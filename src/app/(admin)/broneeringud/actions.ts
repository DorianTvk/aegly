"use server";

import { reportError } from "@/lib/report";

import { refundBooking } from "@/server/stripe";
import { formatEuro } from "@/lib/time";

import { after } from "next/server";
import { appUrl } from "@/lib/app-url";
import { notifyBooking, notifyWaitlist } from "@/server/notify";

import { revalidatePath } from "next/cache";
import { and, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema as s } from "@/db";
import { requireSession } from "@/lib/session";
import { getSlots } from "@/server/availability";
import { quotePrice, checkDiscountCode } from "@/server/pricing";
import { createBooking } from "@/server/bookings";
import { fromMinutes, zonedDateTime } from "@/lib/time";
import type { FormState } from "@/components/ui/form";

/** Halduspaneeli vabad ajad: etteteatamisaeg ei kehti */
export async function adminSlots(serviceId: string, staffId: string | null, isoDate: string) {
  const { business } = await requireSession();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return { slots: [] as { time: string; staffIds: string[] }[], reason: "past" };
  const r = await getSlots(business.id, serviceId, staffId, isoDate, { ignoreLead: true });
  return { slots: r.slots.map((x) => ({ time: fromMinutes(x.start), staffIds: x.staffIds })), reason: r.reason };
}

export async function adminQuote(serviceId: string, staffId: string | null, isoDate: string, time: string, code: string | null, clientEmail: string | null) {
  const { business } = await requireSession();
  let codeInput = null;
  let codeError: string | null = null;
  if (code) {
    const c = await checkDiscountCode(business.id, code, { clientEmail });
    if (c.ok) codeInput = c.code;
    else codeError = c.reason;
  }
  const q = await quotePrice(business.id, { serviceId, staffId, startsAt: zonedDateTime(isoDate, time, business.timezone), code: codeInput });
  if (!q) return null;
  const rejected = { "min-amount": "Ostusumma on alla koodi miinimumi", "not-applicable": "Kood ei kehti sellele teenusele", "not-combinable": "Kampaania soodustus on suurem – kood ei liitu" };
  return { finalCents: q.finalCents, depositCents: q.depositCents, lines: q.lines, codeError: codeError ?? (q.codeRejected ? rejected[q.codeRejected] : null) };
}

const manualSchema = z.object({
  serviceId: z.string().min(1, "Vali teenus"),
  staffId: z.string().nullable(),
  date: z.iso.date(),
  time: z.string().regex(/^\d\d:\d\d$/, "Vali aeg"),
  clientId: z.string().nullable(),
  newClient: z.object({ name: z.string().trim().min(2, "Sisesta kliendi nimi"), email: z.string().trim(), phone: z.string().trim() }).nullable(),
  code: z.string().trim().nullable(),
  priceOverrideCents: z.number().int().min(0).nullable(),
  payment: z.enum(["ON_SITE", "LINK", "PAID"]),
  note: z.string().trim().max(500).nullable(),
});
export type ManualBookingInput = z.infer<typeof manualSchema>;

export async function createManualBooking(input: ManualBookingInput): Promise<FormState & { bookingId?: string }> {
  const { business, user } = await requireSession();
  const parsed = manualSchema.safeParse(input);
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "Kontrolli välju" };
  const d = parsed.data;
  if (user.role === "STAFF" && d.staffId !== user.staffId) return { message: "Töötajana saad broneerida ainult enda kalendrisse." };
  if (!d.clientId && !d.newClient) return { message: "Vali või lisa klient" };
  if (d.newClient && !d.newClient.email && !d.newClient.phone) return { message: "Sisesta kliendi e-post või telefon" };

  const res = await createBooking({
    businessId: business.id,
    serviceId: d.serviceId,
    staffId: d.staffId,
    startsAt: zonedDateTime(d.date, d.time, business.timezone),
    client: d.clientId ? { id: d.clientId } : { name: d.newClient!.name, email: d.newClient!.email || null, phone: d.newClient!.phone || null },
    code: d.code || null,
    source: "ADMIN",
    priceOverrideCents: d.priceOverrideCents,
    ignoreLead: true,
    paid: d.payment === "PAID",
    note: d.note,
  });
  if (!res.ok) return { message: res.reason };
  const base = await appUrl();
  // kinnitus kliendile (kui tal on e-post/telefon); ootab makset → kinnitus hiljem
  if (res.status === "CONFIRMED") after(() => notifyBooking(res.bookingId, "CONFIRMATION", base));
  revalidatePath("/kalender");
  revalidatePath("/toolaud");
  return { ok: true, message: `Broneering ${res.number} loodud.`, bookingId: res.bookingId };
}

// ---------- Broneeringu staatus ----------

const TRANSITIONS: Record<string, string[]> = {
  HELD: ["CONFIRMED", "CANCELLED"],
  PENDING_PAYMENT: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["COMPLETED", "NO_SHOW", "CANCELLED"],
  COMPLETED: ["CONFIRMED"],
  NO_SHOW: ["CONFIRMED", "COMPLETED"],
  CANCELLED: [],
};

export async function setBookingStatus(bookingId: string, status: "CONFIRMED" | "COMPLETED" | "NO_SHOW" | "CANCELLED", reason?: string): Promise<FormState> {
  const { business, user } = await requireSession();
  const b = await db.query.bookings.findFirst({ where: and(eq(s.bookings.id, bookingId), eq(s.bookings.businessId, business.id)) });
  if (!b || (user.role === "STAFF" && b.staffId !== user.staffId)) return { message: "Broneeringut ei leitud" };
  if (!TRANSITIONS[b.status]?.includes(status)) return { message: "Seda muudatust ei saa teha" };
  await db
    .update(s.bookings)
    .set({
      status,
      cancelledAt: status === "CANCELLED" ? new Date() : null,
      cancelReason: status === "CANCELLED" ? (reason?.trim() || "Tühistas salong") : null,
    })
    .where(eq(s.bookings.id, bookingId));
  const base = await appUrl();
  // salong tühistas → veebis tasutud ettemaks tagasi
  let refunded = 0;
  if (status === "CANCELLED") refunded = await refundBooking(bookingId, "Tühistas salong").catch((e) => { reportError("stripe refund", e); return -1; });
  if (status === "CANCELLED" && b.startsAt > new Date()) {
    after(async () => {
      await notifyBooking(bookingId, "CANCELLED", base);
      await notifyWaitlist(bookingId, base);
    });
  }
  if (status === "CONFIRMED" && (b.status === "PENDING_PAYMENT" || b.status === "HELD")) after(() => notifyBooking(bookingId, "CONFIRMATION", base));
  revalidatePath(`/broneeringud/${bookingId}`);
  revalidatePath("/kalender");
  revalidatePath("/toolaud");
  if (refunded < 0) return { ok: true, message: "Broneering tühistatud, kuid ettemaksu tagastamine ebaõnnestus – tagasta see Stripe'i töölaual." };
  if (refunded > 0) return { ok: true, message: `Broneering tühistatud. Ettemaks ${formatEuro(refunded, { decimals: true })} tagastatakse kliendile.` };
  return { ok: true, message: "Staatus muudetud." };
}

export async function saveBookingNote(bookingId: string, note: string): Promise<FormState> {
  const { business, user } = await requireSession();
  const own = user.role === "STAFF" ? eq(s.bookings.staffId, user.staffId ?? "-") : undefined;
  await db.update(s.bookings).set({ note: note.trim() || null }).where(and(eq(s.bookings.id, bookingId), eq(s.bookings.businessId, business.id), own));
  revalidatePath(`/broneeringud/${bookingId}`);
  return { ok: true, message: "Märge salvestatud." };
}

/** Kliendi otsing nime, telefoni või e-posti järgi (käsitsi broneeringu jaoks) */
export async function searchClients(q: string) {
  const { business } = await requireSession();
  const needle = q.trim();
  if (needle.length < 2) return [];
  const like = `%${needle.replace(/[%_]/g, "")}%`;
  const digits = needle.replace(/\D/g, "");
  const rows = await db.query.clients.findMany({
    where: and(
      eq(s.clients.businessId, business.id),
      or(ilike(s.clients.name, like), ilike(s.clients.email, like), digits.length >= 3 ? sql`regexp_replace(coalesce(${s.clients.phone}, ''), '\\D', '', 'g') like ${"%" + digits + "%"}` : sql`false`),
    ),
    limit: 8,
  });
  const visits = rows.length
    ? await db
        .select({ clientId: s.bookings.clientId, n: sql<number>`count(*)`.mapWith(Number) })
        .from(s.bookings)
        .where(and(inArray(s.bookings.clientId, rows.map((r) => r.id)), eq(s.bookings.status, "COMPLETED")))
        .groupBy(s.bookings.clientId)
    : [];
  return rows.map((r) => ({ id: r.id, name: r.name, email: r.email, phone: r.phone, visits: visits.find((v) => v.clientId === r.id)?.n ?? 0 }));
}

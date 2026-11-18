"use server";

import { after } from "next/server";
import { appUrl } from "@/lib/app-url";
import { notifyBooking, notifySalon } from "@/server/notify";
import { smsConfigured } from "@/server/messaging";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema as s } from "@/db";
import { fromMinutes, todayIso, zonedDateTime } from "@/lib/time";
import { getSlots } from "@/server/availability";
import { checkDiscountCode, quotePrice } from "@/server/pricing";
import { createBooking } from "@/server/bookings";
import { findPublicBusiness, firstFree, weekAvailability } from "@/server/widget";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const idStr = z.string().min(1).max(64);

async function ctx(slug: string, serviceId: string) {
  const business = await findPublicBusiness(slug);
  if (!business) return null;
  const service = await db.query.services.findFirst({
    where: and(eq(s.services.id, serviceId), eq(s.services.businessId, business.id), eq(s.services.status, "ACTIVE"), eq(s.services.bookableOnline, true)),
  });
  if (!service) return null;
  return { business, service };
}

/** W4: esimene vaba aeg iga töötaja ja "Ükskõik kes" jaoks */
export async function staffFirstFree(slug: string, serviceId: string, staffIds: string[]) {
  const c = await ctx(slug, idStr.parse(serviceId));
  if (!c) return null;
  const today = todayIso(c.business.timezone);
  const ids = z.array(idStr).max(50).parse(staffIds);
  const [any, ...each] = await Promise.all([firstFree(c.business.id, c.service.id, null, today), ...ids.map((id) => firstFree(c.business.id, c.service.id, id, today))]);
  const fmt = (r: { date: string; start: number } | null) => (r ? { date: r.date, time: fromMinutes(r.start) } : null);
  return { any: fmt(any), staff: Object.fromEntries(ids.map((id, i) => [id, fmt(each[i])])) as Record<string, { date: string; time: string } | null> };
}

/** W5: nädala riba (mis päevadel on vabu aegu) */
export async function weekDays(slug: string, serviceId: string, staffId: string | null, fromIso: string) {
  const c = await ctx(slug, idStr.parse(serviceId));
  if (!c) return [];
  return weekAvailability(c.business.id, c.service.id, staffId ? idStr.parse(staffId) : null, isoDate.parse(fromIso));
}

/** W5 / W5b: päeva vabad ajad; kui päev on täis, järgmine vaba päev */
export async function daySlots(slug: string, serviceId: string, staffId: string | null, date: string) {
  const c = await ctx(slug, idStr.parse(serviceId));
  if (!c) return { slots: [], reason: "closed" as const, next: null };
  const staff = staffId ? idStr.parse(staffId) : null;
  const d = isoDate.parse(date);
  const { slots, reason } = await getSlots(c.business.id, c.service.id, staff, d);
  const names = new Map((await db.query.staffMembers.findMany({ where: eq(s.staffMembers.businessId, c.business.id) })).map((m) => [m.id, m.name]));
  const next = slots.length ? null : await firstFree(c.business.id, c.service.id, staff, d, 30);
  return {
    slots: slots.map((x) => ({ time: fromMinutes(x.start), end: fromMinutes(x.end), staffId: x.staffIds[0], staffName: names.get(x.staffIds[0]) ?? "" })),
    reason: reason ?? null,
    next: next ? { date: next.date, time: fromMinutes(next.start) } : null,
  };
}

const quoteSchema = z.object({
  slug: z.string().max(80),
  serviceId: idStr,
  staffId: idStr,
  date: isoDate,
  time: hhmm,
  code: z.string().trim().max(40).optional(),
  email: z.string().trim().max(200).optional(),
});

/** W6–W7: hind koos sooduskoodiga */
export async function quote(input: z.input<typeof quoteSchema>) {
  const q = quoteSchema.parse(input);
  const c = await ctx(q.slug, q.serviceId);
  if (!c) return { ok: false as const, reason: "Teenust ei leitud" };
  let code = null;
  let codeMessage: string | null = null;
  if (q.code) {
    const check = await checkDiscountCode(c.business.id, q.code, { clientEmail: q.email || null });
    if (check.ok) code = check.code;
    else codeMessage = check.reason;
  }
  const price = await quotePrice(c.business.id, { serviceId: c.service.id, staffId: q.staffId, startsAt: zonedDateTime(q.date, q.time, c.business.timezone), code });
  if (!price) return { ok: false as const, reason: "Hinda ei õnnestunud arvutada" };
  if (code && !price.code) {
    codeMessage = price.codeRejected === "min-amount" ? "Kood nõuab suuremat summat" : price.codeRejected === "not-combinable" ? "Koodi ei saa kampaaniaga kombineerida" : "Kood ei kehti sellele teenusele";
  }
  return {
    ok: true as const,
    lines: price.lines.filter((l) => l.kind !== "info"),
    finalCents: price.finalCents,
    baseCents: price.staffCents,
    depositCents: price.depositCents,
    payOnSiteCents: price.payOnSiteCents,
    code: price.code ? { code: price.code.code, discountCents: price.code.discountCents } : null,
    codeMessage,
  };
}

const bookSchema = quoteSchema.extend({
  name: z.string().trim().min(2, "Sisesta nimi").max(80),
  email: z.email("Sisesta kehtiv e-post"),
  phone: z.string().trim().min(5, "Sisesta telefon").max(30),
  smsReminder: z.boolean(),
  terms: z.literal(true, { error: "Nõustu broneerimistingimustega" }),
});

/** W7 → W8: broneeringu loomine. Maksed lisanduvad hiljem – seni tasutakse ettemaks kohapeal. */
export async function book(input: z.input<typeof bookSchema>) {
  const parsed = bookSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, reason: parsed.error.issues[0]?.message ?? "Kontrolli andmeid" };
  const q = parsed.data;
  const c = await ctx(q.slug, q.serviceId);
  if (!c) return { ok: false as const, reason: "Teenust ei leitud" };
  const res = await createBooking({
    businessId: c.business.id,
    serviceId: c.service.id,
    staffId: q.staffId,
    startsAt: zonedDateTime(q.date, q.time, c.business.timezone),
    client: { name: q.name, email: q.email, phone: q.phone, consentSms: q.smsReminder && smsConfigured() },
    code: q.code || null,
    source: "WIDGET",
    deferPayment: true,
  });
  if (!res.ok) return res;
  const base = await appUrl();
  after(() => Promise.all([res.status === "CONFIRMED" ? notifyBooking(res.bookingId, "CONFIRMATION", base) : null, notifySalon(res.bookingId, "NEW", base)]));
  const b = await db.query.bookings.findFirst({ where: eq(s.bookings.id, res.bookingId) });
  return { ok: true as const, number: res.number, manageToken: b!.manageToken, finalCents: b!.finalPriceCents, depositCents: b!.depositCents };
}

const waitSchema = z.object({ slug: z.string().max(80), serviceId: idStr, staffId: idStr.nullable(), date: isoDate, name: z.string().trim().min(2, "Sisesta nimi").max(80), email: z.email("Sisesta kehtiv e-post") });

/** W5b: ootenimekiri */
export async function joinWaitlist(input: z.input<typeof waitSchema>) {
  const parsed = waitSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, reason: parsed.error.issues[0]?.message ?? "Kontrolli andmeid" };
  const q = parsed.data;
  const c = await ctx(q.slug, q.serviceId);
  if (!c) return { ok: false as const, reason: "Teenust ei leitud" };
  const email = q.email.toLowerCase();
  let client = await db.query.clients.findFirst({ where: and(eq(s.clients.businessId, c.business.id), eq(s.clients.email, email)) });
  if (!client) [client] = await db.insert(s.clients).values({ businessId: c.business.id, name: q.name, email }).returning();
  await db.insert(s.waitlistEntries).values({ businessId: c.business.id, clientId: client.id, serviceId: c.service.id, staffId: q.staffId, date: q.date });
  return { ok: true as const };
}

"use server";

import { logActivity } from "@/server/audit";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { and, eq, gt, inArray, lt, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema as s } from "@/db";
import { requireSession } from "@/lib/session";
import { appUrl } from "@/lib/app-url";
import { formatShortDate, fromMinutes, localDate, localTime, zonedDateTime } from "@/lib/time";
import { notifyBooking } from "@/server/notify";

const input = z.object({
  bookingId: z.string().min(1).max(40),
  staffId: z.string().min(1).max(40),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start: z.number().int().min(0).max(24 * 60 - 5),
  notify: z.boolean(),
});

export type MoveResult = { ok: true; message: string } | { ok: false; message: string };

/** Kalendris lohistamine: uus aeg ja/või töötaja. Kestus jääb samaks. */
export async function moveBooking(raw: z.infer<typeof input>): Promise<MoveResult> {
  const { business, user } = await requireSession();
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Vigane aeg." };
  const { bookingId, staffId, date, start, notify } = parsed.data;
  const tz = business.timezone;

  const b = await db.query.bookings.findFirst({ where: and(eq(s.bookings.id, bookingId), eq(s.bookings.businessId, business.id)) });
  if (!b) return { ok: false, message: "Broneeringut ei leitud." };
  if (!["HELD", "PENDING_PAYMENT", "CONFIRMED"].includes(b.status)) return { ok: false, message: "Tühistatud või lõpetatud broneeringut ei saa liigutada." };

  // töötaja tohib liigutada ainult oma broneeringuid ja ainult oma veerus
  if (user.role === "STAFF" && (b.staffId !== user.staffId || staffId !== b.staffId)) return { ok: false, message: "Saad liigutada ainult oma broneeringuid." };

  if (staffId !== b.staffId) {
    const staff = await db.query.staffMembers.findFirst({ where: and(eq(s.staffMembers.id, staffId), eq(s.staffMembers.businessId, business.id), eq(s.staffMembers.active, true)) });
    if (!staff) return { ok: false, message: "Töötajat ei leitud." };
    // kui teenusel on määratud tegijad, peab uus töötaja nende hulgas olema
    const links = await db.select({ staffId: s.staffServices.staffId }).from(s.staffServices).where(eq(s.staffServices.serviceId, b.serviceId));
    if (links.length && !links.some((l) => l.staffId === staffId)) return { ok: false, message: `${staff.name} ei tee seda teenust. Lisa teenus töötaja juures või vali teine töötaja.` };
  }

  const startsAt = zonedDateTime(date, fromMinutes(start), tz);
  const endsAt = new Date(startsAt.getTime() + (b.endsAt.getTime() - b.startsAt.getTime()));
  if (startsAt.getTime() === b.startsAt.getTime() && staffId === b.staffId) return { ok: true, message: "Muudatusi pole." };

  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${staffId}))`);
      const clash = await tx
        .select({ id: s.bookings.id })
        .from(s.bookings)
        .where(and(ne(s.bookings.id, b.id), eq(s.bookings.staffId, staffId), inArray(s.bookings.status, ["HELD", "PENDING_PAYMENT", "CONFIRMED"]), lt(s.bookings.startsAt, endsAt), gt(s.bookings.endsAt, startsAt)))
        .limit(1);
      if (clash.length) throw new Error("CLASH");
      await tx.update(s.bookings).set({ startsAt, endsAt, staffId }).where(eq(s.bookings.id, b.id));
    });
  } catch (e) {
    if (e instanceof Error && e.message === "CLASH") return { ok: false, message: "Selles ajas on töötajal juba broneering." };
    throw e;
  }

  const timeChanged = startsAt.getTime() !== b.startsAt.getTime();
  if (notify && timeChanged) {
    const base = await appUrl();
    after(() => notifyBooking(b.id, "CHANGED", base));
  }
  revalidatePath("/kalender");
  revalidatePath(`/broneeringud/${b.id}`);
  const when = `${formatShortDate(localDate(startsAt, tz))} ${localTime(startsAt, tz)}`;
  await logActivity({ action: "booking.moved", summary: timeChanged ? `Viis broneeringu ${b.number} uuele ajale: ${when}` : `Vahetas broneeringu ${b.number} töötajat`, target: { type: "booking", id: b.id } });
  return { ok: true, message: timeChanged ? `Broneering viidud: ${when}${notify ? " · klienti teavitatakse" : ""}` : "Töötaja vahetatud." };
}

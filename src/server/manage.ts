import "server-only";
import { releasePrepaid } from "./prepaid";
import { and, eq, gt, inArray, lt, ne, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { localMinutes, zonedDateTime } from "@/lib/time";
import { getSlots } from "./availability";

/** Kliendi iseteeninduse broneering salajase lingi järgi */
export async function loadManaged(token: string) {
  if (!/^[\w-]{10,64}$/.test(token)) return null;
  const b = await db.query.bookings.findFirst({ where: eq(s.bookings.manageToken, token), with: { service: true, staff: true, client: true } });
  if (!b) return null;
  const business = await db.query.businesses.findFirst({ where: eq(s.businesses.id, b.businessId) });
  if (!business) return null;
  const hours = b.service.cancelUntilHours ?? business.cancelUntilHours;
  const deadline = new Date(b.startsAt.getTime() - hours * 3_600_000);
  const active = b.status === "CONFIRMED" || b.status === "PENDING_PAYMENT" || b.status === "HELD";
  const paid = await db.select({ sum: sql<number>`coalesce(sum(${s.payments.amountCents}),0)` }).from(s.payments).where(and(eq(s.payments.bookingId, b.id), eq(s.payments.status, "SUCCEEDED")));
  return {
    booking: b,
    business,
    tz: business.timezone,
    deadline,
    canChange: active && Date.now() < deadline.getTime() && b.startsAt.getTime() > Date.now(),
    paidCents: Number(paid[0]?.sum ?? 0),
  };
}

export async function rescheduleManaged(token: string, isoDate: string, hhmm: string): Promise<{ ok: true; bookingId: string; businessId: string } | { ok: false; reason: string }> {
  const m = await loadManaged(token);
  if (!m) return { ok: false, reason: "Broneeringut ei leitud" };
  if (!m.canChange) return { ok: false, reason: "Seda broneeringut ei saa enam muuta." };
  const { booking: b, tz } = m;
  const startsAt = zonedDateTime(isoDate, hhmm, tz);
  const { slots } = await getSlots(b.businessId, b.serviceId, b.staffId, isoDate);
  const start = localMinutes(startsAt, tz);
  if (!slots.some((x) => x.start === start)) return { ok: false, reason: "See aeg ei ole enam vaba. Vali teine aeg." };
  const endsAt = new Date(startsAt.getTime() + (b.endsAt.getTime() - b.startsAt.getTime()));
  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${b.staffId}))`);
      const clash = await tx
        .select({ id: s.bookings.id })
        .from(s.bookings)
        .where(and(ne(s.bookings.id, b.id), eq(s.bookings.staffId, b.staffId), inArray(s.bookings.status, ["HELD", "PENDING_PAYMENT", "CONFIRMED"]), lt(s.bookings.startsAt, endsAt), gt(s.bookings.endsAt, startsAt)))
        .limit(1);
      if (clash.length) throw new Error("CLASH");
      await tx.update(s.bookings).set({ startsAt, endsAt }).where(eq(s.bookings.id, b.id));
    });
  } catch (e) {
    if (e instanceof Error && e.message === "CLASH") return { ok: false, reason: "See aeg broneeriti just ära. Vali teine aeg." };
    throw e;
  }
  return { ok: true, bookingId: b.id, businessId: b.businessId };
}

export async function cancelManaged(token: string, reason: string | null): Promise<{ ok: true; bookingId: string; businessId: string } | { ok: false; reason: string }> {
  const m = await loadManaged(token);
  if (!m) return { ok: false, reason: "Broneeringut ei leitud" };
  if (!m.canChange) return { ok: false, reason: "Tasuta tühistamise aeg on läbi. Võta ühendust teenusepakkujaga." };
  await db.update(s.bookings).set({ status: "CANCELLED", cancelledAt: new Date(), cancelReason: reason ? `Klient: ${reason}` : "Klient tühistas" }).where(eq(s.bookings.id, m.booking.id));
  await releasePrepaid(m.booking.id);
  return { ok: true, bookingId: m.booking.id, businessId: m.booking.businessId };
}


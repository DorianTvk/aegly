import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { and, asc, eq, gte, inArray, lt } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireSession } from "@/lib/session";
import { addDaysIso, localTime, todayIso, zonedDateTime } from "@/lib/time";
import { Card } from "@/components/ui/primitives";
import { ReceptionView, type ReceptionBooking } from "./ReceptionView";

export const metadata: Metadata = { title: "Vastuvõtt" };

/** Tänased kliendid vastuvõtu jaoks (tahvel letil): suured nupud, automaatne värskendus */
async function Reception() {
  await connection();
  const { business: b, user } = await requireSession();
  const tz = b.timezone;
  const today = todayIso(tz);
  const from = zonedDateTime(today, "00:00", tz);
  const to = zonedDateTime(addDaysIso(today, 1), "00:00", tz);
  const rows = await db
    .select({
      bk: s.bookings,
      client: { name: s.clients.name, phone: s.clients.phone, email: s.clients.email },
      service: s.services.name,
      staff: s.staffMembers.name,
      staffColor: s.staffMembers.color,
    })
    .from(s.bookings)
    .innerJoin(s.clients, eq(s.clients.id, s.bookings.clientId))
    .innerJoin(s.services, eq(s.services.id, s.bookings.serviceId))
    .innerJoin(s.staffMembers, eq(s.staffMembers.id, s.bookings.staffId))
    .where(
      and(
        eq(s.bookings.businessId, b.id),
        gte(s.bookings.startsAt, from),
        lt(s.bookings.startsAt, to),
        inArray(s.bookings.status, ["HELD", "PENDING_PAYMENT", "CONFIRMED", "COMPLETED", "NO_SHOW"]),
        // töötaja näeb ainult oma kliente
        user.role === "STAFF" && user.staffId ? eq(s.bookings.staffId, user.staffId) : undefined,
      ),
    )
    .orderBy(asc(s.bookings.startsAt));
  const ids = rows.map((r) => r.bk.id);
  const paid = ids.length
    ? await db.select({ bookingId: s.payments.bookingId, amount: s.payments.amountCents }).from(s.payments).where(and(inArray(s.payments.bookingId, ids), eq(s.payments.status, "SUCCEEDED")))
    : [];
  const paidBy = new Map<string, number>();
  for (const p of paid) if (p.bookingId) paidBy.set(p.bookingId, (paidBy.get(p.bookingId) ?? 0) + p.amount);

  const bookings: ReceptionBooking[] = rows.map(({ bk, client, service, staff, staffColor }) => {
    const paidCents = paidBy.get(bk.id) ?? 0;
    return {
      id: bk.id,
      number: bk.number,
      startsAt: bk.startsAt.toISOString(),
      endsAt: bk.endsAt.toISOString(),
      time: `${localTime(bk.startsAt, tz)}–${localTime(bk.endsAt, tz)}`,
      status: bk.status,
      clientName: client.name,
      phone: client.phone,
      service,
      staff,
      staffColor,
      note: bk.note,
      package: !!bk.clientPackageId || bk.priceBreakdown.some((l) => l.kind === "package"),
      giftCents: bk.giftCardCents,
      // kohapeal tasuda: hind − kinkekaart − juba makstud (ettemaks)
      dueCents: Math.max(0, bk.finalPriceCents - bk.giftCardCents - paidCents),
      paidCents,
    };
  });
  return <ReceptionView bookings={bookings} today={today} canSeeAll={user.role !== "STAFF"} />;
}

export default function ReceptionPage() {
  return (
    <Suspense fallback={<Card className="h-[480px] animate-pulse" />}>
      <Reception />
    </Suspense>
  );
}

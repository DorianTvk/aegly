import "server-only";
import { and, count, desc, eq, gt } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { formatShortDate, localDate, localTime } from "@/lib/time";

export type ActivityKind = "BOOKING_NEW" | "BOOKING_CHANGED" | "BOOKING_CANCELLED" | "WAITLIST" | "WIDGET_INSTALLED" | "SHOP_GIFT" | "SHOP_PACKAGE";

const TITLES: Record<ActivityKind, string> = {
  BOOKING_NEW: "Uus broneering veebist",
  BOOKING_CHANGED: "Klient muutis aega",
  BOOKING_CANCELLED: "Klient tühistas broneeringu",
  WAITLIST: "Uus ootenimekirjas",
  WIDGET_INSTALLED: "Vidin on kodulehel kasutusel",
  SHOP_GIFT: "Kinkekaart müüdud veebis",
  SHOP_PACKAGE: "Pakett müüdud veebis",
};

/** Lisa sündmus kellukese voogu. Broneeringu puhul koostatakse kirjeldus broneeringu andmetest. */
export async function recordActivity(businessId: string, kind: ActivityKind, opts: { bookingId?: string; body?: string } = {}) {
  let body = opts.body ?? null;
  if (opts.bookingId) {
    const bk = await db.query.bookings.findFirst({ where: eq(s.bookings.id, opts.bookingId), with: { client: true, service: true, staff: true } });
    const biz = await db.query.businesses.findFirst({ where: eq(s.businesses.id, businessId), columns: { timezone: true } });
    if (bk && biz) {
      body = `${bk.client.name} · ${bk.service.name} · ${formatShortDate(localDate(bk.startsAt, biz.timezone))} kell ${localTime(bk.startsAt, biz.timezone)} · ${bk.staff.name}`;
    }
  }
  await db.insert(s.activityEvents).values({ businessId, kind, bookingId: opts.bookingId ?? null, title: TITLES[kind], body });
}

export async function activityFeed(businessId: string, seenAt: Date | null) {
  const [items, [unread]] = await Promise.all([
    db.query.activityEvents.findMany({ where: eq(s.activityEvents.businessId, businessId), orderBy: [desc(s.activityEvents.createdAt)], limit: 20 }),
    db
      .select({ n: count() })
      .from(s.activityEvents)
      .where(seenAt ? and(eq(s.activityEvents.businessId, businessId), gt(s.activityEvents.createdAt, seenAt)) : eq(s.activityEvents.businessId, businessId)),
  ]);
  return { items, unread: unread.n };
}

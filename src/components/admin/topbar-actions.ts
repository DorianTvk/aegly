"use server";

import { and, desc, eq, ilike, or } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireSession } from "@/lib/session";
import { formatShortDate, localDate, localTime } from "@/lib/time";
import { activityFeed } from "@/server/activity";

export type SearchResult = { type: "client" | "booking"; id: string; title: string; subtitle: string; href: string };

/** Ülariba otsing: kliendid (nimi, e-post, telefon) ja broneeringud (number, kliendi nimi) */
export async function searchAll(raw: string): Promise<SearchResult[]> {
  const { business } = await requireSession();
  const q = raw.trim().slice(0, 60);
  if (q.length < 2) return [];
  const like = `%${q.replace(/[%_\\]/g, (c) => "\\" + c)}%`;
  const [clients, bookings] = await Promise.all([
    db.query.clients.findMany({
      where: and(eq(s.clients.businessId, business.id), or(ilike(s.clients.name, like), ilike(s.clients.email, like), ilike(s.clients.phone, like))),
      limit: 6,
    }),
    db
      .select({ id: s.bookings.id, number: s.bookings.number, startsAt: s.bookings.startsAt, client: s.clients.name, service: s.services.name })
      .from(s.bookings)
      .innerJoin(s.clients, eq(s.clients.id, s.bookings.clientId))
      .innerJoin(s.services, eq(s.services.id, s.bookings.serviceId))
      .where(and(eq(s.bookings.businessId, business.id), or(ilike(s.bookings.number, like), ilike(s.clients.name, like))))
      .orderBy(desc(s.bookings.startsAt))
      .limit(6),
  ]);
  const tz = business.timezone;
  return [
    ...clients.map((c) => ({ type: "client" as const, id: c.id, title: c.name, subtitle: [c.email, c.phone].filter(Boolean).join(" · ") || "Klient", href: `/kliendid/${c.id}` })),
    ...bookings.map((b) => ({
      type: "booking" as const, id: b.id, title: `${b.number} · ${b.client}`,
      subtitle: `${b.service} · ${formatShortDate(localDate(b.startsAt, tz))} kell ${localTime(b.startsAt, tz)}`, href: `/broneeringud/${b.id}`,
    })),
  ];
}

export async function loadNotifications() {
  const { business, user } = await requireSession();
  const feed = await activityFeed(business.id, user.notificationsSeenAt);
  return {
    unread: feed.unread,
    seenAt: user.notificationsSeenAt?.toISOString() ?? null,
    items: feed.items.map((i) => ({ id: i.id, kind: i.kind, title: i.title, body: i.body, bookingId: i.bookingId, at: i.createdAt.toISOString() })),
  };
}

export async function markNotificationsSeen() {
  const { user } = await requireSession();
  await db.update(s.users).set({ notificationsSeenAt: new Date() }).where(eq(s.users.id, user.id));
}

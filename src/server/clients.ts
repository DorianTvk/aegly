import "server-only";
import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";

export type ClientRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  createdAt: Date;
  birthday: string | null;
  visits: number;
  firstVisit: Date | null;
  lastVisit: Date | null;
  nextVisit: Date | null;
  spentCents: number;
  noShows: number;
  noShows90: number;
  cancellations: number;
  packageLeft: number;
  packageTotal: number;
  giftBalanceCents: number;
  tags: string[];
};

/** Kõik kliendid koos koondnäitajatega (üks päring broneeringutele) */
export async function listClients(businessId: string): Promise<ClientRow[]> {
  const ninetyAgo = new Date(Date.now() - 90 * 86_400_000);
  const now = new Date();
  const [clients, agg, pkgs, gifts] = await Promise.all([
    db.query.clients.findMany({ where: eq(s.clients.businessId, businessId), orderBy: [asc(s.clients.name)] }),
    db
      .select({
        clientId: s.bookings.clientId,
        visits: sql<number>`count(*) filter (where ${s.bookings.status} = 'COMPLETED')`.mapWith(Number),
        firstVisit: sql<Date | null>`min(${s.bookings.startsAt}) filter (where ${s.bookings.status} = 'COMPLETED')`.mapWith((v) => (v ? new Date(v) : null)),
        lastVisit: sql<Date | null>`max(${s.bookings.startsAt}) filter (where ${s.bookings.status} = 'COMPLETED')`.mapWith((v) => (v ? new Date(v) : null)),
        nextVisit: sql<Date | null>`min(${s.bookings.startsAt}) filter (where ${s.bookings.startsAt} >= ${now} and ${s.bookings.status} in ('CONFIRMED','PENDING_PAYMENT','HELD'))`.mapWith((v) => (v ? new Date(v) : null)),
        spent: sql<number>`coalesce(sum(${s.bookings.finalPriceCents}) filter (where ${s.bookings.status} = 'COMPLETED'), 0)`.mapWith(Number),
        noShows: sql<number>`count(*) filter (where ${s.bookings.status} = 'NO_SHOW')`.mapWith(Number),
        noShows90: sql<number>`count(*) filter (where ${s.bookings.status} = 'NO_SHOW' and ${s.bookings.startsAt} >= ${ninetyAgo})`.mapWith(Number),
        cancellations: sql<number>`count(*) filter (where ${s.bookings.status} = 'CANCELLED')`.mapWith(Number),
      })
      .from(s.bookings)
      .where(eq(s.bookings.businessId, businessId))
      .groupBy(s.bookings.clientId),
    db
      .select({ clientId: s.clientPackages.clientId, left: s.clientPackages.usesLeft, total: s.clientPackages.usesTotal, expiresAt: s.clientPackages.expiresAt })
      .from(s.clientPackages)
      .innerJoin(s.clients, eq(s.clients.id, s.clientPackages.clientId))
      .where(eq(s.clients.businessId, businessId)),
    db.query.giftCards.findMany({ where: and(eq(s.giftCards.businessId, businessId), gte(s.giftCards.expiresAt, now)) }),
  ]);
  const byClient = new Map(agg.map((a) => [a.clientId, a]));
  return clients.map((c) => {
    const a = byClient.get(c.id);
    const own = pkgs.filter((p) => p.clientId === c.id && p.left > 0 && (!p.expiresAt || p.expiresAt > now));
    const gift = c.email ? gifts.filter((g) => g.recipientEmail?.toLowerCase() === c.email!.toLowerCase()).reduce((x, g) => x + g.balanceCents, 0) : 0;
    return {
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      createdAt: c.createdAt,
      birthday: c.birthday,
      visits: a?.visits ?? 0,
      firstVisit: a?.firstVisit ?? null,
      lastVisit: a?.lastVisit ?? null,
      nextVisit: a?.nextVisit ?? null,
      spentCents: a?.spent ?? 0,
      noShows: a?.noShows ?? 0,
      noShows90: a?.noShows90 ?? 0,
      cancellations: a?.cancellations ?? 0,
      packageLeft: own.reduce((x, p) => x + p.left, 0),
      packageTotal: own.reduce((x, p) => x + p.total, 0),
      giftBalanceCents: gift,
      tags: c.tags,
    };
  });
}

export async function getClient(businessId: string, clientId: string) {
  const client = await db.query.clients.findFirst({ where: and(eq(s.clients.id, clientId), eq(s.clients.businessId, businessId)) });
  if (!client) return null;
  const [bookings, packages, gifts] = await Promise.all([
    db
      .select({ b: s.bookings, service: s.services.name, staff: s.staffMembers.name })
      .from(s.bookings)
      .innerJoin(s.services, eq(s.services.id, s.bookings.serviceId))
      .innerJoin(s.staffMembers, eq(s.staffMembers.id, s.bookings.staffId))
      .where(eq(s.bookings.clientId, clientId))
      .orderBy(desc(s.bookings.startsAt)),
    db.query.clientPackages.findMany({ where: eq(s.clientPackages.clientId, clientId), with: { package: true } }),
    client.email
      ? db.query.giftCards.findMany({ where: and(eq(s.giftCards.businessId, businessId), sql`lower(${s.giftCards.recipientEmail}) = ${client.email.toLowerCase()}`) })
      : Promise.resolve([]),
  ]);
  return { client, bookings, packages, gifts };
}

/** Mitteilmumise kaitse: kas kliendilt tuleb nõuda 100% ettemaksu */
export function requiresFullPrepayment(noShows12m: number, threshold: number, enabled: boolean, exempt: boolean) {
  return enabled && !exempt && noShows12m >= threshold;
}

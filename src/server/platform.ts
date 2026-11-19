import "server-only";
import { and, count, desc, eq, gte, max } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { isSuperadmin, PLANS } from "@/lib/plans";
import { addDaysIso, todayIso, zonedDateTime } from "@/lib/time";
import { reportError } from "@/lib/report";
import { billingEnabled } from "./billing";
import { stripe } from "./stripe";

const TZ = "Europe/Tallinn";

/** Paketi kuutulu sentides (ilma km); aastapakett jagatakse 12-ga */
export const monthlyValue = (b: { plan: keyof typeof PLANS; billingPeriod: "MONTH" | "YEAR" }) =>
  b.billingPeriod === "YEAR" ? Math.round(PLANS[b.plan].yearlyCents / 12) : PLANS[b.plan].monthlyCents;

/**
 * Kõik platvormi kliendid (salongid), v.a platvormi haldurite enda (demo)salongid.
 * "Maksev" = aktiivne Stripe'i tellimus; "Tasuta" = käsitsi aktiivseks pandud, tellimuseta.
 */
export async function platformClients() {
  const since30 = zonedDateTime(addDaysIso(todayIso(TZ), -30), "00:00", TZ);
  const [businesses, owners, staff, bookings30, lastBooking] = await Promise.all([
    db.select().from(s.businesses).orderBy(desc(s.businesses.createdAt)),
    db.select({ id: s.users.businessId, email: s.users.email, name: s.users.name }).from(s.users).where(eq(s.users.role, "OWNER")),
    db.select({ id: s.staffMembers.businessId, n: count() }).from(s.staffMembers).where(eq(s.staffMembers.active, true)).groupBy(s.staffMembers.businessId),
    db.select({ id: s.bookings.businessId, n: count() }).from(s.bookings).where(gte(s.bookings.createdAt, since30)).groupBy(s.bookings.businessId),
    db.select({ id: s.bookings.businessId, at: max(s.bookings.createdAt) }).from(s.bookings).groupBy(s.bookings.businessId),
  ]);
  const ownerBy = new Map(owners.map((o) => [o.id, o]));
  const n = (rows: { id: string; n: number }[]) => new Map(rows.map((r) => [r.id, r.n]));
  const staffBy = n(staff);
  const b30 = n(bookings30);
  const lastBy = new Map(lastBooking.map((r) => [r.id, r.at]));

  return businesses
    .filter((b) => !isSuperadmin(ownerBy.get(b.id)?.email ?? ""))
    .map((b) => {
      const paying = b.planStatus === "ACTIVE" && !!b.stripeSubscriptionId;
      const comp = b.planStatus === "ACTIVE" && !b.stripeSubscriptionId;
      return {
        b,
        owner: ownerBy.get(b.id) ?? null,
        staff: staffBy.get(b.id) ?? 0,
        bookings30: b30.get(b.id) ?? 0,
        lastBookingAt: lastBy.get(b.id) ?? null,
        paying,
        comp,
        mrrCents: paying || b.planStatus === "PAST_DUE" ? monthlyValue(b) : 0,
      };
    });
}

export type PlatformClient = Awaited<ReturnType<typeof platformClients>>[number];

/** Viimase 6 kuu laekumised Stripe'ist (tasutud arved, ilma km) */
export async function revenueByMonth(months = 6): Promise<{ month: string; netCents: number; grossCents: number; count: number }[] | null> {
  if (!billingEnabled()) return null;
  const now = new Date();
  const keys = Array.from({ length: months }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1 - i), 1));
    return d.toISOString().slice(0, 7);
  });
  const from = Math.floor(new Date(`${keys[0]}-01T00:00:00Z`).getTime() / 1000);
  const out = new Map(keys.map((k) => [k, { month: k, netCents: 0, grossCents: 0, count: 0 }]));
  try {
    for await (const inv of stripe().invoices.list({ status: "paid", created: { gte: from }, limit: 100 })) {
      // ainult Aegly tellimuste arved (mitte nt salongide Connect-kontode omad – need siia ei jõuagi)
      const key = new Date((inv.status_transitions?.paid_at ?? inv.created) * 1000).toISOString().slice(0, 7);
      const row = out.get(key);
      if (!row) continue;
      const tax = (inv.total_taxes ?? []).reduce((sum, t) => sum + t.amount, 0);
      row.grossCents += inv.amount_paid;
      row.netCents += inv.amount_paid - tax;
      row.count += 1;
    }
  } catch (e) {
    reportError("platform revenue", e);
    return null;
  }
  return [...out.values()];
}

/** Platvormi kasutus viimase 30 päeva jooksul */
export async function platformUsage(excludeBusinessIds: string[]) {
  const since30 = zonedDateTime(addDaysIso(todayIso(TZ), -30), "00:00", TZ);
  const rows = await db
    .select({ source: s.bookings.source, businessId: s.bookings.businessId, n: count() })
    .from(s.bookings)
    .where(and(gte(s.bookings.createdAt, since30)))
    .groupBy(s.bookings.source, s.bookings.businessId);
  const skip = new Set(excludeBusinessIds);
  const own = rows.filter((r) => !skip.has(r.businessId));
  const total = own.reduce((a, r) => a + r.n, 0);
  const widget = own.filter((r) => r.source === "WIDGET").reduce((a, r) => a + r.n, 0);
  return { total, widget };
}

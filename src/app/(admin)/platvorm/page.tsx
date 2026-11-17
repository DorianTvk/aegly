import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { count, desc, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireSession } from "@/lib/session";
import { isSuperadmin, PLAN_IDS, PLANS } from "@/lib/plans";
import { formatEuro } from "@/lib/time";
import { Card, PageHeader } from "@/components/ui/primitives";
import { BusinessRow } from "./BusinessRow";

export const metadata: Metadata = { title: "Platvorm" };

async function Platform() {
  const { user } = await requireSession();
  if (!isSuperadmin(user.email)) notFound();

  const [businesses, staff, bookings, owners] = await Promise.all([
    db.select().from(s.businesses).orderBy(desc(s.businesses.createdAt)),
    db.select({ id: s.staffMembers.businessId, n: count() }).from(s.staffMembers).where(eq(s.staffMembers.active, true)).groupBy(s.staffMembers.businessId),
    db.select({ id: s.bookings.businessId, n: count() }).from(s.bookings).groupBy(s.bookings.businessId),
    db.select({ id: s.users.businessId, email: s.users.email }).from(s.users).where(eq(s.users.role, "OWNER")),
  ]);
  const by = (rows: { id: string; n: number }[]) => new Map(rows.map((r) => [r.id, r.n]));
  const staffBy = by(staff);
  const bookingsBy = by(bookings);
  const ownerBy = new Map(owners.map((o) => [o.id, o.email]));

  const active = businesses.filter((b) => b.planStatus === "ACTIVE");
  const mrr = active.reduce((sum, b) => sum + (b.billingPeriod === "YEAR" ? PLANS[b.plan].yearlyCents / 12 : PLANS[b.plan].monthlyCents), 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Card className="p-5">
          <p className="text-[13px] text-muted">Salonge</p>
          <p className="mt-2 text-[24px] font-bold">{businesses.length}</p>
        </Card>
        <Card className="p-5">
          <p className="text-[13px] text-muted">Kuutulu (aktiivsed, ilma km)</p>
          <p className="mt-2 text-[24px] font-bold">{formatEuro(Math.round(mrr))}</p>
        </Card>
        {PLAN_IDS.map((p) => (
          <Card key={p} className="p-5">
            <p className="text-[13px] text-muted">{PLANS[p].name}</p>
            <p className="mt-2 text-[24px] font-bold">{businesses.filter((b) => b.plan === p).length}</p>
          </Card>
        ))}
      </div>

      <div className="overflow-x-auto rounded-[14px] border border-line bg-white shadow-[var(--shadow-card)]">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-[#f9fafb] text-left text-xs font-semibold tracking-[0.3px] text-[#475467] uppercase">
            <tr>
              <th className="py-3 pl-5">Salong</th>
              <th className="py-3">Pakett</th>
              <th className="py-3">Arveldus</th>
              <th className="py-3">Staatus</th>
              <th className="py-3">Töötajad</th>
              <th className="py-3">Broneeringud</th>
              <th className="py-3">Loodud</th>
              <th className="py-3 pr-5" />
            </tr>
          </thead>
          <tbody>
            {businesses.map((b) => (
              <BusinessRow
                key={b.id}
                b={{
                  id: b.id,
                  name: b.name,
                  slug: b.slug,
                  plan: b.plan,
                  period: b.billingPeriod,
                  status: b.planStatus,
                  staff: staffBy.get(b.id) ?? 0,
                  bookings: bookingsBy.get(b.id) ?? 0,
                  owner: ownerBy.get(b.id) ?? "—",
                  created: b.createdAt.toLocaleDateString("et-EE", { timeZone: "Europe/Tallinn" }),
                }}
              />
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">Siin muudetud pakett ei kontrolli töötajate piiri ega tee makseid. Platvormi haldurid määrab keskkonnamuutuja SUPERADMIN_EMAILS.</p>
    </div>
  );
}

export default function PlatformPage() {
  return (
    <div className="space-y-5">
      <PageHeader title="Platvorm" subtitle="Kõik Aegly salongid, nende paketid ja makseseis." />
      <Suspense fallback={<Card className="h-[480px] animate-pulse" />}>
        <Platform />
      </Suspense>
    </div>
  );
}

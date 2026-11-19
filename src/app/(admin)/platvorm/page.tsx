import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { count, desc, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireSession } from "@/lib/session";
import { isSuperadmin, PLAN_IDS, PLANS } from "@/lib/plans";
import { formatEuro } from "@/lib/time";
import { Card, PageHeader } from "@/components/ui/primitives";
import { PlatformTable } from "./PlatformTable";

export const metadata: Metadata = { title: "Platvorm" };

async function Platform() {
  const { user, business: own } = await requireSession();
  if (!isSuperadmin(user.email)) notFound();
  const ownBusinessId = own.id;

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
      <PageHeader
        title="Platvorm"
        subtitle="Kõik Aegly salongid, nende paketid ja makseseis."
        actions={
          process.env.NEXT_PUBLIC_SENTRY_DSN ? (
            <a href="/api/sentry-test" target="_blank" rel="noreferrer" className="inline-flex h-9 items-center rounded-[10px] border border-line bg-white px-3 text-[13px] font-semibold hover:bg-line-soft">
              Saada Sentryle testviga
            </a>
          ) : (
            <span className="text-xs text-muted">Sentry seadistamata</span>
          )
        }
      />
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

      <PlatformTable
        ownBusinessId={ownBusinessId}
        rows={businesses.map((b) => ({
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
          protected: b.id === ownBusinessId || isSuperadmin(ownerBy.get(b.id) ?? ""),
        }))}
      />
      <p className="text-xs text-muted">Siin muudetud pakett ei kontrolli töötajate piiri ega tee makseid. Platvormi haldurid määrab keskkonnamuutuja SUPERADMIN_EMAILS.</p>
    </div>
  );
}

export default function PlatformPage() {
  return (
    <div className="space-y-5">
      <Suspense fallback={<Card className="h-[480px] animate-pulse" />}>
        <Platform />
      </Suspense>
    </div>
  );
}

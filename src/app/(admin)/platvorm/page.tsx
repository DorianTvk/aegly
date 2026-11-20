import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { AlertTriangle, ArrowRight, Eye } from "lucide-react";
import { Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { PLAN_IDS, PLAN_STATUS_LABEL, PLANS } from "@/lib/plans";
import { formatEuro } from "@/lib/time";
import { platformClients, platformUsage, revenueByMonth } from "@/server/platform";
import { isSuperadmin } from "@/lib/plans";
import { db, schema as s } from "@/db";
import { eq } from "drizzle-orm";

export const metadata: Metadata = { title: "Platvorm" };

const MONTH = ["jaan", "veebr", "märts", "apr", "mai", "juuni", "juuli", "aug", "sept", "okt", "nov", "dets"];
const eur = (c: number) => formatEuro(Math.round(c));

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="p-5">
      <p className="text-[13px] text-muted">{label}</p>
      <p className="mt-2 text-[24px] font-bold tracking-[-0.3px]">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </Card>
  );
}

async function Overview() {
  await connection(); // päringuaegsed andmed (kuupäevad, Stripe)
  const clients = await platformClients();
  const owners = await db.select({ id: s.users.businessId, email: s.users.email }).from(s.users).where(eq(s.users.role, "OWNER"));
  const ownIds = owners.filter((o) => isSuperadmin(o.email)).map((o) => o.id);
  const [revenue, usage] = await Promise.all([revenueByMonth(6), platformUsage(ownIds)]);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const paying = clients.filter((c) => c.paying);
  const mrr = paying.reduce((a, c) => a + c.mrrCents, 0);
  const newThisMonth = clients.filter((c) => c.b.createdAt >= monthStart).length;
  const attention = clients.filter((c) => c.b.planStatus === "PAST_DUE" || c.b.planStatus === "PENDING");
  const comp = clients.filter((c) => c.comp);
  const churned = clients.filter((c) => c.b.planStatus === "SUSPENDED");
  const thisMonth = revenue?.at(-1);
  const maxRev = Math.max(1, ...(revenue ?? []).map((r) => r.netCents));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Kuutulu (MRR, ilma km)" value={eur(mrr)} sub={`Aastas ${eur(mrr * 12)}`} />
        <Kpi label="Maksvad kliendid" value={String(paying.length)} sub={comp.length ? `+ ${comp.length} tasuta (käsitsi)` : `kokku ${clients.length} kontot`} />
        <Kpi label="Laekunud sel kuul" value={thisMonth ? eur(thisMonth.netCents) : "—"} sub={thisMonth ? `${thisMonth.count} arvet · km-ga ${eur(thisMonth.grossCents)}` : "Stripe seadistamata"} />
        <Kpi label="Uued kliendid sel kuul" value={String(newThisMonth)} sub={churned.length ? `${churned.length} lõpetanud kokku` : undefined} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Laekumised Stripe'ist" subtitle="Tasutud Aegly arved kuude kaupa, ilma käibemaksuta" />
          {revenue ? (
            <div className="p-5">
              <div className="flex h-[180px] items-end gap-3" role="list" aria-label="Laekumised kuude kaupa">
                {revenue.map((r) => (
                  <div key={r.month} role="listitem" className="flex flex-1 flex-col items-center gap-1.5" title={`${eur(r.netCents)} · ${r.count} arvet`}>
                    <span className="text-[11px] font-semibold text-muted">{r.netCents ? eur(r.netCents) : ""}</span>
                    <div className="w-full max-w-[48px] rounded-t-[4px] bg-lime" style={{ height: `${Math.max(2, (r.netCents / maxRev) * 140)}px` }} />
                    <span className="text-xs text-muted">{MONTH[Number(r.month.slice(5, 7)) - 1]}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="p-5 text-sm text-muted">Stripe pole seadistatud või andmeid ei õnnestunud laadida.</p>
          )}
        </Card>

        <Card>
          <CardHeader title="Paketid" subtitle="Maksvad kliendid paketi järgi" />
          <ul className="space-y-3 p-5 text-sm">
            {PLAN_IDS.map((p) => {
              const n = paying.filter((c) => c.b.plan === p).length;
              return (
                <li key={p}>
                  <div className="flex justify-between">
                    <span className="font-medium">{PLANS[p].name}</span>
                    <span className="text-muted">
                      {n} · {eur(paying.filter((c) => c.b.plan === p).reduce((a, c) => a + c.mrrCents, 0))}/kuu
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 rounded-full bg-line-soft">
                    <div className="h-2 rounded-full bg-ink" style={{ width: `${paying.length ? (n / paying.length) * 100 : 0}%` }} />
                  </div>
                </li>
              );
            })}
            <li className="border-t border-line-soft pt-3 text-xs text-muted">
              Aastamakse: {paying.filter((c) => c.b.billingPeriod === "YEAR").length} · kuumakse: {paying.filter((c) => c.b.billingPeriod === "MONTH").length}
            </li>
          </ul>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Vajavad tähelepanu" subtitle="Makse ootel või pakett aktiveerimata" />
          {attention.length ? (
            <ul className="divide-y divide-line-soft">
              {attention.slice(0, 8).map((c) => (
                <li key={c.b.id}>
                  <Link href={`/platvorm/${c.b.id}`} className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-line-soft/50">
                    <AlertTriangle size={16} className={c.b.planStatus === "PAST_DUE" ? "text-[#dc6803]" : "text-subtle"} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{c.b.name}</span>
                      <span className="block truncate text-xs text-muted">{c.owner?.email}</span>
                    </span>
                    <span className="text-xs text-muted">{PLAN_STATUS_LABEL[c.b.planStatus]}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-5 text-sm text-muted">Kõik korras – makseprobleeme pole.</p>
          )}
        </Card>

        <Card>
          <CardHeader title="Viimased liitujad" action={<Link href="/platvorm/kliendid" className="inline-flex items-center gap-1 text-[13px] font-semibold">Kõik kliendid <ArrowRight size={14} /></Link>} />
          {clients.length ? (
            <ul className="divide-y divide-line-soft">
              {clients.slice(0, 6).map((c) => (
                <li key={c.b.id}>
                  <Link href={`/platvorm/${c.b.id}`} className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-line-soft/50">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{c.b.name}</span>
                      <span className="block truncate text-xs text-muted">
                        {PLANS[c.b.plan].name} · {c.b.createdAt.toLocaleDateString("et-EE", { timeZone: "Europe/Tallinn" })}
                      </span>
                    </span>
                    <span className="text-xs text-muted">{PLAN_STATUS_LABEL[c.b.planStatus]}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-5 text-sm text-muted">Kliente veel pole.</p>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Broneeringuid 30 päevaga" value={String(usage.total)} sub="kõigil klientidel kokku" />
        <Kpi label="Neist vidinast" value={usage.total ? `${Math.round((usage.widget / usage.total) * 100)}%` : "—"} sub={`${usage.widget} broneeringut`} />
        <Kpi label="Aktiivsed kliendid 30 p" value={String(clients.filter((c) => c.bookings30 > 0).length)} sub="vähemalt üks broneering" />
        <Kpi label="Töötajaid kokku" value={String(clients.reduce((a, c) => a + c.staff, 0))} sub="aktiivsed profiilid" />
      </div>
    </div>
  );
}

export default function PlatformPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Platvorm"
        subtitle="Aegly kliendid, tulu ja kasutus. Sinu enda demokonto ei ole siinsetes arvudes."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <a href="/api/vaade?m=salon" className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-line bg-white px-3 text-[13px] font-semibold hover:bg-line-soft">
              <Eye size={15} /> Kliendi vaade (demo)
            </a>
            {process.env.NEXT_PUBLIC_SENTRY_DSN ? (
              <a href="/api/sentry-test" target="_blank" rel="noreferrer" className="inline-flex h-9 items-center rounded-[10px] border border-line bg-white px-3 text-[13px] font-semibold hover:bg-line-soft">
                Saada Sentryle testviga
              </a>
            ) : null}
          </div>
        }
      />
      <Suspense fallback={<Card className="h-[480px] animate-pulse" />}>
        <Overview />
      </Suspense>
    </div>
  );
}

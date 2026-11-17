import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { and, eq, inArray } from "drizzle-orm";
import { Download } from "lucide-react";
import { db, schema as s } from "@/db";
import { clsx } from "clsx";
import { getCurrentBusiness } from "@/lib/tenant";
import { periodRange, periodReport, type Period } from "@/server/reports";
import { addDaysIso, formatEuro, isoWeekday, localDate, localMinutes, todayIso } from "@/lib/time";
import { Avatar } from "@/components/ui/Avatar";
import { Card, CardHeader, Delta, PageHeader } from "@/components/ui/primitives";
import { Heatmap, RevenueBars } from "./Charts";

export const metadata: Metadata = { title: "Aruanded" };

const PERIODS: { key: Period; label: string }[] = [
  { key: "week", label: "Nädal" },
  { key: "month", label: "Kuu" },
  { key: "quarter", label: "Kvartal" },
  { key: "year", label: "Aasta" },
];

const pct = (a: number, b: number) => (b ? `${a >= b ? "+" : "−"}${Math.abs(Math.round(((a - b) / b) * 100))}%` : "—");
const pp = (a: number, b: number) => `${a >= b ? "+" : "−"}${Math.abs(Math.round((a - b) * 1000) / 10)}%`.replace(".", ",");

function Kpi({ label, value, delta, invert }: { label: string; value: string; delta: string; invert?: boolean }) {
  const shown = invert && delta !== "—" ? (delta.startsWith("+") ? delta.replace("+", "−") : delta.replace("−", "+")) : delta;
  return (
    <Card className="p-4">
      <p className="text-[13px] text-muted">{label}</p>
      <div className="mt-2 flex items-center gap-2">
        <p className="text-[22px] font-bold tracking-[-0.3px]">{value}</p>
        {delta !== "—" && <Delta value={shown} />}
      </div>
    </Card>
  );
}

async function Report({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const sp = await searchParams;
  const period = (PERIODS.find((x) => x.key === sp.p)?.key ?? "month") as Period;
  const business = await getCurrentBusiness();
  const tz = business.timezone;
  const today = todayIso(tz);
  const cur = periodRange(period, today);
  const prev = periodRange(period, today, -1);
  const [r, p] = await Promise.all([periodReport(business.id, tz, cur.from, cur.to), periodReport(business.id, tz, prev.from, prev.to)]);

  // käive alamperioodide kaupa: nädal → päevad, kuu → nädalad, kvartal/aasta → kuud
  const buckets: { label: string; from: string; to: string }[] = [];
  if (period === "week") {
    const wd = ["E", "T", "K", "N", "R", "L", "P"];
    for (let i = 0; i < 7; i++) buckets.push({ label: wd[i], from: addDaysIso(cur.from, i), to: addDaysIso(cur.from, i + 1) });
  } else if (period === "month") {
    let d = addDaysIso(cur.from, 1 - isoWeekday(cur.from));
    while (d < cur.to) {
      const thursday = addDaysIso(d, 3);
      const jan4 = `${thursday.slice(0, 4)}-01-04`;
      const wk = Math.round((Date.parse(thursday) - Date.parse(addDaysIso(jan4, 1 - isoWeekday(jan4)))) / 604_800_000) + 1;
      buckets.push({ label: `N${wk}`, from: d < cur.from ? cur.from : d, to: addDaysIso(d, 7) > cur.to ? cur.to : addDaysIso(d, 7) });
      d = addDaysIso(d, 7);
    }
  } else {
    const names = ["jaan", "veebr", "märts", "apr", "mai", "juuni", "juuli", "aug", "sept", "okt", "nov", "dets"];
    let d = cur.from;
    while (d < cur.to) {
      const [y, m] = d.split("-").map(Number);
      const next = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
      buckets.push({ label: names[m - 1], from: d, to: next });
      d = next;
    }
  }
  const bars = buckets.map((b) => ({
    label: b.label,
    cents: r.bookings.filter((x) => { const d = localDate(x.b.startsAt, tz); return d >= b.from && d < b.to; }).reduce((a, x) => a + x.b.finalPriceCents, 0),
  }));

  // populaarseimad teenused
  const byService = new Map<string, { name: string; n: number; cents: number }>();
  for (const x of r.bookings) {
    const e = byService.get(x.b.serviceId) ?? { name: x.serviceName, n: 0, cents: 0 };
    e.n++;
    e.cents += x.b.finalPriceCents;
    byService.set(x.b.serviceId, e);
  }
  const services = [...byService.values()].sort((a, b) => b.cents - a.cents).slice(0, 6);

  // kampaaniad ja koodid
  const camp = new Map<string, { n: number; cents: number; discount: number }>();
  for (const x of r.bookings) {
    for (const [key, kind] of [[x.b.campaignId, "campaign"], [x.b.discountCodeId, "code"]] as const) {
      if (!key) continue;
      const e = camp.get(key) ?? { n: 0, cents: 0, discount: 0 };
      e.n++;
      e.cents += x.b.finalPriceCents;
      e.discount -= x.b.priceBreakdown.filter((l) => l.kind === kind).reduce((a, l) => a + l.amountCents, 0);
      camp.set(key, e);
    }
  }

  // soojuskaart: E–L × 9–19
  const days = ["E", "T", "K", "N", "R", "L"];
  const hours = Array.from({ length: 11 }, (_, i) => 9 + i);
  const heat = days.map(() => hours.map(() => 0));
  for (const x of r.bookings) {
    const wd = isoWeekday(localDate(x.b.startsAt, tz));
    const h = Math.floor(localMinutes(x.b.startsAt, tz) / 60);
    if (wd <= 6 && h >= 9 && h <= 19) heat[wd - 1][h - 9]++;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {cur.label} · võrdlus: {prev.label.toLowerCase()}
        </p>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-[10px] bg-line-soft p-0.5">
            {PERIODS.map((x) => (
              <Link key={x.key} href={`/aruanded?p=${x.key}`} className={clsx("rounded-lg px-3 py-1.5 text-[13px]", period === x.key ? "bg-white font-semibold shadow-sm" : "text-muted")}>
                {x.label}
              </Link>
            ))}
          </div>
          <a href={`/aruanded/export?from=${cur.from}&to=${cur.to}`} download className="inline-flex h-[34px] items-center gap-1.5 rounded-[10px] border border-line bg-white px-2.5 text-[13px] font-semibold hover:bg-[#f9fafb]">
            <Download size={15} /> Ekspordi CSV
          </a>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Kpi label="Käive" value={formatEuro(r.revenue + r.giftRevenue, { decimals: false })} delta={pct(r.revenue + r.giftRevenue, p.revenue + p.giftRevenue)} />
        <Kpi label="Broneeringuid" value={String(r.countedCount)} delta={pct(r.countedCount, p.countedCount)} />
        <Kpi label="Täituvus" value={`${Math.round(r.utilization * 100)}%`} delta={p.utilization ? pp(r.utilization, p.utilization) : "—"} />
        <Kpi label="Keskmine arve" value={formatEuro(r.avgTicket, { decimals: true })} delta={pct(r.avgTicket, p.avgTicket)} />
        <Kpi label="Ei ilmunud" value={`${(Math.round(r.noShowRate * 1000) / 10).toString().replace(".", ",")}%`} delta={p.count ? pp(r.noShowRate, p.noShowRate) : "—"} invert />
      </div>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader title="Käive" subtitle={`Broneeringud ${formatEuro(r.revenue, { decimals: false })} · kinkekaardid ${formatEuro(r.giftRevenue, { decimals: false })}`} />
          <div className="p-5">
            <RevenueBars data={bars} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Käive töötaja kaupa" subtitle="Paremal täituvus" />
          <ul className="space-y-3.5 p-5">
            {[...r.staff].sort((a, b) => b.revenue - a.revenue).map((m) => (
              <li key={m.id} className="flex items-center gap-3">
                <Avatar name={m.name} color={m.color} size={30} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{m.name}</p>
                  <div className="mt-1 h-1.5 rounded bg-line-soft">
                    <div className="h-1.5 rounded bg-[#0f766e]" style={{ width: `${Math.round(m.utilization * 100)}%` }} />
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold tabular-nums">{formatEuro(m.revenue, { decimals: false })}</p>
                  <p className="text-xs text-muted">{Math.round(m.utilization * 100)}%</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader title="Populaarseimad teenused" />
          <table className="w-full text-sm">
            <thead className="text-left text-xs font-semibold tracking-[0.3px] text-[#475467] uppercase">
              <tr>
                <th className="py-2.5 pl-5 font-semibold">Teenus</th>
                <th className="py-2.5 font-semibold">Bron.</th>
                <th className="py-2.5 font-semibold">Käive</th>
                <th className="py-2.5 pr-5 font-semibold">Osakaal</th>
              </tr>
            </thead>
            <tbody>
              {services.map((x) => (
                <tr key={x.name} className="border-t border-line-soft">
                  <td className="py-2.5 pl-5">{x.name}</td>
                  <td className="py-2.5 tabular-nums">{x.n}</td>
                  <td className="py-2.5 tabular-nums">{formatEuro(x.cents, { decimals: false })}</td>
                  <td className="py-2.5 pr-5 tabular-nums">{r.revenue ? Math.round((x.cents / r.revenue) * 100) : 0}%</td>
                </tr>
              ))}
              {services.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-6 text-muted">Sel perioodil broneeringuid pole.</td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
        <Card>
          <CardHeader title="Täituvus päeva ja kellaaja järgi" />
          <div className="p-5">
            <Heatmap days={days} hours={hours} values={heat} />
          </div>
        </Card>
      </div>

      <CampaignResults ids={[...camp.keys()]} stats={camp} businessId={business.id} />
    </div>
  );
}

async function CampaignResults({ ids, stats, businessId }: { ids: string[]; stats: Map<string, { n: number; cents: number; discount: number }>; businessId: string }) {
  if (!ids.length) return null;
  const [campaigns, codes] = await Promise.all([
    db.query.campaigns.findMany({ where: and(eq(s.campaigns.businessId, businessId), inArray(s.campaigns.id, ids)) }),
    db.query.discountCodes.findMany({ where: and(eq(s.discountCodes.businessId, businessId), inArray(s.discountCodes.id, ids)) }),
  ]);
  const rows = [
    ...campaigns.map((c) => ({ id: c.id, name: c.name, type: `Kampaania · ${c.kind === "PERCENT" ? `−${c.value}%` : "summa"}` })),
    ...codes.map((c) => ({ id: c.id, name: c.code, type: "Sooduskood" })),
  ];
  return (
    <Card>
      <CardHeader title="Kampaaniate ja koodide tulemus" />
      <table className="w-full text-sm">
        <thead className="text-left text-xs font-semibold tracking-[0.3px] text-[#475467] uppercase">
          <tr>
            <th className="py-2.5 pl-5 font-semibold">Kampaania</th>
            <th className="py-2.5 font-semibold">Bron.</th>
            <th className="py-2.5 font-semibold">Käive</th>
            <th className="py-2.5 pr-5 font-semibold">Antud soodustus</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((x) => {
            const st = stats.get(x.id)!;
            return (
              <tr key={x.id} className="border-t border-line-soft">
                <td className="py-2.5 pl-5">
                  <p className="font-medium">{x.name}</p>
                  <p className="text-xs text-muted">{x.type}</p>
                </td>
                <td className="py-2.5 tabular-nums">{st.n}</td>
                <td className="py-2.5 tabular-nums">{formatEuro(st.cents, { decimals: false })}</td>
                <td className="py-2.5 pr-5 tabular-nums">{formatEuro(st.discount, { decimals: false })}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

export default function ReportsPage(props: PageProps<"/aruanded">) {
  return (
    <div className="space-y-5">
      <PageHeader title="Aruanded" />
      <Suspense fallback={<Card className="h-[600px] animate-pulse" />}>
        <Report searchParams={props.searchParams as Promise<{ p?: string }>} />
      </Suspense>
    </div>
  );
}

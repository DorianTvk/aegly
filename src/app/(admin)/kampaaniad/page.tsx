import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { and, desc, eq, isNotNull, ne } from "drizzle-orm";
import { Plus } from "lucide-react";
import { clsx } from "clsx";
import { db, schema as s } from "@/db";
import { getCurrentBusiness } from "@/lib/tenant";
import { getTargets, conditionsSummary } from "@/server/targets";
import { addDaysIso, formatEuro, formatShortDate, localDate, localTime, todayIso } from "@/lib/time";
import { Badge, Card, LinkButton, PageHeader } from "@/components/ui/primitives";
import { CampaignEditor } from "./CampaignEditor";
import type { CampaignInput } from "./actions";

export const metadata: Metadata = { title: "Kampaaniad" };

type Status = "ACTIVE" | "SCHEDULED" | "ENDED" | "PAUSED";
const STATUS = {
  ACTIVE: { label: "Aktiivne", tone: "ok" },
  SCHEDULED: { label: "Planeeritud", tone: "info" },
  ENDED: { label: "Lõppenud", tone: "neutral" },
  PAUSED: { label: "Peatatud", tone: "warn" },
} as const;
const TABS = [
  { key: "all", label: "Kõik" },
  { key: "ACTIVE", label: "Aktiivsed" },
  { key: "SCHEDULED", label: "Planeeritud" },
  { key: "ENDED", label: "Lõppenud" },
] as const;

async function Campaigns({ searchParams }: { searchParams: Promise<{ id?: string; tab?: string }> }) {
  const sp = await searchParams;
  const business = await getCurrentBusiness();
  const tz = business.timezone;
  const now = new Date();
  const [{ all }, campaigns, used] = await Promise.all([
    getTargets(business.id),
    db.query.campaigns.findMany({ where: eq(s.campaigns.businessId, business.id), orderBy: [desc(s.campaigns.startsAt)] }),
    db
      .select({ campaignId: s.bookings.campaignId, price: s.bookings.finalPriceCents, breakdown: s.bookings.priceBreakdown })
      .from(s.bookings)
      .where(and(eq(s.bookings.businessId, business.id), isNotNull(s.bookings.campaignId), ne(s.bookings.status, "CANCELLED"))),
  ]);
  const names = new Map(all.map((t) => [t.id, t.label]));

  const rows = campaigns.map((c) => {
    const status: Status = !c.active ? "PAUSED" : c.endsAt < now ? "ENDED" : c.startsAt > now ? "SCHEDULED" : "ACTIVE";
    const mine = used.filter((u) => u.campaignId === c.id);
    const discount = mine.reduce((a, u) => a - u.breakdown.filter((l) => l.kind === "campaign").reduce((x, l) => x + l.amountCents, 0), 0);
    const start = localDate(c.startsAt, tz);
    const end = localDate(c.endsAt, tz);
    const daysToStart = Math.ceil((c.startsAt.getTime() - now.getTime()) / 86_400_000);
    const value = c.kind === "PERCENT" ? `−${c.value}%` : c.kind === "FIXED" ? `−${formatEuro(c.value, { decimals: true })}` : `hind ${formatEuro(c.value, { decimals: true })}`;
    return {
      c,
      status,
      period: `${formatShortDate(start).slice(0, 5)} – ${formatShortDate(end)}`,
      line: `${value} ${conditionsSummary(c, names)}`,
      bookings: mine.length,
      revenue: mine.reduce((a, u) => a + u.price, 0),
      discount,
      daysToStart,
    };
  });

  const tab = TABS.find((t) => t.key === sp.tab)?.key ?? "all";
  const visible = rows.filter((r) => tab === "all" || r.status === tab);
  const selectedId = sp.id === "uus" ? null : (sp.id ?? visible[0]?.c.id ?? null);
  const selected = rows.find((r) => r.c.id === selectedId);
  const today = todayIso(tz);

  const initial: CampaignInput = selected
    ? {
        name: selected.c.name, kind: selected.c.kind, value: selected.c.value,
        startDate: localDate(selected.c.startsAt, tz), startTime: localTime(selected.c.startsAt, tz),
        endDate: localDate(selected.c.endsAt, tz), endTime: localTime(selected.c.endsAt, tz),
        weekdays: selected.c.weekdays, fromTime: selected.c.fromTime, toTime: selected.c.toTime,
        serviceIds: selected.c.serviceIds, categoryIds: selected.c.categoryIds, staffIds: selected.c.staffIds, packageIds: selected.c.packageIds,
        combinable: selected.c.combinable, showBanner: selected.c.showBanner, bannerText: selected.c.bannerText, bannerColor: selected.c.bannerColor, active: selected.c.active,
      }
    : {
        name: "", kind: "PERCENT", value: 10, startDate: today, startTime: "00:00", endDate: addDaysIso(today, 30), endTime: "23:59",
        weekdays: [], fromTime: null, toTime: null, serviceIds: [], categoryIds: [], staffIds: [], packageIds: [],
        combinable: false, showBanner: false, bannerText: null, bannerColor: "#fff4ed", active: true,
      };

  return (
    <div className="space-y-5">
      <nav className="flex gap-1 border-b border-line">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/kampaaniad?tab=${t.key}`}
            className={clsx("-mb-px border-b-2 px-3 py-2.5 text-sm", tab === t.key ? "border-lime font-semibold" : "border-transparent text-muted hover:text-ink")}
          >
            {t.label} ({t.key === "all" ? rows.length : rows.filter((r) => r.status === t.key).length})
          </Link>
        ))}
      </nav>
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="space-y-3">
          {visible.map((r) => (
            <Link
              key={r.c.id}
              href={`/kampaaniad?tab=${tab}&id=${r.c.id}`}
              className={clsx("block rounded-[14px] border bg-white p-4 shadow-[var(--shadow-card)] transition-colors", r.c.id === selectedId ? "border-lime ring-1 ring-lime" : "border-line hover:border-[#d0d5dd]")}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">{r.c.name}</p>
                <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
              </div>
              <p className="mt-1 text-[13px] text-muted">
                {r.period} · {r.line}
              </p>
              {r.status === "SCHEDULED" ? (
                <p className="mt-3 text-xs text-muted">
                  Algab <span className="block text-sm font-semibold text-ink">{r.daysToStart} päeva pärast</span>
                </p>
              ) : (
                <dl className="mt-3 grid grid-cols-3 gap-2 text-xs text-muted">
                  <div>
                    <dt>Broneeringuid</dt>
                    <dd className="text-sm font-semibold text-ink">{r.bookings}</dd>
                  </div>
                  <div>
                    <dt>Käive</dt>
                    <dd className="text-sm font-semibold text-ink">{formatEuro(r.revenue, { decimals: false })}</dd>
                  </div>
                  <div>
                    <dt>Soodustus</dt>
                    <dd className="text-sm font-semibold text-ink">{formatEuro(r.discount, { decimals: false })}</dd>
                  </div>
                </dl>
              )}
            </Link>
          ))}
          {visible.length === 0 && <Card className="p-6 text-sm text-muted">Selles vaates kampaaniaid pole.</Card>}
        </div>
        <CampaignEditor key={selectedId ?? "new"} id={selectedId} initial={initial} targets={all} isRunning={selected?.status === "ACTIVE"} />
      </div>
    </div>
  );
}

export default function CampaignsPage(props: PageProps<"/kampaaniad">) {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Kampaaniad"
        subtitle="Ajaliselt piiratud soodustused, mis rakenduvad vidinas automaatselt."
        actions={
          <LinkButton href="/kampaaniad?id=uus" variant="primary">
            <Plus size={16} strokeWidth={2.25} /> Loo kampaania
          </LinkButton>
        }
      />
      <Suspense fallback={<Card className="h-[500px] animate-pulse" />}>
        <Campaigns searchParams={props.searchParams as Promise<{ id?: string; tab?: string }>} />
      </Suspense>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { CalendarDays } from "lucide-react";
import { clsx } from "clsx";
import { db, schema as s } from "@/db";
import { getCurrentBusiness } from "@/lib/tenant";
import { currentWeek, getStaffMember, upcomingTimeOff } from "@/server/staff";
import { formatShortDate, localDate, localTime, todayIso } from "@/lib/time";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, Card, LinkButton } from "@/components/ui/primitives";
import { ProfileForm } from "../ProfileForm";
import { WeekEditor } from "../WeekEditor";
import { TimeOffPanel } from "../TimeOffPanel";
import { StaffServicesForm } from "../StaffServicesForm";

export const metadata: Metadata = { title: "Töötaja" };

const TABS = [
  { key: "profiil", label: "Profiil" },
  { key: "teenused", label: "Teenused" },
  { key: "tooaeg", label: "Tööaeg ja puudumised" },
] as const;
type Tab = (typeof TABS)[number]["key"];

const TYPE_LABEL = { VACATION: "Puhkus", TRAINING: "Koolitus", SICK: "Haigus", OTHER: "Muu" } as const;

async function StaffDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const tab: Tab = (TABS.find((t) => t.key === sp.tab)?.key ?? "tooaeg") as Tab;
  const business = await getCurrentBusiness();
  const tz = business.timezone;
  const m = await getStaffMember(business.id, id);
  if (!m) notFound();
  const today = todayIso(tz);

  let body: React.ReactNode = null;
  if (tab === "profiil") {
    body = <ProfileForm staffId={m.id} values={m} />;
  } else if (tab === "teenused") {
    const services = await db.query.services.findMany({
      where: and(eq(s.services.businessId, business.id)),
      orderBy: [asc(s.services.sortOrder)],
      with: { category: true },
    });
    const links = new Map(m.services.map((l) => [l.serviceId, l]));
    body = (
      <StaffServicesForm
        staffId={m.id}
        rows={services
          .filter((sv) => sv.status !== "ARCHIVED")
          .map((sv) => ({
            id: sv.id,
            name: sv.name,
            category: sv.category?.name ?? null,
            priceCents: sv.priceCents,
            durationMinutes: sv.durationMinutes,
            linked: links.has(sv.id),
            customPrice: links.get(sv.id)?.priceCents ?? null,
            customDuration: links.get(sv.id)?.durationMinutes ?? null,
          }))}
      />
    );
  } else {
    // aktiivne graafik: viimane, mis algab kuni tänaseni; kui tulevikus on uuem, näita seda
    const future = m.schedules.filter((r) => r.validFrom > today).sort((a, b) => a.validFrom.localeCompare(b.validFrom))[0];
    const refDate = future?.validFrom ?? today;
    const week = currentWeek(m.schedules, refDate);
    const initial = week.map((r, i) => {
      if (!r) return { weekday: i + 1, enabled: false, intervals: [] };
      const breaks = [...r.breaks].sort((a, b) => a.start.localeCompare(b.start));
      const points = [r.startTime, ...breaks.flatMap((b) => [b.start, b.end]), r.endTime];
      const intervals = [];
      for (let k = 0; k < points.length; k += 2) intervals.push({ start: points[k], end: points[k + 1] });
      return { weekday: i + 1, enabled: true, intervals };
    });
    const timeOff = await upcomingTimeOff(m.id);
    const items = timeOff.map((t) => {
      const from = localDate(t.startsAt, tz);
      const to = localDate(new Date(t.endsAt.getTime() - 1), tz);
      const wholeDays = localTime(t.startsAt, tz) === "00:00" && localTime(t.endsAt, tz) === "00:00";
      const days = Math.round((t.endsAt.getTime() - t.startsAt.getTime()) / 86_400_000);
      const when = wholeDays
        ? from === to
          ? `${formatShortDate(from)} · terve päev`
          : `${formatShortDate(from).slice(0, 5)}–${formatShortDate(to)} · ${days} päeva`
        : `${formatShortDate(from)} · ${localTime(t.startsAt, tz)}–${localTime(t.endsAt, tz)}`;
      return { id: t.id, type: t.type, title: t.note || TYPE_LABEL[t.type], when };
    });
    body = (
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <WeekEditor key={refDate} staffId={m.id} initial={initial} validFrom={future ? future.validFrom : today} today={today} />
        <TimeOffPanel staffId={m.id} items={items} today={today} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Card className="flex flex-wrap items-center gap-4 p-5">
        <Avatar name={m.name} color={m.color} size={56} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[22px] font-bold tracking-[-0.3px]">{m.name}</h1>
            <Badge tone={m.active ? "ok" : "neutral"}>{m.active ? "Aktiivne" : "Mitteaktiivne"}</Badge>
          </div>
          <p className="mt-0.5 text-[13px] text-muted">{[m.title, m.email, m.phone].filter(Boolean).join(" · ") || "Lisa profiilile andmed"}</p>
        </div>
        <LinkButton href="/kalender">
          <CalendarDays size={16} />
          Vaata kalendrit
        </LinkButton>
      </Card>

      <nav className="flex gap-1 border-b border-line" aria-label="Töötaja jaotised">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/tootajad/${m.id}?tab=${t.key}`}
            aria-current={tab === t.key ? "page" : undefined}
            className={clsx(
              "-mb-px border-b-2 px-3 py-2.5 text-sm",
              tab === t.key ? "border-lime font-semibold text-ink" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {t.label}
            {t.key === "teenused" && ` (${m.services.length})`}
          </Link>
        ))}
      </nav>

      {body}
    </div>
  );
}

export default function StaffDetailPage(props: PageProps<"/tootajad/[id]">) {
  return (
    <Suspense fallback={<div className="h-[600px] animate-pulse rounded-[14px] bg-white" />}>
      <StaffDetail params={props.params} searchParams={props.searchParams as Promise<{ tab?: string }>} />
    </Suspense>
  );
}

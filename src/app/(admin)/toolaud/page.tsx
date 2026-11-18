import type { Metadata } from "next";
import { Suspense } from "react";
import { and, eq, gte, lte } from "drizzle-orm";
import { ArrowRight, CalendarDays, ChevronRight, Check, Download, Euro, Megaphone, Ticket, Timer, TrendingUp, Users } from "lucide-react";
import Link from "next/link";
import { clsx } from "clsx";
import { db, schema as s } from "@/db";
import { getCurrentBusiness, getCurrentUser } from "@/lib/tenant";
import { countNewClients, isActiveStatus, loadDay, periodStats } from "@/server/day";
import { addDaysIso, formatEuro, formatLongDate, formatShortDate, fromMinutes, isoWeekday, localDate, todayIso, zonedDateTime } from "@/lib/time";
import { totalMinutes } from "@/lib/schedule";
import { BOOKING_STATUS } from "@/lib/booking-status";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, Card, CardHeader, Delta, LinkButton, PageHeader } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Töölaud" };

function pct(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? "+100%" : "0%";
  const d = Math.round(((current - previous) / previous) * 100);
  return d >= 0 ? `+${d}%` : `−${Math.abs(d)}%`;
}
function diff(current: number, previous: number): string {
  const d = current - previous;
  return d >= 0 ? `+${d}` : `−${Math.abs(d)}`;
}

function Kpi({ label, value, delta, icon: Icon }: { label: string; value: string; delta: string; icon: typeof TrendingUp }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <p className="pt-2 text-[13px] font-medium text-muted">{label}</p>
        <span className="grid size-8 place-items-center rounded-lg bg-lime-soft text-ink">
          <Icon size={16} strokeWidth={2} />
        </span>
      </div>
      <div className="mt-3 flex items-center gap-2.5">
        <p className="text-[28px] font-bold tracking-[-0.5px] text-ink">{value}</p>
        <Delta value={delta} />
      </div>
    </Card>
  );
}

async function Dashboard() {
  const business = await getCurrentBusiness();
  const user = await getCurrentUser();
  const tz = business.timezone;
  const today = todayIso(tz);
  const lastWeekSameDay = addDaysIso(today, -7);
  const monday = addDaysIso(today, 1 - isoWeekday(today));
  const now = new Date();

  const [day, prevDay, week, prevWeek, campaigns, codes, staffCount, serviceCount, scheduleCount] = await Promise.all([
    loadDay(business.id, today, tz),
    loadDay(business.id, lastWeekSameDay, tz),
    periodStats(business.id, zonedDateTime(monday, "00:00", tz), zonedDateTime(addDaysIso(today, 1), "00:00", tz)),
    periodStats(business.id, zonedDateTime(addDaysIso(monday, -7), "00:00", tz), zonedDateTime(addDaysIso(today, -6), "00:00", tz)),
    db.query.campaigns.findMany({
      where: and(eq(s.campaigns.businessId, business.id), eq(s.campaigns.active, true), lte(s.campaigns.startsAt, now), gte(s.campaigns.endsAt, now)),
    }),
    db.query.discountCodes.findMany({ where: and(eq(s.discountCodes.businessId, business.id), eq(s.discountCodes.active, true)) }),
    db.$count(s.staffMembers, eq(s.staffMembers.businessId, business.id)),
    db.$count(s.services, eq(s.services.businessId, business.id)),
    db
      .select({ id: s.workSchedules.id })
      .from(s.workSchedules)
      .innerJoin(s.staffMembers, eq(s.staffMembers.id, s.workSchedules.staffId))
      .where(eq(s.staffMembers.businessId, business.id))
      .limit(1)
      .then((r) => r.length),
  ]);

  const [newThisWeek, newPrevWeek] = await Promise.all([
    countNewClients(business.id, week.clientIds, zonedDateTime(monday, "00:00", tz)),
    countNewClients(business.id, prevWeek.clientIds, zonedDateTime(addDaysIso(monday, -7), "00:00", tz)),
  ]);

  const active = day.bookings.filter((b) => isActiveStatus(b.status));
  const prevActive = prevDay.bookings.filter((b) => isActiveStatus(b.status));
  const utilization = (d: typeof day) => {
    const work = d.columns.reduce((a, c) => a + totalMinutes(c.day.working), 0);
    const booked = d.columns.reduce((a, c) => a + c.utilization * totalMinutes(c.day.working), 0);
    return work > 0 ? Math.round((booked / work) * 100) : 0;
  };
  const util = utilization(day);
  const prevUtil = utilization(prevDay);
  const pending = day.bookings.filter((b) => b.status === "PENDING_PAYMENT").length;
  const cancelled = day.bookings.filter((b) => b.status === "CANCELLED").length;
  const staffById = new Map(day.columns.map((c) => [c.id, c]));

  // iga samm viib kohta, kus selle saab ära teha; kui kõik on tehtud, kaart kaob
  const setup = [
    { label: "Ettevõtte andmed", hint: "Lisa aadress ja kontaktid", cta: "Täida ettevõtte andmed", href: "/profiil", done: Boolean(business.name && business.address && (business.phone || business.email)) },
    { label: "Töötajad lisatud", hint: "Lisa vähemalt üks töötaja", cta: "Lisa töötaja", href: "/tootajad/uus", done: staffCount > 0 },
    { label: "Teenused ja hinnad", hint: "Lisa teenus koos hinna ja kestusega", cta: "Lisa teenus", href: "/teenused/uus", done: serviceCount > 0 },
    { label: "Tööajad määratud", hint: "Määra töötajate nädalagraafik", cta: "Määra tööajad", href: "/tooajad", done: scheduleCount > 0 },
    { label: "Vidina välimus kohandatud", hint: "Vali värvid ja salvesta", cta: "Kohanda vidinat", href: "/vidin", done: Boolean(business.widgetCustomizedAt) },
    { label: "Vidin kodulehele lisatud", hint: "Kopeeri paigalduskood kodulehele", cta: "Lisa vidin kodulehele", href: "/vidin#paigaldus", done: Boolean(business.widgetInstalledAt) },
  ];
  const doneCount = setup.filter((x) => x.done).length;
  const nextStep = setup.find((x) => !x.done);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Tere, ${user.name.split(" ")[0]}`}
        subtitle={formatLongDate(today)}
        actions={
          <>
            <LinkButton href="/kalender">
              <CalendarDays size={16} />
              Täna
            </LinkButton>
            <LinkButton href="/aruanded">
              <Download size={16} />
              Ekspordi
            </LinkButton>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Tänased broneeringud" value={String(active.length)} delta={diff(active.length, prevActive.length)} icon={TrendingUp} />
        <Kpi label="Nädala käive" value={formatEuro(week.revenue, { decimals: false })} delta={pct(week.revenue, prevWeek.revenue)} icon={Euro} />
        <Kpi label="Täituvus" value={`${util}%`} delta={diff(util, prevUtil) + "%"} icon={Timer} />
        <Kpi label="Uued kliendid" value={String(newThisWeek)} delta={diff(newThisWeek, newPrevWeek)} icon={Users} />
      </div>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader
            title="Tänased broneeringud"
            subtitle={[
              `${active.length} broneeringut`,
              pending > 0 && `${pending} ootab ettemaksu`,
              cancelled > 0 && `${cancelled} tühistatud`,
            ]
              .filter(Boolean)
              .join(" · ")}
            action={
              <LinkButton href="/kalender" size="sm">
                Ava kalender
              </LinkButton>
            }
          />
          {day.bookings.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted">Täna broneeringuid pole.</p>
          ) : (
            <ul>
              {day.bookings.map((b) => {
                const st = staffById.get(b.staffId);
                const status = BOOKING_STATUS[b.status];
                return (
                  <li key={b.id} className="grid grid-cols-[56px_minmax(0,1fr)_minmax(0,180px)_auto] items-center gap-4 border-t border-line-soft px-5 py-3 first:border-t-0">
                    <span className="text-sm font-semibold">{fromMinutes(b.start)}</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{b.clientName}</p>
                      <p className="truncate text-[13px] text-muted">
                        {b.serviceName} · {b.end - b.start} min
                      </p>
                    </div>
                    <div className="flex min-w-0 items-center gap-2">
                      {st && <Avatar name={st.name} color={st.color} />}
                      <span className="truncate text-[13px]">{st?.name}</span>
                    </div>
                    <div className="justify-self-end">
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <div className="space-y-4">
          {nextStep && (
            <Card>
              <CardHeader title="Seadistuse edenemine" subtitle={`Järgmine samm: ${nextStep.label.toLowerCase()}`} />
              <div className="space-y-4 p-5">
                <div className="flex items-center gap-2.5">
                  <div className="h-2 flex-1 rounded bg-line-soft" role="progressbar" aria-valuemin={0} aria-valuemax={setup.length} aria-valuenow={doneCount} aria-label="Seadistuse edenemine">
                    <div className="h-2 rounded bg-lime" style={{ width: `${(doneCount / setup.length) * 100}%` }} />
                  </div>
                  <span className="text-[13px] font-semibold">
                    {doneCount} / {setup.length}
                  </span>
                </div>
                <ul className="-mx-2 space-y-0.5">
                  {setup.map((step) => (
                    <li key={step.label}>
                      <Link
                        href={step.href}
                        className={clsx(
                          "group flex items-center gap-3 rounded-[10px] px-2 py-2 text-sm hover:bg-line-soft",
                          step === nextStep && "bg-[#f7fee7] hover:bg-[#ecfccb]",
                        )}
                      >
                        {step.done ? (
                          <span className="grid size-[22px] shrink-0 place-items-center rounded-full bg-ok-dot text-white">
                            <Check size={13} strokeWidth={3} aria-hidden />
                          </span>
                        ) : (
                          <span className="size-[22px] shrink-0 rounded-full border-2 border-[#d1d5db] group-hover:border-ink" />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className={step.done ? "block text-muted line-through" : "block font-medium"}>{step.label}</span>
                          {!step.done && <span className="block text-[12px] text-muted">{step.hint}</span>}
                        </span>
                        {!step.done && <ChevronRight size={16} className="shrink-0 text-subtle group-hover:text-ink" aria-hidden />}
                        <span className="sr-only">{step.done ? "(tehtud)" : "(tegemata)"}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <LinkButton href={nextStep.href} variant="primary" className="w-full">
                  {nextStep.cta}
                  <ArrowRight size={16} aria-hidden />
                </LinkButton>
              </div>
            </Card>
          )}

          <Card>
            <CardHeader title="Aktiivsed soodustused" />
            <ul className="divide-y divide-line px-5">
              {campaigns.map((c) => (
                <li key={c.id} className="flex items-center gap-3 py-4">
                  <span className="grid size-9 place-items-center rounded-[9px] bg-[#fff4ed] text-[#e62e05]">
                    <Megaphone size={17} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {c.name} {c.kind === "PERCENT" ? `−${c.value}%` : `−${formatEuro(c.value)}`}
                    </p>
                    <p className="text-xs text-muted">Kampaania · kuni {formatShortDate(localDate(c.endsAt, tz)).slice(0, 5)}</p>
                  </div>
                </li>
              ))}
              {codes.map((c) => (
                <li key={c.id} className="flex items-center gap-3 py-4">
                  <span className="grid size-9 place-items-center rounded-[9px] bg-lime-soft text-ink">
                    <Ticket size={17} />
                  </span>
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-medium">{c.code}</p>
                    <p className="text-xs text-muted">
                      Sooduskood · kasutatud {c.usedCount}
                      {c.maxUses ? ` / ${c.maxUses}` : ""}
                    </p>
                  </div>
                </li>
              ))}
              {campaigns.length + codes.length === 0 && <li className="py-6 text-center text-sm text-muted">Aktiivseid soodustusi pole.</li>}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy>
      <div className="h-[60px] w-64 animate-pulse rounded-lg bg-line" />
      <div className="grid grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[116px] animate-pulse rounded-[14px] bg-white" />
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Dashboard />
    </Suspense>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { and, eq, gte, lte } from "drizzle-orm";
import { CalendarDays, Check, Code2, Download, Euro, Megaphone, Ticket, Timer, TrendingUp, Users } from "lucide-react";
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

  const setup = [
    { label: "Ettevõtte andmed", done: Boolean(business.name && business.address) },
    { label: "Töötajad lisatud", done: staffCount > 0 },
    { label: "Teenused ja hinnad", done: serviceCount > 0 },
    { label: "Tööajad määratud", done: scheduleCount > 0 },
    { label: "Vidina välimus kohandatud", done: Boolean(business.logoUrl) },
    { label: "Vidin kodulehele lisatud", done: Boolean(business.widgetInstalledAt) },
  ];
  const doneCount = setup.filter((x) => x.done).length;

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
          <Card>
            <CardHeader
              title="Seadistuse edenemine"
              subtitle={setup[5].done ? "Kõik valmis" : "Vidin on veel kodulehel avaldamata"}
            />
            <div className="space-y-4 p-5">
              <div className="flex items-center gap-2.5">
                <div className="h-2 flex-1 rounded bg-line-soft">
                  <div className="h-2 rounded bg-lime" style={{ width: `${(doneCount / setup.length) * 100}%` }} />
                </div>
                <span className="text-[13px] font-semibold">
                  {doneCount} / {setup.length}
                </span>
              </div>
              <ul className="space-y-3.5">
                {setup.map((step) => (
                  <li key={step.label} className="flex items-center gap-3 text-sm">
                    {step.done ? (
                      <span className="grid size-[22px] place-items-center rounded-full bg-ok-dot text-white">
                        <Check size={13} strokeWidth={3} />
                      </span>
                    ) : (
                      <span className="size-[22px] rounded-full border-2 border-[#d1d5db]" />
                    )}
                    <span className={step.done ? "text-muted line-through" : "font-medium"}>{step.label}</span>
                  </li>
                ))}
              </ul>
              {doneCount < setup.length && (
                <LinkButton href="/vidin" variant="primary" className="w-full">
                  <Code2 size={16} />
                  Seadista broneerimisvidin
                </LinkButton>
              )}
            </div>
          </Card>

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

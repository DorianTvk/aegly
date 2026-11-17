import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { and, asc, eq } from "drizzle-orm";
import { CalendarDays, ChevronLeft, ChevronRight, Filter, Plus, X } from "lucide-react";
import { db, schema as s } from "@/db";
import { getCurrentBusiness } from "@/lib/tenant";
import { loadDay, type DayBooking, type StaffColumn } from "@/server/day";
import { addDaysIso, formatLongDate, formatShortDate, fromMinutes, localMinutes, todayIso } from "@/lib/time";
import { subtract } from "@/lib/schedule";
import { Avatar } from "@/components/ui/Avatar";
import { Card, LinkButton } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Kalender" };

const PX_PER_MIN = 1.2; // 72 px tunnis
const MIN_FREE_BLOCK = 60; // "Vaba aeg" kast ainult vähemalt tunnistele akendele

function BookingBlock({ b, top }: { b: DayBooking; top: number }) {
  const cancelled = b.status === "CANCELLED" || b.status === "NO_SHOW";
  const color = cancelled ? "#98a2b3" : b.categoryColor;
  const height = Math.max((b.end - b.start) * PX_PER_MIN - 4, 22);
  const compact = b.end - b.start <= 45;
  return (
    <Link
      href={`/broneeringud/${b.id}`}
      title={`${fromMinutes(b.start)}–${fromMinutes(b.end)} ${b.serviceName} · ${b.clientName}`}
      className="absolute inset-x-1.5 overflow-hidden rounded-md border-l-[3px] px-2 py-1.5 text-xs transition-shadow hover:shadow-md"
      style={{ top: top + 2, height, borderColor: color, background: `linear-gradient(${color}14, ${color}14), #fff` }}
    >
      {compact ? (
        <p className="truncate">
          <span className="font-medium" style={{ color }}>
            {fromMinutes(b.start)}–{fromMinutes(b.end)}
          </span>{" "}
          <span className="font-semibold text-ink">{b.serviceName}</span>
          {b.end - b.start >= 45 && <span className="block truncate text-muted">{b.clientName}</span>}
        </p>
      ) : (
        <>
          <p className="font-medium" style={{ color }}>
            {fromMinutes(b.start)}–{fromMinutes(b.end)}
          </p>
          <p className="truncate font-semibold text-ink">{b.serviceName}</p>
          <p className="truncate text-muted">
            {b.clientName}
            {cancelled && " · tühistatud"}
          </p>
        </>
      )}
    </Link>
  );
}

function Column({ col, startMin, endMin, isoDate }: { col: StaffColumn; startMin: number; endMin: number; isoDate: string }) {
  const y = (m: number) => (m - startMin) * PX_PER_MIN;
  // kõik kuvatud broneeringud (ka tühistatud) on visuaalselt hõivatud, et kastid ei kattuks
  const busy = col.bookings.map((b) => ({ start: b.start, end: b.end }));
  const free = col.day.absent ? [] : subtract(col.day.working, busy).filter((f) => f.end - f.start >= MIN_FREE_BLOCK);

  return (
    <div className="relative border-l border-line-soft" style={{ height: (endMin - startMin) * PX_PER_MIN }}>
      {/* väljaspool tööaega */}
      {col.day.shift && !col.day.absent && (
        <>
          <div className="absolute inset-x-0 top-0 bg-[#f9fafb]" style={{ height: Math.max(0, y(col.day.shift.start)) }} />
          <div className="absolute inset-x-0 bottom-0 bg-[#f9fafb]" style={{ top: y(col.day.shift.end) }} />
        </>
      )}
      {!col.day.scheduled && <div className="absolute inset-0 bg-[#f9fafb]" />}

      {col.day.absent ? (
        <div className="absolute inset-1.5 grid place-items-center rounded-md border border-dashed border-[#d0d5dd] bg-line-soft text-center text-muted">
          <div>
            <CalendarDays size={18} className="mx-auto mb-1.5" />
            <p className="text-xs font-semibold text-[#475467]">{col.absence?.note === "Puhkus" || !col.absence?.note ? "Puhkusel" : col.absence.note}</p>
            {col.absence && (
              <p className="mt-0.5 text-[11px]">
                {formatShortDate(col.absence.from).slice(0, 5)}–{formatShortDate(col.absence.to).slice(0, 5)}
              </p>
            )}
          </div>
        </div>
      ) : (
        <>
          {col.day.breaks.map((br) => (
            <div
              key={br.start}
              className="absolute inset-x-1.5 grid place-items-center rounded-md border border-dashed border-[#d0d5dd] text-xs text-muted"
              style={{ top: y(br.start) + 2, height: (br.end - br.start) * PX_PER_MIN - 4 }}
            >
              {br.label}
            </div>
          ))}
          {free.map((f) => (
            <Link
              key={f.start}
              href={`/broneeringud/uus?staff=${col.id}&date=${isoDate}&time=${fromMinutes(f.start)}`}
              className="group absolute inset-x-1.5 grid place-items-center rounded-md border border-dashed border-transparent text-xs font-semibold text-transparent transition-colors hover:border-lime hover:bg-lime-soft hover:text-ink focus-visible:border-lime focus-visible:text-ink"
              style={{ top: y(f.start) + 2, height: (f.end - f.start) * PX_PER_MIN - 4 }}
            >
              <span className="flex items-center gap-1">
                <Plus size={14} /> Vaba aeg
              </span>
            </Link>
          ))}
          {col.bookings.map((b) => (
            <BookingBlock key={b.id} b={b} top={y(b.start)} />
          ))}
        </>
      )}
    </div>
  );
}

async function Calendar({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const business = await getCurrentBusiness();
  const tz = business.timezone;
  const today = todayIso(tz);
  const { date } = await searchParams;
  const isoDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : today;

  const [day, categories] = await Promise.all([
    loadDay(business.id, isoDate, tz),
    db.query.serviceCategories.findMany({ where: and(eq(s.serviceCategories.businessId, business.id)), orderBy: [asc(s.serviceCategories.sortOrder)] }),
  ]);

  // Nähtav ajavahemik: lahtiolekuaeg ∪ graafikud ∪ broneeringud, ümardatud täistundideks
  const starts = [day.opening?.start ?? 9 * 60, ...day.columns.flatMap((c) => (c.day.shift ? [c.day.shift.start] : [])), ...day.bookings.map((b) => b.start)];
  const ends = [day.opening?.end ?? 18 * 60, ...day.columns.flatMap((c) => (c.day.shift ? [c.day.shift.end] : [])), ...day.bookings.map((b) => b.end)];
  const startMin = Math.floor(Math.min(...starts) / 60) * 60;
  const endMin = Math.ceil(Math.max(...ends) / 60) * 60;
  const hours = Array.from({ length: (endMin - startMin) / 60 }, (_, i) => startMin + i * 60);
  const nowMin = isoDate === today ? localMinutes(new Date(), tz) : null;
  const showNow = nowMin !== null && nowMin > startMin && nowMin < endMin;

  const nav = (d: string) => `/kalender?date=${d}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href={nav(addDaysIso(isoDate, -1))} aria-label="Eelmine päev" className="grid size-9 place-items-center rounded-lg hover:bg-white">
          <ChevronLeft size={18} />
        </Link>
        <Link href={nav(addDaysIso(isoDate, 1))} aria-label="Järgmine päev" className="grid size-9 place-items-center rounded-lg hover:bg-white">
          <ChevronRight size={18} />
        </Link>
        <LinkButton href="/kalender" size="sm">
          Täna
        </LinkButton>
        <h1 className="ml-1 text-lg font-bold text-ink">{formatLongDate(isoDate)}</h1>

        <div className="ml-auto flex items-center gap-2.5">
          <button type="button" className="inline-flex h-[34px] items-center gap-2 rounded-[10px] border border-line bg-white px-3 text-[13px] font-semibold">
            <Filter size={15} />
            Kõik töötajad ({day.columns.length})
          </button>
          <div className="flex rounded-[10px] bg-line-soft p-0.5 text-[13px]" role="tablist" aria-label="Vaade">
            <span role="tab" aria-selected className="rounded-lg bg-white px-3 py-1.5 font-semibold shadow-sm">
              Päev
            </span>
            <span role="tab" aria-selected={false} aria-disabled title="Tulekul" className="px-3 py-1.5 text-muted">
              Nädal
            </span>
            <span role="tab" aria-selected={false} aria-disabled title="Tulekul" className="px-3 py-1.5 text-muted">
              Kuu
            </span>
          </div>
          <LinkButton href="/tooajad" size="sm">
            <X size={15} />
            Blokeeri aeg
          </LinkButton>
        </div>
      </div>

      <Card className="overflow-x-auto">
        <div className="min-w-[860px]" style={{ display: "grid", gridTemplateColumns: `64px repeat(${day.columns.length}, minmax(160px, 1fr))` }}>
          {/* päis */}
          <div className="border-b border-line bg-white" />
          {day.columns.map((c) => {
            const active = c.bookings.filter((b) => b.status !== "CANCELLED").length;
            return (
              <div key={c.id} className="flex items-center gap-2.5 border-b border-l border-line border-l-line-soft bg-white px-3 py-3">
                <Avatar name={c.name} color={c.color} size={30} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{c.name}</p>
                  <p className="truncate text-xs text-muted">
                    {c.day.absent || !c.day.scheduled ? "Puudub" : `${active} broneeringut · ${Math.round(c.utilization * 100)}%`}
                  </p>
                </div>
              </div>
            );
          })}

          {/* kellaajad */}
          <div className="relative" style={{ height: (endMin - startMin) * PX_PER_MIN }}>
            {hours.map((h) => (
              <span key={h} className="absolute right-2.5 -translate-y-1/2 text-xs text-muted" style={{ top: (h - startMin) * PX_PER_MIN + (h === startMin ? 10 : 0) }}>
                {fromMinutes(h)}
              </span>
            ))}
            {showNow && <span className="absolute right-0 z-[6] size-2 -translate-y-1/2 translate-x-1 rounded-full bg-danger" style={{ top: (nowMin! - startMin) * PX_PER_MIN }} />}
          </div>

          {day.columns.map((c) => (
            <div key={c.id} className="relative">
              {/* tunnijooned */}
              {hours.slice(1).map((h) => (
                <div key={h} className="pointer-events-none absolute inset-x-0 border-t border-line-soft" style={{ top: (h - startMin) * PX_PER_MIN }} />
              ))}
              <Column col={c} startMin={startMin} endMin={endMin} isoDate={isoDate} />
              {showNow && <div className="pointer-events-none absolute inset-x-0 z-[6] border-t border-danger" style={{ top: (nowMin! - startMin) * PX_PER_MIN }} />}
            </div>
          ))}
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3 text-[13px] text-muted">
        <div className="flex flex-wrap items-center gap-4">
          {categories.map((c) => (
            <span key={c.id} className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm" style={{ background: c.color }} />
              {c.name}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-[#98a2b3]" />
            Tühistatud
          </span>
        </div>
        <p>Ajasamm {business.slotStepMinutes} min · Vabad ajad arvutatakse töötaja tööaja, broneeringute ja puhveraja põhjal</p>
      </div>
    </div>
  );
}

export default function CalendarPage(props: PageProps<"/kalender">) {
  return (
    <Suspense fallback={<div className="h-[600px] animate-pulse rounded-[14px] bg-white" />}>
      <Calendar searchParams={props.searchParams as Promise<{ date?: string }>} />
    </Suspense>
  );
}


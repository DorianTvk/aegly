import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { and, asc, eq } from "drizzle-orm";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { clsx } from "clsx";
import { db, schema as s } from "@/db";
import { requireSession } from "@/lib/session";
import { loadDay } from "@/server/day";
import { loadRange, type RangeDay } from "@/server/range";
import {
  addDaysIso,
  formatLongDate,
  formatMonth,
  formatShortDate,
  fromMinutes,
  isoWeekday,
  localMinutes,
  todayIso,
  WEEKDAY_SHORT,
} from "@/lib/time";
import { subtract, type Interval } from "@/lib/schedule";
import { Avatar } from "@/components/ui/Avatar";
import { Card, LinkButton } from "@/components/ui/primitives";
import { TimeGrid, type GridBooking, type GridColumn } from "./TimeGrid";
import { StaffFilter } from "./StaffFilter";

export const metadata: Metadata = { title: "Kalender" };

const MIN_FREE_BLOCK = 60; // "Vaba aeg" kast ainult vähemalt tunnistele akendele
const MOVABLE = ["HELD", "PENDING_PAYMENT", "CONFIRMED"];
type View = "paev" | "nadal" | "kuu";

const mondayOf = (iso: string) => addDaysIso(iso, 1 - isoWeekday(iso));
const shortDm = (iso: string) =>
  `${Number(iso.slice(8, 10))}.${Number(iso.slice(5, 7))}`;

/** Väljaspool vahemikku (tööaeg/lahtiolek) hallid alad */
function shadingFor(iv: Interval | null | undefined): Interval[] {
  if (iv === undefined) return [];
  if (iv === null) return [{ start: 0, end: 24 * 60 }];
  return [
    { start: 0, end: iv.start },
    { start: iv.end, end: 24 * 60 },
  ];
}

function bounds(
  intervals: (Interval | null | undefined)[],
  bookings: { start: number; end: number }[],
) {
  const ivs = intervals.filter(Boolean) as Interval[];
  const starts = [...ivs.map((i) => i.start), ...bookings.map((b) => b.start)];
  const ends = [...ivs.map((i) => i.end), ...bookings.map((b) => b.end)];
  const startMin = Math.floor(Math.min(9 * 60, ...starts) / 60) * 60;
  const endMin = Math.ceil(Math.max(18 * 60, ...ends) / 60) * 60;
  return { startMin, endMin: Math.min(endMin, 24 * 60) };
}

async function Calendar({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { business, user } = await requireSession();
  const tz = business.timezone;
  const today = todayIso(tz);
  const sp = await searchParams;
  const str = (k: string) =>
    typeof sp[k] === "string" ? (sp[k] as string) : undefined;
  const isoDate = /^\d{4}-\d{2}-\d{2}$/.test(str("date") ?? "")
    ? str("date")!
    : today;
  const view: View =
    str("vaade") === "nadal"
      ? "nadal"
      : str("vaade") === "kuu"
        ? "kuu"
        : "paev";

  if (user.role === "STAFF" && !user.staffId) {
    return (
      <p className="rounded-[12px] border border-line bg-white p-8 text-center text-sm text-muted">
        Sinu kasutaja pole veel töötaja profiiliga seotud. Palu salongi omanikul
        see Seadete all siduda.
      </p>
    );
  }

  const [allStaff, categories] = await Promise.all([
    db.query.staffMembers.findMany({
      where: and(
        eq(s.staffMembers.businessId, business.id),
        eq(s.staffMembers.active, true),
      ),
      orderBy: [asc(s.staffMembers.sortOrder)],
      columns: { id: true, name: true },
    }),
    db.query.serviceCategories.findMany({
      where: eq(s.serviceCategories.businessId, business.id),
      orderBy: [asc(s.serviceCategories.sortOrder)],
    }),
  ]);
  // töötaja näeb ainult ennast
  const staffFilter =
    user.role === "STAFF"
      ? user.staffId!
      : allStaff.some((m) => m.id === str("staff"))
        ? str("staff")!
        : "";
  const canMove = (b: { status: string; staffId: string }) =>
    MOVABLE.includes(b.status) &&
    (user.role !== "STAFF" || b.staffId === user.staffId);

  const q = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const next = {
      date: isoDate,
      vaade: view === "paev" ? null : view,
      staff: user.role === "STAFF" ? null : staffFilter || null,
      ...patch,
    };
    for (const [k, v] of Object.entries(next)) if (v) p.set(k, v);
    const qs = p.toString();
    return `/kalender${qs ? `?${qs}` : ""}`;
  };

  // ---------- vaated ----------
  let body: React.ReactNode;
  let title: string;
  let prev: string;
  let next: string;

  if (view === "kuu") {
    const first = `${isoDate.slice(0, 7)}-01`;
    const gridStart = mondayOf(first);
    const { days, bookings } = await loadRange(
      business.id,
      gridStart,
      42,
      tz,
      staffFilter || null,
    );
    const nextMonth = addDaysIso(first, 32).slice(0, 7) + "-01";
    const prevMonth = addDaysIso(first, -1).slice(0, 7) + "-01";
    title = formatMonth(first).replace(/^./, (c) => c.toUpperCase());
    prev = q({ date: prevMonth });
    next = q({ date: nextMonth });
    const weeks = Array.from({ length: 6 }, (_, w) =>
      days.slice(w * 7, w * 7 + 7),
    ).filter((w, i) => i < 5 || w[0].date.slice(0, 7) === first.slice(0, 7));
    body = (
      <Card className="overflow-hidden">
        <div className="grid grid-cols-7 border-b border-line bg-white text-center text-xs font-semibold text-muted">
          {WEEKDAY_SHORT.map((d) => (
            <div key={d} className="py-2.5">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {weeks.flat().map((d) => {
            const list = bookings.filter(
              (b) => b.date === d.date && b.status !== "CANCELLED",
            );
            const inMonth = d.date.slice(0, 7) === first.slice(0, 7);
            const closed = d.opening === null;
            return (
              <Link
                key={d.date}
                href={q({ date: d.date, vaade: null })}
                className={clsx(
                  "group min-h-[96px] border-b border-l border-line-soft p-1.5 text-left transition-colors hover:bg-lime-soft/50 sm:min-h-[118px] sm:p-2 [&:nth-child(7n+1)]:border-l-0",
                  !inMonth && "bg-[#fafafa] text-subtle",
                  closed && inMonth && "bg-[#f9fafb]",
                )}
              >
                <div className="flex items-center justify-between gap-1">
                  <span
                    className={clsx(
                      "grid size-6 place-items-center rounded-full text-xs font-semibold",
                      d.date === today && "bg-ink text-white",
                    )}
                  >
                    {Number(d.date.slice(8, 10))}
                  </span>
                  {list.length > 0 && (
                    <span className="rounded-full bg-line-soft px-1.5 text-[11px] font-semibold text-muted sm:hidden">
                      {list.length}
                    </span>
                  )}
                </div>
                {d.holidayName && (
                  <p className="mt-0.5 truncate text-[10px] text-muted">
                    {d.holidayName}
                  </p>
                )}
                <ul className="mt-1 hidden space-y-0.5 sm:block">
                  {list.slice(0, 3).map((b) => (
                    <li
                      key={b.id}
                      className="flex items-center gap-1 truncate text-[11px]"
                    >
                      <span
                        className="size-1.5 shrink-0 rounded-full"
                        style={{ background: b.categoryColor }}
                      />
                      <span className="text-muted">{fromMinutes(b.start)}</span>
                      <span className="truncate text-ink">{b.serviceName}</span>
                    </li>
                  ))}
                  {list.length > 3 && (
                    <li className="text-[11px] font-semibold text-muted">
                      +{list.length - 3} veel
                    </li>
                  )}
                </ul>
              </Link>
            );
          })}
        </div>
      </Card>
    );
  } else if (view === "nadal") {
    const monday = mondayOf(isoDate);
    const { days, bookings } = await loadRange(
      business.id,
      monday,
      7,
      tz,
      staffFilter || null,
    );
    title = `${shortDm(monday)}–${shortDm(addDaysIso(monday, 6))}.${addDaysIso(monday, 6).slice(0, 4)}`;
    prev = q({ date: addDaysIso(monday, -7) });
    next = q({ date: addDaysIso(monday, 7) });
    const { startMin, endMin } = bounds(
      days.flatMap((d) => [d.opening, d.shift]),
      bookings,
    );
    const columns: GridColumn[] = days.map((d: RangeDay) => ({
      key: d.date,
      date: d.date,
      staffId: null,
      label: `${WEEKDAY_SHORT[isoWeekday(d.date) - 1]} ${shortDm(d.date)}`,
      shading: staffFilter
        ? shadingFor(d.absent ? null : (d.shift ?? null))
        : shadingFor(d.opening),
      breaks: d.breaks ?? [],
      free: [],
      absent: d.absent ? { title: "Puudub" } : undefined,
    }));
    // nädalavaates tühistatud peidetud (päevavaates näha)
    const gridBookings: GridBooking[] = bookings
      .filter((b) => b.status !== "CANCELLED" && b.status !== "NO_SHOW")
      .map((b) => ({
        id: b.id,
        colKey: b.date,
        staffId: b.staffId,
        start: b.start,
        end: b.end,
        color: b.categoryColor,
        title: b.serviceName,
        subtitle: b.clientName,
        cancelled: b.status === "CANCELLED" || b.status === "NO_SHOW",
        draggable: canMove(b),
        staff: staffFilter
          ? undefined
          : { name: b.staffName, color: b.staffColor },
      }));
    const headers = days.map((d) => {
      const n = bookings.filter(
        (b) => b.date === d.date && b.status !== "CANCELLED",
      ).length;
      return (
        <Link
          key={d.date}
          href={q({ date: d.date, vaade: null })}
          className="flex flex-col items-center px-2 py-2.5 hover:bg-line-soft"
        >
          <span className="text-xs font-semibold text-muted">
            {WEEKDAY_SHORT[isoWeekday(d.date) - 1]}
          </span>
          <span
            className={clsx(
              "mt-0.5 grid size-7 place-items-center rounded-full text-sm font-bold",
              d.date === today && "bg-ink text-white",
            )}
          >
            {Number(d.date.slice(8, 10))}
          </span>
          <span className="mt-0.5 truncate text-[11px] text-muted">
            {d.holidayName ??
              (d.opening === null ? "Suletud" : `${n} broneeringut`)}
          </span>
        </Link>
      );
    });
    const nowMin = localMinutes(new Date(), tz);
    body = (
      <Card className="max-h-[calc(100dvh-210px)] overflow-auto">
        <TimeGrid
          key={`w-${monday}-${staffFilter}`}
          columns={columns}
          bookings={gridBookings}
          headers={headers}
          startMin={startMin}
          endMin={endMin}
          step={business.slotStepMinutes}
          now={
            days.some((d) => d.date === today)
              ? { colKey: today, min: nowMin }
              : null
          }
          minColWidth={120}
        />
      </Card>
    );
  } else {
    const fullDay = await loadDay(business.id, isoDate, tz);
    const day = staffFilter
      ? {
          ...fullDay,
          columns: fullDay.columns.filter((c) => c.id === staffFilter),
          bookings: fullDay.bookings.filter((b) => b.staffId === staffFilter),
        }
      : fullDay;
    title = formatLongDate(isoDate);
    prev = q({ date: addDaysIso(isoDate, -1) });
    next = q({ date: addDaysIso(isoDate, 1) });
    const { startMin, endMin } = bounds(
      [day.opening, ...day.columns.map((c) => c.day.shift)],
      day.bookings,
    );
    const columns: GridColumn[] = day.columns.map((c) => {
      const busy = c.bookings.map((b) => ({ start: b.start, end: b.end }));
      const free = c.day.absent
        ? []
        : subtract(c.day.working, busy).filter(
            (f) => f.end - f.start >= MIN_FREE_BLOCK,
          );
      return {
        key: c.id,
        date: isoDate,
        staffId: c.id,
        label: c.name,
        shading: !c.day.scheduled
          ? [{ start: 0, end: 24 * 60 }]
          : c.day.shift && !c.day.absent
            ? shadingFor(c.day.shift)
            : [],
        breaks: c.day.breaks,
        free: free.map((f) => ({
          start: f.start,
          end: f.end,
          href: `/broneeringud/uus?staff=${c.id}&date=${isoDate}&time=${fromMinutes(f.start)}`,
        })),
        absent: c.day.absent
          ? {
              title:
                c.absence?.note === "Puhkus" || !c.absence?.note
                  ? "Puhkusel"
                  : c.absence.note,
              sub: c.absence
                ? `${formatShortDate(c.absence.from).slice(0, 5)}–${formatShortDate(c.absence.to).slice(0, 5)}`
                : undefined,
            }
          : undefined,
      };
    });
    const gridBookings: GridBooking[] = day.bookings
      .filter((b) => columns.some((c) => c.key === b.staffId))
      .map((b) => ({
        id: b.id,
        colKey: b.staffId,
        staffId: b.staffId,
        start: b.start,
        end: b.end,
        color: b.categoryColor,
        title: b.serviceName,
        subtitle: b.clientName,
        cancelled: b.status === "CANCELLED" || b.status === "NO_SHOW",
        draggable: canMove(b),
      }));
    const headers = day.columns.map((c) => {
      const active = c.bookings.filter((b) => b.status !== "CANCELLED").length;
      return (
        <div key={c.id} className="flex items-center gap-2.5 px-3 py-3">
          <Avatar name={c.name} color={c.color} size={30} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{c.name}</p>
            <p className="truncate text-xs text-muted">
              {c.day.absent || !c.day.scheduled
                ? "Puudub"
                : `${active} broneeringut · ${Math.round(c.utilization * 100)}%`}
            </p>
          </div>
        </div>
      );
    });
    body = (
      <Card className="max-h-[calc(100dvh-210px)] overflow-auto">
        {day.holidayName && (
          <p className="border-b border-line bg-[#fffaeb] px-4 py-2 text-[13px] text-[#93370d]">
            {day.holidayName}
          </p>
        )}
        <TimeGrid
          key={`d-${isoDate}-${staffFilter}`}
          columns={columns}
          bookings={gridBookings}
          headers={headers}
          startMin={startMin}
          endMin={endMin}
          step={business.slotStepMinutes}
          now={
            isoDate === today
              ? { colKey: null, min: localMinutes(new Date(), tz) }
              : null
          }
        />
      </Card>
    );
  }

  const tabs: { v: View; label: string }[] = [
    { v: "paev", label: "Päev" },
    { v: "nadal", label: "Nädal" },
    { v: "kuu", label: "Kuu" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={prev}
          aria-label="Eelmine"
          className="grid size-9 place-items-center rounded-lg hover:bg-white"
        >
          <ChevronLeft size={18} />
        </Link>
        <Link
          href={next}
          aria-label="Järgmine"
          className="grid size-9 place-items-center rounded-lg hover:bg-white"
        >
          <ChevronRight size={18} />
        </Link>
        <LinkButton href={q({ date: null })} size="sm">
          Täna
        </LinkButton>
        <h1 className="ml-1 text-lg font-bold text-ink">{title}</h1>

        <div className="ml-auto flex flex-wrap items-center gap-2.5">
          {user.role !== "STAFF" && allStaff.length > 1 && (
            <StaffFilter staff={allStaff} value={staffFilter} />
          )}
          <nav
            className="flex rounded-[10px] bg-line-soft p-0.5 text-[13px]"
            aria-label="Vaade"
          >
            {tabs.map((t) => (
              <Link
                key={t.v}
                href={q({ vaade: t.v === "paev" ? null : t.v })}
                aria-current={view === t.v ? "page" : undefined}
                className={clsx(
                  "rounded-lg px-3 py-1.5",
                  view === t.v
                    ? "bg-white font-semibold shadow-sm"
                    : "text-muted hover:text-ink",
                )}
              >
                {t.label}
              </Link>
            ))}
          </nav>
          {user.role !== "STAFF" && (
            <LinkButton href="/tooajad" size="sm">
              <X size={15} />
              Blokeeri aeg
            </LinkButton>
          )}
        </div>
      </div>

      {body}

      <div className="flex flex-wrap items-center justify-between gap-3 text-[13px] text-muted">
        <div className="flex flex-wrap items-center gap-4">
          {categories.map((c) => (
            <span key={c.id} className="flex items-center gap-1.5">
              <span
                className="size-2.5 rounded-sm"
                style={{ background: c.color }}
              />
              {c.name}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-[#98a2b3]" />
            Tühistatud
          </span>
        </div>
        <p>
          {view === "kuu"
            ? "Vajuta päevale, et avada päevavaade"
            : "Lohista broneeringut, et muuta aega või töötajat · puutega hoia sõrme all"}
        </p>
      </div>
    </div>
  );
}

export default function CalendarPage(props: PageProps<"/kalender">) {
  return (
    <Suspense
      fallback={
        <div className="h-[600px] animate-pulse rounded-[14px] bg-white" />
      }
    >
      <Calendar searchParams={props.searchParams} />
    </Suspense>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, GripVertical, Plus } from "lucide-react";
import { clsx } from "clsx";
import { fromMinutes } from "@/lib/time";
import { moveBooking } from "./actions";

export const PX_PER_MIN = 1.2; // 72 px tunnis

export type GridColumn = {
  key: string;
  date: string;
  staffId: string | null;
  label: string;
  /** hallid alad (väljaspool tööaega / suletud) */
  shading: { start: number; end: number }[];
  breaks: { start: number; end: number; label: string }[];
  free: { start: number; end: number; href: string }[];
  absent?: { title: string; sub?: string };
};

export type GridBooking = {
  id: string;
  colKey: string;
  staffId: string;
  start: number;
  end: number;
  color: string;
  title: string;
  subtitle: string;
  cancelled: boolean;
  draggable: boolean;
  /** nädalavaates: kelle broneering */
  staff?: { name: string; color: string };
};

type Drag = {
  id: string;
  pointerId: number;
  grabOffset: number; // minutid broneeringu algusest
  originX: number;
  originY: number;
  active: boolean;
  colKey: string;
  start: number;
};

type Pending = { booking: GridBooking; col: GridColumn; start: number };

const LONG_PRESS_MS = 350;

/** Kattuvad broneeringud kõrvuti (rajad) */
function layout(bookings: GridBooking[]) {
  const out = new Map<string, { lane: number; lanes: number }>();
  const sorted = [...bookings].sort((a, b) => a.start - b.start || b.end - a.end);
  let cluster: GridBooking[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const laneEnds: number[] = [];
    const lanesOf = new Map<string, number>();
    for (const b of cluster) {
      let lane = laneEnds.findIndex((e) => e <= b.start);
      if (lane === -1) lane = laneEnds.push(0) - 1;
      laneEnds[lane] = b.end;
      lanesOf.set(b.id, lane);
    }
    for (const b of cluster) out.set(b.id, { lane: lanesOf.get(b.id)!, lanes: laneEnds.length });
    cluster = [];
  };
  for (const b of sorted) {
    if (cluster.length && b.start >= clusterEnd) flush();
    cluster.push(b);
    clusterEnd = Math.max(clusterEnd, b.end);
  }
  if (cluster.length) flush();
  return out;
}

export function TimeGrid({
  columns,
  bookings: initial,
  headers,
  startMin,
  endMin,
  step,
  now,
  minColWidth = 160,
}: {
  columns: GridColumn[];
  bookings: GridBooking[];
  headers: ReactNode[];
  startMin: number;
  endMin: number;
  step: number;
  now: { colKey: string | null; min: number } | null;
  minColWidth?: number;
}) {
  const router = useRouter();
  const [bookings, setBookings] = useState(initial);
  const [drag, setDragState] = useState<Drag | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [notify, setNotify] = useState(true);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, startSaving] = useTransition();
  const colRefs = useRef(new Map<string, HTMLDivElement>());
  const dragged = useRef(false); // klikk pärast lohistamist ei ava broneeringut
  const pressTimer = useRef<number | null>(null);
  const dragRef = useRef<Drag | null>(null);
  // ref + olek koos: pointer-sündmused loevad ref'i kohe, renderdus olekut
  const setDrag = (next: Drag | null | ((cur: Drag | null) => Drag | null)) => {
    dragRef.current = typeof next === "function" ? next(dragRef.current) : next;
    setDragState(dragRef.current);
  };

  // serverist uued andmed (router.refresh) → uuenda
  const [prevInitial, setPrevInitial] = useState(initial);
  if (prevInitial !== initial) {
    setPrevInitial(initial);
    setBookings(initial);
  }

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(t);
  }, [toast]);

  // puutel lohistades ei tohi leht kerida
  useEffect(() => {
    const block = (e: TouchEvent) => {
      if (dragRef.current?.active) e.preventDefault();
    };
    document.addEventListener("touchmove", block, { passive: false });
    return () => document.removeEventListener("touchmove", block);
  }, []);

  const height = (endMin - startMin) * PX_PER_MIN;
  const hours = Array.from({ length: Math.max(0, (endMin - startMin) / 60) }, (_, i) => startMin + i * 60);
  const y = (m: number) => (m - startMin) * PX_PER_MIN;
  const snap = Math.max(5, step || 15);

  const byCol = useMemo(() => {
    const m = new Map<string, GridBooking[]>();
    for (const b of bookings) m.set(b.colKey, [...(m.get(b.colKey) ?? []), b]);
    return m;
  }, [bookings]);
  const lanes = useMemo(() => {
    const all = new Map<string, { lane: number; lanes: number }>();
    for (const list of byCol.values()) for (const [k, v] of layout(list.filter((b) => !b.cancelled))) all.set(k, v);
    return all;
  }, [byCol]);

  function locate(clientX: number, clientY: number, d: Drag, b: GridBooking) {
    let colKey = d.colKey;
    for (const [key, el] of colRefs.current) {
      const r = el.getBoundingClientRect();
      if (clientX >= r.left && clientX < r.right) {
        colKey = key;
        const raw = (clientY - r.top) / PX_PER_MIN + startMin - d.grabOffset;
        const dur = b.end - b.start;
        const start = Math.min(Math.max(Math.round(raw / snap) * snap, startMin), endMin - dur);
        return { colKey, start };
      }
    }
    return { colKey, start: d.start };
  }

  function onPointerDown(e: React.PointerEvent, b: GridBooking) {
    if (!b.draggable || e.button !== 0 || saving) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const d: Drag = {
      id: b.id,
      pointerId: e.pointerId,
      grabOffset: Math.round((e.clientY - rect.top) / PX_PER_MIN),
      originX: e.clientX,
      originY: e.clientY,
      active: false,
      colKey: b.colKey,
      start: b.start,
    };
    dragged.current = false;
    setDrag(d);
    if (e.pointerType === "touch") {
      // puutel: hoia sõrme all, siis lohista (muidu leht kerib)
      pressTimer.current = window.setTimeout(() => {
        setDrag((cur) => (cur && cur.id === b.id ? { ...cur, active: true } : cur));
        navigator.vibrate?.(15);
      }, LONG_PRESS_MS);
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const moved = Math.hypot(e.clientX - d.originX, e.clientY - d.originY);
    if (!d.active) {
      if (e.pointerType === "touch") {
        if (moved > 8 && pressTimer.current) {
          window.clearTimeout(pressTimer.current); // kerimine, mitte lohistamine
          pressTimer.current = null;
          setDrag(null);
        }
        return;
      }
      if (moved < 5) return;
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    }
    const b = bookings.find((x) => x.id === d.id)!;
    const pos = locate(e.clientX, e.clientY, d, b);
    dragged.current = true;
    setDrag({ ...d, active: true, ...pos });
  }

  function onPointerUp(e: React.PointerEvent) {
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
    pressTimer.current = null;
    const d = dragRef.current;
    setDrag(null);
    if (!d || !d.active || e.pointerId !== d.pointerId) return;
    const b = bookings.find((x) => x.id === d.id)!;
    if (d.colKey === b.colKey && d.start === b.start) return;
    const col = columns.find((c) => c.key === d.colKey)!;
    setNotify(true);
    setPending({ booking: b, col, start: d.start });
  }

  function confirmMove() {
    if (!pending) return;
    const { booking: b, col, start } = pending;
    const staffId = col.staffId ?? b.staffId;
    const dur = b.end - b.start;
    const before = bookings;
    // optimistlik: liiguta kohe
    setBookings((list) => list.map((x) => (x.id === b.id ? { ...x, colKey: col.key, staffId, start, end: start + dur } : x)));
    setPending(null);
    startSaving(async () => {
      const r = await moveBooking({ bookingId: b.id, staffId, date: col.date, start, notify: notify && (col.date !== columns.find((c) => c.key === b.colKey)?.date || start !== b.start) });
      setToast({ ok: r.ok, text: r.message });
      if (!r.ok) setBookings(before);
      else router.refresh();
    });
  }

  const dragBooking = drag?.active ? bookings.find((b) => b.id === drag.id) : null;
  const timeChanged = pending && (pending.start !== pending.booking.start || pending.col.date !== columns.find((c) => c.key === pending.booking.colKey)?.date);
  const staffChanged = pending && pending.col.staffId && pending.col.staffId !== pending.booking.staffId;

  return (
    <>
      <div
        className={clsx("select-none", drag?.active && "cursor-grabbing")}
        style={{ display: "grid", gridTemplateColumns: `64px repeat(${columns.length}, minmax(${minColWidth}px, 1fr))`, minWidth: 64 + columns.length * minColWidth }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          if (pressTimer.current) window.clearTimeout(pressTimer.current);
          setDrag(null);
        }}
      >
        <div className="sticky top-0 z-[8] border-b border-line bg-white" />
        {headers.map((h, i) => (
          <div key={columns[i].key} className="sticky top-0 z-[8] border-b border-l border-line border-l-line-soft bg-white">
            {h}
          </div>
        ))}

        {/* kellaajad */}
        <div className="relative" style={{ height }}>
          {hours.map((h) => (
            <span key={h} className="absolute right-2.5 -translate-y-1/2 text-xs text-muted" style={{ top: y(h) + (h === startMin ? 10 : 0) }}>
              {fromMinutes(h)}
            </span>
          ))}
        </div>

        {columns.map((col) => {
          const list = byCol.get(col.key) ?? [];
          const isTarget = drag?.active && drag.colKey === col.key;
          return (
            <div
              key={col.key}
              ref={(el) => {
                if (el) colRefs.current.set(col.key, el);
                else colRefs.current.delete(col.key);
              }}
              className={clsx("relative border-l border-line-soft", isTarget && "bg-lime-soft/40")}
              style={{ height }}
            >
              {col.shading.map((sh, i) => (
                <div key={i} className="absolute inset-x-0 bg-[#f9fafb]" style={{ top: y(Math.max(sh.start, startMin)), height: (Math.min(sh.end, endMin) - Math.max(sh.start, startMin)) * PX_PER_MIN }} />
              ))}
              {hours.slice(1).map((h) => (
                <div key={h} className="pointer-events-none absolute inset-x-0 border-t border-line-soft" style={{ top: y(h) }} />
              ))}
              {col.absent ? (
                <div className="absolute inset-1.5 grid place-items-center rounded-md border border-dashed border-[#d0d5dd] bg-line-soft text-center text-muted">
                  <div>
                    <CalendarDays size={18} className="mx-auto mb-1.5" />
                    <p className="text-xs font-semibold text-[#475467]">{col.absent.title}</p>
                    {col.absent.sub && <p className="mt-0.5 text-[11px]">{col.absent.sub}</p>}
                  </div>
                </div>
              ) : (
                <>
                  {col.breaks.map((br) => (
                    <div key={br.start} className="absolute inset-x-1.5 grid place-items-center rounded-md border border-dashed border-[#d0d5dd] text-xs text-muted" style={{ top: y(br.start) + 2, height: (br.end - br.start) * PX_PER_MIN - 4 }}>
                      {br.label}
                    </div>
                  ))}
                  {!drag?.active &&
                    col.free.map((f) => (
                      <Link
                        key={f.start}
                        href={f.href}
                        className="group absolute inset-x-1.5 grid place-items-center rounded-md border border-dashed border-transparent text-xs font-semibold text-transparent transition-colors hover:border-lime hover:bg-lime-soft hover:text-ink focus-visible:border-lime focus-visible:text-ink"
                        style={{ top: y(f.start) + 2, height: (f.end - f.start) * PX_PER_MIN - 4 }}
                      >
                        <span className="flex items-center gap-1">
                          <Plus size={14} /> Vaba aeg
                        </span>
                      </Link>
                    ))}
                  {list.map((b) => {
                    const l = lanes.get(b.id) ?? { lane: 0, lanes: 1 };
                    const isDragged = drag?.active && drag.id === b.id;
                    return (
                      <Block
                        key={b.id}
                        b={b}
                        top={y(b.start)}
                        lane={l}
                        ghost={!!isDragged}
                        onPointerDown={(e) => onPointerDown(e, b)}
                        onClick={(e) => {
                          if (dragged.current) {
                            e.preventDefault();
                            dragged.current = false;
                          }
                        }}
                      />
                    );
                  })}
                  {isTarget && dragBooking && (
                    <div
                      className="pointer-events-none absolute inset-x-1.5 z-[7] rounded-md border-2 border-dashed px-2 py-1 text-xs font-semibold shadow-lg"
                      style={{ top: y(drag.start) + 2, height: Math.max((dragBooking.end - dragBooking.start) * PX_PER_MIN - 4, 22), borderColor: dragBooking.color, background: `linear-gradient(${dragBooking.color}26, ${dragBooking.color}26), #fff` }}
                    >
                      <span style={{ color: dragBooking.color }}>
                        {fromMinutes(drag.start)}–{fromMinutes(drag.start + dragBooking.end - dragBooking.start)}
                      </span>
                      <span className="block truncate text-ink">{dragBooking.title}</span>
                    </div>
                  )}
                </>
              )}
              {now && (now.colKey === null || now.colKey === col.key) && now.min > startMin && now.min < endMin && (
                <div className="pointer-events-none absolute inset-x-0 z-[6] border-t border-danger" style={{ top: y(now.min) }} />
              )}
            </div>
          );
        })}
      </div>

      {pending && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" onClick={() => setPending(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="move-title" className="w-full max-w-[380px] rounded-[14px] bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 id="move-title" className="text-base font-bold">
              Liiguta broneering?
            </h2>
            <p className="mt-1 text-sm text-muted">{pending.booking.title}</p>
            <dl className="mt-4 space-y-2 rounded-[10px] bg-line-soft p-3 text-sm">
              {timeChanged && (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Aeg</dt>
                  <dd className="text-right font-semibold">
                    {Number(pending.col.date.slice(8, 10))}.{Number(pending.col.date.slice(5, 7))} kell {fromMinutes(pending.start)}–{fromMinutes(pending.start + pending.booking.end - pending.booking.start)}
                  </dd>
                </div>
              )}
              {staffChanged && (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Töötaja</dt>
                  <dd className="text-right font-semibold">{pending.col.label}</dd>
                </div>
              )}
            </dl>
            {timeChanged && (
              <label className="mt-4 flex items-center gap-2.5 text-sm">
                <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="size-4 accent-[#4d7c0f]" />
                Saada kliendile teade uuest ajast
              </label>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setPending(null)} className="h-10 rounded-[10px] border border-line px-4 text-sm font-semibold hover:bg-line-soft">
                Katkesta
              </button>
              <button type="button" autoFocus onClick={confirmMove} className="h-10 rounded-[10px] bg-lime px-4 text-sm font-semibold text-ink">
                Liiguta
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div role="status" className={clsx("fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-[10px] px-4 py-2.5 text-sm font-medium shadow-lg", toast.ok ? "bg-ink text-white" : "bg-[#b42318] text-white")}>
          {toast.text}
        </div>
      )}
    </>
  );
}

function Block({
  b,
  top,
  lane,
  ghost,
  onPointerDown,
  onClick,
}: {
  b: GridBooking;
  top: number;
  lane: { lane: number; lanes: number };
  ghost: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onClick: (e: React.MouseEvent) => void;
}) {
  const color = b.cancelled ? "#98a2b3" : b.color;
  const h = Math.max((b.end - b.start) * PX_PER_MIN - 4, 22);
  const compact = b.end - b.start <= 45;
  const width = `calc((100% - 12px) / ${lane.lanes})`;
  return (
    <Link
      href={`/broneeringud/${b.id}`}
      draggable={false}
      title={`${fromMinutes(b.start)}–${fromMinutes(b.end)} ${b.title} · ${b.subtitle}${b.draggable ? " · lohista, et aega muuta" : ""}`}
      onPointerDown={onPointerDown}
      onClick={onClick}
      onContextMenu={(e) => e.preventDefault()}
      className={clsx(
        "group absolute overflow-hidden rounded-md border-l-[3px] px-2 py-1.5 text-xs transition-shadow hover:shadow-md",
        b.draggable && "cursor-grab [-webkit-touch-callout:none]",
        ghost && "opacity-35",
        b.cancelled && "z-0",
      )}
      style={{
        top: top + 2,
        height: h,
        left: `calc(6px + ${width} * ${lane.lane})`,
        width: b.cancelled ? "calc(100% - 12px)" : width,
        borderColor: color,
        background: `linear-gradient(${color}14, ${color}14), #fff`,
      }}
    >
      {b.draggable && <GripVertical size={12} className="absolute top-1 right-1 text-subtle opacity-0 group-hover:opacity-100" aria-hidden />}
      {compact ? (
        <p className="truncate">
          <span className="font-medium" style={{ color }}>
            {fromMinutes(b.start)}
          </span>{" "}
          <span className="font-semibold text-ink">{b.title}</span>
        </p>
      ) : (
        <>
          <p className="font-medium" style={{ color }}>
            {fromMinutes(b.start)}–{fromMinutes(b.end)}
          </p>
          <p className="truncate font-semibold text-ink">{b.title}</p>
          <p className="truncate text-muted">
            {b.subtitle}
            {b.cancelled && " · tühistatud"}
          </p>
          {b.staff && (
            <p className="mt-0.5 flex items-center gap-1 truncate text-muted">
              <span className="size-2 shrink-0 rounded-full" style={{ background: b.staff.color }} />
              {b.staff.name}
            </p>
          )}
        </>
      )}
    </Link>
  );
}

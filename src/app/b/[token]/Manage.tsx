"use client";

import { useEffect, useMemo, useState, useTransition, type CSSProperties } from "react";
import { ArrowLeft, CalendarPlus, ChevronLeft, ChevronRight, Info, Phone, X } from "lucide-react";
import { clsx } from "clsx";
import { addDaysIso, formatEuro } from "@/lib/time";
import { dayLong, dayNum, dayShort, dayShortYear, monthYear, weekdayLetter } from "@/lib/date-et";
import { daySlots, weekDays } from "@/app/w/[slug]/actions";
import { cancel, reschedule } from "./actions";

type Booking = {
  number: string; status: string; serviceId: string; serviceName: string; staffId: string; staffName: string;
  date: string; start: string; end: string; finalCents: number; paidCents: number; deadlineDate: string; deadlineTime: string; canChange: boolean;
};
type Biz = { name: string; slug: string; address: string | null; phone: string | null; logoUrl: string | null; maxAdvanceDays: number };

const STATUS: Record<string, { label: string; cls: string }> = {
  CONFIRMED: { label: "Kinnitatud", cls: "bg-[#ecfdf3] text-[#067647]" },
  PENDING_PAYMENT: { label: "Ootab kinnitust", cls: "bg-[#fffaeb] text-[#b54708]" },
  HELD: { label: "Hoitud", cls: "bg-[#fffaeb] text-[#b54708]" },
  COMPLETED: { label: "Toimunud", cls: "bg-black/5" },
  CANCELLED: { label: "Tühistatud", cls: "bg-[#fef3f2] text-[#b42318]" },
  NO_SHOW: { label: "Ei tulnud kohale", cls: "bg-[#fef3f2] text-[#b42318]" },
};
const REASONS = ["Aeg ei sobi", "Haigestusin", "Leidsin muu aja", "Muu"];
const eur = (c: number) => formatEuro(c, { decimals: true });

export function Manage({ token, today, theme, biz, booking: b }: { token: string; today: string; theme: { primary: string; onPrimary: string }; biz: Biz; booking: Booking }) {
  const [view, setView] = useState<"main" | "move">("main");
  const [sheet, setSheet] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const style = { "--w-primary": theme.primary, "--w-on-primary": theme.onPrimary } as CSSProperties;
  const st = STATUS[b.status] ?? STATUS.CONFIRMED;

  return (
    <div style={style} className="flex min-h-dvh justify-center bg-[#f3f4f6] sm:py-8">
      <div className="relative flex min-h-dvh w-full flex-col bg-white sm:min-h-0 sm:max-w-[440px] sm:rounded-[20px] sm:shadow-[0_24px_60px_rgba(16,24,40,0.12)]">
        {view === "main" ? (
          <>
            <header className="flex items-center gap-3 border-b border-black/5 px-5 py-4">
              <span className="grid size-10 place-items-center overflow-hidden rounded-[12px] bg-[var(--w-primary)] text-[14px] font-bold text-[var(--w-on-primary)]">
                {biz.logoUrl ? <img src={biz.logoUrl} alt="" className="size-full object-cover" /> : biz.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
              </span>
              <div>
                <p className="text-[13px] text-[#6b7280]">{biz.name}</p>
                <h1 className="text-[17px] font-semibold">Minu broneering</h1>
              </div>
            </header>
            <div className="flex-1 px-5 py-5">
              {msg && (
                <p role="status" className={clsx("mb-4 rounded-[12px] px-3 py-2.5 text-[14px]", msg.ok ? "bg-[#ecfdf3] text-[#067647]" : "bg-[#fef3f2] text-[#b42318]")}>
                  {msg.text}
                </p>
              )}
              <div className="flex items-center justify-between">
                <span className={clsx("rounded-full px-2.5 py-1 text-[12px] font-semibold", st.cls)}>{st.label}</span>
                <span className="text-[13px] text-[#6b7280]">{b.number}</span>
              </div>
              <h2 className="mt-3 text-[22px] font-bold">{b.serviceName}</h2>
              <dl className="mt-4 divide-y divide-black/5 rounded-[14px] border border-black/10">
                {[
                  ["Aeg", `${dayShortYear(b.date)} kell ${b.start}–${b.end}`],
                  ["Spetsialist", b.staffName],
                  ...(biz.address ? [["Asukoht", biz.address]] : []),
                  ["Hind", b.paidCents > 0 ? `${eur(b.paidCents)} makstud · kohapeal ${eur(Math.max(0, b.finalCents - b.paidCents))}` : `${eur(b.finalCents)} · tasud kohapeal`],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 px-4 py-3 text-[14px]">
                    <dt className="text-[#6b7280]">{k}</dt>
                    <dd className="text-right font-medium">{v}</dd>
                  </div>
                ))}
              </dl>

              {b.status !== "CANCELLED" && (
                <div className="mt-4 space-y-2">
                  <a href={`/b/${token}/kalender.ics`} className="flex h-12 items-center justify-center gap-2 rounded-full border border-black/15 text-[15px] font-semibold">
                    <CalendarPlus size={17} aria-hidden /> Lisa kalendrisse
                  </a>
                  {b.canChange && (
                    <>
                      <button type="button" onClick={() => { setMsg(null); setView("move"); }} className="flex h-12 w-full items-center justify-center rounded-full bg-[var(--w-primary)] text-[15px] font-semibold text-[var(--w-on-primary)]">
                        Muuda aega
                      </button>
                      <button type="button" onClick={() => setSheet(true)} className="flex h-12 w-full items-center justify-center gap-2 rounded-full text-[15px] font-semibold text-[#b42318] hover:bg-[#fef3f2]">
                        <X size={17} aria-hidden /> Tühista broneering
                      </button>
                    </>
                  )}
                </div>
              )}
              {b.status !== "CANCELLED" && (
                <p className="mt-4 flex gap-2 rounded-[12px] bg-black/[0.04] p-3 text-[13px] text-[#374151]">
                  <Info size={16} className="mt-0.5 shrink-0" aria-hidden />
                  {b.canChange
                    ? `Tasuta muutmine ja tühistamine kuni ${dayShort(b.deadlineDate)} kell ${b.deadlineTime}.`
                    : "Veebis muutmise aeg on läbi. Muutmiseks võta ühendust salongiga."}
                </p>
              )}
              {b.status === "CANCELLED" && (
                <a href={`/w/${biz.slug}`} className="mt-5 flex h-12 items-center justify-center rounded-full bg-[var(--w-primary)] text-[15px] font-semibold text-[var(--w-on-primary)]">
                  Broneeri uus aeg
                </a>
              )}
              {biz.phone && (
                <p className="mt-5 flex items-center justify-center gap-1.5 text-[14px] text-[#6b7280]">
                  <Phone size={14} aria-hidden /> Küsimus? Helista{" "}
                  <a href={`tel:${biz.phone.replace(/\s/g, "")}`} className="font-semibold text-[#1f2937] underline-offset-4 hover:underline">
                    {biz.phone}
                  </a>
                </p>
              )}
            </div>
          </>
        ) : (
          <Move
            token={token}
            today={today}
            biz={biz}
            b={b}
            onBack={() => setView("main")}
            onDone={(text) => {
              setMsg({ ok: true, text });
              setView("main");
            }}
          />
        )}

        {sheet && (
          <div className="absolute inset-0 z-10 flex items-end bg-black/40 sm:rounded-[20px]" onClick={() => setSheet(false)}>
            <div role="dialog" aria-modal="true" aria-labelledby="cancel-title" className="w-full rounded-t-[20px] bg-white p-5" onClick={(e) => e.stopPropagation()}>
              <h2 id="cancel-title" className="text-[19px] font-bold">
                Tühistada broneering?
              </h2>
              <p className="mt-1 text-[14px] text-[#6b7280]">
                {b.serviceName}, {dayShort(b.date)} kell {b.start}
              </p>
              {b.paidCents > 0 && <p className="mt-3 rounded-[12px] bg-[#ecfdf3] p-3 text-[13px] text-[#067647]">Tagastame {eur(b.paidCents)} samale kontole 3–5 tööpäeva jooksul.</p>}
              <p className="mt-4 text-[13px] font-medium">Põhjus (valikuline)</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {REASONS.map((r) => (
                  <button key={r} type="button" aria-pressed={reason === r} onClick={() => setReason(reason === r ? null : r)} className={clsx("h-9 rounded-full border px-3.5 text-[14px]", reason === r ? "border-[#1f2937] bg-[#1f2937] text-white" : "border-black/15")}>
                    {r}
                  </button>
                ))}
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await cancel(token, reason);
                    setSheet(false);
                    setMsg(r.ok ? { ok: true, text: "Broneering on tühistatud." } : { ok: false, text: r.reason });
                  })
                }
                className="mt-5 flex h-12 w-full items-center justify-center rounded-full bg-[#d92d20] text-[15px] font-semibold text-white disabled:opacity-50"
              >
                {pending ? "Tühistan…" : "Jah, tühista"}
              </button>
              <button type="button" onClick={() => setSheet(false)} className="mt-2 flex h-12 w-full items-center justify-center rounded-full text-[15px] font-semibold">
                Jäta alles
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Move({ token, today, biz, b, onBack, onDone }: { token: string; today: string; biz: Biz; b: Booking; onBack: () => void; onDone: (t: string) => void }) {
  const [weekStart, setWeekStart] = useState(today);
  const [date, setDate] = useState(b.date >= today ? b.date : today);
  const [days, setDays] = useState<{ date: string; free: number }[] | null>(null);
  const [slotsRes, setSlotsRes] = useState<{ date: string; v: { time: string }[] } | null>(null);
  const [picked, setPicked] = useState<{ date: string; time: string } | null>(null);
  const slots = slotsRes?.date === date ? slotsRes.v : null;
  const time = picked?.date === date ? picked.time : null;
  const setTime = (t: string) => setPicked({ date, time: t });
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysIso(weekStart, i)), [weekStart]);

  useEffect(() => {
    let live = true;
    weekDays(biz.slug, b.serviceId, b.staffId, weekStart).then((r) => live && setDays(r));
    return () => {
      live = false;
    };
  }, [biz.slug, b.serviceId, b.staffId, weekStart]);
  useEffect(() => {
    let live = true;
    daySlots(biz.slug, b.serviceId, b.staffId, date).then((r) => live && setSlotsRes({ date, v: r.slots.filter((x) => !(date === b.date && x.time === b.start)) }));
    return () => {
      live = false;
    };
  }, [biz.slug, b.serviceId, b.staffId, date, b.date, b.start]);

  return (
    <>
      <header className="flex items-center gap-2 border-b border-black/5 px-4 py-3">
        <button type="button" onClick={onBack} aria-label="Tagasi" className="grid size-9 place-items-center rounded-full hover:bg-black/5">
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-[17px] font-semibold">Muuda aega</h1>
      </header>
      <div className="flex-1 px-4 py-4">
        <p className="rounded-[12px] bg-black/[0.04] p-3 text-[13px]">Sama teenus ja spetsialist ({b.staffName}). Hind ja makse jäävad samaks.</p>
        <p className="mt-3 text-[14px]">
          Praegu: <b>{dayShort(b.date)} kell {b.start}</b>
        </p>
        <div className="mt-4 flex items-center justify-between">
          <p className="font-semibold">{monthYear(weekStart)}</p>
          <div className="flex gap-1">
            <button type="button" aria-label="Eelmine nädal" disabled={weekStart <= today} onClick={() => setWeekStart(addDaysIso(weekStart, -7) < today ? today : addDaysIso(weekStart, -7))} className="grid size-9 place-items-center rounded-full hover:bg-black/5 disabled:opacity-30">
              <ChevronLeft size={18} />
            </button>
            <button type="button" aria-label="Järgmine nädal" disabled={addDaysIso(weekStart, 7) > addDaysIso(today, biz.maxAdvanceDays)} onClick={() => setWeekStart(addDaysIso(weekStart, 7))} className="grid size-9 place-items-center rounded-full hover:bg-black/5 disabled:opacity-30">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
        <div className="mt-2 grid grid-cols-7 gap-1.5">
          {week.map((d) => {
            const info = days?.find((x) => x.date === d);
            const sel = d === date;
            return (
              <button key={d} type="button" aria-pressed={sel} aria-label={dayLong(d)} onClick={() => setDate(d)} className={clsx("flex h-[56px] flex-col items-center justify-center rounded-[12px] border text-[11px]", sel ? "border-[var(--w-primary)] bg-[var(--w-primary)] text-[var(--w-on-primary)]" : "border-black/10", info?.free === 0 && !sel && "opacity-40")}>
                <span className="uppercase">{weekdayLetter(d)}</span>
                <span className="text-[16px] font-bold">{dayNum(d)}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-5 text-[12px] font-semibold tracking-[0.5px] uppercase text-[#6b7280]">{dayLong(date)}</p>
        {slots === null ? (
          <div className="mt-3 grid grid-cols-4 gap-2">{Array.from({ length: 8 }).map((_, i) => <span key={i} className="h-11 animate-pulse rounded-[10px] bg-black/5" />)}</div>
        ) : slots.length ? (
          <div role="radiogroup" aria-label="Kellaaeg" className="mt-3 grid grid-cols-4 gap-2">
            {slots.map((x) => (
              <button key={x.time} type="button" role="radio" aria-checked={time === x.time} onClick={() => setTime(x.time)} className={clsx("h-11 rounded-[10px] border text-[14px]", time === x.time ? "border-[var(--w-primary)] bg-[var(--w-primary)] font-semibold text-[var(--w-on-primary)]" : "border-black/10")}>
                {x.time}
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-[14px] text-[#6b7280]">Sel päeval vabu aegu pole. Vali teine päev.</p>
        )}
        {err && <p className="mt-3 text-[13px] text-[#b42318]">{err}</p>}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-black/5 px-4 py-3">
        <div>
          <p className="text-[13px] text-[#6b7280]">Uus aeg</p>
          <p className="font-semibold">{time ? `${dayShort(date)} kell ${time}` : "—"}</p>
        </div>
        <button
          type="button"
          disabled={!time || pending}
          onClick={() =>
            start(async () => {
              setErr(null);
              const r = await reschedule(token, date, time!);
              if (r.ok) onDone(`Aeg muudetud: ${dayShort(date)} kell ${time}.`);
              else setErr(r.reason);
            })
          }
          className="h-12 rounded-full bg-[var(--w-primary)] px-6 text-[15px] font-semibold text-[var(--w-on-primary)] disabled:opacity-40"
        >
          Kinnita
        </button>
      </div>
    </>
  );
}

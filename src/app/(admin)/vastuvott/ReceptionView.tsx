"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Gift, Package, Phone, RotateCcw, StickyNote, UserX } from "lucide-react";
import { clsx } from "clsx";
import { Badge } from "@/components/ui/primitives";
import { BOOKING_STATUS } from "@/lib/booking-status";
import { formatEuro } from "@/lib/time";
import { setBookingStatus } from "../broneeringud/actions";

export type ReceptionBooking = {
  id: string;
  number: string;
  startsAt: string;
  endsAt: string;
  time: string;
  status: "HELD" | "PENDING_PAYMENT" | "CONFIRMED" | "COMPLETED" | "NO_SHOW" | "CANCELLED";
  clientName: string;
  phone: string | null;
  service: string;
  staff: string;
  staffColor: string;
  note: string | null;
  package: boolean;
  giftCents: number;
  dueCents: number;
  paidCents: number;
};

const eur = (c: number) => formatEuro(c, { decimals: true });
const DONE = ["COMPLETED", "NO_SHOW"];

export function ReceptionView({ bookings, today, canSeeAll }: { bookings: ReceptionBooking[]; today: string; canSeeAll: boolean }) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const [staff, setStaff] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);

  // kell ja andmed värskenevad ise (tahvel on terve päeva lahti)
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    const refresh = setInterval(() => router.refresh(), 60_000);
    const vis = () => document.visibilityState === "visible" && (setNow(Date.now()), router.refresh());
    document.addEventListener("visibilitychange", vis);
    return () => { clearInterval(tick); clearInterval(refresh); document.removeEventListener("visibilitychange", vis); };
  }, [router]);

  const staffList = useMemo(() => [...new Map(bookings.map((b) => [b.staff, b.staffColor])).entries()], [bookings]);
  const list = staff ? bookings.filter((b) => b.staff === staff) : bookings;
  const isDone = (b: ReceptionBooking) => DONE.includes(b.status);
  const current = list.filter((b) => !isDone(b) && Date.parse(b.startsAt) <= now && Date.parse(b.endsAt) > now);
  const next = list.filter((b) => !isDone(b) && Date.parse(b.startsAt) > now);
  const late = list.filter((b) => !isDone(b) && Date.parse(b.endsAt) <= now);
  const done = list.filter(isDone);
  const dateLabel = new Date(`${today}T12:00:00`).toLocaleDateString("et-EE", { weekday: "long", day: "numeric", month: "long" });
  const clock = new Date(now).toLocaleTimeString("et-EE", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="mx-auto max-w-[1100px] space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[13px] font-medium text-muted first-letter:uppercase">{dateLabel}</p>
          <h1 className="text-[28px] font-bold tracking-[-0.4px]">
            Vastuvõtt <span className="ml-2 font-mono text-[22px] font-semibold text-muted tabular-nums">{clock}</span>
          </h1>
          <p className="mt-1 text-sm text-muted">
            {list.length} klienti täna · {next.length + current.length + late.length} ootel · {done.length} tehtud
          </p>
        </div>
      </div>

      {canSeeAll && staffList.length > 1 && (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Töötaja">
          <Chip active={!staff} onClick={() => setStaff(null)}>Kõik</Chip>
          {staffList.map(([name, color]) => (
            <Chip key={name} active={staff === name} onClick={() => setStaff(name)}>
              <span className="size-2.5 rounded-full" style={{ background: color }} aria-hidden /> {name}
            </Chip>
          ))}
        </div>
      )}

      {list.length === 0 && <p className="rounded-[14px] border border-dashed border-line bg-white p-12 text-center text-muted">Täna pole ühtegi broneeringut.</p>}

      {current.length > 0 && <Section title="Praegu teenindamisel">{current.map((b) => <Row key={b.id} b={b} tone="now" />)}</Section>}
      {late.length > 0 && <Section title="Aeg möödas – märgi tehtuks või mitteilmunuks">{late.map((b) => <Row key={b.id} b={b} tone="late" />)}</Section>}
      {next.length > 0 && <Section title="Järgmisena">{next.map((b, i) => <Row key={b.id} b={b} tone={i === 0 ? "next" : "later"} />)}</Section>}
      {done.length > 0 && (
        <section>
          <button type="button" onClick={() => setShowDone((v) => !v)} aria-expanded={showDone} className="mb-2 flex h-11 items-center gap-1.5 text-[15px] font-semibold text-muted">
            <ChevronDown size={18} className={clsx("transition-transform", showDone && "rotate-180")} aria-hidden /> Tehtud ja mitteilmunud ({done.length})
          </button>
          {showDone && <div className="space-y-2.5">{done.map((b) => <Row key={b.id} b={b} tone="done" />)}</div>}
        </section>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={clsx("inline-flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-[14px] font-semibold", active ? "border-ink bg-ink text-white" : "border-line bg-white")}
    >
      {children}
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-[13px] font-semibold tracking-wide text-muted uppercase">{title}</h2>
      <div className="space-y-2.5">{children}</div>
    </section>
  );
}

function Row({ b, tone }: { b: ReceptionBooking; tone: "now" | "next" | "later" | "late" | "done" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const act = (status: "CONFIRMED" | "COMPLETED" | "NO_SHOW") =>
    start(async () => {
      const r = await setBookingStatus(b.id, status);
      setMsg(r?.ok ? null : (r?.message ?? "Ei õnnestunud"));
      router.refresh();
    });
  const st = BOOKING_STATUS[b.status];
  const big = "inline-flex h-12 min-w-[120px] items-center justify-center gap-2 rounded-[12px] px-4 text-[15px] font-semibold disabled:opacity-50";

  return (
    <article
      className={clsx(
        "flex flex-wrap items-center gap-x-5 gap-y-3 rounded-[14px] border bg-white p-4",
        tone === "now" ? "border-lime ring-2 ring-lime/40" : tone === "late" ? "border-warn/40" : "border-line",
        tone === "done" && "opacity-70",
        pending && "opacity-60",
      )}
    >
      <div className="w-[92px] shrink-0">
        <p className="font-mono text-[22px] leading-none font-semibold tabular-nums">{b.time.slice(0, 5)}</p>
        <p className="mt-1 text-[12px] text-muted tabular-nums">kuni {b.time.slice(6)}</p>
      </div>
      <div className="min-w-[200px] flex-1">
        <p className="flex flex-wrap items-center gap-2">
          <Link href={`/broneeringud/${b.id}`} className="text-[18px] font-semibold hover:underline">{b.clientName}</Link>
          {b.status !== "CONFIRMED" && <Badge tone={st.tone}>{st.label}</Badge>}
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 text-[14px] text-ink-2">
          {b.service} · <span className="size-2 rounded-full" style={{ background: b.staffColor }} aria-hidden /> {b.staff}
        </p>
        <p className="mt-1.5 flex flex-wrap gap-1.5 text-[12px] font-semibold">
          {b.package ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#f4f3ff] px-2 py-0.5 text-[#5925dc]"><Package size={12} aria-hidden /> Pakett – tasuda pole vaja</span>
          ) : (
            <>
              {b.giftCents > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-[#fdf2fa] px-2 py-0.5 text-[#c11574]"><Gift size={12} aria-hidden /> Kinkekaart {eur(b.giftCents)}</span>}
              {b.paidCents > 0 && <span className="rounded-full bg-ok-bg px-2 py-0.5 text-ok">Ettemaks tasutud {eur(b.paidCents)}</span>}
              <span className={clsx("rounded-full px-2 py-0.5", b.dueCents > 0 ? "bg-line-soft text-ink" : "bg-ok-bg text-ok")}>
                {b.dueCents > 0 ? `Tasuda kohapeal ${eur(b.dueCents)}` : "Tasutud"}
              </span>
            </>
          )}
        </p>
        {b.note && (
          <p className="mt-1.5 flex items-start gap-1.5 text-[13px] text-muted">
            <StickyNote size={13} className="mt-0.5 shrink-0" aria-hidden /> {b.note}
          </p>
        )}
        {msg && <p className="mt-1.5 text-[13px] text-bad">{msg}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {b.phone && (
          <a href={`tel:${b.phone.replace(/\s/g, "")}`} aria-label={`Helista: ${b.phone}`} className="grid size-12 place-items-center rounded-[12px] border border-line hover:bg-line-soft">
            <Phone size={18} aria-hidden />
          </a>
        )}
        {tone === "done" ? (
          <button type="button" disabled={pending} onClick={() => act("CONFIRMED")} className={clsx(big, "border border-line bg-white")}>
            <RotateCcw size={17} aria-hidden /> Taasta
          </button>
        ) : b.status === "CONFIRMED" ? (
          <>
            <button type="button" disabled={pending} onClick={() => act("NO_SHOW")} className={clsx(big, "border border-line bg-white text-bad")}>
              <UserX size={17} aria-hidden /> Ei ilmunud
            </button>
            <button type="button" disabled={pending} onClick={() => act("COMPLETED")} className={clsx(big, "bg-ink text-white")}>
              <Check size={18} aria-hidden /> Tehtud
            </button>
          </>
        ) : (
          <button type="button" disabled={pending} onClick={() => act("CONFIRMED")} className={clsx(big, "bg-ink text-white")}>
            <Check size={18} aria-hidden /> Kinnita
          </button>
        )}
      </div>
    </article>
  );
}

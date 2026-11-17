"use client";

import { useEffect, useId, useMemo, useState, useTransition, type CSSProperties, type ReactNode } from "react";
import { ArrowLeft, Bell, CalendarPlus, Check, ChevronLeft, ChevronRight, Clock, CreditCard, Info, MapPin, ShieldCheck, Tag, X } from "lucide-react";
import { clsx } from "clsx";
import type { WidgetData, WidgetService } from "@/server/widget";
import { formatEuro, addDaysIso } from "@/lib/time";
import { addMinutes, dayLong, dayNum, dayShort, dayShortYear, monthYear, weekdayLetter } from "@/lib/date-et";
import { book, daySlots, joinWaitlist, quote, staffFirstFree, weekDays } from "./actions";

type Data = NonNullable<WidgetData>;
type Step = "home" | "staff" | "time" | "details" | "confirm" | "done";
type Slot = { time: string; end: string; staffId: string; staffName: string };
type Quote = Extract<Awaited<ReturnType<typeof quote>>, { ok: true }>;
type Free = { date: string; time: string } | null;

const eur = (c: number) => formatEuro(c, { decimals: true });
const initials = (n: string) => n.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
const relDay = (iso: string, today: string) => (iso === today ? "täna" : iso === addDaysIso(today, 1) ? "homme" : dayShort(iso));

export function Widget({ data, embed }: { data: Data; embed: boolean }) {
  const { business: biz, theme, today } = data;
  const [step, setStep] = useState<Step>("home");
  const [cat, setCat] = useState<string>(data.categories[0]?.id ?? "none");
  const [info, setInfo] = useState<WidgetService | null>(null);
  const [service, setService] = useState<WidgetService | null>(null);
  const [staffId, setStaffId] = useState<string | null>(null); // null = ükskõik kes
  const [date, setDate] = useState<string>(today);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", code: "", sms: true, terms: false });
  const [q, setQ] = useState<Quote | null>(null);
  const [result, setResult] = useState<{ number: string; manageToken: string; finalCents: number; depositCents: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const staffStep = !!service && service.allowStaffChoice && service.staff.length > 1;
  const steps: Step[] = staffStep ? ["home", "staff", "time", "details", "confirm"] : ["home", "time", "details", "confirm"];
  const stepNo = steps.indexOf(step) + 1;

  const style = {
    "--w-primary": theme.primary,
    "--w-on-primary": theme.buttonText,
    "--w-bg": theme.dark ? "#111827" : theme.background,
    "--w-text": theme.dark ? "#f9fafb" : theme.text,
    fontFamily: theme.font === "inherit" ? "Inter Variable, system-ui, sans-serif" : theme.font,
  } as CSSProperties;

  const close = () => {
    if (embed) window.parent.postMessage({ type: "aegly:close" }, "*");
  };
  const back = () => {
    setError(null);
    const i = steps.indexOf(step);
    if (i > 0) setStep(steps[i - 1]);
  };
  const reset = () => {
    setStep("home");
    setService(null);
    setSlot(null);
    setQ(null);
    setResult(null);
    setStaffId(null);
    setForm((f) => ({ ...f, code: "", terms: false }));
  };

  const choose = (sv: WidgetService) => {
    setService(sv);
    setSlot(null);
    setStaffId(null);
    setInfo(null);
  };

  const staffName = service?.staff.find((m) => m.id === (slot?.staffId ?? staffId))?.name;
  const duration = service ? (service.staff.find((m) => m.id === slot?.staffId)?.durationMinutes ?? service.durationMinutes) : 0;

  const loadQuote = (code = form.code) =>
    new Promise<Quote | null>((resolve) =>
      start(async () => {
        if (!service || !slot) return resolve(null);
        const r = await quote({ slug: biz.slug, serviceId: service.id, staffId: slot.staffId, date, time: slot.time, code: code || undefined, email: form.email || undefined });
        if (r.ok) {
          setQ(r);
          resolve(r);
        } else {
          setError(r.reason);
          resolve(null);
        }
      }),
    );

  return (
    <div style={style} className={clsx("flex min-h-dvh justify-center", embed ? "bg-[var(--w-bg)]" : "bg-[#f3f4f6] sm:py-8")}>
      <div className={clsx("relative flex w-full flex-col bg-[var(--w-bg)] text-[var(--w-text)]", embed ? "h-dvh" : "h-dvh sm:h-[min(820px,calc(100dvh-64px))] sm:max-w-[440px] sm:overflow-hidden sm:rounded-[20px] sm:shadow-[0_24px_60px_rgba(16,24,40,0.16)]")}>
        {/* Päis */}
        {step === "home" || step === "done" ? (
          <HomeHeader data={data} onClose={embed ? close : undefined} compact={step === "done"} />
        ) : (
          <header className="flex items-center gap-2 border-b border-black/5 px-4 py-3">
            <button type="button" onClick={back} aria-label="Tagasi" className="grid size-9 place-items-center rounded-full hover:bg-black/5">
              <ArrowLeft size={18} />
            </button>
            <h1 className="flex-1 text-[17px] font-semibold">
              {step === "staff" ? "Vali spetsialist" : step === "time" ? "Vali aeg" : step === "details" ? "Sinu andmed" : "Kinnita broneering"}
            </h1>
            <span className="text-[13px] opacity-60">
              {stepNo}/{steps.length}
            </span>
            {embed && (
              <button type="button" onClick={close} aria-label="Sulge" className="grid size-9 place-items-center rounded-full hover:bg-black/5">
                <X size={18} />
              </button>
            )}
          </header>
        )}
        {step !== "home" && step !== "done" && (
          <div className="flex gap-1 px-4 pt-2" aria-hidden>
            {steps.map((s, i) => (
              <span key={s} className={clsx("h-1 flex-1 rounded-full", i < stepNo ? "bg-[var(--w-primary)]" : "bg-black/10")} />
            ))}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {error && (
            <p role="alert" className="mx-4 mt-3 rounded-[10px] bg-[#fef3f2] px-3 py-2 text-[13px] text-[#b42318]">
              {error}
            </p>
          )}
          {step === "home" && <Home data={data} cat={cat} setCat={setCat} selected={service} onInfo={setInfo} onChoose={choose} />}
          {step === "staff" && service && <StaffStep slug={biz.slug} service={service} today={today} value={staffId} onChange={setStaffId} />}
          {step === "time" && service && (
            <TimeStep
              slug={biz.slug}
              service={service}
              staffId={staffId}
              today={today}
              maxDays={biz.maxAdvanceDays}
              date={date}
              setDate={(d) => {
                setDate(d);
                setSlot(null);
              }}
              slot={slot}
              setSlot={setSlot}
              showStaffNames={staffId === null && service.staff.length > 1}
            />
          )}
          {step === "details" && <Details form={form} setForm={setForm} q={q} onApply={(code) => loadQuote(code)} pending={pending} />}
          {step === "confirm" && service && slot && q && (
            <Confirm service={service} date={date} slot={slot} duration={duration} staffName={staffName} q={q} cancelHours={biz.cancelUntilHours} />
          )}
          {step === "done" && service && slot && result && (
            <Done biz={biz} service={service} date={date} slot={slot} duration={duration} staffName={staffName} email={form.email} result={result} />
          )}
        </div>

        {/* Jalus */}
        <Footer>
          {step === "home" && service && (
            <FooterRow
              left={
                <>
                  <p className="text-[13px] opacity-70">1 teenus · {service.durationMinutes} min</p>
                  {service.showPrice && <p className="font-semibold">{eur(service.campaignPriceCents ?? service.priceCents)}</p>}
                </>
              }
              button={<PrimaryButton onClick={() => setStep(staffStep ? "staff" : "time")}>Jätka</PrimaryButton>}
            />
          )}
          {step === "staff" && service && (
            <FooterRow
              left={
                <>
                  <p className="text-[13px] opacity-70">{service.name}</p>
                  <p className="font-semibold">{staffId ? service.staff.find((m) => m.id === staffId)?.name : "Ükskõik kes"}</p>
                </>
              }
              button={<PrimaryButton onClick={() => setStep("time")}>Jätka</PrimaryButton>}
            />
          )}
          {step === "time" && (
            <FooterRow
              left={
                slot ? (
                  <>
                    <p className="text-[13px] opacity-70">{dayLong(date)}</p>
                    <p className="font-semibold">
                      kell {slot.time}–{slot.end}
                    </p>
                  </>
                ) : (
                  <p className="text-[13px] opacity-70">Vali sobiv kellaaeg</p>
                )
              }
              button={
                <PrimaryButton
                  disabled={!slot || pending}
                  onClick={async () => {
                    setError(null);
                    if (await loadQuote()) setStep("details");
                  }}
                >
                  Jätka
                </PrimaryButton>
              }
            />
          )}
          {step === "details" && q && (
            <FooterRow
              left={
                <>
                  <p className="text-[13px] opacity-70">Kokku{q.code ? ` (${q.lines.find((l) => l.kind === "code")?.label ?? "soodustus"})` : ""}</p>
                  <p className="font-semibold">{eur(q.finalCents)}</p>
                </>
              }
              button={
                <PrimaryButton
                  disabled={pending}
                  onClick={async () => {
                    setError(null);
                    if (form.name.trim().length < 2) return setError("Sisesta oma nimi.");
                    if (!/^\S+@\S+\.\S+$/.test(form.email)) return setError("Sisesta kehtiv e-posti aadress.");
                    if (form.phone.replace(/\D/g, "").length < 5) return setError("Sisesta telefoninumber.");
                    if (!form.terms) return setError("Nõustu broneerimistingimustega.");
                    // kood võib sõltuda e-postist (uued kliendid) – arvuta uuesti
                    if (await loadQuote()) setStep("confirm");
                  }}
                >
                  Jätka
                </PrimaryButton>
              }
            />
          )}
          {step === "confirm" && service && slot && q && (
            <div className="space-y-2">
              <p className="flex items-center justify-center gap-1.5 text-[12px] opacity-60">
                <ShieldCheck size={14} aria-hidden /> Tasuta tühistamine kuni {biz.cancelUntilHours} h enne algust
              </p>
              <PrimaryButton
                className="w-full"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    setError(null);
                    const r = await book({
                      slug: biz.slug, serviceId: service.id, staffId: slot.staffId, date, time: slot.time, code: q.code?.code,
                      name: form.name, email: form.email, phone: `+372 ${form.phone}`.replace("+372 +", "+"), smsReminder: form.sms, terms: true,
                    });
                    if (r.ok) {
                      setResult(r);
                      setStep("done");
                    } else {
                      setError(r.reason);
                      if (/vaba|broneeriti/.test(r.reason)) {
                        setSlot(null);
                        setStep("time");
                      }
                    }
                  })
                }
              >
                {pending ? "Broneerin…" : "Kinnita broneering"}
              </PrimaryButton>
            </div>
          )}
          {step === "done" && (
            <div className="space-y-2">
              <p className="text-center text-[13px] opacity-70">Ootame sind{biz.name ? ` – ${biz.name}` : ""}!</p>
              <PrimaryButton className="w-full" onClick={embed ? close : reset}>
                Valmis
              </PrimaryButton>
            </div>
          )}
        </Footer>

        {info && (
          <ServiceSheet
            sv={info}
            onClose={() => setInfo(null)}
            onAdd={() => choose(info)}
          />
        )}
        <p className="pb-2 text-center text-[11px] opacity-40">Toetab Aegly</p>
      </div>
    </div>
  );
}

// ---------- Ühised osad ----------

function PrimaryButton({ className, ...props }: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={clsx("inline-flex h-12 min-w-[120px] items-center justify-center rounded-full bg-[var(--w-primary)] px-6 text-[15px] font-semibold text-[var(--w-on-primary)] transition-opacity disabled:opacity-40", className)}
      {...props}
    />
  );
}

function Footer({ children }: { children: ReactNode }) {
  if (!children || (Array.isArray(children) && children.every((c) => !c))) return null;
  return <div className="border-t border-black/5 px-4 py-3">{children}</div>;
}

function FooterRow({ left, button }: { left: ReactNode; button: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">{left}</div>
      {button}
    </div>
  );
}

function Price({ sv }: { sv: WidgetService }) {
  if (!sv.showPrice) return <span>{sv.durationMinutes} min</span>;
  if (sv.priceType === "FREE") return <span>Tasuta · {sv.durationMinutes} min</span>;
  const from = sv.priceType === "FROM" ? "alates " : "";
  return (
    <span>
      {sv.campaignPriceCents !== null && <s className="mr-1 opacity-50">{eur(sv.priceCents)}</s>}
      {from}
      {eur(sv.campaignPriceCents ?? sv.priceCents)} · {sv.durationMinutes} min
    </span>
  );
}

// ---------- W1–W3 ----------

function HomeHeader({ data, onClose, compact }: { data: Data; onClose?: () => void; compact?: boolean }) {
  const b = data.business;
  return (
    <header className="relative">
      {!compact && <div className="h-[92px] bg-[var(--w-primary)] bg-cover bg-center" style={b.bannerUrl ? { backgroundImage: `url(${b.bannerUrl})` } : undefined} />}
      {onClose && (
        <button type="button" onClick={onClose} aria-label="Sulge" className="absolute top-3 right-3 grid size-9 place-items-center rounded-full bg-white/90 text-[#1f2937] shadow">
          <X size={18} />
        </button>
      )}
      <div className={clsx("flex items-end gap-3 px-4", compact ? "pt-4" : "-mt-7")}>
        <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-[14px] border-2 border-[var(--w-bg)] bg-white text-lg font-bold text-[var(--w-primary)] shadow">
          {b.logoUrl ? <img src={b.logoUrl} alt="" className="size-full object-cover" /> : initials(b.name)}
        </span>
      </div>
      <div className="px-4 pt-2 pb-1">
        <h1 className="text-[18px] font-bold">{b.name}</h1>
        {!compact && (
          <p className="mt-0.5 flex items-center gap-1 text-[13px] opacity-70">
            <MapPin size={13} aria-hidden />
            {[b.address, b.todayHours ? `Avatud täna ${b.todayHours}` : "Täna suletud"].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>
    </header>
  );
}

function Home({ data, cat, setCat, selected, onInfo, onChoose }: { data: Data; cat: string; setCat: (c: string) => void; selected: WidgetService | null; onInfo: (s: WidgetService) => void; onChoose: (s: WidgetService) => void }) {
  const tabs = [...data.categories, ...(data.hasUncategorized ? [{ id: "none", name: "Muud" }] : [])];
  const list = data.services.filter((s) => (s.categoryId ?? "none") === cat);
  const anyDeposit = data.services.some((s) => s.depositPercent > 0);
  return (
    <div className="px-4 pb-4">
      <p className="mt-2 text-[14px] opacity-80">{data.business.description || "Tere tulemast! Vali endale sobiv teenus ja aeg."}</p>
      <div className="mt-3 flex flex-wrap gap-2 text-[12px]">
        {anyDeposit && (
          <span className="inline-flex items-center gap-1 rounded-full bg-black/5 px-2.5 py-1">
            <CreditCard size={13} aria-hidden /> Ettemaks broneerimisel
          </span>
        )}
        <span className="inline-flex items-center gap-1 rounded-full bg-black/5 px-2.5 py-1">
          <Clock size={13} aria-hidden /> Tühistamine kuni {data.business.cancelUntilHours} h enne
        </span>
      </div>
      {data.banner && (
        <p className="mt-3 flex items-center gap-2 rounded-[12px] px-3 py-2.5 text-[13px] font-semibold text-[#9a3412]" style={{ background: data.banner.color }}>
          <Tag size={15} aria-hidden /> {data.banner.text}
        </p>
      )}

      {tabs.length > 1 && (
        <div role="tablist" aria-label="Kategooriad" className="-mx-4 mt-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={cat === t.id}
              onClick={() => setCat(t.id)}
              className={clsx("h-9 shrink-0 rounded-full px-4 text-[14px] font-medium", cat === t.id ? "bg-[var(--w-primary)] text-[var(--w-on-primary)]" : "bg-black/5")}
            >
              {t.name}
            </button>
          ))}
        </div>
      )}

      <ul className="mt-3 space-y-2">
        {list.map((sv) => {
          const active = selected?.id === sv.id;
          return (
            <li key={sv.id}>
              <div className={clsx("flex items-start gap-3 rounded-[14px] border p-3.5", active ? "border-[var(--w-primary)] ring-1 ring-[var(--w-primary)]" : "border-black/10")}>
                <button type="button" onClick={() => onInfo(sv)} className="min-w-0 flex-1 text-left">
                  <span className="flex items-center gap-2 font-semibold">
                    {sv.name}
                    {sv.campaignLabel && <span className="rounded-full bg-[#fff4ed] px-1.5 py-0.5 text-[11px] font-bold text-[#c4320a]">{sv.campaignLabel}</span>}
                  </span>
                  <span className="mt-0.5 block text-[13px] opacity-70">
                    <Price sv={sv} />
                  </span>
                  {sv.description && <span className="mt-1 line-clamp-1 block text-[13px] opacity-60">{sv.description}</span>}
                </button>
                <button
                  type="button"
                  onClick={() => onChoose(sv)}
                  aria-pressed={active}
                  aria-label={active ? `${sv.name} valitud` : `Vali ${sv.name}`}
                  className={clsx("grid size-9 shrink-0 place-items-center rounded-full border", active ? "border-[var(--w-primary)] bg-[var(--w-primary)] text-[var(--w-on-primary)]" : "border-black/15")}
                >
                  {active ? <Check size={17} /> : <span className="text-lg leading-none">+</span>}
                </button>
              </div>
            </li>
          );
        })}
        {list.length === 0 && <li className="py-10 text-center text-[14px] opacity-60">Selles kategoorias pole veebis broneeritavaid teenuseid.</li>}
      </ul>
    </div>
  );
}

function ServiceSheet({ sv, onClose, onAdd }: { sv: WidgetService; onClose: () => void; onAdd: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="absolute inset-0 z-10 flex items-end bg-black/40" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={sv.name} className="w-full rounded-t-[20px] bg-[var(--w-bg)] p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-[19px] font-bold">{sv.name}</h2>
          <button type="button" onClick={onClose} aria-label="Sulge" className="grid size-8 place-items-center rounded-full hover:bg-black/5">
            <X size={17} />
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-[13px]">
          <span className="rounded-full bg-black/5 px-2.5 py-1">{sv.durationMinutes} min</span>
          {sv.showPrice && <span className="rounded-full bg-black/5 px-2.5 py-1">{sv.priceType === "FREE" ? "Tasuta" : eur(sv.campaignPriceCents ?? sv.priceCents)}</span>}
          {sv.depositPercent > 0 && <span className="rounded-full bg-black/5 px-2.5 py-1">{sv.depositPercent}% ettemaks</span>}
        </div>
        {sv.description && <p className="mt-3 text-[14px] leading-relaxed opacity-80">{sv.description}</p>}
        <p className="mt-3 text-[13px] opacity-70">Teevad: {sv.staff.map((m) => m.name).join(", ")}</p>
        <PrimaryButton className="mt-5 w-full" onClick={onAdd}>
          Vali see teenus
        </PrimaryButton>
      </div>
    </div>
  );
}

// ---------- W4 ----------

function StaffStep({ slug, service, today, value, onChange }: { slug: string; service: WidgetService; today: string; value: string | null; onChange: (v: string | null) => void }) {
  const [free, setFree] = useState<{ any: Free; staff: Record<string, Free> } | null>(null);
  useEffect(() => {
    let live = true;
    staffFirstFree(slug, service.id, service.staff.map((m) => m.id)).then((r) => live && setFree(r));
    return () => {
      live = false;
    };
  }, [slug, service]);
  const minPrice = Math.min(...service.staff.map((m) => m.priceCents));
  const freeText = (f: Free | undefined) => (free === null ? "Otsin vaba aega…" : f ? `Esimene vaba: ${relDay(f.date, today)} ${f.time}` : "Lähiajal vabu aegu pole");


  return (
    <div className="px-4 py-3">
      <p className="text-[13px] opacity-70">
        {service.name} · {service.durationMinutes} min
      </p>
      <ul role="radiogroup" aria-label="Spetsialist" className="mt-3 space-y-2">
        <StaffRow
            value={value}
            onChange={onChange}
          id={null}
          title="Ükskõik kes"
          sub={`Esimene vaba aeg${service.showPrice ? ` · alates ${eur(minPrice)}` : ""}`}
          note={freeText(free?.any)}
          avatar={<span className="grid size-11 place-items-center rounded-full bg-black/5"><Clock size={18} /></span>}
        />
        {service.staff.map((m) => (
          <StaffRow
            value={value}
            onChange={onChange}
            key={m.id}
            id={m.id}
            title={m.name}
            sub={[m.title, service.showPrice ? eur(m.priceCents) : null].filter(Boolean).join(" · ")}
            note={[m.onLeaveUntil ? `Puhkusel kuni ${dayShort(m.onLeaveUntil)}` : null, freeText(free?.staff[m.id])].filter(Boolean).join(" · ")}
            avatar={
              m.avatarUrl ? (
                <img src={m.avatarUrl} alt="" className="size-11 rounded-full object-cover" />
              ) : (
                <span className="grid size-11 place-items-center rounded-full text-[13px] font-semibold text-white" style={{ background: m.color }}>
                  {initials(m.name)}
                </span>
              )
            }
          />
        ))}
      </ul>
    </div>
  );
}

function StaffRow({ id, title, sub, avatar, note, value, onChange }: { id: string | null; title: string; sub: string; avatar: ReactNode; note: string; value: string | null; onChange: (v: string | null) => void }) {
  return (
    <li>
      <button
        type="button"
        role="radio"
        aria-checked={value === id}
        onClick={() => onChange(id)}
        className={clsx("flex w-full items-center gap-3 rounded-[14px] border p-3.5 text-left", value === id ? "border-[var(--w-primary)] ring-1 ring-[var(--w-primary)]" : "border-black/10")}
      >
        {avatar}
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{title}</span>
          <span className="block text-[13px] opacity-70">{sub}</span>
          <span className="block text-[12px] opacity-60">{note}</span>
        </span>
        <span className={clsx("grid size-5 place-items-center rounded-full border", value === id ? "border-[var(--w-primary)] bg-[var(--w-primary)]" : "border-black/20")}>
          {value === id && <span className="size-2 rounded-full bg-[var(--w-on-primary)]" />}
        </span>
      </button>
    </li>
  );
}

// ---------- W5 / W5b ----------

function TimeStep({
  slug, service, staffId, today, maxDays, date, setDate, slot, setSlot, showStaffNames,
}: {
  slug: string; service: WidgetService; staffId: string | null; today: string; maxDays: number; date: string;
  setDate: (d: string) => void; slot: Slot | null; setSlot: (s: Slot) => void; showStaffNames: boolean;
}) {
  const [weekStart, setWeekStart] = useState(date);
  const [daysRes, setDaysRes] = useState<{ key: string; v: { date: string; free: number }[] } | null>(null);
  const [dayRes, setDayRes] = useState<{ key: string; v: Awaited<ReturnType<typeof daySlots>> } | null>(null);
  const [waitRes, setWait0] = useState<{ key: string; v: "closed" | "open" | "done" }>({ key: "", v: "closed" });
  const weekKey = `${service.id}|${staffId}|${weekStart}`;
  const dayKey = `${service.id}|${staffId}|${date}`;
  const days = daysRes?.key === weekKey ? daysRes.v : null;
  const day = dayRes?.key === dayKey ? dayRes.v : null;
  const wait = waitRes.key === dayKey ? waitRes.v : "closed";
  const setWait = (v: "closed" | "open" | "done") => setWait0({ key: dayKey, v });
  const [wForm, setWForm] = useState({ name: "", email: "" });
  const [wErr, setWErr] = useState<string | null>(null);
  const lastDay = addDaysIso(today, maxDays);

  useEffect(() => {
    let live = true;
    const key = `${service.id}|${staffId}|${weekStart}`;
    weekDays(slug, service.id, staffId, weekStart).then((r) => live && setDaysRes({ key, v: r }));
    return () => {
      live = false;
    };
  }, [slug, service.id, staffId, weekStart]);

  useEffect(() => {
    let live = true;
    const key = `${service.id}|${staffId}|${date}`;
    daySlots(slug, service.id, staffId, date).then((r) => live && setDayRes({ key, v: r }));
    return () => {
      live = false;
    };
  }, [slug, service.id, staffId, date]);

  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysIso(weekStart, i)), [weekStart]);
  const goto = (d: string) => {
    if (!week.includes(d)) setWeekStart(d);
    setDate(d);
  };

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between">
        <p className="font-semibold">{monthYear(weekStart)}</p>
        <div className="flex gap-1">
          <button type="button" aria-label="Eelmine nädal" disabled={weekStart <= today} onClick={() => setWeekStart(addDaysIso(weekStart, -7) < today ? today : addDaysIso(weekStart, -7))} className="grid size-9 place-items-center rounded-full hover:bg-black/5 disabled:opacity-30">
            <ChevronLeft size={18} />
          </button>
          <button type="button" aria-label="Järgmine nädal" disabled={addDaysIso(weekStart, 7) > lastDay} onClick={() => setWeekStart(addDaysIso(weekStart, 7))} className="grid size-9 place-items-center rounded-full hover:bg-black/5 disabled:opacity-30">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1.5">
        {week.map((d) => {
          const info = days?.find((x) => x.date === d);
          const sel = d === date;
          const none = info && info.free === 0;
          return (
            <button
              key={d}
              type="button"
              onClick={() => setDate(d)}
              aria-pressed={sel}
              aria-label={`${dayLong(d)}${none ? ", vabu aegu pole" : ""}`}
              className={clsx("flex h-[58px] flex-col items-center justify-center rounded-[12px] border text-[11px]", sel ? "border-[var(--w-primary)] bg-[var(--w-primary)] text-[var(--w-on-primary)]" : "border-black/10", none && !sel && "opacity-40")}
            >
              <span className="uppercase opacity-80">{d === today ? "Täna" : weekdayLetter(d)}</span>
              <span className={clsx("text-[16px] font-bold", none && "line-through")}>{dayNum(d)}</span>
              {info && info.free > 0 && <span className={clsx("mt-0.5 size-1 rounded-full", sel ? "bg-[var(--w-on-primary)]" : "bg-[var(--w-primary)]")} />}
            </button>
          );
        })}
      </div>

      <p className="mt-5 text-[12px] font-semibold tracking-[0.5px] uppercase opacity-60">{dayLong(date)}</p>
      {day === null ? (
        <div className="mt-3 grid grid-cols-4 gap-2" aria-busy>
          {Array.from({ length: 8 }).map((_, i) => (
            <span key={i} className="h-11 animate-pulse rounded-[10px] bg-black/5" />
          ))}
        </div>
      ) : day.slots.length > 0 ? (
        <>
          <div role="radiogroup" aria-label="Kellaaeg" className={clsx("mt-3 grid gap-2", showStaffNames ? "grid-cols-3" : "grid-cols-4")}>
            {day.slots.map((x) => {
              const sel = slot?.time === x.time;
              return (
                <button
                  key={x.time}
                  type="button"
                  role="radio"
                  aria-checked={sel}
                  onClick={() => setSlot(x)}
                  className={clsx("flex min-h-11 flex-col items-center justify-center rounded-[10px] border px-1 py-1.5 text-[14px]", sel ? "border-[var(--w-primary)] bg-[var(--w-primary)] font-semibold text-[var(--w-on-primary)]" : "border-black/10 hover:border-[var(--w-primary)]")}
                >
                  {x.time}
                  {showStaffNames && <span className="text-[11px] font-normal opacity-70">{x.staffName.split(" ")[0]}</span>}
                </button>
              );
            })}
          </div>
          <WaitlistLink onClick={() => setWait("open")} hidden={wait !== "closed"} />
        </>
      ) : (
        <div className="mt-3 rounded-[14px] bg-black/[0.03] p-4">
          <p className="font-semibold">{day.reason === "closed" ? "Sel päeval on suletud" : day.reason === "too-far" ? "Nii kaugele ette ei saa broneerida" : "See päev on täielikult broneeritud"}</p>
          <p className="mt-1 text-[13px] opacity-70">Vali teine päev{day.reason ? "" : " või liitu ootenimekirjaga"}.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {day.next && (
              <button type="button" onClick={() => goto(day.next!.date)} className="h-10 rounded-full bg-[var(--w-primary)] px-4 text-[14px] font-semibold text-[var(--w-on-primary)]">
                Järgmine vaba päev: {dayShort(day.next.date)}
              </button>
            )}
            {!day.reason && wait === "closed" && (
              <button type="button" onClick={() => setWait("open")} className="h-10 rounded-full border border-black/15 px-4 text-[14px] font-semibold">
                Liitu ootenimekirjaga
              </button>
            )}
          </div>
        </div>
      )}

      {wait === "open" && (
        <form
          className="mt-4 space-y-2 rounded-[14px] border border-black/10 p-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setWErr(null);
            const r = await joinWaitlist({ slug, serviceId: service.id, staffId, date, ...wForm });
            if (r.ok) setWait("done");
            else setWErr(r.reason);
          }}
        >
          <p className="font-semibold">Saa teavitus, kui {dayShort(date)} aeg vabaneb</p>
          <WInput label="Nimi" value={wForm.name} onChange={(v) => setWForm({ ...wForm, name: v })} autoComplete="name" />
          <WInput label="E-post" type="email" value={wForm.email} onChange={(v) => setWForm({ ...wForm, email: v })} autoComplete="email" />
          {wErr && <p className="text-[13px] text-[#b42318]">{wErr}</p>}
          <PrimaryButton type="submit" className="w-full">
            Liitu ootenimekirjaga
          </PrimaryButton>
        </form>
      )}
      {wait === "done" && (
        <p className="mt-4 flex items-center gap-2 rounded-[12px] bg-[#ecfdf3] px-3 py-2.5 text-[13px] text-[#067647]">
          <Check size={16} aria-hidden /> Oled ootenimekirjas. Anname teada, kui aeg vabaneb.
        </p>
      )}
    </div>
  );
}

function WaitlistLink({ onClick, hidden }: { onClick: () => void; hidden: boolean }) {
  if (hidden) return null;
  return (
    <button type="button" onClick={onClick} className="mt-4 flex items-center gap-2 text-[13px] underline-offset-4 opacity-80 hover:underline">
      <Bell size={15} aria-hidden /> Ei leia sobivat aega? Saa teavitus, kui aeg vabaneb
    </button>
  );
}

// ---------- W6 ----------

function WInput({ id: idProp, label, value, onChange, type = "text", autoComplete, prefix, inputMode }: { id?: string; label: string; value: string; onChange: (v: string) => void; type?: string; autoComplete?: string; prefix?: string; inputMode?: "tel" | "email" | "text" }) {
  const auto = useId();
  const id = idProp ?? auto;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[13px] font-medium">
        {label}
      </label>
      <div className="flex h-12 items-center rounded-[12px] border border-black/15 bg-transparent focus-within:border-[var(--w-primary)] focus-within:ring-1 focus-within:ring-[var(--w-primary)]">
        {prefix && <span className="border-r border-black/10 px-3 text-[14px] opacity-70">{prefix}</span>}
        <input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} inputMode={inputMode} className="h-full min-w-0 flex-1 bg-transparent px-3 text-[15px] outline-none" />
      </div>
    </div>
  );
}

function Details({
  form, setForm, q, onApply, pending,
}: {
  form: { name: string; email: string; phone: string; code: string; sms: boolean; terms: boolean };
  setForm: (f: typeof form) => void;
  q: Quote | null;
  onApply: (code: string) => void;
  pending: boolean;
}) {
  const [codeInput, setCodeInput] = useState(form.code);
  return (
    <div className="space-y-3.5 px-4 py-4">
      <WInput id="w-name" label="Täisnimi" value={form.name} onChange={(v) => setForm({ ...form, name: v })} autoComplete="name" />
      <WInput id="w-email" label="E-post" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} autoComplete="email" inputMode="email" />
      <WInput id="w-phone" label="Telefon" type="tel" prefix="EE +372" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} autoComplete="tel-national" inputMode="tel" />
      <div>
        <label htmlFor="w-code" className="mb-1 block text-[13px] font-medium">
          Sooduskood
        </label>
        <div className="flex gap-2">
          <input
            id="w-code"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
            className="h-12 min-w-0 flex-1 rounded-[12px] border border-black/15 bg-transparent px-3 text-[15px] uppercase outline-none focus:border-[var(--w-primary)]"
          />
          {form.code && q?.code ? (
            <button
              type="button"
              className="h-12 rounded-[12px] border border-black/15 px-4 text-[14px] font-semibold"
              onClick={() => {
                setCodeInput("");
                setForm({ ...form, code: "" });
                onApply("");
              }}
            >
              Eemalda
            </button>
          ) : (
            <button
              type="button"
              disabled={!codeInput.trim() || pending}
              className="h-12 rounded-[12px] border border-black/15 px-4 text-[14px] font-semibold disabled:opacity-40"
              onClick={() => {
                setForm({ ...form, code: codeInput.trim() });
                onApply(codeInput.trim());
              }}
            >
              Rakenda
            </button>
          )}
        </div>
        {q?.code && (
          <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-[#067647]">
            <Check size={14} aria-hidden /> {q.code.code} rakendatud: {eur(-q.code.discountCents)}
          </p>
        )}
        {q?.codeMessage && form.code && <p className="mt-1.5 text-[13px] text-[#b42318]">{q.codeMessage}</p>}
      </div>
      <label className="flex items-start gap-2.5 text-[14px]">
        <input type="checkbox" checked={form.sms} onChange={(e) => setForm({ ...form, sms: e.target.checked })} className="mt-0.5 size-[18px] accent-[var(--w-primary)]" />
        Saada mulle SMS-meeldetuletus 24 h enne aega
      </label>
      <label className="flex items-start gap-2.5 text-[14px]">
        <input type="checkbox" checked={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.checked })} className="mt-0.5 size-[18px] accent-[var(--w-primary)]" />
        Nõustun broneerimistingimustega
      </label>
    </div>
  );
}

// ---------- W7 ----------

function Confirm({ service, date, slot, duration, staffName, q, cancelHours }: { service: WidgetService; date: string; slot: Slot; duration: number; staffName?: string; q: Quote; cancelHours: number }) {
  return (
    <div className="space-y-4 px-4 py-4">
      <div className="rounded-[14px] border border-black/10 p-4">
        <div className="flex justify-between gap-3 font-semibold">
          <span>{service.name}</span>
          <span>{eur(q.baseCents)}</span>
        </div>
        <p className="mt-1 text-[13px] opacity-70">
          {dayShort(date)} kell {slot.time}–{addMinutes(slot.time, duration)}
          {staffName ? ` · ${staffName}` : ""}
        </p>
        {q.lines
          .filter((l) => l.kind !== "base" && l.kind !== "staff")
          .map((l, i) => (
            <div key={i} className="mt-2 flex justify-between text-[14px]">
              <span className="opacity-80">{l.label}</span>
              <span>{eur(l.amountCents)}</span>
            </div>
          ))}
        <div className="mt-3 flex justify-between border-t border-black/10 pt-3 text-[16px] font-bold">
          <span>Kokku</span>
          <span>{eur(q.finalCents)}</span>
        </div>
      </div>
      {q.depositCents > 0 ? (
        <p className="flex gap-2 rounded-[12px] bg-black/[0.04] p-3 text-[13px]">
          <Info size={16} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            Selle teenuse ettemaks on {eur(q.depositCents)}. Veebimakse lisandub peagi – praegu tasud kogu summa ({eur(q.finalCents)}) kohapeal.
          </span>
        </p>
      ) : (
        <p className="flex gap-2 rounded-[12px] bg-black/[0.04] p-3 text-[13px]">
          <Info size={16} className="mt-0.5 shrink-0" aria-hidden /> Tasud kohapeal pärast teenust.
        </p>
      )}
      <p className="text-[12px] opacity-60">Saad aega muuta või tühistada kinnituskirjas oleva lingi kaudu kuni {cancelHours} h enne algust.</p>
    </div>
  );
}

// ---------- W8 ----------

function Done({ biz, service, date, slot, duration, staffName, email, result }: { biz: Data["business"]; service: WidgetService; date: string; slot: Slot; duration: number; staffName?: string; email: string; result: { number: string; manageToken: string; finalCents: number } }) {
  const rows: [string, string][] = [
    ["Teenus", `${service.name} · ${duration} min`],
    ["Aeg", `${dayShortYear(date)} kell ${slot.time}`],
    ...(staffName ? ([["Spetsialist", staffName]] as [string, string][]) : []),
    ["Hind", `${eur(result.finalCents)} · tasud kohapeal`],
    ["Broneeringu nr", result.number],
  ];
  return (
    <div className="px-4 py-5">
      <div className="flex flex-col items-center text-center">
        <span className="grid size-14 place-items-center rounded-full bg-[#ecfdf3] text-[#067647]">
          <Check size={28} />
        </span>
        <h2 className="mt-3 text-[20px] font-bold">Aeg on broneeritud!</h2>
        <p className="mt-1 text-[14px] opacity-70">Kinnitus saadetakse aadressile {email}.</p>
      </div>
      <dl className="mt-5 divide-y divide-black/5 rounded-[14px] border border-black/10">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 px-4 py-3 text-[14px]">
            <dt className="opacity-60">{k}</dt>
            <dd className="text-right font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <a href={`/b/${result.manageToken}/kalender.ics`} className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-black/15 text-[14px] font-semibold">
          <CalendarPlus size={16} aria-hidden /> Lisa kalendrisse
        </a>
        <a href={`/b/${result.manageToken}`} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center justify-center rounded-full border border-black/15 text-[14px] font-semibold">
          Muuda
        </a>
      </div>
      {biz.phone && <p className="mt-4 text-center text-[13px] opacity-60">Küsimused: {biz.phone}</p>}
    </div>
  );
}


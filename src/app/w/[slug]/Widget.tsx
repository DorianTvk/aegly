"use client";

import { logActivity } from "@/server/audit";
import { createContext, useContext, useEffect, useId, useMemo, useState, useTransition, type CSSProperties, type ReactNode } from "react";
import { ArrowLeft, Bell, CalendarPlus, Check, ChevronLeft, ChevronRight, Clock, CreditCard, Gift, Info, MapPin, Package, ShieldCheck, Tag, X } from "lucide-react";
import { clsx } from "clsx";
import type { WidgetData, WidgetService } from "@/server/widget";
import { formatEuro, addDaysIso } from "@/lib/time";
import { addMinutes } from "@/lib/date-et";
import { dates, DICT, LANGS, priceLabel, serverText, type Dict, type Lang } from "../i18n";
import { loc } from "@/lib/translations";
import { book, buyGiftCard, buyPackage, daySlots, joinWaitlist, quote, staffFirstFree, weekDays } from "./actions";

type Data = NonNullable<WidgetData>;
type Step = "home" | "staff" | "time" | "details" | "confirm" | "done" | "gift" | "packages";
type Slot = { time: string; end: string; staffId: string; staffName: string };
type Quote = Extract<Awaited<ReturnType<typeof quote>>, { ok: true }>;
type Free = { date: string; time: string } | null;

const eur = (c: number) => formatEuro(c, { decimals: true });
const initials = (n: string) => n.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
type L = { lang: Lang; t: Dict; d: ReturnType<typeof dates>; srv: (s: string) => string };
const LangCtx = createContext<L>({ lang: "et", t: DICT.et, d: dates("et"), srv: (s) => s });
const useL = () => useContext(LangCtx);

/** Salongi tekstid valitud keelde (tõlke puudumisel eesti keeles) */
function localize(data: Data, lang: Lang): Data {
  if (lang === "et") return data;
  const svc = (sv: WidgetService): WidgetService => ({
    ...sv,
    name: loc(sv.name, sv.tr, lang, "name"),
    description: loc(sv.description, sv.tr, lang, "description"),
    campaignLabel: sv.campaignTr ? loc(sv.campaignLabel, sv.campaignTr, lang, "name") : sv.campaignLabel,
    staff: sv.staff.map((m) => ({ ...m, title: loc(m.title, m.tr, lang, "title") })),
  });
  return {
    ...data,
    business: { ...data.business, description: loc(data.business.description, data.business.tr, lang, "description") },
    banner: data.banner ? { ...data.banner, text: loc(data.banner.text, data.banner.tr, lang, "bannerText") } : null,
    categories: data.categories.map((c) => ({ ...c, name: loc(c.name, c.tr, lang, "name") })),
    services: data.services.map(svc),
  };
}

export function Widget({ data: raw, embed, lang: initialLang }: { data: Data; embed: boolean; lang: Lang }) {
  const [lang, setLang] = useState<Lang>(initialLang);
  const data = useMemo(() => localize(raw, lang), [raw, lang]);
  const { business: biz, theme, today } = data;
  const L = useMemo<L>(() => ({ lang, t: DICT[lang], d: dates(lang), srv: (x: string) => serverText(lang, x) }), [lang]);
  const { t, d } = L;
  const [step, setStep] = useState<Step>("home");
  const [cat, setCat] = useState<string>(data.categories[0]?.id ?? "none");
  const [infoPicked, setInfo] = useState<WidgetService | null>(null);
  const [picked, setService] = useState<WidgetService | null>(null);
  // keelevahetusel näita valitud teenust uues keeles
  const service = picked ? (data.services.find((x) => x.id === picked.id) ?? picked) : null;
  const info = infoPicked ? (data.services.find((x) => x.id === infoPicked.id) ?? infoPicked) : null;
  const [staffId, setStaffId] = useState<string | null>(null); // null = ükskõik kes
  const [date, setDate] = useState<string>(today);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", code: "", giftCode: "", usePackage: true, sms: true, terms: false, website: "" });
  const [q, setQ] = useState<Quote | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const [result, setResult] = useState<{ number: string; manageToken: string; finalCents: number; depositCents: number; prepaid: "package" | "gift" | null } | null>(null);
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
  const shopStep = step === "gift" || step === "packages";
  const back = () => {
    setError(null);
    if (shopStep) return setStep("home");
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

  const loadQuote = (code = form.code, extra: { giftCode?: string; usePackage?: boolean } = {}) =>
    new Promise<Quote | null>((resolve) =>
      start(async () => {
        if (!service || !slot) return resolve(null);
        const giftCode = extra.giftCode ?? form.giftCode;
        const r = await quote({
          slug: biz.slug, serviceId: service.id, staffId: slot.staffId, date, time: slot.time, code: code || undefined, email: form.email || undefined,
          giftCode: giftCode || undefined, usePackage: extra.usePackage ?? form.usePackage,
        });
        if (r.ok) {
          setQ(r);
          resolve(r);
        } else {
          setError(L.srv(r.reason));
          resolve(null);
        }
      }),
    );

  return (
    <LangCtx.Provider value={L}>
    <div lang={lang} style={style} className={clsx("flex min-h-dvh justify-center", embed ? "bg-[var(--w-bg)]" : "bg-[#f3f4f6] sm:py-8")}>
      <div className={clsx("relative flex w-full flex-col bg-[var(--w-bg)] text-[var(--w-text)]", embed ? "h-dvh" : "h-dvh sm:h-[min(820px,calc(100dvh-64px))] sm:max-w-[440px] sm:overflow-hidden sm:rounded-[20px] sm:shadow-[0_24px_60px_rgba(16,24,40,0.16)]")}>
        {/* Päis */}
        {step === "home" || step === "done" ? (
          <HomeHeader data={data} onClose={embed ? close : undefined} compact={step === "done"} lang={lang} setLang={setLang} />
        ) : (
          <header className="flex items-center gap-2 border-b border-black/5 px-4 py-3">
            <button type="button" onClick={back} aria-label={t.back} className="grid size-9 place-items-center rounded-full hover:bg-black/5">
              <ArrowLeft size={18} />
            </button>
            <h1 className="flex-1 text-[17px] font-semibold">
              {step === "gift" ? t.shopGift : step === "packages" ? t.shopPackages : step === "staff" ? t.stepStaff : step === "time" ? t.stepTime : step === "details" ? t.stepDetails : t.stepConfirm}
            </h1>
            {!shopStep && (
              <span className="text-[13px] opacity-60">
                {stepNo}/{steps.length}
              </span>
            )}
            {embed && (
              <button type="button" onClick={close} aria-label={t.close} className="grid size-9 place-items-center rounded-full hover:bg-black/5">
                <X size={18} />
              </button>
            )}
          </header>
        )}
        {step !== "home" && step !== "done" && !shopStep && (
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
          {step === "home" && <Home data={data} cat={cat} setCat={setCat} selected={service} onInfo={setInfo} onChoose={choose} onShop={setStep} />}
          {step === "gift" && data.shop.gift && <GiftShop slug={biz.slug} gift={data.shop.gift} embed={embed} />}
          {step === "packages" && <PackageShop slug={biz.slug} packages={data.shop.packages} embed={embed} />}
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
          {step === "details" && (
            <Details
              form={form} setForm={setForm} q={q} pending={pending} smsAvailable={biz.smsAvailable} giftCards={biz.giftCards}
              onApply={(code) => loadQuote(code)}
              onGift={(giftCode) => loadQuote(form.code, { giftCode })}
            />
          )}
          {step === "confirm" && service && slot && q && (
            <Confirm
              service={service} date={date} slot={slot} duration={duration} staffName={staffName} q={q} cancelHours={biz.cancelUntilHours} online={biz.onlineDeposits}
              onTogglePackage={(v) => { setForm({ ...form, usePackage: v }); loadQuote(form.code, { usePackage: v }); }}
            />
          )}
          {step === "done" && service && slot && result && (
            <Done biz={biz} service={service} date={date} slot={slot} duration={duration} staffName={staffName} email={form.email} result={result} />
          )}
        </div>

        {/* Jalus (poe vaadetel on oma nupp) */}
        {!shopStep && <Footer>
          {step === "home" && service && (
            <FooterRow
              left={
                <>
                  <p className="text-[13px] opacity-70">{t.oneService(service.durationMinutes)}</p>
                  {service.showPrice && <p className="font-semibold">{eur(service.campaignPriceCents ?? service.priceCents)}</p>}
                </>
              }
              button={<PrimaryButton onClick={() => setStep(staffStep ? "staff" : "time")}>{t.continue}</PrimaryButton>}
            />
          )}
          {step === "staff" && service && (
            <FooterRow
              left={
                <>
                  <p className="text-[13px] opacity-70">{service.name}</p>
                  <p className="font-semibold">{staffId ? service.staff.find((m) => m.id === staffId)?.name : t.anyone}</p>
                </>
              }
              button={<PrimaryButton onClick={() => setStep("time")}>{t.continue}</PrimaryButton>}
            />
          )}
          {step === "time" && (
            <FooterRow
              left={
                slot ? (
                  <>
                    <p className="text-[13px] opacity-70">{d.dayLong(date)}</p>
                    <p className="font-semibold">{t.at(`${slot.time}–${slot.end}`)}</p>
                  </>
                ) : (
                  <p className="text-[13px] opacity-70">{t.pickTime}</p>
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
                  {t.continue}
                </PrimaryButton>
              }
            />
          )}
          {step === "details" && q && (
            <FooterRow
              left={
                <>
                  <p className="text-[13px] opacity-70">{t.total}{q.code ? ` (${priceLabel(t, q.lines.find((l) => l.kind === "code")?.label ?? t.discount)})` : ""}</p>
                  <p className="font-semibold">{eur(q.finalCents)}</p>
                </>
              }
              button={
                <PrimaryButton
                  disabled={pending}
                  onClick={async () => {
                    setError(null);
                    if (form.name.trim().length < 2) return setError(t.errName);
                    if (!/^\S+@\S+\.\S+$/.test(form.email)) return setError(t.errEmail);
                    if (form.phone.replace(/\D/g, "").length < 5) return setError(t.errPhone);
                    if (!form.terms) return setError(t.errTerms);
                    // kood võib sõltuda e-postist (uued kliendid) – arvuta uuesti
                    if (await loadQuote()) setStep("confirm");
                  }}
                >
                  {t.continue}
                </PrimaryButton>
              }
            />
          )}
          {step === "confirm" && service && slot && q && (
            <div className="space-y-2">
              <p className="flex items-center justify-center gap-1.5 text-[12px] opacity-60">
                <ShieldCheck size={14} aria-hidden /> {t.freeCancel(biz.cancelUntilHours)}
              </p>
              {redirectUrl && (
                <p className="text-center text-[13px]">
                  {t.payNotOpened}{" "}
                  <a href={redirectUrl} target="_top" className="font-semibold underline">
                    {t.openPay}
                  </a>
                </p>
              )}
              <PrimaryButton
                className="w-full"
                disabled={pending || !!redirectUrl}
                onClick={() =>
                  start(async () => {
                    setError(null);
                    const r = await book({
                      slug: biz.slug, serviceId: service.id, staffId: slot.staffId, date, time: slot.time, code: q.code?.code,
                      giftCode: !q.pkg?.applied && q.gift ? q.gift.code : undefined, usePackage: !!q.pkg?.applied,
                      name: form.name, email: form.email, phone: `+372 ${form.phone}`.replace("+372 +", "+"), smsReminder: form.sms, terms: true, website: form.website,
                    });
                    if (r.ok && r.checkoutUrl) {
                      // ettemaks Stripe'is: makseleht ei avane iframe'is, seega suuname kogu lehe
                      setRedirectUrl(r.checkoutUrl);
                      if (embed) window.parent.postMessage({ type: "aegly:redirect", url: r.checkoutUrl }, "*");
                      else window.location.href = r.checkoutUrl;
                    } else if (r.ok) {
                      setResult(r);
                      setStep("done");
                    } else {
                      setError(L.srv(r.reason));
                      if (/vaba|broneeriti/.test(r.reason)) {
                        setSlot(null);
                        setStep("time");
                      }
                    }
                  })
                }
              >
                {pending || redirectUrl ? (q.depositCents > 0 && biz.onlineDeposits ? t.openingPay : t.booking) : q.depositCents > 0 && biz.onlineDeposits ? t.payDeposit(eur(q.depositCents)) : t.confirmBooking}
              </PrimaryButton>
            </div>
          )}
          {step === "done" && (
            <div className="space-y-2">
              <p className="text-center text-[13px] opacity-70">{t.seeYou(biz.name)}</p>
              <PrimaryButton className="w-full" onClick={embed ? close : reset}>
                {t.done}
              </PrimaryButton>
            </div>
          )}
        </Footer>}

        {info && (
          <ServiceSheet
            sv={info}
            onClose={() => setInfo(null)}
            onAdd={() => choose(info)}
          />
        )}
        <p className="pb-2 text-center text-[11px] opacity-40">{t.poweredBy}</p>
      </div>
    </div>
    </LangCtx.Provider>
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
  const { t, lang } = useL();
  const min = lang === "ru" ? "мин" : "min";
  if (!sv.showPrice) return <span>{sv.durationMinutes} {min}</span>;
  if (sv.priceType === "FREE") return <span>{t.free} · {sv.durationMinutes} {min}</span>;
  const from = sv.priceType === "FROM" ? t.from : "";
  return (
    <span>
      {sv.campaignPriceCents !== null && <s className="mr-1 opacity-50">{eur(sv.priceCents)}</s>}
      {from}
      {eur(sv.campaignPriceCents ?? sv.priceCents)} · {sv.durationMinutes} {min}
    </span>
  );
}

// ---------- W1–W3 ----------

function HomeHeader({ data, onClose, compact, lang, setLang }: { data: Data; onClose?: () => void; compact?: boolean; lang: Lang; setLang: (l: Lang) => void }) {
  const b = data.business;
  const { t } = useL();
  return (
    <header className="relative">
      {!compact && <div className="h-[92px] bg-[var(--w-primary)] bg-cover bg-center" style={b.bannerUrl ? { backgroundImage: `url(${b.bannerUrl})` } : undefined} />}
      <div role="radiogroup" aria-label={t.language} className={clsx("absolute top-3 flex rounded-full bg-white/90 p-0.5 text-[11px] font-semibold text-[#1f2937] shadow", onClose ? "right-14" : "right-3")}>
        {LANGS.map((l) => (
          <button key={l} type="button" role="radio" aria-checked={lang === l} onClick={() => setLang(l)} className={clsx("h-7 rounded-full px-2 uppercase", lang === l ? "bg-[#1f2937] text-white" : "opacity-70 hover:opacity-100")}>
            {l}
          </button>
        ))}
      </div>
      {onClose && (
        <button type="button" onClick={onClose} aria-label={t.close} className="absolute top-3 right-3 grid size-9 place-items-center rounded-full bg-white/90 text-[#1f2937] shadow">
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
            {[b.address, b.todayHours ? t.openToday(b.todayHours) : t.closedToday].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>
    </header>
  );
}

function Home({ data, cat, setCat, selected, onInfo, onChoose, onShop }: { data: Data; cat: string; setCat: (c: string) => void; selected: WidgetService | null; onInfo: (s: WidgetService) => void; onChoose: (s: WidgetService) => void; onShop: (s: "gift" | "packages") => void }) {
  const { t } = useL();
  const tabs = [...data.categories, ...(data.hasUncategorized ? [{ id: "none", name: t.other }] : [])];
  const list = data.services.filter((s) => (s.categoryId ?? "none") === cat);
  const anyDeposit = data.services.some((s) => s.depositPercent > 0);
  return (
    <div className="px-4 pb-4">
      <p className="mt-2 text-[14px] opacity-80">{data.business.description || t.welcome}</p>
      <div className="mt-3 flex flex-wrap gap-2 text-[12px]">
        {anyDeposit && (
          <span className="inline-flex items-center gap-1 rounded-full bg-black/5 px-2.5 py-1">
            <CreditCard size={13} aria-hidden /> {t.depositOnBooking}
          </span>
        )}
        <span className="inline-flex items-center gap-1 rounded-full bg-black/5 px-2.5 py-1">
          <Clock size={13} aria-hidden /> {t.cancelUntil(data.business.cancelUntilHours)}
        </span>
      </div>
      <ShopEntry shop={data.shop} onGift={() => onShop("gift")} onPackages={() => onShop("packages")} />
      {data.banner && (
        <p className="mt-3 flex items-center gap-2 rounded-[12px] px-3 py-2.5 text-[13px] font-semibold text-[#9a3412]" style={{ background: data.banner.color }}>
          <Tag size={15} aria-hidden /> {data.banner.text}
        </p>
      )}

      {tabs.length > 1 && (
        <div role="tablist" aria-label={t.categories} className="-mx-4 mt-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
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
                {sv.imageUrl && (
                  <button type="button" onClick={() => onInfo(sv)} className="shrink-0" aria-hidden tabIndex={-1}>
                    <img src={sv.imageUrl} alt="" loading="lazy" className="h-[60px] w-[80px] rounded-[10px] object-cover" />
                  </button>
                )}
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
                  aria-label={active ? t.selected(sv.name) : t.choose(sv.name)}
                  className={clsx("grid size-9 shrink-0 place-items-center rounded-full border", active ? "border-[var(--w-primary)] bg-[var(--w-primary)] text-[var(--w-on-primary)]" : "border-black/15")}
                >
                  {active ? <Check size={17} /> : <span className="text-lg leading-none">+</span>}
                </button>
              </div>
            </li>
          );
        })}
        {list.length === 0 && <li className="py-10 text-center text-[14px] opacity-60">{t.noServices}</li>}
      </ul>
    </div>
  );
}

function ServiceSheet({ sv, onClose, onAdd }: { sv: WidgetService; onClose: () => void; onAdd: () => void }) {
  const { t, lang } = useL();
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="absolute inset-0 z-10 flex items-end bg-black/40" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={sv.name} className="w-full rounded-t-[20px] bg-[var(--w-bg)] p-5" onClick={(e) => e.stopPropagation()}>
        {sv.imageUrl && <img src={sv.imageUrl} alt="" className="-mx-5 -mt-5 mb-4 aspect-[4/3] max-h-[220px] w-[calc(100%+2.5rem)] rounded-t-[20px] object-cover" />}
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-[19px] font-bold">{sv.name}</h2>
          <button type="button" onClick={onClose} aria-label={t.close} className="grid size-8 place-items-center rounded-full hover:bg-black/5">
            <X size={17} />
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-[13px]">
          <span className="rounded-full bg-black/5 px-2.5 py-1">{sv.durationMinutes} {lang === "ru" ? "мин" : "min"}</span>
          {sv.showPrice && <span className="rounded-full bg-black/5 px-2.5 py-1">{sv.priceType === "FREE" ? t.free : eur(sv.campaignPriceCents ?? sv.priceCents)}</span>}
          {sv.depositPercent > 0 && <span className="rounded-full bg-black/5 px-2.5 py-1">{t.depositPct(sv.depositPercent)}</span>}
        </div>
        {sv.description && <p className="mt-3 text-[14px] leading-relaxed opacity-80">{sv.description}</p>}
        <p className="mt-3 text-[13px] opacity-70">{t.doneBy(sv.staff.map((m) => m.name).join(", "))}</p>
        <PrimaryButton className="mt-5 w-full" onClick={onAdd}>
          {t.chooseService}
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
  const { t, d, lang } = useL();
  const relDay = (iso: string) => (iso === today ? t.today : iso === addDaysIso(today, 1) ? t.tomorrow : d.dayShort(iso));
  const minPrice = Math.min(...service.staff.map((m) => m.priceCents));
  const freeText = (f: Free | undefined) => (free === null ? t.searching : f ? t.firstFree(`${relDay(f.date)} ${f.time}`) : t.noFreeSoon);


  return (
    <div className="px-4 py-3">
      <p className="text-[13px] opacity-70">
        {service.name} · {service.durationMinutes} {lang === "ru" ? "мин" : "min"}
      </p>
      <ul role="radiogroup" aria-label={t.specialist} className="mt-3 space-y-2">
        <StaffRow
            value={value}
            onChange={onChange}
          id={null}
          title={t.anyone}
          sub={`${t.firstFreeTime}${service.showPrice ? t.fromPrice(eur(minPrice)) : ""}`}
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
            note={[m.onLeaveUntil ? t.onLeave(d.dayShort(m.onLeaveUntil)) : null, freeText(free?.staff[m.id])].filter(Boolean).join(" · ")}
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
  const [wForm, setWForm] = useState({ name: "", email: "", website: "" });
  const [wErr, setWErr] = useState<string | null>(null);
  const lastDay = addDaysIso(today, maxDays);
  const { t, d, srv } = useL();

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
        <p className="font-semibold">{d.monthYear(weekStart)}</p>
        <div className="flex gap-1">
          <button type="button" aria-label={t.prevWeek} disabled={weekStart <= today} onClick={() => setWeekStart(addDaysIso(weekStart, -7) < today ? today : addDaysIso(weekStart, -7))} className="grid size-9 place-items-center rounded-full hover:bg-black/5 disabled:opacity-30">
            <ChevronLeft size={18} />
          </button>
          <button type="button" aria-label={t.nextWeek} disabled={addDaysIso(weekStart, 7) > lastDay} onClick={() => setWeekStart(addDaysIso(weekStart, 7))} className="grid size-9 place-items-center rounded-full hover:bg-black/5 disabled:opacity-30">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1.5">
        {week.map((wd) => {
          const info = days?.find((x) => x.date === wd);
          const sel = wd === date;
          const none = info && info.free === 0;
          return (
            <button
              key={wd}
              type="button"
              onClick={() => setDate(wd)}
              aria-pressed={sel}
              aria-label={`${d.dayLong(wd)}${none ? t.noFreeTimes : ""}`}
              className={clsx("flex h-[58px] flex-col items-center justify-center rounded-[12px] border text-[11px]", sel ? "border-[var(--w-primary)] bg-[var(--w-primary)] text-[var(--w-on-primary)]" : "border-black/10", none && !sel && "opacity-40")}
            >
              <span className="uppercase opacity-80">{wd === today ? t.todayShort : d.weekdayLetter(wd)}</span>
              <span className={clsx("text-[16px] font-bold", none && "line-through")}>{d.dayNum(wd)}</span>
              {info && info.free > 0 && <span className={clsx("mt-0.5 size-1 rounded-full", sel ? "bg-[var(--w-on-primary)]" : "bg-[var(--w-primary)]")} />}
            </button>
          );
        })}
      </div>

      <p className="mt-5 text-[12px] font-semibold tracking-[0.5px] uppercase opacity-60">{d.dayLong(date)}</p>
      {day === null ? (
        <div className="mt-3 grid grid-cols-4 gap-2" aria-busy>
          {Array.from({ length: 8 }).map((_, i) => (
            <span key={i} className="h-11 animate-pulse rounded-[10px] bg-black/5" />
          ))}
        </div>
      ) : day.slots.length > 0 ? (
        <>
          <div role="radiogroup" aria-label={t.timeLabel} className={clsx("mt-3 grid gap-2", showStaffNames ? "grid-cols-3" : "grid-cols-4")}>
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
          <p className="font-semibold">{day.reason === "closed" ? t.closedDay : day.reason === "too-far" ? t.tooFar : t.fullyBooked}</p>
          <p className="mt-1 text-[13px] opacity-70">{t.pickOther}{day.reason ? "" : t.orWaitlist}.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {day.next && (
              <button type="button" onClick={() => goto(day.next!.date)} className="h-10 rounded-full bg-[var(--w-primary)] px-4 text-[14px] font-semibold text-[var(--w-on-primary)]">
                {t.nextFree(d.dayShort(day.next.date))}
              </button>
            )}
            {!day.reason && wait === "closed" && (
              <button type="button" onClick={() => setWait("open")} className="h-10 rounded-full border border-black/15 px-4 text-[14px] font-semibold">
                {t.joinWaitlist}
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
            else setWErr(srv(r.reason));
          }}
        >
          <p className="font-semibold">{t.notifyWhen(d.dayShort(date))}</p>
          <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-px w-px opacity-0" value={wForm.website} onChange={(e) => setWForm({ ...wForm, website: e.target.value })} />
          <WInput label={t.name} value={wForm.name} onChange={(v) => setWForm({ ...wForm, name: v })} autoComplete="name" />
          <WInput label={t.email} type="email" value={wForm.email} onChange={(v) => setWForm({ ...wForm, email: v })} autoComplete="email" />
          {wErr && <p className="text-[13px] text-[#b42318]">{wErr}</p>}
          <PrimaryButton type="submit" className="w-full">
            {t.joinWaitlist}
          </PrimaryButton>
        </form>
      )}
      {wait === "done" && (
        <p className="mt-4 flex items-center gap-2 rounded-[12px] bg-[#ecfdf3] px-3 py-2.5 text-[13px] text-[#067647]">
          <Check size={16} aria-hidden /> {t.onWaitlist}
        </p>
      )}
    </div>
  );
}

function WaitlistLink({ onClick, hidden }: { onClick: () => void; hidden: boolean }) {
  const { t } = useL();
  if (hidden) return null;
  return (
    <button type="button" onClick={onClick} className="mt-4 flex items-center gap-2 text-[13px] underline-offset-4 opacity-80 hover:underline">
      <Bell size={15} aria-hidden /> {t.cantFind}
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
  form, setForm, q, onApply, onGift, pending, smsAvailable, giftCards,
}: {
  smsAvailable: boolean;
  giftCards: boolean;
  form: { name: string; email: string; phone: string; code: string; giftCode: string; usePackage: boolean; sms: boolean; terms: boolean; website: string };
  setForm: (f: typeof form) => void;
  q: Quote | null;
  onApply: (code: string) => void;
  onGift: (code: string) => void;
  pending: boolean;
}) {
  const [codeInput, setCodeInput] = useState(form.code);
  const [giftInput, setGiftInput] = useState(form.giftCode);
  const [giftOpen, setGiftOpen] = useState(!!form.giftCode);
  const { t, srv } = useL();
  return (
    <div className="space-y-3.5 px-4 py-4">
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-px w-px opacity-0" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
      <WInput id="w-name" label={t.fullName} value={form.name} onChange={(v) => setForm({ ...form, name: v })} autoComplete="name" />
      <WInput id="w-email" label={t.email} type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} autoComplete="email" inputMode="email" />
      <WInput id="w-phone" label={t.phone} type="tel" prefix="EE +372" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} autoComplete="tel-national" inputMode="tel" />
      <div>
        <label htmlFor="w-code" className="mb-1 block text-[13px] font-medium">
          {t.promo}
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
              {t.remove}
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
              {t.apply}
            </button>
          )}
        </div>
        {q?.code && (
          <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-[#067647]">
            <Check size={14} aria-hidden /> {t.applied(q.code.code, eur(-q.code.discountCents))}
          </p>
        )}
        {q?.codeMessage && form.code && <p className="mt-1.5 text-[13px] text-[#b42318]">{srv(q.codeMessage)}</p>}
      </div>
      {(giftCards || form.giftCode) && !giftOpen && (
        <button type="button" onClick={() => setGiftOpen(true)} className="flex items-center gap-1.5 text-[14px] font-semibold text-[var(--w-primary)]">
          <Gift size={15} aria-hidden /> {t.haveGift}
        </button>
      )}
      {giftOpen && (
        <div>
          <label htmlFor="w-gift" className="mb-1 block text-[13px] font-medium">{t.giftCode}</label>
          <div className="flex gap-2">
            <input
              id="w-gift" value={giftInput} placeholder="GC-XXXX-XXX" autoComplete="off" spellCheck={false}
              onChange={(e) => setGiftInput(e.target.value.toUpperCase())}
              className="h-12 min-w-0 flex-1 rounded-[12px] border border-black/15 bg-transparent px-3 text-[15px] uppercase outline-none focus:border-[var(--w-primary)]"
            />
            {form.giftCode && q?.gift ? (
              <button type="button" className="h-12 rounded-[12px] border border-black/15 px-4 text-[14px] font-semibold" onClick={() => { setGiftInput(""); setForm({ ...form, giftCode: "" }); onGift(""); }}>
                {t.remove}
              </button>
            ) : (
              <button
                type="button" disabled={!giftInput.trim() || pending} className="h-12 rounded-[12px] border border-black/15 px-4 text-[14px] font-semibold disabled:opacity-40"
                onClick={() => { setForm({ ...form, giftCode: giftInput.trim() }); onGift(giftInput.trim()); }}
              >
                {t.apply}
              </button>
            )}
          </div>
          {q?.gift && (
            <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-[#067647]">
              <Check size={14} aria-hidden /> {t.giftApplied(q.gift.code, eur(q.gift.appliedCents))} · {t.giftLeft(eur(q.gift.balanceCents - q.gift.appliedCents))}
            </p>
          )}
          {q?.giftMessage && form.giftCode && <p className="mt-1.5 text-[13px] text-[#b42318]">{srv(q.giftMessage)}</p>}
        </div>
      )}
      {smsAvailable && <label className="flex items-start gap-2.5 text-[14px]">
        <input type="checkbox" checked={form.sms} onChange={(e) => setForm({ ...form, sms: e.target.checked })} className="mt-0.5 size-[18px] accent-[var(--w-primary)]" />
        {t.smsReminder}
      </label>}
      <label className="flex items-start gap-2.5 text-[14px]">
        <input type="checkbox" checked={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.checked })} className="mt-0.5 size-[18px] accent-[var(--w-primary)]" />
        {t.acceptTerms}
      </label>
    </div>
  );
}

// ---------- W7 ----------

function Confirm({ service, date, slot, duration, staffName, q, cancelHours, online, onTogglePackage }: { service: WidgetService; date: string; slot: Slot; duration: number; staffName?: string; q: Quote; cancelHours: number; online: boolean; onTogglePackage: (v: boolean) => void }) {
  const { t, d } = useL();
  return (
    <div className="space-y-4 px-4 py-4">
      {q.pkg && (
        <div className={clsx("rounded-[14px] border p-3.5", q.pkg.applied ? "border-[var(--w-primary)] bg-[var(--w-primary)]/5" : "border-black/10")}>
          <Check2 checked={q.pkg.applied} onChange={onTogglePackage}>
            <span className="flex items-center gap-1.5 font-semibold">
              <Package size={15} aria-hidden /> {t.pkgUse(q.pkg.name, q.pkg.usesLeft)}
            </span>
          </Check2>
        </div>
      )}
      <div className="rounded-[14px] border border-black/10 p-4">
        <div className="flex justify-between gap-3 font-semibold">
          <span>{service.name}</span>
          <span>{eur(q.baseCents)}</span>
        </div>
        <p className="mt-1 text-[13px] opacity-70">
          {d.dayShort(date)} {t.at(`${slot.time}–${addMinutes(slot.time, duration)}`)}
          {staffName ? ` · ${staffName}` : ""}
        </p>
        {q.lines
          .filter((l) => l.kind !== "base" && l.kind !== "staff")
          .map((l, i) => (
            <div key={i} className="mt-2 flex justify-between text-[14px]">
              <span className="opacity-80">{priceLabel(t, l.label)}</span>
              <span>{eur(l.amountCents)}</span>
            </div>
          ))}
        <div className="mt-3 flex justify-between border-t border-black/10 pt-3 text-[16px] font-bold">
          <span>{t.total}</span>
          <span>{eur(q.finalCents)}</span>
        </div>
      </div>
      {q.pkg?.applied ? (
        <p className="flex gap-2 rounded-[12px] bg-[#ecfdf3] p-3 text-[13px] text-[#067647]">
          <Check size={16} className="mt-0.5 shrink-0" aria-hidden /> {t.pkgCovered}
        </p>
      ) : q.depositCents > 0 ? (
        <p className="flex gap-2 rounded-[12px] bg-black/[0.04] p-3 text-[13px]">
          <Info size={16} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            {online
              ? t.depositOnline(eur(q.depositCents), q.finalCents > q.depositCents ? eur(q.finalCents - q.depositCents) : null, cancelHours)
              : t.depositOffline(eur(q.depositCents), eur(q.finalCents))}
          </span>
        </p>
      ) : (
        <p className="flex gap-2 rounded-[12px] bg-black/[0.04] p-3 text-[13px]">
          <Info size={16} className="mt-0.5 shrink-0" aria-hidden /> {q.finalCents === 0 && q.gift ? t.giftCovered : t.payOnSite}
        </p>
      )}
      <p className="text-[12px] opacity-60">{t.changeLink(cancelHours)}</p>
    </div>
  );
}

// ---------- W8 ----------

function Done({ biz, service, date, slot, duration, staffName, email, result }: { biz: Data["business"]; service: WidgetService; date: string; slot: Slot; duration: number; staffName?: string; email: string; result: { number: string; manageToken: string; finalCents: number; prepaid: "package" | "gift" | null } }) {
  const { t, d, lang } = useL();
  const rows: [string, string][] = [
    [t.rowService, `${service.name} · ${duration} ${lang === "ru" ? "мин" : "min"}`],
    [t.rowTime, `${d.dayShortYear(date)} ${t.at(slot.time)}`],
    ...(staffName ? ([[t.rowStaff, staffName]] as [string, string][]) : []),
    [t.rowPrice, result.prepaid === "package" ? t.pkgLine : result.finalCents === 0 ? `${eur(0)} · ${t.giftLine}` : `${eur(result.finalCents)} · ${t.payOnSiteShort}`],
    [t.bookingNo, result.number],
  ];
  return (
    <div className="px-4 py-5">
      <div className="flex flex-col items-center text-center">
        <span className="grid size-14 place-items-center rounded-full bg-[#ecfdf3] text-[#067647]">
          <Check size={28} />
        </span>
        <h2 className="mt-3 text-[20px] font-bold">{t.booked}</h2>
        <p className="mt-1 text-[14px] opacity-70">{t.confirmationTo(email)}</p>
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
          <CalendarPlus size={16} aria-hidden /> {t.addCal}
        </a>
        <a href={`/b/${result.manageToken}`} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center justify-center rounded-full border border-black/15 text-[14px] font-semibold">
          {t.change}
        </a>
      </div>
      {biz.phone && <p className="mt-4 text-center text-[13px] opacity-60">{t.questions(biz.phone)}</p>}
    </div>
  );
}


// ---------- Pood: kinkekaart ja paketid ----------

function ShopEntry({ shop, onGift, onPackages }: { shop: Data["shop"]; onGift: () => void; onPackages: () => void }) {
  const { t } = useL();
  if (!shop.gift && !shop.packages.length) return null;
  const card = "flex flex-1 items-center gap-3 rounded-[14px] border border-black/10 p-3 text-left hover:border-[var(--w-primary)]";
  return (
    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
      {shop.gift && (
        <button type="button" onClick={onGift} className={card}>
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--w-primary)]/10 text-[var(--w-primary)]">
            <Gift size={18} aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-[14px] font-semibold">{t.shopGift}</span>
            <span className="block text-[12px] opacity-60">{t.shopGiftSub}</span>
          </span>
        </button>
      )}
      {shop.packages.length > 0 && (
        <button type="button" onClick={onPackages} className={card}>
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--w-primary)]/10 text-[var(--w-primary)]">
            <Package size={18} aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-[14px] font-semibold">{t.shopPackages}</span>
            <span className="block text-[12px] opacity-60">{t.shopPackagesSub}</span>
          </span>
        </button>
      )}
    </div>
  );
}

function Check2({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="flex items-start gap-2.5 text-[14px]">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-[18px] accent-[var(--w-primary)]" />
      {children}
    </label>
  );
}

/** Stripe'i makseleht ei avane iframe'is → suuna kogu leht */
function goToPayment(url: string, embed: boolean) {
  if (embed) window.parent.postMessage({ type: "aegly:redirect", url }, "*");
  else window.location.href = url;
}

function GiftShop({ slug, gift, embed }: { slug: string; gift: NonNullable<Data["shop"]["gift"]>; embed: boolean }) {
  const { t, lang, srv } = useL();
  const [amount, setAmount] = useState<number | null>(gift.amounts[1] ?? gift.amounts[0] ?? null);
  const [custom, setCustom] = useState("");
  const [f, setF] = useState({ name: "", email: "", forOther: false, rName: "", rEmail: "", message: "", terms: false, website: "" });
  const [error, setError] = useState<string | null>(null);
  const [redirect, setRedirect] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const customCents = Math.round(Number(custom.replace(",", ".")) * 100);
  const cents = amount ?? (Number.isFinite(customCents) ? customCents : 0);

  const submit = () =>
    start(async () => {
      setError(null);
      if (!cents || (amount === null && cents < gift.minCents)) return setError(t.minAmount(eur(gift.minCents)));
      if (f.name.trim().length < 2) return setError(t.errName);
      if (!/^\S+@\S+\.\S+$/.test(f.email)) return setError(t.errEmail);
      if (f.forOther && !/^\S+@\S+\.\S+$/.test(f.rEmail)) return setError(srv("Sisesta saaja kehtiv e-post"));
      if (!f.terms) return setError(srv("Nõustu tingimustega"));
      const r = await buyGiftCard({
        slug, amountCents: cents, buyerName: f.name, buyerEmail: f.email, forOther: f.forOther, recipientName: f.rName, recipientEmail: f.rEmail,
        message: f.message, lang, terms: true, website: f.website,
      });
      if (r.ok) {
        setRedirect(r.url);
        goToPayment(r.url, embed);
      } else setError(srv(r.reason));
    });

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1 space-y-4 px-4 py-4">
        {error && <p role="alert" className="rounded-[10px] bg-[#fef3f2] px-3 py-2 text-[13px] text-[#b42318]">{error}</p>}
        <fieldset>
          <legend className="mb-2 text-[13px] font-medium">{t.pickAmount}</legend>
          <div className="grid grid-cols-3 gap-2">
            {gift.amounts.map((a) => (
              <button
                key={a}
                type="button"
                aria-pressed={amount === a}
                onClick={() => { setAmount(a); setCustom(""); }}
                className={clsx("h-12 rounded-[12px] border text-[15px] font-semibold", amount === a ? "border-[var(--w-primary)] bg-[var(--w-primary)] text-[var(--w-on-primary)]" : "border-black/15")}
              >
                {formatEuro(a)}
              </button>
            ))}
          </div>
          {gift.custom && (
            <div className="mt-2">
              <WInput id="g-custom" label={`${t.otherAmount} (€) · ${t.minAmount(eur(gift.minCents)).toLowerCase()}`} value={custom} inputMode="text" onChange={(v) => { setCustom(v.replace(/[^\d.,]/g, "")); setAmount(null); }} />
            </div>
          )}
          <p className="mt-2 text-[12px] opacity-60">{t.giftValid(gift.validityMonths)}</p>
        </fieldset>
        <fieldset className="space-y-3">
          <legend className="mb-1 text-[13px] font-medium">{t.buyerDetails}</legend>
          <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-px w-px opacity-0" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} />
          <WInput id="g-name" label={t.fullName} value={f.name} onChange={(v) => setF({ ...f, name: v })} autoComplete="name" />
          <WInput id="g-email" label={t.email} type="email" value={f.email} onChange={(v) => setF({ ...f, email: v })} autoComplete="email" inputMode="email" />
        </fieldset>
        <Check2 checked={f.forOther} onChange={(v) => setF({ ...f, forOther: v })}>{t.forOther}</Check2>
        {f.forOther && (
          <div className="space-y-3 rounded-[14px] bg-black/[0.03] p-3">
            <WInput id="g-rname" label={t.recipientName} value={f.rName} onChange={(v) => setF({ ...f, rName: v })} />
            <WInput id="g-remail" label={t.recipientEmail} type="email" value={f.rEmail} onChange={(v) => setF({ ...f, rEmail: v })} inputMode="email" />
            <div>
              <label htmlFor="g-msg" className="mb-1 block text-[13px] font-medium">{t.giftMessage}</label>
              <textarea id="g-msg" rows={3} maxLength={300} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} className="w-full rounded-[12px] border border-black/15 bg-transparent px-3 py-2 text-[15px] outline-none focus:border-[var(--w-primary)]" />
            </div>
          </div>
        )}
        <Check2 checked={f.terms} onChange={(v) => setF({ ...f, terms: v })}>{t.acceptShopTerms}</Check2>
      </div>
      <div className="sticky bottom-0 space-y-2 border-t border-black/5 bg-[var(--w-bg)] px-4 py-3">
        {redirect && (
          <p className="text-center text-[13px]">
            {t.payNotOpened} <a href={redirect} target="_top" className="font-semibold underline">{t.openPay}</a>
          </p>
        )}
        <PrimaryButton className="w-full" disabled={pending || !!redirect || !cents} onClick={submit}>
          {pending || redirect ? t.openingPay : t.payAmount(cents ? eur(cents) : "")}
        </PrimaryButton>
      </div>
    </div>
  );
}

function PackageShop({ slug, packages, embed }: { slug: string; packages: Data["shop"]["packages"]; embed: boolean }) {
  const { t, lang, srv } = useL();
  const [picked, setPicked] = useState<string | null>(packages.length === 1 ? packages[0].id : null);
  const [f, setF] = useState({ name: "", email: "", phone: "", terms: false, website: "" });
  const [error, setError] = useState<string | null>(null);
  const [redirect, setRedirect] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const pkg = packages.find((p) => p.id === picked) ?? null;

  const submit = () =>
    start(async () => {
      setError(null);
      if (!pkg) return;
      if (f.name.trim().length < 2) return setError(t.errName);
      if (!/^\S+@\S+\.\S+$/.test(f.email)) return setError(t.errEmail);
      if (!f.terms) return setError(srv("Nõustu tingimustega"));
      const r = await buyPackage({ slug, packageId: pkg.id, buyerName: f.name, buyerEmail: f.email, buyerPhone: f.phone ? `+372 ${f.phone}`.replace("+372 +", "+") : "", lang, terms: true, website: f.website });
      if (r.ok) {
        setRedirect(r.url);
        goToPayment(r.url, embed);
      } else setError(srv(r.reason));
    });

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1 space-y-3 px-4 py-4">
        {error && <p role="alert" className="rounded-[10px] bg-[#fef3f2] px-3 py-2 text-[13px] text-[#b42318]">{error}</p>}
        <ul className="space-y-2">
          {packages.map((p) => {
            const active = p.id === picked;
            const visits = p.items.reduce((n, i) => n + i.quantity, 0);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => setPicked(p.id)}
                  className={clsx("w-full rounded-[14px] border p-3.5 text-left", active ? "border-[var(--w-primary)] ring-1 ring-[var(--w-primary)]" : "border-black/10")}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="font-semibold">{p.name}</span>
                    <span className="shrink-0 font-semibold">{eur(p.priceCents)}</span>
                  </span>
                  {p.description && <span className="mt-1 block text-[13px] opacity-70">{p.description}</span>}
                  <span className="mt-2 block text-[13px]">
                    <span className="opacity-60">{t.packageIncludes}: </span>
                    {p.items.map((i) => `${i.quantity}× ${i.serviceName}`).join(", ")}
                  </span>
                  <span className="mt-1 block text-[12px] opacity-60">
                    {t.packageUses(visits)}
                    {p.validityDays ? ` · ${t.packageValid(p.validityDays)}` : ""}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {pkg && (
          <div className="space-y-3 pt-2">
            <p className="flex gap-2 rounded-[12px] bg-black/[0.04] p-3 text-[13px]">
              <Info size={16} className="mt-0.5 shrink-0" aria-hidden /> {t.packageInfo}
            </p>
            <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-px w-px opacity-0" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} />
            <WInput id="p-name" label={t.fullName} value={f.name} onChange={(v) => setF({ ...f, name: v })} autoComplete="name" />
            <WInput id="p-email" label={t.email} type="email" value={f.email} onChange={(v) => setF({ ...f, email: v })} autoComplete="email" inputMode="email" />
            <WInput id="p-phone" label={t.phone} type="tel" prefix="EE +372" value={f.phone} onChange={(v) => setF({ ...f, phone: v })} autoComplete="tel-national" inputMode="tel" />
            <Check2 checked={f.terms} onChange={(v) => setF({ ...f, terms: v })}>{t.acceptShopTerms}</Check2>
          </div>
        )}
      </div>
      {pkg && (
        <div className="sticky bottom-0 space-y-2 border-t border-black/5 bg-[var(--w-bg)] px-4 py-3">
          {redirect && (
            <p className="text-center text-[13px]">
              {t.payNotOpened} <a href={redirect} target="_top" className="font-semibold underline">{t.openPay}</a>
            </p>
          )}
          <PrimaryButton className="w-full" disabled={pending || !!redirect} onClick={submit}>
            {pending || redirect ? t.openingPay : t.payAmount(eur(pkg.priceCents))}
          </PrimaryButton>
        </div>
      )}
    </div>
  );
}

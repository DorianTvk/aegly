"use client";

import { useFormAction } from "@/components/ui/use-form-action";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { clsx } from "clsx";
import { ENTERPRISE_NOTE, PLAN_IDS, PLANS, staffLimitText, type BillingPeriod, type PlanId } from "@/lib/plans";
import { formatEuro } from "@/lib/time";

import { Field, FormMessage, Input, Select } from "@/components/ui/form";
import { findIndustry, INDUSTRIES } from "@/lib/industries";
import { Button } from "@/components/ui/primitives";
import { acceptInvite, login, register, requestPasswordReset, resetPassword } from "./actions";
import { BotProtection } from "@/components/ui/BotProtection";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { PASSWORD_HINT } from "@/lib/password-policy";

export function LoginForm({ next, siteKey }: { next?: string; siteKey?: string | null }) {
  const [state, action, pending] = useFormAction(login);
  const e = state?.errors ?? {};
  return (
    <form onSubmit={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="E-post" htmlFor="email" error={e.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required aria-invalid={!!e.email} />
      </Field>
      <Field label="Parool" htmlFor="password" error={e.password}>
        <Input id="password" name="password" type="password" autoComplete="current-password" required aria-invalid={!!e.password} />
      </Field>
      <p className="-mt-1 text-right text-sm">
        <Link href="/parool/unustasin" className="font-medium text-muted underline-offset-4 hover:text-ink hover:underline">
          Unustasid parooli?
        </Link>
      </p>
      <BotProtection siteKey={siteKey} resetKey={state} />
      <Button type="submit" variant="primary" className="w-full" disabled={pending}>
        {pending ? "Sisenen…" : "Logi sisse"}
      </Button>
      <p className="text-center text-sm text-muted">
        Pole veel kontot?{" "}
        <Link href="/registreeru" className="font-semibold text-ink underline-offset-4 hover:underline">
          Loo konto
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm({ defaultPlan = "SALONG", defaultPeriod = "MONTH", siteKey }: { defaultPlan?: PlanId; defaultPeriod?: BillingPeriod; siteKey?: string | null }) {
  const [state, action, pending] = useFormAction(register);
  const [plan, setPlan] = useState<PlanId>(defaultPlan);
  const [period, setPeriod] = useState<BillingPeriod>(defaultPeriod);
  const [industry, setIndustry] = useState("ilu");
  const e = state?.errors ?? {};
  const yearly = period === "YEAR";
  const chosen = PLANS[plan];

  return (
    <form onSubmit={action} className="space-y-7" noValidate>
      <FormMessage state={state} />

      <fieldset className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <legend className="flex items-center gap-2 text-[15px] font-semibold">
            <span className="grid size-6 place-items-center rounded-full bg-ink text-xs text-white">1</span>
            Vali pakett
          </legend>
          <div role="radiogroup" aria-label="Arveldusperiood" className="inline-flex rounded-full bg-line-soft p-0.5 text-[13px]">
            {(["MONTH", "YEAR"] as const).map((p) => (
              <label key={p} className={clsx("relative flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-lime", period === p ? "bg-white font-semibold shadow-sm" : "text-muted")}>
                <input type="radio" name="period" value={p} checked={period === p} onChange={() => setPeriod(p)} className="sr-only" />
                {p === "MONTH" ? "Kuu kaupa" : "Aasta kaupa"}
                {p === "YEAR" && <span className="rounded-full bg-lime px-1.5 py-px text-[10px] font-bold text-ink">2 kuud tasuta</span>}
              </label>
            ))}
          </div>
        </div>

        <div role="radiogroup" aria-label="Pakett" className="space-y-2">
          {PLAN_IDS.map((id) => {
            const p = PLANS[id];
            const active = plan === id;
            const price = yearly ? p.yearlyCents : p.monthlyCents;
            return (
              <label
                key={id}
                className={clsx(
                  "relative flex cursor-pointer items-center gap-3.5 rounded-[14px] border px-4 py-3.5 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-lime",
                  active ? "border-ink bg-[#f7fee7]" : "border-line hover:border-[#c4c9d2]",
                )}
              >
                <input type="radio" name="plan" value={id} checked={active} onChange={() => setPlan(id)} className="sr-only" />
                <span className={clsx("grid size-5 shrink-0 place-items-center rounded-full border-2", active ? "border-ink bg-ink" : "border-[#c4c9d2]")} aria-hidden>
                  {active && <span className="size-2 rounded-full bg-lime" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-[15px] font-semibold">
                    {p.name}
                    {id === "SALONG" && <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] font-semibold text-white">Populaarseim</span>}
                  </span>
                  <span className="block text-[13px] text-muted">{staffLimitText(id)}</span>
                </span>
                <span className="text-right">
                  <span className="block text-[17px] font-bold tracking-[-0.2px]">{formatEuro(price)}</span>
                  <span className="block text-[12px] text-muted">{yearly ? `aastas · ${formatEuro(Math.round(p.yearlyCents / 12), { decimals: true })} kuus` : "kuus"}</span>
                </span>
              </label>
            );
          })}
        </div>

        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted">
          {["Kõik funktsioonid igas paketis", "0 % vahendustasu", "Paketti saab hiljem vahetada"].map((t) => (
            <li key={t} className="flex items-center gap-1.5">
              <Check size={13} className="text-[#4d7c0f]" strokeWidth={2.75} aria-hidden />
              {t}
            </li>
          ))}
        </ul>
        <p className="text-[12px] text-muted">{ENTERPRISE_NOTE}</p>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-3 flex items-center gap-2 text-[15px] font-semibold">
          <span className="grid size-6 place-items-center rounded-full bg-ink text-xs text-white">2</span>
          Sinu andmed
        </legend>
        <Field label="Valdkond" htmlFor="industry" hint="Valime selle järgi esialgsed teenusekategooriad – saad neid hiljem muuta">
          <Select id="industry" name="industry" value={industry} onChange={(ev) => setIndustry(ev.target.value)}>
            {INDUSTRIES.map((i) => (
              <option key={i.id} value={i.id}>
                {i.label}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Ettevõtte nimi" htmlFor="businessName" error={e.businessName}>
            <Input id="businessName" name="businessName" placeholder={findIndustry(industry).example} autoComplete="organization" aria-invalid={!!e.businessName} />
          </Field>
          <Field label="Sinu nimi" htmlFor="ownerName" error={e.ownerName}>
            <Input id="ownerName" name="ownerName" placeholder="Ees- ja perekonnanimi" autoComplete="name" aria-invalid={!!e.ownerName} />
          </Field>
        </div>
        <Field label="E-post" htmlFor="email" error={e.email} hint={e.email ? undefined : "Saadame sinna kinnituslingi"}>
          <Input id="email" name="email" type="email" placeholder="nimi@ettevote.ee" autoComplete="email" aria-invalid={!!e.email} />
        </Field>
        <Field label="Parool" htmlFor="password" hint={e.password ? undefined : PASSWORD_HINT} error={e.password}>
          <PasswordInput id="password" name="password" invalid={!!e.password} />
        </Field>
      </fieldset>

      <div className="space-y-4">
        <label className="flex cursor-pointer items-start gap-2.5 text-[13px] leading-relaxed text-muted">
          <input type="checkbox" name="terms" className="mt-0.5 size-4 shrink-0 accent-[#1f2937]" aria-invalid={!!e.terms} />
          <span>
            Nõustun Aegly{" "}
            <Link href="/tingimused" target="_blank" className="font-medium text-ink underline underline-offset-2">
              kasutustingimuste
            </Link>
            ,{" "}
            <Link href="/andmetootlus" target="_blank" className="font-medium text-ink underline underline-offset-2">
              andmetöötluslepingu
            </Link>{" "}
            ja{" "}
            <Link href="/privaatsus" target="_blank" className="font-medium text-ink underline underline-offset-2">
              privaatsuspoliitikaga
            </Link>
            {e.terms && <span className="block text-xs text-bad">{e.terms[0]}</span>}
          </span>
        </label>
        <BotProtection siteKey={siteKey} resetKey={state} />
        <Button type="submit" variant="primary" className="h-12 w-full text-[15px]" disabled={pending}>
          {pending ? "Loon kontot…" : (
            <>
              Loo konto <ArrowRight size={17} aria-hidden />
            </>
          )}
        </Button>
        <p className="text-center text-[13px] text-muted">
          {chosen.name} · {yearly ? `${formatEuro(chosen.yearlyCents)} aastas` : `${formatEuro(chosen.monthlyCents)} kuus`} + km
        </p>
        <p className="border-t border-line-soft pt-4 text-center text-sm text-muted">
          Konto juba olemas?{" "}
          <Link href="/logi-sisse" className="font-semibold text-ink underline-offset-4 hover:underline">
            Logi sisse
          </Link>
        </p>
      </div>
    </form>
  );
}

export function ForgotForm({ siteKey }: { siteKey?: string | null }) {
  const [state, action, pending] = useFormAction(requestPasswordReset);
  const e = state?.errors ?? {};
  if (state?.ok) {
    return (
      <div className="space-y-4">
        <FormMessage state={state} />
        <Link href="/logi-sisse" className="block text-center text-sm font-semibold underline-offset-4 hover:underline">
          Tagasi sisselogimisele
        </Link>
      </div>
    );
  }
  return (
    <form onSubmit={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <Field label="E-post" htmlFor="email" error={e.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required aria-invalid={!!e.email} />
      </Field>
      <BotProtection siteKey={siteKey} resetKey={state} />
      <Button type="submit" variant="primary" className="w-full" disabled={pending}>
        {pending ? "Saadan…" : "Saada link"}
      </Button>
      <p className="text-center text-sm text-muted">
        Meenus?{" "}
        <Link href="/logi-sisse" className="font-semibold text-ink underline-offset-4 hover:underline">
          Logi sisse
        </Link>
      </p>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useFormAction(resetPassword);
  const e = state?.errors ?? {};
  return (
    <form onSubmit={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="token" value={token} />
      <Field label="Uus parool" htmlFor="password" error={e.password} hint={PASSWORD_HINT}>
        <PasswordInput id="password" name="password" invalid={!!e.password} />
      </Field>
      <Field label="Korda parooli" htmlFor="password2" error={e.password2}>
        <Input id="password2" name="password2" type="password" autoComplete="new-password" required aria-invalid={!!e.password2} />
      </Field>
      <Button type="submit" variant="primary" className="w-full" disabled={pending}>
        {pending ? "Salvestan…" : "Salvesta uus parool"}
      </Button>
    </form>
  );
}

export function InviteForm({ token, email, name }: { token: string; email: string; name: string }) {
  const [state, action, pending] = useFormAction(acceptInvite);
  const e = state?.errors ?? {};
  return (
    <form onSubmit={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="token" value={token} />
      <Field label="E-post" htmlFor="email">
        <Input id="email" value={email} readOnly disabled />
      </Field>
      <Field label="Sinu nimi" htmlFor="name" error={e.name}>
        <Input id="name" name="name" defaultValue={name} autoComplete="name" required aria-invalid={!!e.name} />
      </Field>
      <Field label="Parool" htmlFor="password" error={e.password} hint={PASSWORD_HINT}>
        <PasswordInput id="password" name="password" invalid={!!e.password} context={{ email }} />
      </Field>
      <Field label="Korda parooli" htmlFor="password2" error={e.password2}>
        <Input id="password2" name="password2" type="password" autoComplete="new-password" required aria-invalid={!!e.password2} />
      </Field>
      <Button type="submit" variant="primary" className="w-full" disabled={pending}>
        {pending ? "Loon kontot…" : "Liitu ja logi sisse"}
      </Button>
    </form>
  );
}

"use client";

import { useFormAction } from "@/components/ui/use-form-action";
import Link from "next/link";
import { useState } from "react";
import { clsx } from "clsx";
import { PLAN_IDS, PLANS, staffLimitText, type BillingPeriod, type PlanId } from "@/lib/plans";
import { formatEuro } from "@/lib/time";

import { Field, FormMessage, Input } from "@/components/ui/form";
import { Button } from "@/components/ui/primitives";
import { acceptInvite, login, register, requestPasswordReset, resetPassword } from "./actions";
import { BotProtection } from "@/components/ui/BotProtection";

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
  const e = state?.errors ?? {};
  return (
    <form onSubmit={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Pakett</legend>
        <input type="hidden" name="plan" value={plan} />
        <input type="hidden" name="period" value={period} />
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Pakett">
          {PLAN_IDS.map((id) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={plan === id}
              onClick={() => setPlan(id)}
              className={clsx("rounded-[10px] border px-3 py-2.5 text-left", plan === id ? "border-ink ring-1 ring-ink" : "border-line hover:bg-line-soft")}
            >
              <span className="block text-sm font-semibold">{PLANS[id].name}</span>
              <span className="block text-xs text-muted">{formatEuro(period === "YEAR" ? PLANS[id].yearlyCents : PLANS[id].monthlyCents)} / {period === "YEAR" ? "a" : "kuu"}</span>
              <span className="block text-[11px] text-muted">{staffLimitText(id)}</span>
            </button>
          ))}
        </div>
        <label className="mt-2 flex items-center gap-2 text-[13px] text-muted">
          <input type="checkbox" checked={period === "YEAR"} onChange={(ev) => setPeriod(ev.target.checked ? "YEAR" : "MONTH")} className="size-4 accent-[#a3e635]" />
          Maksan aasta korraga (2 kuud tasuta). Hindadele lisandub km.
        </label>
      </fieldset>
      <Field label="Ettevõtte nimi" htmlFor="businessName" error={e.businessName}>
        <Input id="businessName" name="businessName" placeholder="nt Studio Lumi" autoComplete="organization" aria-invalid={!!e.businessName} />
      </Field>
      <Field label="Sinu nimi" htmlFor="ownerName" error={e.ownerName}>
        <Input id="ownerName" name="ownerName" autoComplete="name" aria-invalid={!!e.ownerName} />
      </Field>
      <Field label="E-post" htmlFor="email" error={e.email}>
        <Input id="email" name="email" type="email" autoComplete="email" aria-invalid={!!e.email} />
      </Field>
      <Field label="Parool" htmlFor="password" hint="Vähemalt 8 märki" error={e.password}>
        <Input id="password" name="password" type="password" autoComplete="new-password" aria-invalid={!!e.password} />
      </Field>
      <label className="flex items-start gap-2.5 text-sm text-muted">
        <input type="checkbox" name="terms" className="mt-0.5 size-4 accent-[#a3e635]" />
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
      <Button type="submit" variant="primary" className="w-full" disabled={pending}>
        {pending ? "Loon kontot…" : "Loo konto"}
      </Button>
      <p className="text-center text-sm text-muted">
        Konto juba olemas?{" "}
        <Link href="/logi-sisse" className="font-semibold text-ink underline-offset-4 hover:underline">
          Logi sisse
        </Link>
      </p>
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
      <Field label="Uus parool" htmlFor="password" error={e.password} hint="Vähemalt 8 märki">
        <Input id="password" name="password" type="password" autoComplete="new-password" required aria-invalid={!!e.password} />
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
      <Field label="Parool" htmlFor="password" error={e.password} hint="Vähemalt 8 märki">
        <Input id="password" name="password" type="password" autoComplete="new-password" required aria-invalid={!!e.password} />
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

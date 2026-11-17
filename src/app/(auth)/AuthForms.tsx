"use client";

import { useFormAction } from "@/components/ui/use-form-action";
import Link from "next/link";

import { Field, FormMessage, Input } from "@/components/ui/form";
import { Button } from "@/components/ui/primitives";
import { login, register } from "./actions";

export function LoginForm({ next }: { next?: string }) {
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

export function RegisterForm() {
  const [state, action, pending] = useFormAction(register);
  const e = state?.errors ?? {};
  return (
    <form onSubmit={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
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
          Nõustun Aegly kasutustingimuste ja privaatsuspoliitikaga
          {e.terms && <span className="block text-xs text-bad">{e.terms[0]}</span>}
        </span>
      </label>
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

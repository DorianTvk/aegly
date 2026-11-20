"use client";

import { useState } from "react";
import { useFormAction } from "@/components/ui/use-form-action";
import { Field, FormMessage, Input } from "@/components/ui/form";
import { Button } from "@/components/ui/primitives";
import { verifyLoginCode } from "../../actions";

export function MfaForm({ next, email }: { next?: string; email: string }) {
  const [state, action, pending] = useFormAction(verifyLoginCode);
  const [recovery, setRecovery] = useState(false);
  const e = state?.errors ?? {};
  return (
    <form onSubmit={action} className="space-y-4" noValidate>
      <FormMessage state={state?.errors ? null : state} />
      <input type="hidden" name="next" value={next ?? ""} />
      <p className="text-sm text-muted">
        Konto: <b className="text-ink">{email}</b>
      </p>
      {recovery ? (
        <Field label="Varukood" htmlFor="code" hint="Kujul abcd-efgh. Iga varukoodi saab kasutada ühe korra." error={e.code}>
          <Input id="code" name="code" key="rec" autoComplete="off" autoCapitalize="none" spellCheck={false} autoFocus aria-invalid={!!e.code} />
        </Field>
      ) : (
        <Field label="6-kohaline kood" htmlFor="code" error={e.code}>
          <Input
            id="code" name="code" key="totp" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]*" maxLength={7}
            autoFocus aria-invalid={!!e.code} className="text-center font-mono text-xl tracking-[0.4em]" placeholder="000000"
          />
        </Field>
      )}
      <Button type="submit" variant="primary" className="w-full" disabled={pending}>
        {pending ? "Kontrollin…" : "Kinnita"}
      </Button>
      <div className="flex items-center justify-between text-sm">
        <button type="button" onClick={() => setRecovery((r) => !r)} className="font-medium text-muted underline-offset-4 hover:text-ink hover:underline">
          {recovery ? "Kasuta autentimisrakendust" : "Telefon pole käepärast? Kasuta varukoodi"}
        </button>
        <a href="/api/auth/valja" className="font-medium text-muted underline-offset-4 hover:text-ink hover:underline">
          Tühista
        </a>
      </div>
    </form>
  );
}

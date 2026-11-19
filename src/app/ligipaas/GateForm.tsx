"use client";

import { useActionState } from "react";
import { Lock } from "lucide-react";
import { unlock } from "./actions";

export function GateForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(unlock, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="next" value={next} />
      <label htmlFor="gate-pw" className="block text-sm font-medium">
        Parool
      </label>
      <input
        id="gate-pw"
        name="password"
        type="password"
        autoComplete="current-password"
        autoFocus
        required
        className="h-11 w-full rounded-[10px] border border-line px-3 text-sm outline-none focus:border-lime focus:ring-3 focus:ring-lime/30"
      />
      {state?.error && <p className="text-[13px] text-bad">{state.error}</p>}
      <button type="submit" disabled={pending} className="flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-lime text-sm font-semibold text-ink disabled:opacity-60">
        <Lock size={16} /> {pending ? "Kontrollin…" : "Sisene"}
      </button>
    </form>
  );
}

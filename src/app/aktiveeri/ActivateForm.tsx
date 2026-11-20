"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { clsx } from "clsx";
import { ENTERPRISE_NOTE, PLAN_IDS, PLANS, staffLimitText, type BillingPeriod, type PlanId } from "@/lib/plans";
import { formatEuro } from "@/lib/time";
import { startSubscription } from "./actions";

export function ActivateForm({ plan: initialPlan, period: initialPeriod, isOwner }: { plan: PlanId; period: BillingPeriod; isOwner: boolean }) {
  const [plan, setPlan] = useState<PlanId>(initialPlan);
  const [period, setPeriod] = useState<BillingPeriod>(initialPeriod);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const p = PLANS[plan];
  const price = period === "YEAR" ? p.yearlyCents : p.monthlyCents;

  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label="Arveldusperiood" className="grid grid-cols-2 gap-1 rounded-[10px] bg-line-soft p-1 text-sm font-medium">
        {(["MONTH", "YEAR"] as const).map((v) => (
          <button key={v} type="button" role="radio" aria-checked={period === v} onClick={() => setPeriod(v)} className={clsx("h-9 rounded-lg", period === v ? "bg-white shadow-sm" : "text-muted")}>
            {v === "MONTH" ? "Kuu kaupa" : "Aasta (2 kuud tasuta)"}
          </button>
        ))}
      </div>
      <div role="radiogroup" aria-label="Pakett" className="space-y-2">
        {PLAN_IDS.map((id) => {
          const x = PLANS[id];
          const sel = id === plan;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={sel}
              onClick={() => setPlan(id)}
              className={clsx("flex w-full items-center gap-3 rounded-[12px] border p-3.5 text-left", sel ? "border-ink ring-1 ring-ink" : "border-line hover:border-subtle")}
            >
              <span className={clsx("grid size-5 shrink-0 place-items-center rounded-full border", sel ? "border-ink bg-ink text-white" : "border-line")}>{sel && <Check size={12} strokeWidth={3} />}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{x.name}</span>
                <span className="block text-[13px] text-muted">{staffLimitText(id)}</span>
              </span>
              <span className="text-right">
                <span className="block font-semibold">{formatEuro(period === "YEAR" ? x.yearlyCents : x.monthlyCents)}</span>
                <span className="block text-xs text-muted">/ {period === "YEAR" ? "aasta" : "kuu"} + km</span>
              </span>
            </button>
          );
        })}
      </div>
      {error && <p className="text-[13px] text-bad">{error}</p>}
      {isOwner ? (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const r = await startSubscription({ plan, period });
              if (r) setError(r.message);
            })
          }
          className="flex h-11 w-full items-center justify-center rounded-[10px] bg-lime text-sm font-semibold text-ink disabled:opacity-60"
        >
          {pending ? "Avan makselehe…" : `Maksa ${formatEuro(Math.round(price * 1.24), { decimals: true })} ja alusta`}
        </button>
      ) : (
        <p className="rounded-[10px] bg-line-soft p-3 text-sm text-muted">Paketi saab aktiveerida konto omanik.</p>
      )}
      <p className="text-center text-xs text-muted">Hind sisaldab 24% käibemaksu. Tellimust saad igal ajal lõpetada.</p>
      <p className="text-center text-xs text-muted">{ENTERPRISE_NOTE}</p>
    </div>
  );
}

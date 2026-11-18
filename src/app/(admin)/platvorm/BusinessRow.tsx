"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/primitives";
import { PLAN_IDS, PLAN_STATUS_LABEL, PLANS, type BillingPeriod, type PlanId, type PlanStatus } from "@/lib/plans";
import { setBusinessPlan } from "./actions";

const sel = "h-8 rounded-lg border border-line bg-white px-2 text-[13px]";

export function BusinessRow({ b }: { b: { id: string; name: string; slug: string; plan: PlanId; period: BillingPeriod; status: PlanStatus; staff: number; bookings: number; owner: string; created: string } }) {
  const [v, setV] = useState({ plan: b.plan, period: b.period, status: b.status });
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const dirty = v.plan !== b.plan || v.period !== b.period || v.status !== b.status;
  const over = PLANS[v.plan].staffLimit !== null && b.staff > PLANS[v.plan].staffLimit!;

  return (
    <tr className="border-t border-line-soft align-middle">
      <td className="py-3 pl-5">
        <Link href={`/platvorm/${b.id}`} className="font-medium underline-offset-4 hover:underline">
          {b.name}
        </Link>
        <p className="text-xs text-muted">
          {b.slug} · {b.owner}
        </p>
      </td>
      <td className="py-3">
        <select aria-label={`Pakett: ${b.name}`} className={sel} value={v.plan} onChange={(e) => setV({ ...v, plan: e.target.value as PlanId })}>
          {PLAN_IDS.map((p) => (
            <option key={p} value={p}>
              {PLANS[p].name}
            </option>
          ))}
        </select>
      </td>
      <td className="py-3">
        <select aria-label={`Arveldus: ${b.name}`} className={sel} value={v.period} onChange={(e) => setV({ ...v, period: e.target.value as BillingPeriod })}>
          <option value="MONTH">Kuu</option>
          <option value="YEAR">Aasta</option>
        </select>
      </td>
      <td className="py-3">
        <select aria-label={`Staatus: ${b.name}`} className={sel} value={v.status} onChange={(e) => setV({ ...v, status: e.target.value as PlanStatus })}>
          {(Object.keys(PLAN_STATUS_LABEL) as PlanStatus[]).map((st) => (
            <option key={st} value={st}>
              {PLAN_STATUS_LABEL[st]}
            </option>
          ))}
        </select>
      </td>
      <td className={over ? "py-3 font-semibold text-bad" : "py-3"}>
        {b.staff}
        {PLANS[v.plan].staffLimit !== null && ` / ${PLANS[v.plan].staffLimit}`}
      </td>
      <td className="py-3">{b.bookings}</td>
      <td className="py-3 text-muted">{b.created}</td>
      <td className="py-3 pr-5 text-right">
        <Button size="sm" variant="primary" disabled={!dirty || pending} onClick={() => start(async () => setMsg((await setBusinessPlan({ businessId: b.id, ...v }))?.message ?? null))}>
          Salvesta
        </Button>
        {msg && <span className="ml-2 text-xs text-muted">{msg}</span>}
      </td>
    </tr>
  );
}

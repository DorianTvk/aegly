"use client";

import Link from "next/link";
import { clsx } from "clsx";
import { PLAN_STATUS_LABEL, PLANS, type BillingPeriod, type PlanId, type PlanStatus } from "@/lib/plans";

export type PlatformRow = {
  id: string;
  name: string;
  slug: string;
  plan: PlanId;
  period: BillingPeriod;
  status: PlanStatus;
  billing: "stripe" | "comp" | "none";
  mrr: string;
  staff: number;
  bookings30: number;
  lastBooking: string;
  owner: string;
  created: string;
  protected: boolean;
};

const TONE: Record<PlanStatus, string> = {
  ACTIVE: "bg-ok-bg text-ok",
  PAST_DUE: "bg-[#fffaeb] text-[#b54708]",
  PENDING: "bg-line-soft text-muted",
  SUSPENDED: "bg-bad-bg text-bad",
};

export function BusinessRow({ b, selected, onSelect }: { b: PlatformRow; selected: boolean; onSelect: (v: boolean) => void }) {
  const over = PLANS[b.plan].staffLimit !== null && b.staff > PLANS[b.plan].staffLimit!;
  return (
    <tr className={clsx("border-t border-line-soft align-middle", selected && "bg-bad-bg/40")}>
      <td className="py-3 pl-5">
        <input
          type="checkbox"
          checked={selected}
          disabled={b.protected}
          onChange={(e) => onSelect(e.target.checked)}
          aria-label={b.protected ? `${b.name} (kaitstud)` : `Vali ${b.name}`}
          className="size-4 accent-[#d92d20] disabled:opacity-30"
        />
      </td>
      <td className="py-3">
        <Link href={`/platvorm/${b.id}`} className="font-medium underline-offset-4 hover:underline">
          {b.name}
        </Link>
        <p className="text-xs text-muted">{b.owner}</p>
      </td>
      <td className="py-3">
        {PLANS[b.plan].name}
        <p className="text-xs text-muted">{b.period === "YEAR" ? "aasta" : "kuu"}</p>
      </td>
      <td className="py-3">
        <span className={clsx("rounded-full px-2 py-0.5 text-xs font-semibold", TONE[b.status])}>{PLAN_STATUS_LABEL[b.status]}</span>
        <p className="mt-0.5 text-xs text-muted">{b.billing === "stripe" ? "Stripe" : b.billing === "comp" ? "Tasuta (käsitsi)" : "—"}</p>
      </td>
      <td className="py-3 font-semibold">{b.mrr}</td>
      <td className={over ? "py-3 font-semibold text-bad" : "py-3"}>
        {b.staff}
        {PLANS[b.plan].staffLimit !== null && <span className="text-muted"> / {PLANS[b.plan].staffLimit}</span>}
      </td>
      <td className="py-3">{b.bookings30}</td>
      <td className="py-3 text-muted">{b.lastBooking}</td>
      <td className="py-3 pr-5 text-muted">{b.created}</td>
    </tr>
  );
}

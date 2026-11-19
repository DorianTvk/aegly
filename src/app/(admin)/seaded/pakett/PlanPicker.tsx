"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { clsx } from "clsx";
import { Badge, Button, Card, CardHeader } from "@/components/ui/primitives";
import { FormMessage, type FormState } from "@/components/ui/form";
import { Segmented } from "@/components/ui/pickers";
import { canSwitchTo, PLAN_IDS, PLAN_STATUS_LABEL, PLANS, staffLimitText, type BillingPeriod, type PlanId, type PlanStatus } from "@/lib/plans";
import { formatEuro } from "@/lib/time";
import { changePlan, openBillingPortal } from "./actions";

export function PlanPicker({
  current,
  period: currentPeriod,
  status,
  activeStaff,
  isOwner,
  billing,
  hasSubscription,
  hasCustomer,
  renewsAt,
  cancelAt,
  notice,
}: {
  current: PlanId;
  period: BillingPeriod;
  status: PlanStatus;
  activeStaff: number;
  isOwner: boolean;
  billing: boolean;
  hasSubscription: boolean;
  hasCustomer: boolean;
  renewsAt: string | null;
  cancelAt: string | null;
  notice: "ok" | "cancelled" | null;
}) {
  const [period, setPeriod] = useState<BillingPeriod>(currentPeriod);
  const [state, setState] = useState<FormState>(null);
  const [pending, start] = useTransition();
  const plan = PLANS[current];

  const needsStart = billing && !hasSubscription;
  return (
    <div className="space-y-5">
      {notice === "ok" && <p role="status" className="rounded-[12px] bg-[#ecfdf3] px-4 py-3 text-sm text-[#067647]">Aitäh! Tellimus on aktiivne. Arve saadeti e-postile.</p>}
      {notice === "cancelled" && <p role="status" className="rounded-[12px] bg-[#fffaeb] px-4 py-3 text-sm text-[#93370d]">Makse jäi pooleli – tellimust ei alustatud.</p>}
      {needsStart && (
        <div className="rounded-[14px] border border-[#fedf89] bg-[#fffaeb] p-4 text-sm text-[#93370d]">
          <p className="font-semibold">{status === "SUSPENDED" ? "Tellimus on lõppenud" : "Aktiveeri pakett"}</p>
          <p className="mt-1">
            {status === "SUSPENDED"
              ? "Broneerimisvidin ei võta praegu broneeringuid vastu. Vali allpool pakett, et jätkata."
              : "Vali allpool pakett ja tasu esimene periood. Seni ei võta broneerimisvidin broneeringuid vastu."}
          </p>
        </div>
      )}
      {status === "PAST_DUE" && (
        <div className="rounded-[14px] border border-[#fecdca] bg-[#fef3f2] p-4 text-sm text-[#b42318]">
          <p className="font-semibold">Viimane makse ebaõnnestus</p>
          <p className="mt-1">Uuenda makseviisi, et vidin töötaks katkestusteta.</p>
        </div>
      )}
      <Card>
        <CardHeader title="Praegune pakett" action={<Badge tone={status === "ACTIVE" ? "ok" : status === "PAST_DUE" ? "warn" : "bad"}>{PLAN_STATUS_LABEL[status]}</Badge>} />
        <dl className="grid grid-cols-1 gap-4 p-5 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted">Pakett</dt>
            <dd className="mt-1 text-[18px] font-semibold">{plan.name}</dd>
          </div>
          <div>
            <dt className="text-muted">Hind</dt>
            <dd className="mt-1 text-[18px] font-semibold">
              {currentPeriod === "YEAR" ? `${formatEuro(plan.yearlyCents)} / aasta` : `${formatEuro(plan.monthlyCents)} / kuu`}
              <span className="ml-1 text-xs font-normal text-muted">+ km</span>
            </dd>
          </div>
          <div>
            <dt className="text-muted">Aktiivsed töötajad</dt>
            <dd className="mt-1 text-[18px] font-semibold">
              {activeStaff}
              {plan.staffLimit !== null && <span className="text-muted"> / {plan.staffLimit}</span>}
            </dd>
          </div>
        </dl>
        {billing && (hasCustomer || renewsAt || cancelAt) && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft px-5 py-4 text-sm">
            <p className="text-muted">
              {cancelAt ? `Tellimus lõpeb ${cancelAt}. Kuni selle kuupäevani töötab kõik edasi.` : renewsAt && hasSubscription ? `Järgmine arve ${renewsAt}.` : "Arved ja makseviis on Stripe'is."}
            </p>
            {isOwner && hasCustomer && (
              <Button size="sm" variant="secondary" disabled={pending} onClick={() => start(async () => setState(await openBillingPortal()))}>
                {cancelAt ? "Jätka tellimust" : "Arved, makseviis ja lõpetamine"}
              </Button>
            )}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title={needsStart ? "Vali pakett" : "Vaheta paketti"} subtitle={needsStart ? "Kõik funktsioonid on igas paketis. Tasud kohe kaardiga, tellimust saad igal ajal lõpetada." : "Kõik funktsioonid on igas paketis. Hinnavahe arvestatakse proportsionaalselt."} />
        <div className="space-y-4 p-5">
          <div className="max-w-[420px]">
            <Segmented
              value={period}
              onChange={setPeriod}
              options={[
                { value: "MONTH", label: "Kuu kaupa" },
                { value: "YEAR", label: "Aasta korraga (2 kuud tasuta)" },
              ]}
            />
          </div>
          <FormMessage state={state} />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {PLAN_IDS.map((id) => {
              const p = PLANS[id];
              const isCurrent = !needsStart && id === current && period === currentPeriod;
              const fits = canSwitchTo(id, activeStaff);
              return (
                <div key={id} className={clsx("flex flex-col rounded-[12px] border p-5", isCurrent ? "border-ink ring-1 ring-ink" : "border-line")}>
                  <p className="font-semibold">{p.name}</p>
                  <p className="mt-0.5 text-[13px] text-muted">{p.tagline}</p>
                  <p className="mt-4">
                    <span className="text-[26px] font-bold tracking-[-0.5px]">{formatEuro(period === "YEAR" ? p.yearlyCents : p.monthlyCents)}</span>
                    <span className="text-sm text-muted"> / {period === "YEAR" ? "aasta" : "kuu"} + km</span>
                  </p>
                  <ul className="mt-4 flex-1 space-y-2 text-sm">
                    {[staffLimitText(id), "Kõik funktsioonid", "0 % vahendustasu"].map((f) => (
                      <li key={f} className="flex items-center gap-2">
                        <Check size={15} className="text-[#4d7c0f]" aria-hidden />
                        {f}
                      </li>
                    ))}
                  </ul>
                  {!fits && <p className="mt-3 text-xs text-bad">Sul on {activeStaff} aktiivset töötajat – see pakett ei mahuta neid.</p>}
                  <Button
                    className="mt-4 w-full"
                    variant={isCurrent ? "secondary" : "primary"}
                    disabled={!isOwner || isCurrent || !fits || pending}
                    onClick={() => start(async () => setState(await changePlan({ plan: id, period })))}
                  >
                    {isCurrent ? "Praegune pakett" : needsStart ? (pending ? "Avan makselehe…" : "Alusta kohe") : "Vali see pakett"}
                  </Button>
                </div>
              );
            })}
          </div>
          {!isOwner && <p className="text-sm text-muted">Paketti saab muuta ainult konto omanik.</p>}
          <p className="text-xs text-muted">Hindadele lisandub käibemaks. SMS 0,08 € tk, e-kirjad tasuta. Kaardimakse tasu vastavalt makseteenuse pakkujale.</p>
        </div>
      </Card>
    </div>
  );
}

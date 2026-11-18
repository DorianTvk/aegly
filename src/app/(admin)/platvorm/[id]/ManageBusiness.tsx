"use client";

import { useState, useTransition } from "react";
import { ExternalLink, KeyRound, LogIn, Trash2 } from "lucide-react";
import { Badge, Button, Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { Field, FormMessage, Input, Select, type FormState } from "@/components/ui/form";
import { PLAN_IDS, PLAN_STATUS_LABEL, PLANS, type BillingPeriod, type PlanId, type PlanStatus } from "@/lib/plans";
import { setBusinessPlan } from "../actions";
import { deleteBusiness, impersonate, resetUserPassword, updateBusiness } from "../manage-actions";

const ROLE = { OWNER: "Omanik", ADMIN: "Administraator", STAFF: "Töötaja" } as const;

type Business = {
  id: string; name: string; slug: string; email: string; phone: string; plan: PlanId; period: BillingPeriod; status: PlanStatus;
  created: string; widgetInstalled: string | null; planName: string;
};

export function ManageBusiness({
  business: b, stats, users, isOwn,
}: {
  business: Business;
  stats: { label: string; value: string }[];
  users: { id: string; name: string; email: string; role: keyof typeof ROLE; created: string; protected: boolean }[];
  isOwn: boolean;
}) {
  const [pending, start] = useTransition();
  const [info, setInfo] = useState({ name: b.name, email: b.email, phone: b.phone });
  const [infoState, setInfoState] = useState<FormState>(null);
  const [plan, setPlan] = useState({ plan: b.plan, period: b.period, status: b.status });
  const [planState, setPlanState] = useState<FormState>(null);
  const [newPw, setNewPw] = useState<{ email: string; password: string } | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState("");
  const [delState, setDelState] = useState<FormState>(null);

  return (
    <div className="space-y-5">
      <PageHeader
        title={b.name}
        subtitle={`${b.slug} · loodud ${b.created}`}
        actions={
          <>
            <a href={`/w/${b.slug}/proov`} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-line bg-white px-3.5 text-sm font-semibold hover:bg-[#f9fafb]">
              <ExternalLink size={16} aria-hidden /> Vidin
            </a>
            {!isOwn && (
              <Button variant="primary" disabled={pending} onClick={() => start(() => impersonate(b.id))}>
                <LogIn size={16} aria-hidden /> Sisene kontole
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((st) => (
          <Card key={st.label} className="p-4">
            <p className="text-[13px] text-muted">{st.label}</p>
            <p className="mt-1.5 text-[18px] font-bold">{st.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Pakett" action={<Badge tone={b.status === "ACTIVE" ? "ok" : b.status === "PAST_DUE" ? "warn" : "bad"}>{PLAN_STATUS_LABEL[b.status]}</Badge>} />
          <div className="space-y-4 p-5">
            <FormMessage state={planState} />
            <div className="grid grid-cols-3 gap-3">
              <Field label="Pakett" htmlFor="p-plan">
                <Select id="p-plan" value={plan.plan} onChange={(e) => setPlan({ ...plan, plan: e.target.value as PlanId })}>
                  {PLAN_IDS.map((p) => <option key={p} value={p}>{PLANS[p].name}</option>)}
                </Select>
              </Field>
              <Field label="Arveldus" htmlFor="p-period">
                <Select id="p-period" value={plan.period} onChange={(e) => setPlan({ ...plan, period: e.target.value as BillingPeriod })}>
                  <option value="MONTH">Kuu</option>
                  <option value="YEAR">Aasta</option>
                </Select>
              </Field>
              <Field label="Staatus" htmlFor="p-status">
                <Select id="p-status" value={plan.status} onChange={(e) => setPlan({ ...plan, status: e.target.value as PlanStatus })}>
                  {(Object.keys(PLAN_STATUS_LABEL) as PlanStatus[]).map((st) => <option key={st} value={st}>{PLAN_STATUS_LABEL[st]}</option>)}
                </Select>
              </Field>
            </div>
            <p className="text-xs text-muted">„Peatatud“ lülitab salongi vidina välja (kliendid ei saa broneerida). Halduspaneel jääb kasutatavaks.</p>
            <Button variant="primary" disabled={pending} onClick={() => start(async () => setPlanState(await setBusinessPlan({ businessId: b.id, ...plan })))}>
              Salvesta pakett
            </Button>
          </div>
        </Card>

        <Card>
          <CardHeader title="Salongi andmed" />
          <div className="space-y-4 p-5">
            <FormMessage state={infoState} />
            <Field label="Nimi" htmlFor="b-name">
              <Input id="b-name" value={info.name} onChange={(e) => setInfo({ ...info, name: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="E-post" htmlFor="b-email">
                <Input id="b-email" type="email" value={info.email} onChange={(e) => setInfo({ ...info, email: e.target.value })} />
              </Field>
              <Field label="Telefon" htmlFor="b-phone">
                <Input id="b-phone" value={info.phone} onChange={(e) => setInfo({ ...info, phone: e.target.value })} />
              </Field>
            </div>
            <Button variant="primary" disabled={pending} onClick={() => start(async () => setInfoState(await updateBusiness(b.id, info)))}>
              Salvesta andmed
            </Button>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Kasutajad" subtitle="Unustatud parooli korral saad anda kasutajale uue ajutise parooli." />
        {newPw && (
          <div role="status" className="mx-5 mt-4 rounded-[10px] border border-ok/30 bg-ok-bg px-4 py-3 text-sm">
            Uus parool kasutajale <b>{newPw.email}</b>: <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[14px]">{newPw.password}</code>
            <p className="mt-1 text-xs text-muted">Näidatakse ainult üks kord. Saada see kasutajale turvaliselt ja palu tal see hiljem ära muuta. Kõik tema sessioonid lõpetati.</p>
          </div>
        )}
        {pwError && <p className="mx-5 mt-4 text-sm text-bad">{pwError}</p>}
        <ul className="divide-y divide-line-soft">
          {users.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{u.name}</span>
                <span className="block text-xs text-muted">
                  {u.email} · {ROLE[u.role]} · loodud {u.created}
                </span>
              </span>
              {!u.protected && (
                <Button
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      if (!window.confirm(`Anda kasutajale ${u.email} uus parool? Vana parool lakkab kohe töötamast.`)) return;
                      const r = await resetUserPassword(u.id);
                      if (r.ok) {
                        setNewPw({ email: u.email, password: r.password });
                        setPwError(null);
                      } else setPwError(r.message);
                    })
                  }
                >
                  <KeyRound size={14} aria-hidden /> Uus parool
                </Button>
              )}
            </li>
          ))}
        </ul>
      </Card>

      {!isOwn && (
        <Card className="border-bad/30">
          <CardHeader title="Kustuta salong" subtitle="Kustutab salongi koos kõigi töötajate, klientide, broneeringute ja kasutajatega. Seda ei saa tagasi võtta." />
          <div className="space-y-3 p-5">
            <FormMessage state={delState} />
            <Field label={<>Kinnitamiseks sisesta salongi lühinimi <code className="font-mono">{b.slug}</code></>} htmlFor="del-confirm">
              <Input id="del-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" className="max-w-[320px]" />
            </Field>
            <button
              type="button"
              disabled={confirm.trim() !== b.slug || pending}
              onClick={() => start(async () => setDelState(await deleteBusiness(b.id, confirm)))}
              className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-[#d92d20] px-4 text-sm font-semibold text-white disabled:opacity-40"
            >
              <Trash2 size={16} aria-hidden /> Kustuta jäädavalt
            </button>
          </div>
        </Card>
      )}
    </div>
  );
}

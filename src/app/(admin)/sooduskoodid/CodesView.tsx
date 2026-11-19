"use client";

import { useMemo, useState, useTransition } from "react";
import { Copy, Pause, Pencil, Play, Plus, Sparkles, Trash2 } from "lucide-react";
import { clsx } from "clsx";
import { Badge, Button } from "@/components/ui/primitives";
import { Dialog } from "@/components/ui/Dialog";
import { Field, FormMessage, Input, UnitInput, type FormState } from "@/components/ui/form";
import { Segmented, Switch, TargetPicker, type Target } from "@/components/ui/pickers";
import { centsToInput, parseEuroToCents } from "@/lib/money";
import { deleteCode, generateCode, saveCode, setCodeActive, type CodeInput } from "./actions";

export type CodeRow = CodeInput & {
  id: string;
  status: "ACTIVE" | "PAUSED" | "EXPIRED" | "SCHEDULED" | "USED_UP";
  usedCount: number;
  discountLabel: string;
  targetLabel: string;
  validLabel: string;
};

const STATUS = {
  ACTIVE: { label: "Aktiivne", tone: "ok" },
  PAUSED: { label: "Peatatud", tone: "neutral" },
  EXPIRED: { label: "Aegunud", tone: "bad" },
  SCHEDULED: { label: "Planeeritud", tone: "info" },
  USED_UP: { label: "Ära kasutatud", tone: "warn" },
} as const;

const EMPTY: CodeInput = {
  code: "", kind: "PERCENT", value: 10, minAmountCents: null, startsOn: null, endsOn: null, maxUses: null, maxUsesPerClient: 1,
  newClientsOnly: false, combinable: false, serviceIds: [], categoryIds: [], packageIds: [], active: true,
};

type Tab = "all" | "active" | "paused" | "expired";

export function CodesView({ codes, targets }: { codes: CodeRow[]; targets: Target[] }) {
  const [tab, setTab] = useState<Tab>("all");
  const [editing, setEditing] = useState<{ id: string | null; v: CodeInput } | null>(null);
  const [state, setState] = useState<FormState>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const v = editing?.v;
  const set = <K extends keyof CodeInput>(k: K, val: CodeInput[K]) => setEditing((e) => (e ? { ...e, v: { ...e.v, [k]: val } } : e));

  const counts = {
    all: codes.length,
    active: codes.filter((c) => c.status === "ACTIVE").length,
    paused: codes.filter((c) => c.status === "PAUSED").length,
    expired: codes.filter((c) => c.status === "EXPIRED" || c.status === "USED_UP").length,
  };
  const visible = useMemo(
    () =>
      codes.filter((c) =>
        tab === "all" ? true : tab === "active" ? c.status === "ACTIVE" || c.status === "SCHEDULED" : tab === "paused" ? c.status === "PAUSED" : c.status === "EXPIRED" || c.status === "USED_UP",
      ),
    [codes, tab],
  );

  const tabs: { key: Tab; label: string }[] = [
    { key: "all", label: `Kõik (${counts.all})` },
    { key: "active", label: `Aktiivsed (${counts.active})` },
    { key: "paused", label: `Peatatud (${counts.paused})` },
    { key: "expired", label: `Aegunud (${counts.expired})` },
  ];

  const selectedTargets = v
    ? [
        ...targets.filter((t) => t.kind === "category" && v.categoryIds.includes(t.id)),
        ...targets.filter((t) => t.kind === "service" && v.serviceIds.includes(t.id)),
        ...targets.filter((t) => t.kind === "package" && v.packageIds.includes(t.id)),
      ]
    : [];

  return (
    <>
      <div className="flex flex-wrap-reverse items-center justify-between gap-x-3 border-b border-line">
        <nav className="-mb-px flex gap-1 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={clsx("-mb-px border-b-2 px-3 py-2.5 text-sm", tab === t.key ? "border-lime font-semibold" : "border-transparent text-muted hover:text-ink")}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <Button variant="primary" size="sm" className="mb-2" onClick={() => { setState(null); setEditing({ id: null, v: EMPTY }); }}>
          <Plus size={15} /> Lisa sooduskood
        </Button>
      </div>

      <div className="overflow-x-auto rounded-[14px] border border-line bg-white shadow-[var(--shadow-card)]">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-[#f9fafb] text-left text-xs font-semibold tracking-[0.3px] text-[#475467] uppercase">
            <tr>
              <th className="py-3 pl-5 font-semibold">Kood</th>
              <th className="py-3 font-semibold">Soodustus</th>
              <th className="py-3 font-semibold">Kehtib</th>
              <th className="py-3 font-semibold">Periood</th>
              <th className="py-3 font-semibold">Kasutatud</th>
              <th className="py-3 font-semibold">Staatus</th>
              <th className="py-3 pr-5" />
            </tr>
          </thead>
          <tbody>
            {visible.map((c) => (
              <tr key={c.id} className="border-t border-line-soft">
                <td className="py-3 pl-5">
                  <span className="rounded-md bg-line-soft px-2 py-1 font-mono text-[13px] font-medium">{c.code}</span>
                  {c.newClientsOnly && <span className="ml-2 text-xs text-muted">uued kliendid</span>}
                </td>
                <td className="py-3 font-semibold">{c.discountLabel}</td>
                <td className="max-w-[220px] truncate py-3 text-muted">{c.targetLabel}</td>
                <td className="py-3 text-muted">{c.validLabel}</td>
                <td className="py-3">
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums">
                      {c.usedCount}
                      {c.maxUses ? ` / ${c.maxUses}` : ""}
                    </span>
                    {c.maxUses && (
                      <span className="h-1.5 w-14 rounded bg-line-soft">
                        <span className="block h-1.5 rounded bg-lime" style={{ width: `${Math.min(100, (c.usedCount / c.maxUses) * 100)}%` }} />
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-3">
                  <Badge tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Badge>
                </td>
                <td className="py-3 pr-5">
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      title={copied === c.id ? "Kopeeritud" : "Kopeeri kood"}
                      aria-label="Kopeeri kood"
                      onClick={() => { void navigator.clipboard.writeText(c.code); setCopied(c.id); setTimeout(() => setCopied(null), 1500); }}
                      className={clsx("grid size-8 place-items-center rounded-lg hover:bg-line-soft", copied === c.id ? "text-ok" : "text-muted")}
                    >
                      <Copy size={15} />
                    </button>
                    <button type="button" aria-label={c.active ? "Peata" : "Aktiveeri"} title={c.active ? "Peata" : "Aktiveeri"} onClick={() => start(() => setCodeActive(c.id, !c.active))} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-line-soft hover:text-ink">
                      {c.active ? <Pause size={15} /> : <Play size={15} />}
                    </button>
                    <button type="button" aria-label="Muuda" onClick={() => { setState(null); setEditing({ id: c.id, v: c }); }} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-line-soft hover:text-ink">
                      <Pencil size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={7} className="py-12 text-center text-muted">
                  Sooduskoode pole.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? "Muuda sooduskoodi" : "Uus sooduskood"}
        subtitle="Koodi saab jagada uudiskirjas või sotsiaalmeedias"
        footer={
          <>
            {editing?.id && (
              <Button variant="ghost" className="mr-auto text-bad" onClick={() => { if (confirm("Kustutada see kood?")) start(async () => { await deleteCode(editing.id!); setEditing(null); }); }}>
                <Trash2 size={15} /> Kustuta
              </Button>
            )}
            <Button onClick={() => setEditing(null)}>Tühista</Button>
            <Button variant="primary" disabled={pending} onClick={() => start(async () => { const r = await saveCode(editing!.id, editing!.v); setState(r); if (r?.ok) setEditing(null); })}>
              {editing?.id ? "Salvesta" : "Loo sooduskood"}
            </Button>
          </>
        }
      >
        {v && (
          <div className="space-y-4">
            <FormMessage state={state} />
            <Field label="Sooduskood" htmlFor="code">
              <div className="flex gap-2">
                <Input id="code" value={v.code} onChange={(e) => set("code", e.target.value.toUpperCase())} className="font-mono" placeholder="TALV2026" />
                <Button onClick={() => start(async () => set("code", await generateCode()))}>
                  <Sparkles size={15} /> Genereeri
                </Button>
              </div>
            </Field>
            <Field label="Soodustuse tüüp">
              <Segmented
                value={v.kind}
                onChange={(k) => set("kind", k)}
                options={[{ value: "PERCENT", label: "Protsent (%)" }, { value: "FIXED", label: "Summa (€)" }, { value: "FREE_SERVICE", label: "Tasuta teenus" }]}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              {v.kind !== "FREE_SERVICE" && (
                <Field label="Väärtus" htmlFor="cval">
                  {v.kind === "PERCENT" ? (
                    <UnitInput unit="%" id="cval" type="number" min={1} max={100} value={v.value} onChange={(e) => set("value", Number(e.target.value) || 0)} />
                  ) : (
                    <UnitInput unit="€" id="cval" inputMode="decimal" defaultValue={centsToInput(v.value)} onChange={(e) => set("value", parseEuroToCents(e.target.value) ?? 0)} />
                  )}
                </Field>
              )}
              <Field label="Min. ostusumma" htmlFor="cmin">
                <UnitInput unit="€" id="cmin" inputMode="decimal" placeholder="—" defaultValue={centsToInput(v.minAmountCents)} onChange={(e) => set("minAmountCents", parseEuroToCents(e.target.value))} />
              </Field>
            </div>
            <Field label={v.kind === "FREE_SERVICE" ? "Tasuta teenus" : "Kehtib"}>
              <TargetPicker
                options={targets}
                value={selectedTargets}
                onChange={(list) => {
                  set("categoryIds", list.filter((t) => t.kind === "category").map((t) => t.id));
                  set("serviceIds", list.filter((t) => t.kind === "service").map((t) => t.id));
                  set("packageIds", list.filter((t) => t.kind === "package").map((t) => t.id));
                }}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Kehtib alates" htmlFor="cfrom">
                <Input id="cfrom" type="date" value={v.startsOn ?? ""} onChange={(e) => set("startsOn", e.target.value || null)} />
              </Field>
              <Field label="Kehtib kuni" htmlFor="cto">
                <Input id="cto" type="date" value={v.endsOn ?? ""} onChange={(e) => set("endsOn", e.target.value || null)} />
              </Field>
              <Field label="Kasutuskordi kokku" htmlFor="cmax">
                <Input id="cmax" type="number" min={1} placeholder="Piiramatu" value={v.maxUses ?? ""} onChange={(e) => set("maxUses", e.target.value ? Number(e.target.value) : null)} />
              </Field>
              <Field label="Ühe kliendi kohta" htmlFor="cper">
                <Input id="cper" type="number" min={1} placeholder="Piiramatu" value={v.maxUsesPerClient ?? ""} onChange={(e) => set("maxUsesPerClient", e.target.value ? Number(e.target.value) : null)} />
              </Field>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-medium">Ainult uutele klientidele</span>
              <Switch checked={v.newClientsOnly} onChange={(x) => set("newClientsOnly", x)} label="Ainult uutele klientidele" />
            </div>
            <div className="flex items-center justify-between gap-4">
              <span>
                <span className="block text-sm font-medium">Kombineeritav kampaaniatega</span>
                <span className="text-[13px] text-muted">Kui väljas, rakendub suurem soodustus</span>
              </span>
              <Switch checked={v.combinable} onChange={(x) => set("combinable", x)} label="Kombineeritav kampaaniatega" />
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}

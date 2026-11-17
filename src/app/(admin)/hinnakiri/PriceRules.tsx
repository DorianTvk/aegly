"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { clsx } from "clsx";
import { Button, Card, CardHeader } from "@/components/ui/primitives";
import { Dialog } from "@/components/ui/Dialog";
import { Field, FormMessage, Input, Select, TimeSelect, UnitInput, type FormState } from "@/components/ui/form";
import { Segmented, Switch, TargetPicker, WeekdayPicker, type Target } from "@/components/ui/pickers";
import { centsToInput, parseEuroToCents } from "@/lib/money";
import { deletePriceRule, savePriceRule, togglePriceRule, type RuleInput } from "./actions";

export type RuleRow = RuleInput & { id: string; summary: string };

const EMPTY: RuleInput = {
  name: "", kind: "PERCENT", value: 10, weekdays: [], fromTime: null, toTime: null,
  minLeadHours: null, maxLeadHours: null, dateFrom: null, dateTo: null, serviceIds: [], categoryIds: [], active: true,
};

function RuleToggle({ id, active }: { id: string; active: boolean }) {
  const [opt, setOpt] = useOptimistic(active);
  const [, start] = useTransition();
  return <Switch checked={opt} label="Aktiivne" onChange={(v) => start(async () => { setOpt(v); await togglePriceRule(id, v); })} />;
}

export function PriceRules({ rules, targets }: { rules: RuleRow[]; targets: Target[] }) {
  const [editing, setEditing] = useState<{ id: string | null; v: RuleInput } | null>(null);
  const [state, setState] = useState<FormState>(null);
  const [pending, start] = useTransition();

  const open = (r?: RuleRow) => {
    setState(null);
    setEditing(r ? { id: r.id, v: r } : { id: null, v: EMPTY });
  };
  const set = <K extends keyof RuleInput>(k: K, val: RuleInput[K]) => setEditing((e) => (e ? { ...e, v: { ...e.v, [k]: val } } : e));
  const v = editing?.v;
  const direction = v && v.value < 0 ? "minus" : "plus";

  const fmt = (r: RuleRow) => {
    const abs = Math.abs(r.value);
    return `${r.value > 0 ? "+" : "−"}${r.kind === "PERCENT" ? `${abs}%` : `${centsToInput(abs)} €`}`;
  };

  return (
    <Card>
      <CardHeader
        title="Hinnareeglid"
        subtitle="Rakenduvad automaatselt vidinas kuvatavale hinnale"
        action={
          <Button size="sm" onClick={() => open()}>
            <Plus size={15} />
            Lisa reegel
          </Button>
        }
      />
      <ul className="divide-y divide-line-soft px-5">
        {rules.map((r) => (
          <li key={r.id} className="flex items-center gap-4 py-3.5">
            <RuleToggle id={r.id} active={r.active} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{r.name}</p>
              <p className="truncate text-xs text-muted">{r.summary}</p>
            </div>
            <span className={clsx("text-sm font-semibold tabular-nums", r.value > 0 ? "text-bad" : "text-ok")}>{fmt(r)}</span>
            <button type="button" onClick={() => open(r)} aria-label={`Muuda ${r.name}`} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-line-soft hover:text-ink">
              <Pencil size={15} />
            </button>
          </li>
        ))}
        {rules.length === 0 && <li className="py-6 text-sm text-muted">Hinnareegleid pole. Lisa näiteks nädalavahetuse lisatasu.</li>}
      </ul>

      <Dialog
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? "Muuda hinnareeglit" : "Uus hinnareegel"}
        subtitle="Reegel arvutatakse töötaja hinnast ja liidetakse enne kampaaniaid ja koode"
        footer={
          <>
            {editing?.id && (
              <Button
                className="mr-auto text-bad"
                variant="ghost"
                onClick={() => {
                  if (confirm("Kustutada see reegel?")) start(async () => { await deletePriceRule(editing.id!); setEditing(null); });
                }}
              >
                <Trash2 size={15} /> Kustuta
              </Button>
            )}
            <Button onClick={() => setEditing(null)}>Tühista</Button>
            <Button
              variant="primary"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await savePriceRule(editing!.id, editing!.v);
                  setState(res);
                  if (res?.ok) setEditing(null);
                })
              }
            >
              Salvesta
            </Button>
          </>
        }
      >
        {v && (
          <div className="space-y-4">
            <FormMessage state={state} />
            <Field label="Nimi" htmlFor="ruleName">
              <Input id="ruleName" value={v.name} onChange={(e) => set("name", e.target.value)} placeholder="nt Nädalavahetuse lisatasu" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Mõju">
                <Segmented
                  value={direction}
                  onChange={(d) => set("value", d === "plus" ? Math.abs(v.value) : -Math.abs(v.value))}
                  options={[{ value: "plus", label: "Lisatasu" }, { value: "minus", label: "Soodustus" }]}
                />
              </Field>
              <Field label="Tüüp">
                <Segmented
                  value={v.kind}
                  onChange={(k) => set("kind", k as "PERCENT" | "FIXED")}
                  options={[{ value: "PERCENT", label: "Protsent" }, { value: "FIXED", label: "Summa" }]}
                />
              </Field>
            </div>
            <Field label="Väärtus" htmlFor="ruleValue">
              {v.kind === "PERCENT" ? (
                <UnitInput unit="%" id="ruleValue" type="number" min={1} max={100} value={Math.abs(v.value)} onChange={(e) => set("value", (direction === "plus" ? 1 : -1) * Math.abs(Number(e.target.value) || 0))} />
              ) : (
                <UnitInput unit="€" id="ruleValue" inputMode="decimal" defaultValue={centsToInput(Math.abs(v.value))} onChange={(e) => set("value", (direction === "plus" ? 1 : -1) * (parseEuroToCents(e.target.value) ?? 0))} />
              )}
            </Field>
            <Field label="Kehtib teenustele">
              <TargetPicker
                options={targets}
                value={[
                  ...targets.filter((t) => t.kind === "category" && v.categoryIds.includes(t.id)),
                  ...targets.filter((t) => t.kind === "service" && v.serviceIds.includes(t.id)),
                ]}
                onChange={(list) => {
                  set("categoryIds", list.filter((t) => t.kind === "category").map((t) => t.id));
                  set("serviceIds", list.filter((t) => t.kind === "service").map((t) => t.id));
                }}
              />
            </Field>
            <Field label="Nädalapäevad (tühi = kõik)">
              <WeekdayPicker value={v.weekdays} onChange={(w) => set("weekdays", w)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Algus alates kella">
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={v.fromTime !== null} onChange={(e) => set("fromTime", e.target.checked ? "18:00" : null)} className="size-4 accent-[#a3e635]" aria-label="Kellaaja tingimus" />
                  {v.fromTime !== null ? <TimeSelect value={v.fromTime} onChange={(t) => set("fromTime", t)} /> : <span className="text-sm text-muted">Igal ajal</span>}
                </div>
              </Field>
              <Field label="Etteaeg">
                <Select
                  value={v.maxLeadHours !== null ? `max${v.maxLeadHours}` : v.minLeadHours !== null ? `min${v.minLeadHours}` : ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    set("maxLeadHours", val.startsWith("max") ? Number(val.slice(3)) : null);
                    set("minLeadHours", val.startsWith("min") ? Number(val.slice(3)) : null);
                  }}
                >
                  <option value="">Pole tingimust</option>
                  <option value="max3">Vähem kui 3 h enne (viimane hetk)</option>
                  <option value="max24">Vähem kui 24 h enne</option>
                  <option value="min168">Vähemalt 7 päeva ette</option>
                  <option value="min720">Vähemalt 30 päeva ette</option>
                </Select>
              </Field>
              <Field label="Kuupäevad alates" htmlFor="dFrom">
                <Input id="dFrom" type="date" value={v.dateFrom ?? ""} onChange={(e) => set("dateFrom", e.target.value || null)} />
              </Field>
              <Field label="kuni" htmlFor="dTo">
                <Input id="dTo" type="date" value={v.dateTo ?? ""} onChange={(e) => set("dateTo", e.target.value || null)} />
              </Field>
            </div>
          </div>
        )}
      </Dialog>
    </Card>
  );
}

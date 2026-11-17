"use client";

import { useState, useTransition } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { clsx } from "clsx";
import { Badge, Button } from "@/components/ui/primitives";
import { Dialog } from "@/components/ui/Dialog";
import { Field, FormMessage, Input, Select, Textarea, UnitInput, type FormState } from "@/components/ui/form";
import { Segmented, Switch } from "@/components/ui/pickers";
import { centsToInput, parseEuroToCents } from "@/lib/money";
import { formatEuro } from "@/lib/time";
import { deletePackage, savePackage, type PackageInput } from "./actions";

export type ServiceOption = { id: string; name: string; durationMinutes: number; priceCents: number };
export type PackageRow = PackageInput & { id: string; sold: number };

const EMPTY: PackageInput = { name: "", type: "MULTI_VISIT", description: null, priceCents: 0, validityDays: 180, sellInWidget: true, shareable: false, active: true, items: [] };
const VALIDITY = [
  { v: 30, l: "1 kuu" },
  { v: 90, l: "3 kuud" },
  { v: 180, l: "6 kuud" },
  { v: 365, l: "12 kuud" },
];

type Tab = "all" | "selling" | "hidden";

export function PackagesView({ packages, services }: { packages: PackageRow[]; services: ServiceOption[] }) {
  const [tab, setTab] = useState<Tab>("all");
  const [editing, setEditing] = useState<{ id: string | null; v: PackageInput; priceText: string } | null>(null);
  const [state, setState] = useState<FormState>(null);
  const [pending, start] = useTransition();
  const svc = new Map(services.map((x) => [x.id, x]));
  const v = editing?.v;
  const set = <K extends keyof PackageInput>(k: K, val: PackageInput[K]) => setEditing((e) => (e ? { ...e, v: { ...e.v, [k]: val } } : e));

  const regular = (items: PackageInput["items"]) => items.reduce((a, i) => a + (svc.get(i.serviceId)?.priceCents ?? 0) * i.quantity, 0);
  const isSelling = (p: PackageRow) => p.active && p.sellInWidget;
  const visible = packages.filter((p) => tab === "all" || (tab === "selling" ? isSelling(p) : !isSelling(p)));

  const open = (p?: PackageRow) => {
    setState(null);
    const v0 = p ?? EMPTY;
    setEditing({ id: p?.id ?? null, v: v0, priceText: p ? centsToInput(p.priceCents) : "" });
  };

  const regularCents = v ? regular(v.items) : 0;
  const saving = v ? regularCents - v.priceCents : 0;

  return (
    <>
      <nav className="flex gap-1 border-b border-line">
        {([
          ["all", `Kõik (${packages.length})`],
          ["selling", `Müügis (${packages.filter(isSelling).length})`],
          ["hidden", `Peidetud (${packages.filter((p) => !isSelling(p)).length})`],
        ] as const).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={clsx("-mb-px border-b-2 px-3 py-2.5 text-sm", tab === k ? "border-lime font-semibold" : "border-transparent text-muted hover:text-ink")}>
            {l}
          </button>
        ))}
      </nav>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((p) => {
          const reg = regular(p.items);
          return (
            <button key={p.id} type="button" onClick={() => open(p)} className="flex flex-col rounded-[14px] border border-line bg-white p-5 text-left shadow-[var(--shadow-card)] hover:border-[#d0d5dd]">
              <div className="flex items-center justify-between">
                <span className="rounded-md bg-line-soft px-2 py-0.5 text-xs font-medium">{p.type === "MULTI_VISIT" ? "Kordade pakett" : "Komplekt"}</span>
                <Badge tone={isSelling(p) ? "ok" : "neutral"}>{isSelling(p) ? "Müügis" : "Peidetud"}</Badge>
              </div>
              <p className="mt-3 text-[17px] font-semibold">{p.name}</p>
              <ul className="mt-3 space-y-1 rounded-[10px] bg-[#f9fafb] p-3 text-[13px]">
                {p.items.map((i) => {
                  const sv = svc.get(i.serviceId);
                  return (
                    <li key={i.serviceId} className="flex justify-between gap-2">
                      <span>
                        {p.type === "MULTI_VISIT" ? `${i.quantity}× ` : i.quantity > 1 ? `${i.quantity}× ` : ""}
                        {sv?.name ?? "Kustutatud teenus"}
                      </span>
                      <span className="text-muted">{sv?.durationMinutes} min</span>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-4 flex items-baseline gap-2">
                <span className="text-[24px] font-bold">{formatEuro(p.priceCents, { decimals: false })}</span>
                {reg > p.priceCents && <span className="text-sm text-muted line-through">{formatEuro(reg, { decimals: false })}</span>}
              </p>
              <div className="mt-4 flex justify-between border-t border-line-soft pt-3 text-xs text-muted">
                <span>{p.validityDays ? `Kehtib ${VALIDITY.find((x) => x.v === p.validityDays)?.l ?? `${p.validityDays} päeva`} ostust` : "Tähtajatu"}</span>
                <span>Müüdud {p.sold}</span>
              </div>
            </button>
          );
        })}
        <button type="button" onClick={() => open()} className="grid min-h-[220px] place-items-center rounded-[14px] border-2 border-dashed border-lime/60 bg-lime-soft/50 text-sm font-semibold hover:bg-lime-soft">
          <span className="flex items-center gap-2">
            <Plus size={16} /> Loo uus pakett
          </span>
        </button>
      </div>

      <Dialog
        variant="drawer"
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? "Muuda paketti" : "Uus pakett"}
        subtitle="Paketti saab kasutada broneerimisel ettemaksuna"
        footer={
          <>
            {editing?.id && (
              <Button variant="ghost" className="mr-auto text-bad" onClick={() => { if (confirm("Kustutada pakett? Kui seda on müüdud, see peidetakse.")) start(async () => { await deletePackage(editing.id!); setEditing(null); }); }}>
                <Trash2 size={15} /> Kustuta
              </Button>
            )}
            <Button onClick={() => setEditing(null)}>Tühista</Button>
            <Button variant="primary" disabled={pending} onClick={() => start(async () => { const r = await savePackage(editing!.id, editing!.v); setState(r); if (r?.ok) setEditing(null); })}>
              {editing?.id ? "Salvesta" : "Loo pakett"}
            </Button>
          </>
        }
      >
        {v && (
          <div className="space-y-4">
            <FormMessage state={state} />
            <Field label="Paketi nimi" htmlFor="pName">
              <Input id="pName" value={v.name} onChange={(e) => set("name", e.target.value)} placeholder="nt Sügavmassaaži 4 korda" />
            </Field>
            <Field label="Paketi tüüp">
              <Segmented
                value={v.type}
                onChange={(t) => { set("type", t); if (t === "MULTI_VISIT" && v.items.length > 1) set("items", v.items.slice(0, 1)); }}
                options={[{ value: "MULTI_VISIT", label: "Kordade pakett" }, { value: "BUNDLE", label: "Teenuste komplekt" }]}
              />
            </Field>
            <Field label="Sisalduvad teenused">
              <div className="space-y-2">
                {v.items.map((it, idx) => {
                  const sv = svc.get(it.serviceId);
                  return (
                    <div key={idx} className="flex items-center gap-2 rounded-[10px] border border-line p-2.5">
                      <span className="flex-1 text-sm">
                        {sv?.name} · {sv?.durationMinutes} min
                      </span>
                      <div className="flex items-center rounded-lg border border-line">
                        <button type="button" aria-label="Vähem" className="grid size-7 place-items-center" onClick={() => set("items", v.items.map((x, j) => (j === idx ? { ...x, quantity: Math.max(1, x.quantity - 1) } : x)))}>
                          <Minus size={13} />
                        </button>
                        <span className="w-7 text-center text-sm font-semibold tabular-nums">{it.quantity}</span>
                        <button type="button" aria-label="Rohkem" className="grid size-7 place-items-center" onClick={() => set("items", v.items.map((x, j) => (j === idx ? { ...x, quantity: Math.min(50, x.quantity + 1) } : x)))}>
                          <Plus size={13} />
                        </button>
                      </div>
                      <button type="button" aria-label="Eemalda teenus" className="grid size-7 place-items-center text-muted hover:text-bad" onClick={() => set("items", v.items.filter((_, j) => j !== idx))}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  );
                })}
                {(v.type === "BUNDLE" || v.items.length === 0) && (
                  <Select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) set("items", [...v.items, { serviceId: e.target.value, quantity: v.type === "MULTI_VISIT" ? 5 : 1 }]);
                    }}
                    aria-label="Lisa teenus"
                  >
                    <option value="">+ Lisa teenus</option>
                    {services.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name} · {formatEuro(x.priceCents, { decimals: true })}
                      </option>
                    ))}
                  </Select>
                )}
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Paketi hind" htmlFor="pPrice">
                <UnitInput
                  unit="€"
                  id="pPrice"
                  inputMode="decimal"
                  value={editing!.priceText}
                  onChange={(e) => {
                    const t = e.target.value;
                    setEditing((ed) => (ed ? { ...ed, priceText: t, v: { ...ed.v, priceCents: parseEuroToCents(t) ?? 0 } } : ed));
                  }}
                />
              </Field>
              <Field label="Tavahind" hint="Arvutatakse automaatselt">
                <Input value={formatEuro(regularCents, { decimals: true })} disabled />
              </Field>
            </div>
            {saving > 0 && v.priceCents > 0 && (
              <p className="rounded-[10px] bg-ok-bg px-3 py-2.5 text-sm font-medium text-ok">
                Klient säästab {formatEuro(saving, { decimals: true })} ({Math.round((saving / regularCents) * 100)}%)
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Kehtivus" htmlFor="pValid">
                <Select id="pValid" value={v.validityDays ?? ""} onChange={(e) => set("validityDays", e.target.value ? Number(e.target.value) : null)}>
                  {VALIDITY.map((x) => (
                    <option key={x.v} value={x.v}>
                      {x.l}
                    </option>
                  ))}
                  <option value="">Tähtajatu</option>
                </Select>
              </Field>
              <Field label="Kasutajad" htmlFor="pShare">
                <Select id="pShare" value={v.shareable ? "any" : "buyer"} onChange={(e) => set("shareable", e.target.value === "any")}>
                  <option value="buyer">Ainult ostja</option>
                  <option value="any">Ostja ja tema lähedased</option>
                </Select>
              </Field>
            </div>
            <Field label="Kirjeldus (vidinas)" htmlFor="pDesc">
              <Textarea id="pDesc" rows={2} value={v.description ?? ""} onChange={(e) => set("description", e.target.value || null)} />
            </Field>
            <div className="flex items-center justify-between gap-4">
              <span>
                <span className="block text-sm font-medium">Müü vidinas</span>
                <span className="text-[13px] text-muted">Klient saab paketi osta broneerimisvidinast</span>
              </span>
              <Switch checked={v.sellInWidget} onChange={(x) => set("sellInWidget", x)} label="Müü vidinas" />
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-medium">Aktiivne</span>
              <Switch checked={v.active} onChange={(x) => set("active", x)} label="Aktiivne" />
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}

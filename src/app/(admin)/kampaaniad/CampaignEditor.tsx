"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Megaphone, Trash2 } from "lucide-react";
import { Button, Card } from "@/components/ui/primitives";
import { Field, FormMessage, Input, Select, TimeSelect, UnitInput, type FormState } from "@/components/ui/form";
import { Segmented, Switch, TargetPicker, WeekdayPicker, type Target } from "@/components/ui/pickers";
import { centsToInput, parseEuroToCents } from "@/lib/money";
import { deleteCampaign, endCampaign, saveCampaign, type CampaignInput } from "./actions";

const BANNER_COLORS = ["#fff4ed", "#f7fee7", "#eff8ff", "#fdf2fa", "#fef3f2", "#f4f3ff"];

export function CampaignEditor({ id, initial, targets, isRunning }: { id: string | null; initial: CampaignInput; targets: Target[]; isRunning: boolean }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [state, setState] = useState<FormState>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof CampaignInput>(k: K, val: CampaignInput[K]) => setV((p) => ({ ...p, [k]: val }));

  const selected = [
    ...targets.filter((t) => t.kind === "category" && v.categoryIds.includes(t.id)),
    ...targets.filter((t) => t.kind === "service" && v.serviceIds.includes(t.id)),
    ...targets.filter((t) => t.kind === "staff" && v.staffIds.includes(t.id)),
    ...targets.filter((t) => t.kind === "package" && v.packageIds.includes(t.id)),
  ];

  return (
    <Card>
      <div className="flex items-center justify-between gap-3 border-b border-line-soft px-5 py-4">
        <h2 className="text-[15px] font-semibold">{id ? "Kampaania seadistus" : "Uus kampaania"}</h2>
        <div className="flex items-center gap-2">
          {id && isRunning && (
            <Button size="sm" variant="ghost" onClick={() => { if (confirm("Lõpetada kampaania kohe?")) start(() => endCampaign(id)); }}>
              Lõpeta kampaania
            </Button>
          )}
          {id && (
            <Button size="sm" variant="ghost" className="text-bad" aria-label="Kustuta kampaania" onClick={() => { if (confirm("Kustutada kampaania?")) start(async () => { await deleteCampaign(id); router.push("/kampaaniad"); }); }}>
              <Trash2 size={15} />
            </Button>
          )}
          <Button
            size="sm"
            variant="primary"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await saveCampaign(id, v);
                setState(r);
                if (r?.ok && !id && r.id) router.push(`/kampaaniad?id=${r.id}`);
              })
            }
          >
            Salvesta
          </Button>
        </div>
      </div>
      <div className="space-y-4 p-5">
        <FormMessage state={state} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
          <Field label="Kampaania nimi" htmlFor="cName">
            <Input id="cName" value={v.name} onChange={(e) => set("name", e.target.value)} placeholder="nt Sügisene hoolitsus" />
          </Field>
          <Field label="Staatus" htmlFor="cStatus">
            <Select id="cStatus" value={v.active ? "on" : "off"} onChange={(e) => set("active", e.target.value === "on")}>
              <option value="on">Aktiivne</option>
              <option value="off">Peatatud</option>
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Algus">
            <div className="flex gap-2">
              <Input type="date" value={v.startDate} onChange={(e) => set("startDate", e.target.value)} aria-label="Alguse kuupäev" />
              <TimeSelect value={v.startTime} onChange={(t) => set("startTime", t)} aria-label="Alguse kellaaeg" />
            </div>
          </Field>
          <Field label="Lõpp">
            <div className="flex gap-2">
              <Input type="date" value={v.endDate} onChange={(e) => set("endDate", e.target.value)} aria-label="Lõpu kuupäev" />
              <TimeSelect value={v.endTime} onChange={(t) => set("endTime", t)} aria-label="Lõpu kellaaeg" />
            </div>
          </Field>
        </div>
        <Field label="Soodustus">
          <div className="flex items-center gap-3">
            <div className="w-[380px] whitespace-nowrap">
              <Segmented value={v.kind} onChange={(k) => set("kind", k)} options={[{ value: "PERCENT", label: "Protsent" }, { value: "FIXED", label: "Summa" }, { value: "FIXED_PRICE", label: "Fikseeritud hind" }]} />
            </div>
            {v.kind === "PERCENT" ? (
              <UnitInput unit="%" className="w-[110px]" type="number" min={1} max={100} value={v.value} onChange={(e) => set("value", Number(e.target.value) || 0)} aria-label="Soodustus" />
            ) : (
              <UnitInput key={v.kind} unit="€" className="w-[130px]" inputMode="decimal" defaultValue={centsToInput(v.value)} onChange={(e) => set("value", parseEuroToCents(e.target.value) ?? 0)} aria-label={v.kind === "FIXED" ? "Soodustus" : "Uus hind"} />
            )}
          </div>
        </Field>
        <Field label="Kehtib">
          <TargetPicker
            options={targets}
            value={selected}
            emptyLabel="Kõik teenused ja töötajad"
            onChange={(list) => {
              set("categoryIds", list.filter((t) => t.kind === "category").map((t) => t.id));
              set("serviceIds", list.filter((t) => t.kind === "service").map((t) => t.id));
              set("staffIds", list.filter((t) => t.kind === "staff").map((t) => t.id));
              set("packageIds", list.filter((t) => t.kind === "package").map((t) => t.id));
            }}
          />
        </Field>
        <Field label="Ajatingimus (valikuline)" hint={v.weekdays.length || v.fromTime ? undefined : "Kampaania kehtib kõikidel päevadel ja kellaaegadel"}>
          <div className="flex flex-wrap items-center gap-3">
            <WeekdayPicker value={v.weekdays} onChange={(w) => set("weekdays", w)} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-[#a3e635]" checked={v.fromTime !== null} onChange={(e) => { set("fromTime", e.target.checked ? "09:00" : null); set("toTime", e.target.checked ? "12:00" : null); }} />
              Kellaaeg
            </label>
            {v.fromTime !== null && (
              <div className="flex items-center gap-1.5">
                <TimeSelect value={v.fromTime} onChange={(t) => set("fromTime", t)} aria-label="Alates" />–
                <TimeSelect value={v.toTime ?? "12:00"} onChange={(t) => set("toTime", t)} aria-label="Kuni" />
              </div>
            )}
          </div>
        </Field>
        <div className="space-y-4 border-t border-line-soft pt-4">
          <div className="flex items-center justify-between gap-4">
            <span>
              <span className="block text-sm font-medium">Rakendub automaatselt</span>
              <span className="text-[13px] text-muted">Klient ei pea koodi sisestama</span>
            </span>
            <span className="text-xs text-muted">alati</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium">Kombineeritav sooduskoodidega</span>
            <Switch checked={v.combinable} onChange={(x) => set("combinable", x)} label="Kombineeritav sooduskoodidega" />
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium">Kuva vidinas bännerina</span>
            <Switch checked={v.showBanner} onChange={(x) => set("showBanner", x)} label="Kuva vidinas bännerina" />
          </div>
          {v.showBanner && (
            <>
              <div className="flex items-start gap-3 rounded-[10px] border p-3" style={{ background: v.bannerColor, borderColor: "#0000001a" }}>
                <Megaphone size={17} className="mt-0.5 text-[#e62e05]" />
                <div>
                  <p className="text-sm font-semibold text-[#b93815]">{v.bannerText || "Bänneri tekst"}</p>
                  <p className="text-xs text-[#b93815]/80">Kehtib kuni {v.endDate.split("-").reverse().join(".")}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                <Field label="Bänneri tekst" htmlFor="bText">
                  <Input id="bText" value={v.bannerText ?? ""} maxLength={120} onChange={(e) => set("bannerText", e.target.value || null)} placeholder={`${v.name}: −${v.value}%`} />
                </Field>
                <Field label="Bänneri värv">
                  <div className="flex h-10 items-center gap-1.5">
                    {BANNER_COLORS.map((c) => (
                      <button key={c} type="button" aria-label={c} aria-pressed={v.bannerColor === c} onClick={() => set("bannerColor", c)} className="size-7 rounded-full border border-line ring-offset-2 aria-pressed:ring-2 aria-pressed:ring-ink" style={{ background: c }} />
                    ))}
                  </div>
                </Field>
              </div>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

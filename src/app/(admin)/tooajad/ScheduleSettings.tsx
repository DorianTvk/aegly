"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { clsx } from "clsx";
import { Button, Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { Field, FormMessage, Select, TimeSelect, type FormState } from "@/components/ui/form";
import { saveScheduleSettings, type SettingsInput } from "./actions";

const DAY_NAMES = ["Esmaspäev", "Teisipäev", "Kolmapäev", "Neljapäev", "Reede", "Laupäev", "Pühapäev"];
const STEPS = [
  { v: 10, l: "10 min" },
  { v: 15, l: "15 min" },
  { v: 30, l: "30 min" },
  { v: 60, l: "60 min" },
  { v: 0, l: "Teenuse kestus" },
];
const LEAD = [0, 30, 60, 120, 240, 720, 1440, 2880];
const ADVANCE = [7, 14, 30, 60, 90, 180, 365];
const CANCEL = [0, 2, 6, 12, 24, 48, 72];
const leadLabel = (m: number) => (m === 0 ? "Pole piirangut" : m < 60 ? `${m} min` : m < 1440 ? `${m / 60} tundi` : `${m / 1440} päeva`);


export function ScheduleSettings({ initial, sideCards }: { initial: SettingsInput; sideCards: React.ReactNode }) {
  const [v, setV] = useState(initial);
  const [state, setState] = useState<FormState>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof SettingsInput>(k: K, val: SettingsInput[K]) => setV((p) => ({ ...p, [k]: val }));
  const setHour = (i: number, patch: Partial<SettingsInput["hours"][number]>) =>
    setV((p) => ({ ...p, hours: p.hours.map((h, k) => (k === i ? { ...h, ...patch } : h)) }));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Tööajad ja vabad ajad"
        subtitle="Ettevõtte üldine ajakava ja reeglid, mille järgi vidin vabu aegu pakub."
        actions={
          <>
            <FormMessage state={state} />
            <Button variant="primary" disabled={pending} onClick={() => start(async () => setState(await saveScheduleSettings(v)))}>
              <Check size={16} strokeWidth={2.5} />
              {pending ? "Salvestan…" : "Salvesta"}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
        <div className="space-y-5">
          <Card>
            <CardHeader title="Lahtiolekuajad" subtitle="Töötaja tööaeg ei saa ületada ettevõtte lahtiolekuaega" />
            <ul className="divide-y divide-line-soft px-5">
              {v.hours.map((h, i) => (
                <li key={h.weekday} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                  <label className="flex w-[160px] cursor-pointer items-center gap-3">
                    <span className="relative inline-flex">
                      <input type="checkbox" className="peer sr-only" checked={h.open} onChange={(e) => setHour(i, { open: e.target.checked })} />
                      <span className="h-6 w-11 rounded-full bg-[#d0d5dd] transition-colors peer-checked:bg-lime" />
                      <span className="absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
                    </span>
                    <span className="text-sm font-medium">{DAY_NAMES[i]}</span>
                  </label>
                  {h.open ? (
                    <div className="flex items-center gap-2">
                      <TimeSelect value={h.start} onChange={(val) => setHour(i, { start: val })} aria-label={`${DAY_NAMES[i]} avatakse`} />
                      <span className="text-muted">–</span>
                      <TimeSelect value={h.end} onChange={(val) => setHour(i, { end: val })} aria-label={`${DAY_NAMES[i]} suletakse`} />
                    </div>
                  ) : (
                    <span className="text-sm text-muted">Suletud</span>
                  )}
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Broneeritavate aegade loogika" />
            <div className="space-y-5 p-5">
              <fieldset>
                <legend className="mb-1.5 text-[13px] font-medium">Ajasamm (kui tihti algusajad kuvatakse)</legend>
                <div className="inline-flex flex-wrap rounded-[10px] bg-line-soft p-0.5">
                  {STEPS.map((st) => (
                    <button
                      key={st.v}
                      type="button"
                      aria-pressed={v.slotStepMinutes === st.v}
                      onClick={() => set("slotStepMinutes", st.v)}
                      className={clsx("rounded-lg px-3 py-1.5 text-[13px]", v.slotStepMinutes === st.v ? "bg-white font-semibold shadow-sm" : "text-muted")}
                    >
                      {st.l}
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset className="space-y-2.5">
                <legend className="mb-1.5 text-[13px] font-medium">Vabade aegade kuvamine</legend>
                <label className="flex cursor-pointer items-start gap-2.5">
                  <input type="radio" name="slotMode" checked={v.slotMode === "ALL"} onChange={() => set("slotMode", "ALL")} className="mt-0.5 size-4 accent-[#a3e635]" />
                  <span>
                    <span className="block text-sm font-medium">Kõik vabad ajad</span>
                    <span className="text-[13px] text-muted">Kuvatakse iga vaba algusaeg</span>
                  </span>
                </label>
                <label className="flex cursor-not-allowed items-start gap-2.5 opacity-60">
                  <input type="radio" name="slotMode" disabled className="mt-0.5 size-4" />
                  <span>
                    <span className="block text-sm font-medium">Optimeeritud graafik · tulekul</span>
                    <span className="text-[13px] text-muted">Peidab ajad, mis jätaksid kalendrisse kasutu tühimiku</span>
                  </span>
                </label>
              </fieldset>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Min. etteteatamisaeg" htmlFor="minLead">
                  <Select id="minLead" value={v.minLeadMinutes} onChange={(e) => set("minLeadMinutes", Number(e.target.value))}>
                    {LEAD.map((m) => (
                      <option key={m} value={m}>
                        {leadLabel(m)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Max. broneerimine ette" htmlFor="maxAdv">
                  <Select id="maxAdv" value={v.maxAdvanceDays} onChange={(e) => set("maxAdvanceDays", Number(e.target.value))}>
                    {ADVANCE.map((d) => (
                      <option key={d} value={d}>
                        {d} päeva
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Tühistamine kliendi poolt" htmlFor="cancel">
                  <Select id="cancel" value={v.cancelUntilHours} onChange={(e) => set("cancelUntilHours", Number(e.target.value))}>
                    {CANCEL.map((h) => (
                      <option key={h} value={h}>
                        {h === 0 ? "Igal ajal" : `Kuni ${h} h enne`}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Broneeringu kinnitamine" htmlFor="confirm">
                  <Select id="confirm" value={v.autoConfirm ? "auto" : "manual"} onChange={(e) => set("autoConfirm", e.target.value === "auto")}>
                    <option value="auto">Automaatne</option>
                    <option value="manual">Käsitsi (salong kinnitab)</option>
                  </Select>
                </Field>
              </div>

              <label className="flex cursor-pointer items-start justify-between gap-4 border-t border-line-soft pt-4">
                <span>
                  <span className="block text-sm font-medium">Arvesta Eesti riigipühadega</span>
                  <span className="text-[13px] text-muted">Pühad on suletud, pühade-eelsed päevad 3 tundi lühemad</span>
                </span>
                <input type="checkbox" checked={v.useNationalHolidays} onChange={(e) => set("useNationalHolidays", e.target.checked)} className="mt-1 size-4 accent-[#a3e635]" />
              </label>
            </div>
          </Card>
        </div>

        <div className="space-y-5">{sideCards}</div>
      </div>
    </div>
  );
}

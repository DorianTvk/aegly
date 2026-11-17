"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { clsx } from "clsx";

const WD = ["E", "T", "K", "N", "R", "L", "P"];

/** Nädalapäevade valik; tühi = kõik päevad */
export function WeekdayPicker({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  return (
    <div className="flex gap-1.5">
      {WD.map((d, i) => {
        const on = value.includes(i + 1);
        return (
          <button
            key={d}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== i + 1) : [...value, i + 1].sort())}
            className={clsx("grid size-8 place-items-center rounded-lg text-xs font-semibold", on ? "bg-lime text-ink" : "bg-line-soft text-muted hover:bg-line")}
          >
            {d}
          </button>
        );
      })}
    </div>
  );
}

export type Target = { kind: "service" | "category" | "staff" | "package"; id: string; label: string };

/** Sihtmärkide kiibid ("Kategooria: Näohooldus ×") ja lisamise menüü. Tühi = kehtib kõigile. */
export function TargetPicker({ value, onChange, options, emptyLabel = "Kõik teenused" }: { value: Target[]; onChange: (v: Target[]) => void; options: Target[]; emptyLabel?: string }) {
  const [open, setOpen] = useState(false);
  const has = (t: Target) => value.some((v) => v.kind === t.kind && v.id === t.id);
  const prefix = { service: "", category: "Kategooria: ", staff: "Töötaja: ", package: "Pakett: " };
  return (
    <div className="relative flex flex-wrap items-center gap-2">
      {value.length === 0 && <span className="rounded-full bg-lime-soft px-3 py-1.5 text-[13px] font-medium">{emptyLabel}</span>}
      {value.map((t) => (
        <span key={t.kind + t.id} className="inline-flex items-center gap-1.5 rounded-full border border-lime/60 bg-lime-soft px-3 py-1 text-[13px] font-medium">
          {prefix[t.kind]}
          {t.label}
          <button type="button" aria-label={`Eemalda ${t.label}`} onClick={() => onChange(value.filter((v) => !(v.kind === t.kind && v.id === t.id)))}>
            <X size={13} />
          </button>
        </span>
      ))}
      <button type="button" onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1 text-[13px] hover:bg-line-soft">
        <Plus size={13} /> Lisa tingimus
      </button>
      {open && (
        <div className="absolute top-full left-0 z-20 mt-1 max-h-64 w-64 overflow-y-auto rounded-[10px] border border-line bg-white p-1 shadow-lg">
          {options.filter((o) => !has(o)).map((o) => (
            <button
              key={o.kind + o.id}
              type="button"
              onClick={() => {
                onChange([...value, o]);
                setOpen(false);
              }}
              className="block w-full rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-line-soft"
            >
              <span className="text-muted">{prefix[o.kind]}</span>
              {o.label}
            </button>
          ))}
          {options.filter((o) => !has(o)).length === 0 && <p className="px-2.5 py-1.5 text-sm text-muted">Kõik valitud</p>}
        </div>
      )}
    </div>
  );
}

/** Segmenteeritud valik */
export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="inline-flex w-full rounded-[10px] bg-line-soft p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={clsx("flex-1 rounded-lg px-3 py-1.5 text-[13px]", value === o.value ? "bg-white font-semibold shadow-sm" : "text-muted")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Kontrollitav lüliti ilma vormita */
export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={clsx("relative h-6 w-11 shrink-0 rounded-full transition-colors", checked ? "bg-lime" : "bg-[#d0d5dd]")}
    >
      <span className={clsx("absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform", checked && "translate-x-5")} />
    </button>
  );
}

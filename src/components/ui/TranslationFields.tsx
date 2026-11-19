"use client";

import { useState } from "react";
import { ChevronDown, Languages } from "lucide-react";
import { clsx } from "clsx";
import { TR_LANGS, type TrLang, type Translations } from "@/lib/translations";

type Field = { key: string; label: string; multiline?: boolean; maxLength?: number; placeholder?: string };

/**
 * Valikulised tõlked (inglise, vene). Vormis saadetakse väljad nimega tr.en.name jne;
 * kui antakse onChange, töötab kontrollitud komponendina (nt kampaania redaktor).
 */
export function TranslationFields({
  fields,
  value,
  onChange,
  className,
}: {
  fields: Field[];
  value: Translations | null | undefined;
  onChange?: (v: Translations) => void;
  className?: string;
}) {
  const filled = TR_LANGS.filter((l) => fields.some((f) => value?.[l.id]?.[f.key])).length;
  const [open, setOpen] = useState(filled > 0);
  const set = (lang: TrLang, key: string, v: string) => {
    if (!onChange) return;
    const next: Translations = { ...(value ?? {}), [lang]: { ...(value?.[lang] ?? {}), [key]: v } };
    onChange(next);
  };
  const inputCls =
    "w-full rounded-[10px] border border-line bg-white px-3 text-sm text-ink outline-none placeholder:text-subtle focus:border-lime focus:ring-3 focus:ring-lime/30";

  return (
    <div className={clsx("rounded-[10px] border border-line", className)}>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm">
        <Languages size={16} className="text-muted" aria-hidden />
        <span className="flex-1 font-medium">
          Tõlked vidina jaoks <span className="font-normal text-muted">(inglise, vene · valikuline)</span>
        </span>
        {filled > 0 && <span className="rounded-full bg-lime-soft px-2 py-0.5 text-xs font-semibold text-[#4d7c0f]">{filled}/2</span>}
        <ChevronDown size={16} className={clsx("text-muted transition-transform", open && "rotate-180")} />
      </button>
      {/* suletuna jäävad väljad vormi alles (peidetud), et salvestamine neid ei kustutaks */}
      <div className={clsx("space-y-4 border-t border-line-soft px-3 py-3", !open && "hidden")}>
        <p className="text-xs text-muted">Kui tõlge on tühi, näeb inglise- või venekeelne klient eestikeelset teksti.</p>
        {TR_LANGS.map((l) => (
          <fieldset key={l.id} className="space-y-2">
            <legend className="mb-1 text-[13px] font-semibold">{l.label} keel</legend>
            {fields.map((f) => {
              const name = `tr.${l.id}.${f.key}`;
              const common = {
                name,
                "aria-label": `${f.label} (${l.label.toLowerCase()} keeles)`,
                placeholder: f.placeholder ?? f.label,
                maxLength: f.maxLength ?? 600,
                ...(onChange
                  ? { value: value?.[l.id]?.[f.key] ?? "", onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(l.id, f.key, e.target.value) }
                  : { defaultValue: value?.[l.id]?.[f.key] ?? "" }),
              };
              return f.multiline ? <textarea key={f.key} rows={2} className={clsx(inputCls, "py-2")} {...common} /> : <input key={f.key} className={clsx(inputCls, "h-10")} {...common} />;
            })}
          </fieldset>
        ))}
      </div>
    </div>
  );
}

"use client";

import { useFormAction } from "@/components/ui/use-form-action";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { FormMessage, Input } from "@/components/ui/form";
import { deleteCategory, saveCategory } from "../actions";
import { TranslationFields } from "@/components/ui/TranslationFields";
import type { Translations } from "@/lib/translations";

const PALETTE = ["#7a5af8", "#ee46bc", "#0ba5ec", "#f79009", "#12b76a", "#f04438", "#6172f3", "#15b79e"];

export function CategoryRow({ category, serviceCount }: { category?: { id: string; name: string; color: string; translations: Translations }; serviceCount?: number }) {
  const [state, action, pending] = useFormAction(saveCategory.bind(null, category?.id ?? null));
  return (
    <form onSubmit={action} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
      <select
        name="color"
        defaultValue={category?.color ?? PALETTE[0]}
        aria-label="Värv"
        className="h-10 w-[110px] rounded-[10px] border border-line bg-white px-2 text-sm"
      >
        {PALETTE.map((c) => (
          <option key={c} value={c} style={{ color: c }}>
            ● {c}
          </option>
        ))}
      </select>
      <Input name="name" defaultValue={category?.name} placeholder="Uue kategooria nimi" className="max-w-[280px] flex-1" aria-label="Nimi" />
      {category && <span className="text-[13px] text-muted">{serviceCount} teenust</span>}
      <div className="ml-auto flex items-center gap-2">
        <FormMessage state={state?.errors ? { message: Object.values(state.errors).flat()[0] } : state} />
        <Button type="submit" size="sm" variant={category ? "secondary" : "primary"} disabled={pending}>
          {category ? "Salvesta" : "Lisa"}
        </Button>
        {category && (
          <button
            type="button"
            aria-label="Kustuta kategooria"
            onClick={() => {
              if (confirm(`Kustutada kategooria "${category.name}"? Teenused jäävad alles, kuid ilma kategooriata.`)) void deleteCategory(category.id);
            }}
            className="grid size-[34px] place-items-center rounded-lg text-muted hover:bg-bad-bg hover:text-bad"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
      <TranslationFields className="w-full" value={category?.translations} fields={[{ key: "name", label: "Kategooria nimi", maxLength: 40 }]} />
    </form>
  );
}

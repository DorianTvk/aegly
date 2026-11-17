"use client";

import { useFormAction } from "@/components/ui/use-form-action";
import { useState } from "react";
import { Check } from "lucide-react";
import { Button, Card, CardHeader } from "@/components/ui/primitives";
import { FormMessage, UnitInput } from "@/components/ui/form";
import { centsToInput } from "@/lib/money";
import { saveStaffServices } from "./actions";

export type StaffServiceRow = {
  id: string;
  name: string;
  category: string | null;
  priceCents: number;
  durationMinutes: number;
  linked: boolean;
  customPrice: number | null;
  customDuration: number | null;
};

export function StaffServicesForm({ staffId, rows }: { staffId: string; rows: StaffServiceRow[] }) {
  const [state, action, pending] = useFormAction(saveStaffServices.bind(null, staffId));
  const [on, setOn] = useState(() => new Set(rows.filter((r) => r.linked).map((r) => r.id)));
  return (
    <form onSubmit={action}>
      <Card>
        <CardHeader title="Teenused" subtitle="Vali teenused, mida töötaja osutab. Tühi hind või kestus = teenuse oma." />
        <ul className="divide-y divide-line-soft px-5">
          {rows.map((r) => {
            const checked = on.has(r.id);
            return (
              <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
                <input
                  type="checkbox"
                  name="service"
                  value={r.id}
                  checked={checked}
                  aria-label={r.name}
                  className="size-[18px] accent-[#a3e635]"
                  onChange={(e) => {
                    const next = new Set(on);
                    if (e.target.checked) next.add(r.id);
                    else next.delete(r.id);
                    setOn(next);
                  }}
                />
                <div className={checked ? "flex-1" : "flex-1 opacity-50"}>
                  <p className="text-sm font-medium">{r.name}</p>
                  <p className="text-xs text-muted">{r.category ?? "Kategooriata"}</p>
                </div>
                <UnitInput unit="€" name={`price_${r.id}`} disabled={!checked} placeholder={centsToInput(r.priceCents)} defaultValue={r.customPrice != null ? centsToInput(r.customPrice) : ""} className="w-[110px]" aria-label={`${r.name} hind`} />
                <UnitInput unit="min" type="number" name={`duration_${r.id}`} disabled={!checked} placeholder={String(r.durationMinutes)} defaultValue={r.customDuration ?? ""} className="w-[100px]" aria-label={`${r.name} kestus`} />
              </li>
            );
          })}
          {rows.length === 0 && <li className="py-6 text-sm text-muted">Teenuseid pole veel lisatud.</li>}
        </ul>
        <div className="flex items-center justify-end gap-3 border-t border-line-soft px-5 py-4">
          <FormMessage state={state} />
          <Button type="submit" variant="primary" disabled={pending}>
            <Check size={16} strokeWidth={2.5} />
            Salvesta teenused
          </Button>
        </div>
      </Card>
    </form>
  );
}

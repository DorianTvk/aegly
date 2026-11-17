"use client";

import { useFormAction } from "@/components/ui/use-form-action";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Badge, Button, Card, CardHeader } from "@/components/ui/primitives";
import { Field, FormMessage, Input, Select, TimeField } from "@/components/ui/form";
import { formatShortDate } from "@/lib/time";
import { addHoliday, deleteHoliday } from "./actions";

export type HolidayRow = {
  date: string;
  name: string;
  closed: boolean;
  hours?: string;
  /** ettevõtte enda erand (saab kustutada) */
  id?: string;
};

export function HolidaysCard({ rows, nationalOn, today }: { rows: HolidayRow[]; nationalOn: boolean; today: string }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"closed" | "short">("closed");
  const [state, action, pending] = useFormAction(async (p, fd) => {
    const r = await addHoliday(p, fd);
    if (r?.ok) setOpen(false);
    return r;
  });
  const e = state?.errors ?? {};

  return (
    <Card>
      <CardHeader
        title="Riigipühad ja erandid"
        subtitle={nationalOn ? "Järgmised 6 kuud · Eesti riigipühad arvestatakse automaatselt" : "Järgmised 6 kuud · riigipühi ei arvestata"}
        action={
          <Button size="sm" onClick={() => setOpen((o) => !o)}>
            <Plus size={15} />
            Lisa erand
          </Button>
        }
      />
      {open && (
        <form onSubmit={action} className="grid grid-cols-2 gap-3 border-b border-line-soft p-5">
          <Field label="Kuupäev" htmlFor="hDate" error={e.date}>
            <Input id="hDate" name="date" type="date" min={today} />
          </Field>
          <Field label="Nimetus" htmlFor="hName" error={e.name}>
            <Input id="hName" name="name" placeholder="nt Inventuur" />
          </Field>
          <Field label="Päev" htmlFor="hMode">
            <Select id="hMode" name="mode" value={mode} onChange={(ev) => setMode(ev.target.value as "closed" | "short")}>
              <option value="closed">Suletud</option>
              <option value="short">Erinev lahtiolekuaeg</option>
            </Select>
          </Field>
          {mode === "short" ? (
            <div className="grid grid-cols-2 gap-2">
              <Field label="Avatud" htmlFor="hStart">
                <TimeField id="hStart" name="startTime" defaultValue="10:00" />
              </Field>
              <Field label="Kuni" htmlFor="hEnd" error={e.endTime}>
                <TimeField id="hEnd" name="endTime" defaultValue="15:00" />
              </Field>
            </div>
          ) : (
            <span />
          )}
          <div className="col-span-2 flex justify-end gap-2">
            <Button size="sm" onClick={() => setOpen(false)}>
              Tühista
            </Button>
            <Button size="sm" type="submit" variant="primary" disabled={pending}>
              Lisa
            </Button>
          </div>
        </form>
      )}
      {state?.ok && (
        <div className="px-5 pt-4">
          <FormMessage state={state} />
        </div>
      )}
      <ul className="divide-y divide-line-soft px-5">
        {rows.map((h) => (
          <li key={h.date + h.name} className="flex items-center gap-4 py-3">
            <span className="w-12 text-sm font-semibold tabular-nums">{formatShortDate(h.date).slice(0, 5)}</span>
            <span className="flex-1 text-sm">{h.name}</span>
            {h.closed ? <Badge tone="bad">Suletud</Badge> : <Badge tone="warn">{h.hours}</Badge>}
            {h.id ? (
              <button
                type="button"
                aria-label={`Kustuta ${h.name}`}
                onClick={() => {
                  if (confirm(`Kustutada erand "${h.name}"?`)) void deleteHoliday(h.id!);
                }}
                className="grid size-8 place-items-center rounded-lg text-muted hover:bg-bad-bg hover:text-bad"
              >
                <Trash2 size={15} />
              </button>
            ) : (
              <span className="size-8" />
            )}
          </li>
        ))}
        {rows.length === 0 && <li className="py-6 text-sm text-muted">Lähikuudel erandeid pole.</li>}
      </ul>
    </Card>
  );
}

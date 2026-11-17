"use client";

import { useFormAction } from "@/components/ui/use-form-action";
import { useState } from "react";
import { CalendarDays, Plus, Trash2 } from "lucide-react";
import { Button, Card, CardHeader } from "@/components/ui/primitives";
import { Field, FormMessage, Input, Select, TimeField } from "@/components/ui/form";
import { addTimeOff, deleteTimeOff } from "./actions";

export type TimeOffItem = { id: string; type: "VACATION" | "TRAINING" | "SICK" | "OTHER"; title: string; when: string };

const TYPE = {
  VACATION: { label: "Puhkus", color: "#dc6803", bg: "#fffaeb" },
  TRAINING: { label: "Koolitus", color: "#175cd3", bg: "#eff8ff" },
  SICK: { label: "Haigus", color: "#b42318", bg: "#fef3f2" },
  OTHER: { label: "Muu", color: "#475467", bg: "#f2f4f7" },
} as const;

export function TimeOffPanel({ staffId, items, today }: { staffId: string; items: TimeOffItem[]; today: string }) {
  const [open, setOpen] = useState(false);
  const [allDay, setAllDay] = useState(true);
  const [state, action, pending] = useFormAction(async (prev, fd) => {
    const res = await addTimeOff(staffId, prev, fd);
    if (res?.ok) setOpen(false);
    return res;
  });
  const e = state?.errors ?? {};

  return (
    <Card>
      <CardHeader title="Erandid ja puudumised" subtitle="Ühekordsed muudatused, mis kirjutavad üle nädalagraafiku" />
      <div className="space-y-3 p-5">
        {state?.ok && <FormMessage state={state} />}
        {items.map((t) => (
          <div key={t.id} className="flex items-center gap-3 rounded-[10px] border border-line p-3">
            <span className="grid size-9 place-items-center rounded-lg" style={{ background: TYPE[t.type].bg, color: TYPE[t.type].color }}>
              <CalendarDays size={17} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{t.title}</p>
              <p className="text-xs text-muted">{t.when}</p>
            </div>
            <button
              type="button"
              aria-label="Kustuta erand"
              onClick={() => {
                if (confirm(`Kustutada "${t.title}"?`)) void deleteTimeOff(staffId, t.id);
              }}
              className="grid size-8 place-items-center rounded-lg text-muted hover:bg-bad-bg hover:text-bad"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
        {items.length === 0 && !open && <p className="text-sm text-muted">Tulevasi erandeid pole.</p>}

        {open ? (
          <form onSubmit={action} className="space-y-3 rounded-[10px] border border-line p-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tüüp" htmlFor="type">
                <Select id="type" name="type" defaultValue="VACATION">
                  {Object.entries(TYPE).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Märkus" htmlFor="note">
                <Input id="note" name="note" placeholder="nt Arsti juures" />
              </Field>
              <Field label="Alates" htmlFor="fromDate" error={e.fromDate}>
                <Input id="fromDate" name="fromDate" type="date" min={today} defaultValue={today} />
              </Field>
              <Field label="Kuni" htmlFor="toDate" error={e.toDate}>
                <Input id="toDate" name="toDate" type="date" min={today} defaultValue={today} />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="allDay" checked={allDay} onChange={(ev) => setAllDay(ev.target.checked)} className="size-4 accent-[#a3e635]" />
              Terve päev
            </label>
            {!allDay && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Kellast" htmlFor="fromTime">
                  <TimeField id="fromTime" name="fromTime" defaultValue="09:00" />
                </Field>
                <Field label="Kellani" htmlFor="toTime" error={e.toTime}>
                  <TimeField id="toTime" name="toTime" defaultValue="12:00" />
                </Field>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button size="sm" onClick={() => setOpen(false)}>
                Tühista
              </Button>
              <Button size="sm" type="submit" variant="primary" disabled={pending}>
                Lisa
              </Button>
            </div>
          </form>
        ) : (
          <Button className="w-full" onClick={() => setOpen(true)}>
            <Plus size={16} />
            Lisa erand
          </Button>
        )}
      </div>
    </Card>
  );
}

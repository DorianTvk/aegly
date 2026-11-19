"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Plus, X } from "lucide-react";
import { clsx } from "clsx";
import { Button, Card } from "@/components/ui/primitives";
import { FormMessage, TimeSelect, type FormState } from "@/components/ui/form";
import { saveWeek, type WeekInput } from "./actions";

const DAY_NAMES = ["Esmaspäev", "Teisipäev", "Kolmapäev", "Neljapäev", "Reede", "Laupäev", "Pühapäev"];

type Day = WeekInput["days"][number];

const timeInput =
  "h-10 rounded-[10px] border border-line bg-white px-2.5 text-sm tabular-nums outline-none focus:border-lime focus:ring-3 focus:ring-lime/30";

export function WeekEditor({ staffId, initial, validFrom: initialFrom, today }: { staffId: string; initial: Day[]; validFrom: string; today: string }) {
  const [days, setDays] = useState<Day[]>(initial);
  const [validFrom, setValidFrom] = useState(initialFrom);
  const [state, setState] = useState<FormState>(null);
  const [pending, start] = useTransition();

  const update = (i: number, fn: (d: Day) => Day) => setDays((prev) => prev.map((d, k) => (k === i ? fn(d) : d)));

  const copyToAll = () => {
    const source = days.find((d) => d.enabled);
    if (!source) return;
    setDays((prev) => prev.map((d) => (d.enabled ? { ...d, intervals: source.intervals.map((iv) => ({ ...iv })) } : d)));
  };

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line-soft px-5 py-4">
        <div>
          <h2 className="text-[15px] font-semibold">Iganädalane tööaeg</h2>
          <p className="mt-0.5 text-[13px] text-muted">Neist aegadest arvutatakse vidinas kuvatavad vabad ajad</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={copyToAll} className="inline-flex h-[34px] items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-semibold text-muted hover:bg-line-soft hover:text-ink">
            <Copy size={15} />
            Kopeeri kõigile tööpäevadele
          </button>
          <label className="flex items-center gap-2 text-[13px] text-muted">
            Kehtib alates
            <input type="date" value={validFrom} min={today} onChange={(e) => setValidFrom(e.target.value)} className={timeInput} />
          </label>
        </div>
      </div>

      <ul className="divide-y divide-line-soft px-5">
        {days.map((d, i) => (
          <li key={d.weekday} className="flex flex-wrap items-center gap-3 py-3.5">
            <label className="flex w-[150px] shrink-0 cursor-pointer items-center gap-3">
              <span className="relative inline-flex">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={d.enabled}
                  onChange={(e) =>
                    update(i, (x) => ({ ...x, enabled: e.target.checked, intervals: e.target.checked && x.intervals.length === 0 ? [{ start: "09:00", end: "18:00" }] : x.intervals }))
                  }
                />
                <span className="h-6 w-11 rounded-full bg-[#d0d5dd] transition-colors peer-checked:bg-lime" />
                <span className="absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
              </span>
              <span className="text-sm font-medium">{DAY_NAMES[i]}</span>
            </label>

            {d.enabled ? (
              <div className="flex flex-1 flex-wrap items-center gap-2">
                {d.intervals.map((iv, k) => (
                  <div key={k} className="flex items-center gap-1.5">
                    <TimeSelect step={5} value={iv.start} aria-label={`${DAY_NAMES[i]} algus`}
                      onChange={(val) => update(i, (x) => ({ ...x, intervals: x.intervals.map((y, j) => (j === k ? { ...y, start: val } : y)) }))} />
                    <span className="text-muted">–</span>
                    <TimeSelect step={5} value={iv.end} aria-label={`${DAY_NAMES[i]} lõpp`}
                      onChange={(val) => update(i, (x) => ({ ...x, intervals: x.intervals.map((y, j) => (j === k ? { ...y, end: val } : y)) }))} />
                    <button type="button" aria-label="Eemalda vahemik" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-line-soft hover:text-ink"
                      onClick={() => update(i, (x) => ({ ...x, intervals: x.intervals.filter((_, j) => j !== k), enabled: x.intervals.length > 1 }))}>
                      <X size={15} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[13px] font-semibold hover:bg-line-soft"
                  onClick={() =>
                    update(i, (x) => {
                      const last = x.intervals.at(-1);
                      const startMin = last ? Math.min(Number(last.end.slice(0, 2)) + 1, 22) : 9;
                      const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;
                      return { ...x, intervals: [...x.intervals, { start: hh(startMin), end: hh(Math.min(startMin + 3, 23)) }] };
                    })
                  }
                >
                  <Plus size={14} /> Vahemik
                </button>
              </div>
            ) : (
              <span className="text-sm text-muted">Vaba päev</span>
            )}
          </li>
        ))}
      </ul>

      <div className={clsx("flex items-center justify-end gap-3 border-t border-line-soft px-5 py-4")}>
        <FormMessage state={state} />
        <Button
          type="button"
          variant="primary"
          disabled={pending}
          onClick={() => start(async () => setState(await saveWeek(staffId, { validFrom, days })))}
        >
          <Check size={16} strokeWidth={2.5} />
          {pending ? "Salvestan…" : "Salvesta tööaeg"}
        </Button>
      </div>
    </Card>
  );
}

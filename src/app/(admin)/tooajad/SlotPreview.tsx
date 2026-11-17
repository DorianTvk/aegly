"use client";

import { useEffect, useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/primitives";
import { Field, Select } from "@/components/ui/form";
import { addDaysIso, formatShortDate } from "@/lib/time";
import { previewSlots } from "./actions";

const REASON: Record<string, string> = {
  closed: "Sel päeval on suletud.",
  "too-far": "Kuupäev on kaugemal kui lubatud broneerimisaeg.",
  past: "See päev on möödas või jääb etteteatamisaja sisse.",
  "no-staff": "Sellele teenusele pole töötajat määratud.",
};

export function SlotPreview({
  services,
  staff,
  today,
}: {
  services: { id: string; name: string; staffIds: string[] }[];
  staff: { id: string; name: string }[];
  today: string;
}) {
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [staffId, setStaffId] = useState<string>("any");
  const [date, setDate] = useState(addDaysIso(today, 1));
  const [result, setResult] = useState<{ slots: string[]; reason?: string } | null>(null);
  const [pending, start] = useTransition();

  const allowedStaff = staff.filter((m) => services.find((s) => s.id === serviceId)?.staffIds.includes(m.id));
  const load = () => {
    if (!serviceId) return;
    start(async () => setResult(await previewSlots(serviceId, staffId === "any" ? null : staffId, date)));
  };
  useEffect(load, [serviceId, staffId, date]);

  const days = Array.from({ length: 14 }, (_, i) => addDaysIso(today, i));

  return (
    <Card>
      <CardHeader
        title="Vabade aegade eelvaade"
        subtitle="Nii näeb klient aegu broneerimisvidinas"
        action={
          <button type="button" onClick={load} className="inline-flex h-[34px] items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-semibold text-muted hover:bg-line-soft hover:text-ink">
            <RefreshCw size={15} className={pending ? "animate-spin" : ""} />
            Värskenda
          </button>
        }
      />
      <div className="space-y-4 p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Teenus" htmlFor="pvService">
            <Select id="pvService" value={serviceId} onChange={(e) => { setServiceId(e.target.value); setStaffId("any"); }}>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Töötaja" htmlFor="pvStaff">
            <Select id="pvStaff" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
              <option value="any">Ükskõik kes</option>
              {allowedStaff.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Kuupäev" htmlFor="pvDate">
            <Select id="pvDate" value={date} onChange={(e) => setDate(e.target.value)}>
              {days.map((d) => (
                <option key={d} value={d}>
                  {formatShortDate(d)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="min-h-[96px]" aria-live="polite" aria-busy={pending}>
          {result && result.slots.length > 0 && (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {result.slots.map((t) => (
                <span key={t} className="grid h-9 place-items-center rounded-lg border border-line text-sm tabular-nums">
                  {t}
                </span>
              ))}
            </div>
          )}
          {result && result.slots.length === 0 && (
            <p className="rounded-[10px] bg-line-soft px-3 py-4 text-sm text-muted">{REASON[result.reason ?? ""] ?? "Vabu aegu pole – päev on täis."}</p>
          )}
        </div>
      </div>
    </Card>
  );
}

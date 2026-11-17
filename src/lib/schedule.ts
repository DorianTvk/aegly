/**
 * Töötaja päevagraafik: tööaeg, vaheajad ja puudumised ühe kuupäeva kohta.
 * Puhas loogika (ilma andmebaasita) – sama funktsiooni kasutab hiljem vabade aegade mootor.
 * Kõik ajad on minutid südaööst ettevõtte ajavööndis.
 */
import { isoWeekday, toMinutes } from "./time";

export type Interval = { start: number; end: number };

export type ScheduleRow = {
  weekday: number;
  validFrom: string;
  validTo: string | null;
  startTime: string;
  endTime: string;
  breaks: { start: string; end: string; label?: string }[];
};

export type StaffDay = {
  /** Kas töötaja on sel päeval graafikus */
  scheduled: boolean;
  /** Terve päev puudub (puhkus vms) */
  absent: boolean;
  absenceNote?: string;
  shift?: Interval;
  breaks: (Interval & { label: string })[];
  /** Töövahemikud, millest on vaheajad ja puudumised maha arvatud */
  working: Interval[];
};

/** Lahuta vahemikud b vahemikest a */
export function subtract(a: Interval[], b: Interval[]): Interval[] {
  let result = [...a];
  for (const cut of b) {
    const next: Interval[] = [];
    for (const r of result) {
      if (cut.end <= r.start || cut.start >= r.end) {
        next.push(r);
        continue;
      }
      if (cut.start > r.start) next.push({ start: r.start, end: cut.start });
      if (cut.end < r.end) next.push({ start: cut.end, end: r.end });
    }
    result = next;
  }
  return result;
}

export function totalMinutes(list: Interval[]): number {
  return list.reduce((s, i) => s + (i.end - i.start), 0);
}

/** Vali kuupäevale kehtiv graafikurida (hiliseima validFrom-iga) */
export function scheduleFor(rows: ScheduleRow[], isoDate: string): ScheduleRow | undefined {
  const wd = isoWeekday(isoDate);
  return rows
    .filter((r) => r.weekday === wd && r.validFrom <= isoDate && (!r.validTo || r.validTo >= isoDate))
    .sort((x, y) => (x.validFrom < y.validFrom ? 1 : -1))[0];
}

/**
 * @param absences puudumised minutites selle päeva sees (juba päeva piiridesse lõigatud)
 * @param opening ettevõtte lahtiolekuaeg; töötaja aeg ei saa seda ületada (raport, samm 1)
 */
export function staffDay(
  rows: ScheduleRow[],
  isoDate: string,
  absences: (Interval & { note?: string })[] = [],
  opening?: Interval | null,
): StaffDay {
  const row = scheduleFor(rows, isoDate);
  if (!row || opening === null) return { scheduled: false, absent: false, breaks: [], working: [] };

  let shift: Interval = { start: toMinutes(row.startTime), end: toMinutes(row.endTime) };
  if (opening) shift = { start: Math.max(shift.start, opening.start), end: Math.min(shift.end, opening.end) };

  const breaks = row.breaks.map((b) => ({ start: toMinutes(b.start), end: toMinutes(b.end), label: b.label ?? "Vaheaeg" }));
  const working = subtract(subtract([shift], breaks), absences);
  const absent = absences.some((a) => a.start <= shift.start && a.end >= shift.end);

  return { scheduled: true, absent, absenceNote: absences[0]?.note, shift, breaks, working };
}

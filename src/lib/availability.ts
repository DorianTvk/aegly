/**
 * Vabade aegade mootor (Figma raport R2, "1. Vabade aegade arvutus").
 *
 * Reeglid:
 *  1. Töötaja aeg ei ületa ettevõtte lahtiolekuaega          → staffDay(opening)
 *  2. Töötaja nädalagraafik koos vaheaegadega                → staffDay
 *  3. Erandid: puhkus, koolitus, riigipühad                  → staffDay(absences) / opening = null
 *  4. Hõivatud ajad: olemasolevad broneeringud + nende puhver → busy
 *  5. Teenus peab mahtuma tööaja sisse; puhver võib ulatuda vaheaega või tööpäeva lõppu,
 *     aga ei tohi kattuda teise broneeringuga
 *  6. Algusajad ajasammu järel (vaikimisi 15 min)
 *  7. Reeglid: min etteteatamisaeg, max päevi ette
 *
 * Kõik ajad on minutid südaööst ettevõtte ajavööndis.
 */
import type { Interval, StaffDay } from "./schedule";

export type StaffInput = {
  staffId: string;
  day: StaffDay;
  /** Olemasolevad broneeringud koos puhvritega (start − puhver enne, end + puhver pärast) */
  busy: Interval[];
  /** Töötaja oma kestus sellele teenusele, kui erineb */
  durationMinutes?: number | null;
};

export type SlotQuery = {
  durationMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  /** 0 = teenuse kestus */
  stepMinutes: number;
  /** Varaseim lubatud algus sel päeval (min etteteatamisaeg); null = pole piirangut */
  earliestStart: number | null;
};

export type Slot = { start: number; end: number; staffIds: string[] };

const overlaps = (a: Interval, b: Interval) => a.start < b.end && b.start < a.end;
const inside = (a: Interval, list: Interval[]) => list.some((w) => a.start >= w.start && a.end <= w.end);

/** Ühe töötaja vabad algusajad */
export function staffSlots(staff: StaffInput, q: SlotQuery): number[] {
  if (!staff.day.scheduled || staff.day.absent || staff.day.working.length === 0) return [];
  const duration = staff.durationMinutes ?? q.durationMinutes;
  const step = q.stepMinutes > 0 ? q.stepMinutes : duration;
  const first = Math.min(...staff.day.working.map((w) => w.start));
  const last = Math.max(...staff.day.working.map((w) => w.end));

  const out: number[] = [];
  // ajasamm joondub tööpäeva algusega (09:00, 09:15, …)
  for (let start = first; start + duration <= last; start += step) {
    if (q.earliestStart !== null && start < q.earliestStart) continue;
    const service = { start, end: start + duration };
    if (!inside(service, staff.day.working)) continue;
    const withBuffer = { start: start - q.bufferBeforeMinutes, end: start + duration + q.bufferAfterMinutes };
    if (staff.busy.some((b) => overlaps(withBuffer, b))) continue;
    out.push(start);
  }
  return out;
}

/** Vabad ajad ühele või mitmele töötajale; "Ükskõik kes" korral liidetakse kõigi ajad. */
export function availableSlots(staff: StaffInput[], q: SlotQuery): Slot[] {
  const byStart = new Map<number, Slot>();
  for (const st of staff) {
    const duration = st.durationMinutes ?? q.durationMinutes;
    for (const start of staffSlots(st, q)) {
      const slot = byStart.get(start) ?? { start, end: start + duration, staffIds: [] };
      slot.staffIds.push(st.staffId);
      byStart.set(start, slot);
    }
  }
  return [...byStart.values()].sort((a, b) => a.start - b.start);
}

/** Olemasolev broneering → hõivatud vahemik koos puhvritega */
export function busyInterval(b: { start: number; end: number; bufferBefore?: number; bufferAfter?: number }): Interval {
  return { start: b.start - (b.bufferBefore ?? 0), end: b.end + (b.bufferAfter ?? 0) };
}

import { describe, expect, it } from "vitest";
import { availableSlots, busyInterval, staffSlots } from "./availability";
import { staffDay } from "./schedule";
import { fromMinutes, toMinutes } from "./time";

const week = (start: string, end: string, lunch: [string, string]) =>
  [1, 2, 3, 4, 5].map((weekday) => ({
    weekday, validFrom: "2026-01-01", validTo: null, startTime: start, endTime: end,
    breaks: [{ start: lunch[0], end: lunch[1], label: "Lõunapaus" }],
  }));

const kadriDay = staffDay(week("09:00", "18:00", ["12:00", "13:00"]), "2026-11-03");
const q = { durationMinutes: 60, bufferBeforeMinutes: 0, bufferAfterMinutes: 15, stepMinutes: 15, earliestStart: null };
const fmt = (list: number[]) => list.map(fromMinutes);

describe("vabade aegade mootor – raporti näide (Kadri Tamm, T 3.11, klassikaline massaaž)", () => {
  // Broneeringud 14:15–15:30 ja 17:00–18:00, mõlemal 15 min puhver pärast
  const busy = [
    busyInterval({ start: toMinutes("14:15"), end: toMinutes("15:30"), bufferAfter: 15 }),
    busyInterval({ start: toMinutes("17:00"), end: toMinutes("18:00"), bufferAfter: 15 }),
  ];
  const slots = fmt(staffSlots({ staffId: "kadri", day: kadriDay, busy }, q));

  it("pakub raportis loetletud algusajad", () => {
    expect(slots).toEqual(["09:00", "09:15", "09:30", "09:45", "10:00", "10:15", "10:30", "10:45", "11:00", "13:00", "15:45"]);
  });
  it("11:15 puudub – teenus ulatuks lõunapausi", () => expect(slots).not.toContain("11:15"));
  it("13:15 puudub – puhver kattuks 14:15 broneeringuga", () => expect(slots).not.toContain("13:15"));
  it("16:00 puudub – puhver kattuks 17:00 broneeringuga", () => expect(slots).not.toContain("16:00"));
  it("11:00 lubatud – puhver võib jääda lõunapausi", () => expect(slots).toContain("11:00"));
});

describe("reeglid", () => {
  it("min etteteatamisaeg lõikab varased ajad", () => {
    const s = staffSlots({ staffId: "k", day: kadriDay, busy: [] }, { ...q, earliestStart: toMinutes("10:20") });
    expect(fmt(s)[0]).toBe("10:30");
  });
  it("ajasamm 0 = teenuse kestus", () => {
    const s = staffSlots({ staffId: "k", day: kadriDay, busy: [] }, { ...q, stepMinutes: 0 });
    expect(fmt(s)).toEqual(["09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "17:00"]);
  });
  it("töötaja oma kestus", () => {
    const s = staffSlots({ staffId: "k", day: kadriDay, busy: [], durationMinutes: 90 }, q);
    expect(fmt(s)).not.toContain("11:00");
    expect(fmt(s)).toContain("10:30");
  });
  it("puhkusel töötajal aegu pole", () => {
    const day = staffDay(week("09:00", "18:00", ["12:00", "13:00"]), "2026-11-03", [{ start: 0, end: 1440 }]);
    expect(staffSlots({ staffId: "k", day, busy: [] }, q)).toEqual([]);
  });
  it("Ükskõik kes liidab töötajate ajad", () => {
    const mariDay = staffDay(week("12:00", "20:00", ["15:00", "15:30"]), "2026-11-03");
    const slots = availableSlots(
      [
        { staffId: "kadri", day: kadriDay, busy: [] },
        { staffId: "mari", day: mariDay, busy: [] },
      ],
      q,
    );
    const at13 = slots.find((s) => s.start === toMinutes("13:00"))!;
    expect(at13.staffIds).toEqual(["kadri", "mari"]);
    expect(slots.at(-1)!.start).toBe(toMinutes("19:00"));
  });
});

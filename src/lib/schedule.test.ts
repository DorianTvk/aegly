import { describe, expect, it } from "vitest";
import { staffDay, subtract, totalMinutes } from "./schedule";

const kadri = [1, 2, 3, 4, 5].map((weekday) => ({
  weekday, validFrom: "2026-01-01", validTo: null, startTime: "09:00", endTime: "18:00",
  breaks: [{ start: "12:00", end: "13:00", label: "Lõunapaus" }],
}));

describe("schedule", () => {
  it("lahutab vahemikud", () => {
    expect(subtract([{ start: 540, end: 1080 }], [{ start: 720, end: 780 }])).toEqual([
      { start: 540, end: 720 }, { start: 780, end: 1080 },
    ]);
  });
  it("Kadri teisipäev: 09–12 ja 13–18 (raport R2)", () => {
    const d = staffDay(kadri, "2026-11-03");
    expect(d.working).toEqual([{ start: 540, end: 720 }, { start: 780, end: 1080 }]);
    expect(totalMinutes(d.working)).toBe(480);
  });
  it("nädalavahetusel graafikut pole", () => {
    expect(staffDay(kadri, "2026-11-07").scheduled).toBe(false);
  });
  it("puhkus katab päeva", () => {
    const d = staffDay(kadri, "2026-12-15", [{ start: 0, end: 1440, note: "Puhkus" }]);
    expect(d.absent).toBe(true);
    expect(d.working).toEqual([]);
  });
  it("lahtiolekuaeg piirab tööaega", () => {
    const d = staffDay(kadri, "2026-11-03", [], { start: 600, end: 1020 });
    expect(d.shift).toEqual({ start: 600, end: 1020 });
  });
});

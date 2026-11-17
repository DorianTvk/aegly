import { describe, expect, it } from "vitest";
import { addDaysIso, formatEuro, formatLongDate, isoWeekday, localTime, zonedDateTime } from "./time";

describe("time", () => {
  it("vormindab eurod Figma moodi", () => {
    expect(formatEuro(428000, { decimals: false })).toBe("4 280 €");
    expect(formatEuro(5500)).toBe("55 €");
    expect(formatEuro(4950)).toBe("49,50 €");
    expect(formatEuro(-550)).toBe("−5,50 €");
    expect(formatEuro(105300, { decimals: false })).toBe("1 053 €");
  });
  it("arvestab Tallinna ajavööndit ja suveaega", () => {
    expect(zonedDateTime("2026-11-03", "10:30").toISOString()).toBe("2026-11-03T08:30:00.000Z");
    expect(zonedDateTime("2026-07-01", "10:30").toISOString()).toBe("2026-07-01T07:30:00.000Z");
    expect(localTime(new Date("2026-11-03T08:30:00Z"))).toBe("10:30");
  });
  it("kuupäevad", () => {
    expect(isoWeekday("2026-11-03")).toBe(2);
    expect(addDaysIso("2026-10-30", 3)).toBe("2026-11-02");
    expect(formatLongDate("2026-10-30")).toBe("Reede, 30. oktoober 2026");
  });
});

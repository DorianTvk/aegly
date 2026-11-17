import { describe, expect, it } from "vitest";
import { easterSunday, estonianHolidays } from "./holidays-ee";

describe("Eesti pühad", () => {
  it("lihavõtted", () => {
    expect(easterSunday(2026)).toBe("2026-04-05");
    expect(easterSunday(2027)).toBe("2027-03-28");
    expect(easterSunday(2025)).toBe("2025-04-20");
  });
  it("2026 pühad", () => {
    const list = estonianHolidays(2026);
    const byDate = Object.fromEntries(list.map((h) => [h.date, h]));
    expect(byDate["2026-04-03"].name).toBe("Suur reede");
    expect(byDate["2026-05-24"].name).toBe("Nelipühade 1. püha");
    expect(byDate["2026-12-24"].kind).toBe("closed");
    expect(byDate["2026-12-31"].kind).toBe("short");
    expect(list.filter((h) => h.kind === "closed")).toHaveLength(12);
  });
});

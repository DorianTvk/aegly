import { describe, expect, it } from "vitest";
import { canAddStaff, canSwitchTo, isSuperadmin, parsePeriod, parsePlan, planPrice, smallestPlanFor, staffLimitMessage } from "./plans";

describe("paketid", () => {
  it("töötajate piir", () => {
    expect(canAddStaff("SOLO", 0)).toBe(true);
    expect(canAddStaff("SOLO", 1)).toBe(false);
    expect(canAddStaff("SALONG", 4)).toBe(true);
    expect(canAddStaff("SALONG", 5)).toBe(false);
    expect(canAddStaff("SUUR", 500)).toBe(true);
  });
  it("paketi langetamine ainult siis, kui töötajad mahuvad", () => {
    expect(canSwitchTo("SOLO", 2)).toBe(false);
    expect(canSwitchTo("SALONG", 5)).toBe(true);
    expect(canSwitchTo("SALONG", 6)).toBe(false);
    expect(smallestPlanFor(0)).toBe("SOLO");
    expect(smallestPlanFor(3)).toBe("SALONG");
    expect(smallestPlanFor(9)).toBe("SUUR");
  });
  it("hinnad ja sisendi parsimine", () => {
    expect(planPrice("SALONG", "MONTH")).toBe(1900);
    expect(planPrice("SUUR", "YEAR")).toBe(29000);
    expect(parsePlan("solo")).toBe("SOLO");
    expect(parsePlan("midagi")).toBe("SALONG");
    expect(parsePeriod("year")).toBe("YEAR");
    expect(parsePeriod(undefined)).toBe("MONTH");
  });
  it("täis piiri teade soovitab järgmist paketti", () => {
    expect(staffLimitMessage("SOLO")).toContain("Salong");
    expect(staffLimitMessage("SALONG")).toContain("Suur salong");
  });
  it("superadmin keskkonnamuutujast", () => {
    expect(isSuperadmin("Dorian@x.ee", "a@b.ee, dorian@x.ee")).toBe(true);
    expect(isSuperadmin("c@b.ee", "a@b.ee")).toBe(false);
    expect(isSuperadmin("a@b.ee", undefined)).toBe(false);
  });
});

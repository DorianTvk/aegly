import { describe, expect, it } from "vitest";
import { centsToInput, parseEuroToCents } from "./money";

describe("money", () => {
  it("parsib eesti formaati", () => {
    expect(parseEuroToCents("55,00")).toBe(5500);
    expect(parseEuroToCents("55.5")).toBe(5550);
    expect(parseEuroToCents("1 200 €")).toBe(120000);
    expect(parseEuroToCents("")).toBeNull();
    expect(parseEuroToCents("abc")).toBeNull();
    expect(parseEuroToCents("-5")).toBeNull();
  });
  it("vormindab sisendiks", () => {
    expect(centsToInput(5500)).toBe("55,00");
    expect(centsToInput(null)).toBe("");
  });
});

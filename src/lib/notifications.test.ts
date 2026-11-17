import { describe, expect, it } from "vitest";
import { renderTemplate, smsSegments } from "./notifications";

describe("teavitused", () => {
  it("täidab malli", () => {
    expect(renderTemplate("Tere {eesnimi}! {teenus} kell {kellaaeg}. {tundmatu}", { "{eesnimi}": "Kertu", "{teenus}": "Massaaž", "{kellaaeg}": "10:30" })).toBe(
      "Tere Kertu! Massaaž kell 10:30. {tundmatu}",
    );
  });
  it("SMS pikkus: õ ja š sunnivad unicode'i", () => {
    expect(smsSegments("Tere Kertu! Aeg on kinnitatud.").unicode).toBe(false);
    expect(smsSegments("Tere Kertu! Õhtune aeg.").unicode).toBe(true);
    expect(smsSegments("ä".repeat(160)).segments).toBe(1);
    expect(smsSegments("a".repeat(161)).segments).toBe(2);
    expect(smsSegments("õ".repeat(71)).segments).toBe(2);
    expect(smsSegments("€").chars).toBe(2);
  });
});

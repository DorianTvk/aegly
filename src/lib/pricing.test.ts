import { describe, expect, it } from "vitest";
import { computePrice, type CampaignInput, type CodeInput, type PriceRuleInput } from "./pricing";

const MASSAAZ = "cat-massaaz";
const NAO = "cat-nao";

const rules: PriceRuleInput[] = [
  { id: "r1", name: "Nädalavahetus", kind: "PERCENT", value: 10, weekdays: [6, 7], fromTime: null, toTime: null, serviceIds: [], categoryIds: [], minLeadHours: null, maxLeadHours: null, dateFrom: null, dateTo: null, active: true },
  { id: "r2", name: "Õhtune aeg", kind: "FIXED", value: 500, weekdays: [], fromTime: "18:00", toTime: null, serviceIds: [], categoryIds: [MASSAAZ], minLeadHours: null, maxLeadHours: null, dateFrom: null, dateTo: null, active: true },
  { id: "r3", name: "Viimase hetke soodustus", kind: "PERCENT", value: -15, weekdays: [], fromTime: null, toTime: null, serviceIds: [], categoryIds: [], minLeadHours: null, maxLeadHours: 3, dateFrom: null, dateTo: null, active: false },
];

const campaigns: CampaignInput[] = [
  { id: "c1", name: "Sügisene hoolitsus", kind: "PERCENT", value: 20, startsAt: new Date("2026-10-15T00:00:00+03:00"), endsAt: new Date("2026-11-15T23:59:00+02:00"), weekdays: [], fromTime: null, toTime: null, serviceIds: [], categoryIds: [NAO], staffIds: [], combinable: false, active: true },
  { id: "c2", name: "Hommikune massaaž", kind: "PERCENT", value: 10, startsAt: new Date("2026-10-01T00:00:00+03:00"), endsAt: new Date("2026-12-31T23:59:00+02:00"), weekdays: [1, 3], fromTime: "09:00", toTime: "12:00", serviceIds: [], categoryIds: [MASSAAZ], staffIds: [], combinable: false, active: true },
];

const TERE10: CodeInput = { id: "k1", code: "TERE10", kind: "PERCENT", value: 10, minAmountCents: null, combinable: false, serviceIds: [], categoryIds: [] };
const at = new Date("2026-10-30T10:00:00+02:00");
const common = { at, rules, campaigns, depositPercent: 20, vatPercent: 24 };

describe("hinna mootor – raporti näited", () => {
  it("Näide 1: klassikaline massaaž, Kadri, T 3.11 kell 10:30, TERE10 → 49,50 €", () => {
    const r = computePrice({
      ...common,
      ctx: { isoDate: "2026-11-03", weekday: 2, startMinutes: 630, leadHours: 96, serviceId: "klass", categoryId: MASSAAZ, staffId: "kadri" },
      baseCents: 5500,
      staffPriceCents: null,
      code: TERE10,
    });
    expect(r.campaign).toBeNull(); // hommikune massaaž kehtib E ja K, mitte T
    expect(r.code?.discountCents).toBe(550);
    expect(r.finalCents).toBe(4950);
    expect(r.depositCents).toBe(990);
    expect(r.payOnSiteCents).toBe(3960);
    expect(r.vatCents).toBe(958);
  });

  it("Näide 2: Karli hind 60 € + õhtune aeg +5 €, TERE10 → 58,50 €", () => {
    const r = computePrice({
      ...common,
      ctx: { isoDate: "2026-11-12", weekday: 4, startMinutes: 18 * 60 + 30, leadHours: 200, serviceId: "klass", categoryId: MASSAAZ, staffId: "karl" },
      baseCents: 5500,
      staffPriceCents: 6000,
      code: TERE10,
    });
    expect(r.afterRulesCents).toBe(6500);
    expect(r.code?.discountCents).toBe(650);
    expect(r.finalCents).toBe(5850);
    expect(r.depositCents).toBe(1170);
    expect(r.payOnSiteCents).toBe(4680);
    expect(r.vatCents).toBe(1132);
  });

  it("Näide 3: näohooldus, kampaania −20 % ja TERE10 ei liitu → 52,00 €", () => {
    const r = computePrice({
      ...common,
      ctx: { isoDate: "2026-11-04", weekday: 3, startMinutes: 14 * 60, leadHours: 120, serviceId: "nao", categoryId: NAO, staffId: "mari" },
      baseCents: 6500,
      staffPriceCents: null,
      code: TERE10,
    });
    expect(r.campaign?.discountCents).toBe(1300);
    expect(r.code).toBeNull();
    expect(r.codeRejected).toBe("not-combinable");
    expect(r.finalCents).toBe(5200);
    expect(r.depositCents).toBe(1040);
    expect(r.payOnSiteCents).toBe(4160);
    expect(r.vatCents).toBe(1006);
  });
});

describe("hinna mootor – reeglid", () => {
  const ctx = { isoDate: "2026-11-07", weekday: 6, startMinutes: 600, leadHours: 2, serviceId: "klass", categoryId: MASSAAZ, staffId: "kadri" };
  it("nädalavahetus +10 %", () => {
    const r = computePrice({ ...common, ctx, baseCents: 5500, staffPriceCents: null });
    expect(r.finalCents).toBe(6050);
  });
  it("väljalülitatud reegel ei rakendu", () => {
    const r = computePrice({ ...common, ctx, baseCents: 5500, staffPriceCents: null });
    expect(r.lines.some((l) => l.label.includes("Viimase hetke"))).toBe(false);
  });
  it("kombineeritav kood rakendub pärast kampaaniat", () => {
    const r = computePrice({
      ...common,
      campaigns: [{ ...campaigns[1], combinable: true }],
      ctx: { ...ctx, isoDate: "2026-11-02", weekday: 1 },
      baseCents: 5000,
      staffPriceCents: null,
      code: { ...TERE10, combinable: true },
    });
    // 5000 − 10 % = 4500 − 10 % = 4050
    expect(r.finalCents).toBe(4050);
  });
  it("suurem kood võidab mittekombineeritava kampaania", () => {
    const r = computePrice({
      ...common,
      ctx: { ...ctx, isoDate: "2026-11-02", weekday: 1 },
      baseCents: 5000,
      staffPriceCents: null,
      code: { ...TERE10, value: 25 },
    });
    expect(r.campaign).toBeNull();
    expect(r.finalCents).toBe(3750);
  });
  it("min ostusumma", () => {
    const r = computePrice({ ...common, rules: [], ctx, baseCents: 3000, staffPriceCents: null, code: { ...TERE10, minAmountCents: 4000 } });
    expect(r.codeRejected).toBe("min-amount");
    expect(r.finalCents).toBe(3000);
  });
  it("tasuta teenuse kood", () => {
    const r = computePrice({ ...common, rules: [], ctx, baseCents: 3000, staffPriceCents: null, code: { ...TERE10, kind: "FREE_SERVICE", value: 0 } });
    expect(r.finalCents).toBe(0);
    expect(r.depositCents).toBe(0);
  });
});

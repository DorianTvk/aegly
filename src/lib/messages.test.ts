import { describe, expect, it } from "vitest";
import { emailHtml, firstName, normalizePhone, smsSenderName } from "./messages";

describe("teavitused", () => {
  it("telefoninumber E.164 kujule", () => {
    expect(normalizePhone("+372 5123 4567")).toBe("+37251234567");
    expect(normalizePhone("5123 4567")).toBe("+37251234567");
    expect(normalizePhone("00358 40 123 4567")).toBe("+358401234567");
    expect(normalizePhone("abc")).toBeNull();
    expect(normalizePhone(null)).toBeNull();
  });
  it("SMS-i saatja nimi", () => {
    expect(smsSenderName("Studio Lumi")).toBe("StudioLumi");
    expect(smsSenderName("Ilusalong Õnnelik Päev")).toBe("IlusalongOn");
    expect(smsSenderName("123")).toBe("Aegly");
    expect(smsSenderName(null)).toBe("Aegly");
  });
  it("HTML-kiri: põgenemine ja lingid", () => {
    const html = emailHtml({ body: "Tere <Kati>!\n\nMuuda: https://app.aegly.ee/b/abc", salon: "Lumi & Co", color: "#0f766e" });
    expect(html).toContain("Tere &lt;Kati&gt;!");
    expect(html).toContain('href="https://app.aegly.ee/b/abc"');
    expect(html).toContain("Lumi &amp; Co");
    expect(emailHtml({ body: "x", salon: "s", color: "red;}" })).toContain("#1f2937");
  });
  it("eesnimi", () => expect(firstName(" Kadri Tamm ")).toBe("Kadri"));
});

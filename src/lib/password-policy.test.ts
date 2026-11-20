import { describe, expect, it } from "vitest";
import { checkPasswordPolicy, passwordScore } from "./password-policy";

describe("checkPasswordPolicy", () => {
  it("lükkab tagasi lühikesed", () => expect(checkPasswordPolicy("Abc!1234")).toMatch(/vähemalt 10/));
  it("lükkab tagasi kordused ja jadad", () => {
    for (const p of ["aaaaaaaaaa", "1234567890", "abcabcabcabc", "qwertyuiop", "0987654321", "ababababab"]) expect(checkPasswordPolicy(p), p).toMatch(/lihtne/);
  });
  it("lükkab tagasi levinud paroolid ja nende variandid", () => {
    for (const p of ["Parool2024!", "password123", "P@ssw0rd!!", "Salasona123", "qwerty12345", "Welcome2025"]) expect(checkPasswordPolicy(p), p).not.toBeNull();
  });
  it("lükkab tagasi nime/e-posti/ettevõtte põhised", () => {
    expect(checkPasswordPolicy("dorian2026!", { email: "dorian@aegly.ee" })).toMatch(/nimel/);
    expect(checkPasswordPolicy("StudioLumi1!", { business: "Studio Lumi" })).toMatch(/nimel/);
  });
  it("lubab head paroolid", () => {
    for (const p of ["kollane-kass-sõidab-rongiga", "Vihm7Pilv!Mets", "tl9#Kq2!vWz8", "aegly-demo-parool-pikk"]) expect(checkPasswordPolicy(p, { email: "kati@example.com" }), p).toBeNull();
  });
  it("tugevuse hinnang", () => {
    expect(passwordScore("lühike")).toBe(0);
    expect(passwordScore("parool12345")).toBe(0);
    expect(passwordScore("kollane-kass-sõidab")).toBeGreaterThanOrEqual(3);
  });
});

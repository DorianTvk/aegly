import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, generateRecoveryCodes, generateTotpSecret, hashRecoveryCode, hotp, totp, verifyTotp } from "./totp";

// RFC 6238 test vector: saladus "12345678901234567890" (ASCII)
const RFC = base32Encode(Buffer.from("12345678901234567890"));

describe("totp", () => {
  it("base32 edasi-tagasi", () => {
    const b = Buffer.from("tere maailm");
    expect(base32Decode(base32Encode(b)).toString()).toBe("tere maailm");
  });
  it("RFC 6238 näited (6 numbrit)", () => {
    expect(totp(RFC, 59_000)).toBe("287082");
    expect(totp(RFC, 1111111109_000)).toBe("081804");
    expect(totp(RFC, 1234567890_000)).toBe("005924");
    expect(hotp(RFC, 0)).toBe("755224");
  });
  it("lubab ±30 s, aga mitte rohkem", () => {
    const s = generateTotpSecret();
    const now = 1_800_000_000_000;
    expect(verifyTotp(s, totp(s, now), { now })).not.toBeNull();
    expect(verifyTotp(s, totp(s, now - 30_000), { now })).not.toBeNull();
    expect(verifyTotp(s, totp(s, now - 90_000), { now })).toBeNull();
    expect(verifyTotp(s, "12345", { now })).toBeNull();
  });
  it("sama koodi ei saa teist korda kasutada", () => {
    const s = generateTotpSecret();
    const now = 1_800_000_000_000;
    const step = verifyTotp(s, totp(s, now), { now });
    expect(verifyTotp(s, totp(s, now), { now, lastStep: step })).toBeNull();
  });
  it("varukoodid", () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    expect(codes[0]).toMatch(/^[a-z0-9]{4}-[a-z0-9]{4}$/);
    expect(hashRecoveryCode(codes[0].toUpperCase())).toBe(hashRecoveryCode(codes[0].replace("-", " ")));
  });
});

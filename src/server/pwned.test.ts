import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/report", () => ({ reportError: () => {} }));
import { createHash } from "node:crypto";
import { pwnedCount } from "./pwned";

const sha = (s: string) => createHash("sha1").update(s).digest("hex").toUpperCase();

describe("pwnedCount", () => {
  it("saadab ainult räsi 5 esimest märki ja leiab vaste", async () => {
    const h = sha("parool123");
    const calls: string[] = [];
    const f = (async (url: string) => {
      calls.push(url);
      return new Response(`0000000000000000000000000000000000A:0\r\n${h.slice(5)}:4521\r\n`);
    }) as unknown as typeof fetch;
    expect(await pwnedCount("parool123", f)).toBe(4521);
    expect(calls[0]).toBe(`https://api.pwnedpasswords.com/range/${h.slice(0, 5)}`);
    expect(calls[0]).not.toContain("parool");
  });
  it("puuduv → 0", async () => {
    const f = (async () => new Response("ABCDEF:1\n")) as unknown as typeof fetch;
    expect(await pwnedCount("kollane-kass-sõidab-rongiga", f)).toBe(0);
  });
  it("teenuse rike → null (ei blokeeri)", async () => {
    const f = (async () => { throw new Error("võrk maas"); }) as unknown as typeof fetch;
    expect(await pwnedCount("midagi", f)).toBeNull();
  });
});

import { randomBytes } from "node:crypto";

/** Kinkekaardi kood, nt GC-7KQ2-XMP (segadust tekitavad märgid 0/O/1/I välja jäetud) */
export function giftCode(): string {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const r = Array.from(randomBytes(7), (b) => a[b % a.length]).join("");
  return `GC-${r.slice(0, 4)}-${r.slice(4)}`;
}

/** Kasutaja sisestatud kood ühtlasele kujule ("gc 7kq2xmp" → "GC-7KQ2-XMP") */
export function normalizeGiftCode(raw: string): string {
  const s = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const body = s.startsWith("GC") ? s.slice(2) : s;
  return body.length === 7 ? `GC-${body.slice(0, 4)}-${body.slice(4)}` : raw.trim().toUpperCase();
}

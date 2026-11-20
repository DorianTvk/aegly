import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Kaheastmeline sisselogimine (TOTP, RFC 6238) – sama, mida kasutavad Google Authenticator,
 * Microsoft Authenticator, 1Password jne. 6 numbrit, 30-sekundilised sammud.
 */

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0, value = 0, out = "";
  for (const byte of buf) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += ALPHABET[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(str: string): Buffer {
  const clean = str.toUpperCase().replace(/[\s=]/g, "");
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const i = ALPHABET.indexOf(ch);
    if (i < 0) throw new Error("Vigane base32");
    value = (value << 5) | i; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

/** Uus juhuslik saladus (160 bitti) */
export const generateTotpSecret = () => base32Encode(randomBytes(20));

/** Kood antud ajasammu jaoks */
export function hotp(secret: string, counter: number, digits = 6): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac("sha1", base32Decode(secret)).update(msg).digest();
  const off = h[h.length - 1] & 15;
  const n = ((h[off] & 0x7f) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3];
  return String(n % 10 ** digits).padStart(digits, "0");
}

export const totp = (secret: string, now = Date.now()) => hotp(secret, Math.floor(now / 30_000));

/**
 * Kontrolli koodi. Lubatakse ±1 samm (kella väike erinevus).
 * Tagastab sobinud ajasammu (kordusrünnaku vältimiseks salvestatakse viimane kasutatud) või null.
 */
export function verifyTotp(secret: string, code: string, opts: { now?: number; lastStep?: number | null } = {}): number | null {
  const c = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(c)) return null;
  const step = Math.floor((opts.now ?? Date.now()) / 30_000);
  for (const d of [0, -1, 1]) {
    const s = step + d;
    if (opts.lastStep != null && s <= opts.lastStep) continue;
    const want = Buffer.from(hotp(secret, s));
    if (timingSafeEqual(want, Buffer.from(c))) return s;
  }
  return null;
}

/** otpauth:// aadress QR-koodi jaoks */
export function otpauthUrl(secret: string, account: string, issuer = "Aegly") {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

/** Varukoodid: 10 tk kujul "abcd-efgh"; andmebaasi läheb ainult räsi */
export function generateRecoveryCodes(n = 10): string[] {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: n }, () => {
    const b = randomBytes(8);
    const s = Array.from(b, (x) => chars[x % chars.length]).join("");
    return `${s.slice(0, 4)}-${s.slice(4)}`;
  });
}

export const hashRecoveryCode = (code: string) =>
  createHash("sha256").update(code.toLowerCase().replace(/[^a-z0-9]/g, "")).digest("hex");

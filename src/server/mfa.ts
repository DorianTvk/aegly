import "server-only";
import { eq } from "drizzle-orm";
import QRCode from "qrcode";
import { db, schema as s } from "@/db";
import { hashRecoveryCode, otpauthUrl, verifyTotp } from "@/lib/totp";

type MfaUser = { id: string; totpSecret: string | null; totpLastStep: number | null; recoveryCodes: string[] };

/**
 * Kontrolli autentimisrakenduse koodi või varukoodi.
 * Õige koodi korral salvestatakse ajasamm (kordamise vältimiseks) või kustutatakse kasutatud varukood.
 */
export async function checkSecondFactor(user: MfaUser, input: string): Promise<"totp" | "recovery" | null> {
  if (!user.totpSecret) return null;
  const code = input.trim();
  if (/^\d[\d\s]{5,7}$/.test(code)) {
    const step = verifyTotp(user.totpSecret, code, { lastStep: user.totpLastStep });
    if (step == null) return null;
    await db.update(s.users).set({ totpLastStep: step }).where(eq(s.users.id, user.id));
    return "totp";
  }
  const h = hashRecoveryCode(code);
  if (!user.recoveryCodes.includes(h)) return null;
  await db.update(s.users).set({ recoveryCodes: user.recoveryCodes.filter((x) => x !== h) }).where(eq(s.users.id, user.id));
  return "recovery";
}

/** QR-kood SVG-na (autentimisrakendusega skannimiseks) */
export async function totpQrSvg(secret: string, email: string): Promise<string> {
  return QRCode.toString(otpauthUrl(secret, email), { type: "svg", margin: 1, width: 200, errorCorrectionLevel: "M" });
}

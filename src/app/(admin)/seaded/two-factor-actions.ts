"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { and, eq, ne } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { hashToken, requireSession, SESSION_COOKIE } from "@/lib/session";
import { verifyPassword } from "@/lib/password";
import { generateRecoveryCodes, generateTotpSecret, hashRecoveryCode, verifyTotp } from "@/lib/totp";
import { checkSecondFactor, totpQrSvg } from "@/server/mfa";
import { logActivity } from "@/server/audit";

export type TwoFactorResult = { ok?: boolean; message?: string; qr?: string; secret?: string; codes?: string[] };

/** 1. samm: uus saladus ja QR-kood (sisse lülitub alles pärast koodi kinnitamist) */
export async function startTwoFactor(): Promise<TwoFactorResult> {
  const { user } = await requireSession();
  if (user.totpEnabledAt) return { message: "Kaheastmeline sisselogimine on juba sees." };
  const secret = generateTotpSecret();
  await db.update(s.users).set({ totpSecret: secret }).where(eq(s.users.id, user.id));
  return { ok: true, secret, qr: await totpQrSvg(secret, user.email) };
}

/** 2. samm: kasutaja sisestab rakenduse koodi → sisse lülitatud, näidatakse varukoode (ainult üks kord) */
export async function confirmTwoFactor(code: string): Promise<TwoFactorResult> {
  const { user } = await requireSession();
  if (user.totpEnabledAt) return { message: "Kaheastmeline sisselogimine on juba sees." };
  if (!user.totpSecret) return { message: "Alusta uuesti." };
  const step = verifyTotp(user.totpSecret, code);
  if (step == null) return { message: "Kood ei sobi. Kontrolli, et telefoni kell oleks õige, ja proovi uue koodiga." };
  const codes = generateRecoveryCodes();
  await db
    .update(s.users)
    .set({ totpEnabledAt: new Date(), totpLastStep: step, recoveryCodes: codes.map(hashRecoveryCode) })
    .where(eq(s.users.id, user.id));
  // muud seadmed peavad uuesti sisse logima (nüüd juba koodiga)
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  await db.delete(s.sessions).where(and(eq(s.sessions.userId, user.id), token ? ne(s.sessions.id, hashToken(token)) : undefined));
  await logActivity({ action: "security.2fa_enabled", summary: "Lülitas sisse kaheastmelise sisselogimise" });
  revalidatePath("/seaded");
  return { ok: true, codes };
}

/** Välja lülitamine: nõuab parooli ja koodi (või varukoodi) */
export async function disableTwoFactor(input: { password: string; code: string }): Promise<TwoFactorResult> {
  const { user } = await requireSession();
  if (!user.totpEnabledAt) return { ok: true };
  if (!(await verifyPassword(input.password, user.passwordHash))) return { message: "Vale parool." };
  if (!(await checkSecondFactor(user, input.code))) return { message: "Vale kood." };
  await db
    .update(s.users)
    .set({ totpSecret: null, totpEnabledAt: null, totpLastStep: null, recoveryCodes: [] })
    .where(eq(s.users.id, user.id));
  await logActivity({ action: "security.2fa_disabled", summary: "Lülitas välja kaheastmelise sisselogimise" });
  revalidatePath("/seaded");
  return { ok: true };
}

/** Uued varukoodid (vanad kaotavad kehtivuse) */
export async function newRecoveryCodes(code: string): Promise<TwoFactorResult> {
  const { user } = await requireSession();
  if (!user.totpEnabledAt || !user.totpSecret) return { message: "Kaheastmeline sisselogimine pole sees." };
  if ((await checkSecondFactor(user, code)) !== "totp") return { message: "Sisesta autentimisrakenduse praegune kood." };
  const codes = generateRecoveryCodes();
  await db.update(s.users).set({ recoveryCodes: codes.map(hashRecoveryCode) }).where(eq(s.users.id, user.id));
  revalidatePath("/seaded");
  return { ok: true, codes };
}

/** Logi välja kõigist teistest seadmetest */
export async function signOutOtherDevices(): Promise<TwoFactorResult> {
  const { user } = await requireSession();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  await db.delete(s.sessions).where(and(eq(s.sessions.userId, user.id), token ? ne(s.sessions.id, hashToken(token)) : undefined));
  await logActivity({ action: "security.sessions_revoked", summary: "Logis välja kõigist teistest seadmetest" });
  revalidatePath("/seaded");
  return { ok: true, message: "Teised seadmed logiti välja." };
}

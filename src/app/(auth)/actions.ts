"use server";

import { logActivity } from "@/server/audit";
import { reportError } from "@/lib/report";

import { billingEnabled, subscriptionCheckout } from "@/server/billing";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { appUrl } from "@/lib/app-url";
import { createToken, findToken, markUsed, sendAccountEmail, sendVerifyEmail } from "@/server/auth-tokens";
import { z } from "zod";
import { hashPassword, verifyPassword } from "@/lib/password";
import { completeMfa, createSession, destroySession, readPendingMfa } from "@/lib/session";
import { checkSecondFactor } from "@/server/mfa";
import { createBusinessWithOwner, findUserByEmail } from "@/server/business";
import type { FormState } from "@/components/ui/form";
import { parsePeriod, parsePlan } from "@/lib/plans";
import { clientIp, isHoneypotFilled, isLoginBlocked, isRegisterBlocked, recentAttempts, recordAttempt, verifyTurnstile } from "@/server/bot-protection";

const BOT_MESSAGE = "Turvakontroll ebaõnnestus. Värskenda lehte ja proovi uuesti.";

const loginSchema = z.object({
  email: z.email("Sisesta kehtiv e-posti aadress").transform((v) => v.toLowerCase().trim()),
  password: z.string().min(1, "Sisesta parool"),
  next: z.string().optional(),
});

const registerSchema = z.object({
  businessName: z.string().trim().min(2, "Ettevõtte nimi on liiga lühike").max(80),
  industry: z.string().max(20).optional(),
  ownerName: z.string().trim().min(2, "Sisesta oma nimi").max(80),
  email: z.email("Sisesta kehtiv e-posti aadress").transform((v) => v.toLowerCase().trim()),
  password: z.string().min(8, "Parool peab olema vähemalt 8 märki"),
  terms: z.literal("on", { error: "Nõustu tingimustega" }),
});

/** Ainult sisemised teed, et vältida avatud ümbersuunamist */
/** Ainult oma lehe suhteline aadress: "/x", mitte "//x", "/\\x" ega juhtmärgid (avatud ümbersuunamise kaitse) */
const safeNext = (next?: string) => (next && /^\/(?![\/\\])[^\s\\]*$/.test(next) ? next : "/toolaud");

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };
  const ip = await clientIp();
  if (isHoneypotFilled(formData)) return { message: "Vale e-post või parool." };
  if (await isLoginBlocked(ip, parsed.data.email)) {
    return { message: "Liiga palju ebaõnnestunud katseid. Proovi 15 minuti pärast uuesti." };
  }
  if (!(await verifyTurnstile(formData.get("cf-turnstile-response"), ip))) return { message: BOT_MESSAGE };

  const user = await findUserByEmail(parsed.data.email);
  const ok = await verifyPassword(parsed.data.password, user?.passwordHash);
  await recordAttempt("LOGIN", ip, parsed.data.email, !!user && ok);
  if (!user || !ok) return { message: "Vale e-post või parool." };

  return startSession(user, parsed.data.next);
}

/** Loo sessioon; kui kasutajal on kaheastmeline sisselogimine, küsitakse enne veel koodi */
async function startSession(user: { id: string; name: string; email: string; businessId: string; totpEnabledAt: Date | null }, next?: string): Promise<never> {
  if (user.totpEnabledAt) {
    await createSession(user.id, { mfaPending: true });
    const n = safeNext(next);
    redirect(n === "/toolaud" ? "/logi-sisse/kood" : `/logi-sisse/kood?next=${encodeURIComponent(n)}`);
  }
  await createSession(user.id);
  await logActivity({ action: "security.login", summary: "Logis sisse", businessId: user.businessId, actor: { name: user.name, email: user.email, userId: user.id } });
  redirect(safeNext(next));
}

/** Kaheastmelise sisselogimise kood (autentimisrakendusest või varukood) */
export async function verifyLoginCode(_prev: FormState, formData: FormData): Promise<FormState> {
  const pending = await readPendingMfa();
  if (!pending) redirect("/logi-sisse");
  const code = String(formData.get("code") ?? "");
  const ip = await clientIp();
  // 5 valet koodi 15 minuti jooksul → ootamine (6-kohalist koodi ei saa läbi proovida)
  const failed = await recentAttempts("MFA_FAIL", { email: pending.user.email }, 15);
  if (failed >= 5) return { message: "Liiga palju valesid koode. Proovi 15 minuti pärast uuesti." };
  const ok = await checkSecondFactor(pending.user, code);
  if (!ok) {
    await recordAttempt("MFA_FAIL", ip, pending.user.email, false);
    return { errors: { code: ["Vale kood. Proovi uuesti."] } };
  }
  await recordAttempt("LOGIN", ip, pending.user.email, true);
  await completeMfa(pending);
  const u = pending.user;
  await logActivity({ action: "security.login", summary: ok === "recovery" ? "Logis sisse varukoodiga" : "Logis sisse (kaheastmeline)", businessId: u.businessId, actor: { name: u.name, email: u.email, userId: u.id } });
  redirect(safeNext(String(formData.get("next") ?? "")));
}

export async function register(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };
  const ip = await clientIp();
  if (isHoneypotFilled(formData)) return { message: BOT_MESSAGE };
  if (await isRegisterBlocked(ip)) return { message: "Sellelt võrgult on loodud liiga palju kontosid. Proovi tunni aja pärast uuesti." };
  if (!(await verifyTurnstile(formData.get("cf-turnstile-response"), ip))) return { message: BOT_MESSAGE };

  if (await findUserByEmail(parsed.data.email)) {
    return { errors: { email: ["Selle e-postiga konto on juba olemas. Logi sisse."] } };
  }

  const { user, business } = await createBusinessWithOwner({
    businessName: parsed.data.businessName,
    ownerName: parsed.data.ownerName,
    email: parsed.data.email,
    passwordHash: await hashPassword(parsed.data.password),
    plan: parsePlan(formData.get("plan")),
    billingPeriod: parsePeriod(formData.get("period")),
    industry: parsed.data.industry,
    // tasuta perioodi pole: pakett aktiveerub pärast esimest makset
    planStatus: billingEnabled() ? "PENDING" : "ACTIVE",
  });
  await recordAttempt("REGISTER", ip, parsed.data.email, true);
  const base = await appUrl();
  after(() => sendVerifyEmail(user, base));
  await createSession(user.id);
  if (billingEnabled()) {
    // tasuta perioodi pole: kohe Stripe'i makselehele, pärast makset töölauale
    let url = "/aktiveeri";
    try {
      url = await subscriptionCheckout(business.id, business.plan, business.billingPeriod, base, "/aktiveeri");
    } catch (e) {
      reportError("billing register checkout", e);
    }
    redirect(url);
  }
  redirect("/toolaud");
}

export async function logout() {
  await destroySession();
  redirect("/logi-sisse");
}

// ---------- Parooli taastamine ----------

const RESET_SENT = "Kui see e-post on Aeglys kasutusel, saatsime sinna lingi parooli muutmiseks. Link kehtib 1 tunni.";

export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z.object({ email: z.email("Sisesta kehtiv e-posti aadress").transform((v) => v.toLowerCase().trim()) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };
  const ip = await clientIp();
  if (isHoneypotFilled(formData)) return { ok: true, message: RESET_SENT };
  if (!(await verifyTurnstile(formData.get("cf-turnstile-response"), ip))) return { message: BOT_MESSAGE };
  const email = parsed.data.email;
  // piirang: 3 kirja e-postile ja 10 IP-lt tunnis; vastus on alati sama, et ei saaks kontrollida, kas konto on olemas
  if ((await recentAttempts("RESET", { email }, 60)) >= 3 || (ip !== "unknown" && (await recentAttempts("RESET", { ip }, 60)) >= 10)) {
    return { ok: true, message: RESET_SENT };
  }
  await recordAttempt("RESET", ip, email, true);
  const user = await findUserByEmail(email);
  if (user) {
    const token = await createToken("RESET", { email, userId: user.id, businessId: user.businessId });
    const base = await appUrl();
    after(() =>
      sendAccountEmail({
        businessId: user.businessId, to: email, kind: "ACCOUNT_RESET", subject: "Parooli muutmine – Aegly",
        preheader: "Määra oma Aegly kontole uus parool.",
        heading: "Määra uus parool",
        greeting: `Tere, ${user.name.split(" ")[0]}!`,
        intro: "Saime palve sinu Aegly konto parooli muutmiseks. Uue parooli saad määrata alloleva nupu kaudu.",
        cta: { label: "Määra uus parool", url: `${base}/parool/uus?token=${token}` },
        note: "Link kehtib 1 tunni. Kui sa ei palunud parooli muuta, võid selle kirja kustutada – sinu parool jääb samaks.",
      }),
    );
  }
  return { ok: true, message: RESET_SENT };
}

export async function resetPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({ token: z.string(), password: z.string().min(8, "Parool peab olema vähemalt 8 märki"), password2: z.string() })
    .refine((d) => d.password === d.password2, { message: "Paroolid ei kattu", path: ["password2"] })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };
  const row = await findToken(parsed.data.token, "RESET");
  if (!row?.userId) return { message: "Link on aegunud või juba kasutatud. Küsi uus link." };
  await markUsed(parsed.data.token);
  await db.update(s.users).set({ passwordHash: await hashPassword(parsed.data.password), emailVerifiedAt: new Date() }).where(eq(s.users.id, row.userId));
  // kõik vanad sessioonid (ka võimaliku ründaja oma) lõpetatakse
  await db.delete(s.sessions).where(eq(s.sessions.userId, row.userId));
  // parooli taastamine e-postiga ei lase kaheastmelisest sisselogimisest mööda
  const u = await db.query.users.findFirst({ where: eq(s.users.id, row.userId), columns: { id: true, name: true, email: true, businessId: true, totpEnabledAt: true } });
  return startSession(u!);
}

// ---------- Kutse vastuvõtmine ----------

export async function acceptInvite(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({
      token: z.string(),
      name: z.string().trim().min(2, "Sisesta oma nimi").max(80),
      password: z.string().min(8, "Parool peab olema vähemalt 8 märki"),
      password2: z.string(),
    })
    .refine((d) => d.password === d.password2, { message: "Paroolid ei kattu", path: ["password2"] })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };
  const row = await findToken(parsed.data.token, "INVITE");
  const inv = row?.data;
  if (!row || !inv) return { message: "Kutse on aegunud või juba kasutatud. Palu konto omanikul saata uus kutse." };
  if (await findUserByEmail(inv.email)) return { message: "Selle e-postiga konto on juba olemas. Logi sisse." };
  await markUsed(parsed.data.token);
  const [user] = await db
    .insert(s.users)
    .values({
      businessId: inv.businessId, email: inv.email, name: parsed.data.name, role: inv.role, staffId: inv.staffId,
      passwordHash: await hashPassword(parsed.data.password), emailVerifiedAt: new Date(),
    })
    .returning({ id: s.users.id });
  await createSession(user.id);
  redirect("/toolaud");
}

"use server";

import { billingEnabled, subscriptionCheckout } from "@/server/billing";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { appUrl } from "@/lib/app-url";
import { createToken, findToken, markUsed, sendAccountEmail, sendVerifyEmail } from "@/server/auth-tokens";
import { z } from "zod";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createSession, destroySession } from "@/lib/session";
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
  businessName: z.string().trim().min(2, "Salongi nimi on liiga lühike").max(80),
  ownerName: z.string().trim().min(2, "Sisesta oma nimi").max(80),
  email: z.email("Sisesta kehtiv e-posti aadress").transform((v) => v.toLowerCase().trim()),
  password: z.string().min(8, "Parool peab olema vähemalt 8 märki"),
  terms: z.literal("on", { error: "Nõustu tingimustega" }),
});

/** Ainult sisemised teed, et vältida avatud ümbersuunamist */
const safeNext = (next?: string) => (next && next.startsWith("/") && !next.startsWith("//") ? next : "/toolaud");

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

  await createSession(user.id);
  redirect(safeNext(parsed.data.next));
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
      console.error("[billing] register checkout", e);
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
        text: `Tere ${user.name.split(" ")[0]}!\n\nKeegi (loodetavasti sina) palus Aegly konto parooli muuta. Uue parooli saad määrata siin:\n${base}/parool/uus?token=${token}\n\nLink kehtib 1 tunni. Kui sa ei palunud parooli muuta, võid selle kirja kustutada – parool jääb samaks.\n\nAegly`,
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
  await createSession(row.userId);
  redirect("/toolaud");
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
  if (!row || !inv) return { message: "Kutse on aegunud või juba kasutatud. Palu salongil saata uus kutse." };
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

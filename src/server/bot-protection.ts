import "server-only";
import { and, count, eq, gte, lt } from "drizzle-orm";
import { headers } from "next/headers";
import { db, schema as s } from "@/db";

/**
 * Sisselogimise ja registreerumise kaitse robotite eest:
 * 1) Cloudflare Turnstile (kui TURNSTILE_SECRET_KEY on seadistatud)
 * 2) katsete piiramine IP ja e-posti järgi
 * 3) peidetud lõksuväli (honeypot)
 */

export const LIMITS = {
  /** ebaõnnestunud sisselogimised ühele e-postile 15 min jooksul */
  loginPerEmail: 5,
  /** ebaõnnestunud sisselogimised ühelt IP-lt 15 min jooksul */
  loginPerIp: 20,
  /** uued kontod ühelt IP-lt 1 h jooksul */
  registerPerIp: 5,
};

export async function clientIp(): Promise<string> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
  // kohalik arendus (localhost) – IP-põhist piirangut ei rakendata
  return ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(ip) ? "unknown" : ip;
}

export const turnstileEnabled = () => !!process.env.TURNSTILE_SECRET_KEY && !!process.env.TURNSTILE_SITE_KEY;

/** Kontrolli Turnstile'i vastust Cloudflare'i juures. Ilma võtmeta (arendus) alati lubatud. */
export async function verifyTurnstile(token: FormDataEntryValue | null, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (typeof token !== "string" || !token) return false;
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip !== "unknown") body.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body, signal: AbortSignal.timeout(8000) });
    const json = (await res.json()) as { success?: boolean };
    return json.success === true;
  } catch {
    // Cloudflare ei vasta – ära lukusta kasutajaid välja, katsete piirang kaitseb edasi
    return true;
  }
}

/** Lõksuväli: inimene seda ei näe ega täida, robot täidab */
export const isHoneypotFilled = (formData: FormData) => String(formData.get("website") ?? "").trim() !== "";

export async function isLoginBlocked(ip: string, email: string): Promise<boolean> {
  // ilma IP-ta (kohalik arendus) piiratakse ainult e-posti järgi
  const since = new Date(Date.now() - 15 * 60_000);
  const fail = and(eq(s.authAttempts.kind, "LOGIN"), eq(s.authAttempts.success, false), gte(s.authAttempts.createdAt, since));
  const [[byEmail], [byIp]] = await Promise.all([
    db.select({ n: count() }).from(s.authAttempts).where(and(fail, eq(s.authAttempts.email, email))),
    db.select({ n: count() }).from(s.authAttempts).where(and(fail, eq(s.authAttempts.ip, ip))),
  ]);
  return byEmail.n >= LIMITS.loginPerEmail || (ip !== "unknown" && byIp.n >= LIMITS.loginPerIp);
}

export async function isRegisterBlocked(ip: string): Promise<boolean> {
  if (ip === "unknown") return false;
  const since = new Date(Date.now() - 60 * 60_000);
  const [row] = await db
    .select({ n: count() })
    .from(s.authAttempts)
    .where(and(eq(s.authAttempts.kind, "REGISTER"), eq(s.authAttempts.ip, ip), eq(s.authAttempts.success, true), gte(s.authAttempts.createdAt, since)));
  return row.n >= LIMITS.registerPerIp;
}

export async function recordAttempt(kind: "LOGIN" | "REGISTER" | "RESET" | "VERIFY_SEND", ip: string, email: string | null, success: boolean) {
  await db.insert(s.authAttempts).values({ kind, ip, email, success });
  // vanad kirjed minema (1 % tõenäosusega, et tabel ei kasvaks)
  if (Math.random() < 0.01) await db.delete(s.authAttempts).where(lt(s.authAttempts.createdAt, new Date(Date.now() - 7 * 86_400_000)));
}

/** Viimase `minutes` jooksul tehtud katsed (nt parooli taastamise kirjad) e-posti või IP järgi */
export async function recentAttempts(kind: string, by: { email?: string; ip?: string }, minutes: number): Promise<number> {
  const since = new Date(Date.now() - minutes * 60_000);
  const cond = [eq(s.authAttempts.kind, kind), gte(s.authAttempts.createdAt, since)];
  if (by.email) cond.push(eq(s.authAttempts.email, by.email));
  if (by.ip) cond.push(eq(s.authAttempts.ip, by.ip));
  const [row] = await db.select({ n: count() }).from(s.authAttempts).where(and(...cond));
  return row.n;
}

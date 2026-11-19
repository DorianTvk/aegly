import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import * as Sentry from "@sentry/nextjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { isSuperadmin } from "@/lib/plans";

export const SESSION_COOKIE = "aegly_session";
const SESSION_DAYS = 30;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(userId: string, opts: { hours?: number } = {}) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + (opts.hours ? opts.hours * 3_600_000 : SESSION_DAYS * 86_400_000));
  await db.insert(s.sessions).values({ id: hashToken(token), userId, expiresAt });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  return token;
}

/** Superadmini sessiooni tunnus salongi kontole sisenemise ajal (tagasipöördumiseks) */
export const RETURN_COOKIE = "aegly_admin_return";

export async function sessionUserByToken(token: string) {
  const row = await db.query.sessions.findFirst({ where: eq(s.sessions.id, hashToken(token)), with: { user: true } });
  return row && row.expiresAt > new Date() ? { ...row.user, sessionExpiresAt: row.expiresAt } : null;
}

export async function setSessionCookie(token: string, expires: Date) {
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(s.sessions).where(eq(s.sessions.id, hashToken(token)));
  store.delete(SESSION_COOKIE);
}

/** Kehtiv sessioon koos kasutaja ja ettevõttega või null. Ühe päringu jooksul loetakse andmebaasist üks kord (cache). */
export const readSession = cache(async function readSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = await db.query.sessions.findFirst({
    where: eq(s.sessions.id, hashToken(token)),
    with: { user: { with: { business: true } } },
  });
  if (!row || row.expiresAt < new Date()) return null;
  // vigade juures näeme, kelle kontol see juhtus (ainult id-d, mitte nimi/e-post)
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.setUser({ id: row.user.id });
    Sentry.setTag("business", row.user.business.slug);
  }
  return { user: row.user, business: row.user.business };
});

/** Kasuta igas halduspaneeli lehes ja serveri toimingus. Suunab sisselogimisele, kui sessiooni pole. */
export async function requireSession() {
  const session = await readSession();
  // aegunud/kehtetu küpsis kustutatakse route handleris (lehe renderdamise ajal küpsiseid muuta ei saa)
  if (!session) redirect("/api/auth/valja");
  // maksmata või lõppenud tellimusega halduspaneeli ei pääse (v.a platvormi haldur ja tema "logi sisse kui")
  if (needsActivation(session) && !(await cookies()).has(RETURN_COOKIE)) redirect("/aktiveeri");
  return session;
}

/** Kas ettevõte peab enne halduspaneeli kasutamist paketi eest tasuma */
export function needsActivation(session: { user: { email: string }; business: { planStatus: string } }) {
  if (!process.env.STRIPE_SECRET_KEY) return false;
  if (isSuperadmin(session.user.email)) return false;
  return session.business.planStatus === "PENDING" || session.business.planStatus === "SUSPENDED";
}

/** Nagu requireSession, aga lubab ainult antud rolle. Serveri toimingutes viskab vea, kui õigust pole. */
export async function requireRole(roles: ("OWNER" | "ADMIN" | "STAFF")[]) {
  const session = await requireSession();
  if (!roles.includes(session.user.role)) throw new Error("Sul pole selleks õigust.");
  return session;
}

export const requireManager = () => requireRole(["OWNER", "ADMIN"]);

import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";

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

/** Kehtiv sessioon koos kasutaja ja ettevõttega või null */
export async function readSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = await db.query.sessions.findFirst({
    where: eq(s.sessions.id, hashToken(token)),
    with: { user: { with: { business: true } } },
  });
  if (!row || row.expiresAt < new Date()) return null;
  return { user: row.user, business: row.user.business };
}

/** Kasuta igas halduspaneeli lehes ja serveri toimingus. Suunab sisselogimisele, kui sessiooni pole. */
export async function requireSession() {
  const session = await readSession();
  // aegunud/kehtetu küpsis kustutatakse route handleris (lehe renderdamise ajal küpsiseid muuta ei saa)
  if (!session) redirect("/api/auth/valja");
  return session;
}

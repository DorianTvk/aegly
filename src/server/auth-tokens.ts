import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db, schema as s } from "@/db";
import type { InviteData } from "@/db/schema";
import { accountEmailHtml } from "@/lib/messages";
import { sendEmail } from "./messaging";

export type TokenKind = "RESET" | "VERIFY" | "INVITE";
const TTL_HOURS: Record<TokenKind, number> = { RESET: 1, VERIFY: 72, INVITE: 168 };

const hash = (t: string) => createHash("sha256").update(t).digest("hex");

export async function createToken(kind: TokenKind, opts: { email: string; userId?: string | null; businessId?: string | null; data?: InviteData }) {
  const token = randomBytes(32).toString("base64url");
  await db.insert(s.authTokens).values({
    id: hash(token), kind, email: opts.email.toLowerCase(), userId: opts.userId ?? null, businessId: opts.businessId ?? null,
    data: opts.data ?? null, expiresAt: new Date(Date.now() + TTL_HOURS[kind] * 3_600_000),
  });
  return token;
}

/** Kehtiv (kasutamata, aegumata) token või null */
export async function findToken(token: string, kind: TokenKind) {
  if (!/^[\w-]{20,100}$/.test(token)) return null;
  return (
    (await db.query.authTokens.findFirst({
      where: and(eq(s.authTokens.id, hash(token)), eq(s.authTokens.kind, kind), isNull(s.authTokens.usedAt), gt(s.authTokens.expiresAt, new Date())),
    })) ?? null
  );
}

export async function markUsed(token: string) {
  await db.update(s.authTokens).set({ usedAt: new Date() }).where(eq(s.authTokens.id, hash(token)));
}

/** Platvormi (Aegly) kiri kasutajale: parooli taastamine, kinnitamine, kutse */
type AccountMail = { preheader: string; heading: string; greeting: string; intro: string; cta: { label: string; url: string }; note: string };

export async function sendAccountEmail(opts: { businessId: string; to: string; kind: string; subject: string } & AccountMail) {
  const text = `${opts.greeting}\n\n${opts.intro}\n\n${opts.cta.label}: ${opts.cta.url}\n\n${opts.note}\n\nAegly`;
  await sendEmail({
    businessId: opts.businessId, kind: opts.kind, to: opts.to, subject: opts.subject, text,
    html: accountEmailHtml(opts),
    fromName: "Aegly",
  });
}

export async function sendVerifyEmail(user: { id: string; email: string; name: string; businessId: string }, baseUrl: string) {
  const token = await createToken("VERIFY", { email: user.email, userId: user.id, businessId: user.businessId });
  await sendAccountEmail({
    businessId: user.businessId, to: user.email, kind: "ACCOUNT_VERIFY",
    subject: "Kinnita oma e-posti aadress – Aegly",
    preheader: "Üks klõps ja sinu Aegly konto on kinnitatud.",
    heading: "Kinnita oma e-posti aadress",
    greeting: `Tere, ${user.name.split(" ")[0]}!`,
    intro: "Aitäh, et lõid Aegly konto. Vajuta allolevat nuppu, et kinnitada, et see e-posti aadress kuulub sulle.",
    cta: { label: "Kinnita e-post", url: `${baseUrl}/kinnita?token=${token}` },
    note: "Link kehtib 3 päeva. Kui sa ei loonud Aegly kontot, võid selle kirja lihtsalt kustutada.",
  });
}

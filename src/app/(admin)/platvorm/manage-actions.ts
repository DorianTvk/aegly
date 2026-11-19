"use server";

import { cancelSubscriptionNow } from "@/server/billing";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, schema as s } from "@/db";
import { hashPassword } from "@/lib/password";
import { isSuperadmin } from "@/lib/plans";
import { createSession, destroySession, readSession, requireSession, RETURN_COOKIE, sessionUserByToken, setSessionCookie, SESSION_COOKIE } from "@/lib/session";
import type { FormState } from "@/components/ui/form";

async function requireSuperadmin() {
  const session = await requireSession();
  if (!isSuperadmin(session.user.email)) throw new Error("Puudub ligipääs");
  return session;
}

const IMPERSONATE_HOURS = 2;

/** Sisene salongi kontole omanikuna (tugi ja seadistamine). Oma sessioon jääb alles tagasipöördumiseks. */
export async function impersonate(businessId: string) {
  await requireSuperadmin();
  const store = await cookies();
  const own = store.get(SESSION_COOKIE)?.value;
  const owner = await db.query.users.findFirst({ where: and(eq(s.users.businessId, businessId), eq(s.users.role, "OWNER")) });
  if (!owner || !own) return;
  store.set(RETURN_COOKIE, own, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/",
    expires: new Date(Date.now() + IMPERSONATE_HOURS * 3_600_000),
  });
  await createSession(owner.id, { hours: IMPERSONATE_HOURS });
  redirect("/toolaud");
}

/** Lõpeta salongi kontol olemine ja naase oma kontole */
export async function stopImpersonation() {
  const store = await cookies();
  const back = store.get(RETURN_COOKIE)?.value;
  await destroySession();
  store.delete(RETURN_COOKIE);
  const admin = back ? await sessionUserByToken(back) : null;
  if (!back || !admin || !isSuperadmin(admin.email)) redirect("/logi-sisse");
  await setSessionCookie(back, admin.sessionExpiresAt);
  redirect("/platvorm");
}

export async function isImpersonating(): Promise<{ businessName: string } | null> {
  const store = await cookies();
  if (!store.get(RETURN_COOKIE)) return null;
  const session = await readSession();
  return session ? { businessName: session.business.name } : null;
}

const editSchema = z.object({
  name: z.string().trim().min(2, "Nimi on liiga lühike").max(80),
  email: z.union([z.literal(""), z.email("Vigane e-post")]),
  phone: z.string().trim().max(30),
});

export async function updateBusiness(businessId: string, input: z.input<typeof editSchema>): Promise<FormState> {
  await requireSuperadmin();
  const p = editSchema.safeParse(input);
  if (!p.success) return { message: p.error.issues[0]?.message ?? "Kontrolli välju" };
  await db.update(s.businesses).set({ name: p.data.name, email: p.data.email || null, phone: p.data.phone || null }).where(eq(s.businesses.id, businessId));
  revalidatePath(`/platvorm/${businessId}`);
  return { ok: true, message: "Salvestatud." };
}

/** Uus ajutine parool kasutajale; kõik tema sessioonid lõpetatakse */
export async function resetUserPassword(userId: string): Promise<{ ok: true; password: string } | { ok: false; message: string }> {
  await requireSuperadmin();
  const user = await db.query.users.findFirst({ where: eq(s.users.id, userId) });
  if (!user) return { ok: false, message: "Kasutajat ei leitud" };
  if (isSuperadmin(user.email)) return { ok: false, message: "Platvormi halduri parooli siit muuta ei saa." };
  const password = randomBytes(9).toString("base64url");
  await db.update(s.users).set({ passwordHash: await hashPassword(password) }).where(eq(s.users.id, userId));
  await db.delete(s.sessions).where(eq(s.sessions.userId, userId));
  return { ok: true, password };
}

/** Kustuta salong koos kõigi andmetega. Kinnituseks tuleb sisestada salongi lühinimi (slug). */
export async function deleteBusiness(businessId: string, confirmSlug: string): Promise<FormState> {
  const { business: own } = await requireSuperadmin();
  const b = await db.query.businesses.findFirst({ where: eq(s.businesses.id, businessId) });
  if (!b) return { message: "Salongi ei leitud" };
  if (b.id === own.id) return { message: "Oma salongi siit kustutada ei saa." };
  if (confirmSlug.trim() !== b.slug) return { message: `Kinnitamiseks sisesta täpselt: ${b.slug}` };
  await cancelSubscriptionNow(b.stripeSubscriptionId);
  await db.delete(s.businesses).where(eq(s.businesses.id, businessId));
  revalidatePath("/platvorm");
  redirect("/platvorm");
}

/** Mitme salongi kustutamine korraga. Oma salongi ja platvormi haldurite salonge ei kustutata. */
export async function deleteBusinesses(ids: string[], confirmWord: string): Promise<{ ok: boolean; message: string }> {
  const { business: own } = await requireSuperadmin();
  if (confirmWord.trim() !== "KUSTUTA") return { ok: false, message: "Kinnitamiseks kirjuta KUSTUTA" };
  const unique = [...new Set(ids)].filter((id) => typeof id === "string" && id !== own.id).slice(0, 500);
  if (!unique.length) return { ok: false, message: "Ühtegi salongi pole valitud" };
  const owners = await db.query.users.findMany({ where: inArray(s.users.businessId, unique) });
  const protectedIds = new Set(owners.filter((u) => isSuperadmin(u.email)).map((u) => u.businessId));
  const toDelete = unique.filter((id) => !protectedIds.has(id));
  if (!toDelete.length) return { ok: false, message: "Valitud salonge ei saa kustutada (platvormi halduri salong)." };
  const subs = await db.select({ sub: s.businesses.stripeSubscriptionId }).from(s.businesses).where(inArray(s.businesses.id, toDelete));
  await Promise.all(subs.map((x) => cancelSubscriptionNow(x.sub)));
  const deleted = await db.delete(s.businesses).where(inArray(s.businesses.id, toDelete)).returning({ id: s.businesses.id });
  revalidatePath("/platvorm");
  const skipped = unique.length - deleted.length;
  return { ok: true, message: `Kustutatud ${deleted.length} salongi.${skipped ? ` ${skipped} jäeti vahele (kaitstud).` : ""}` };
}

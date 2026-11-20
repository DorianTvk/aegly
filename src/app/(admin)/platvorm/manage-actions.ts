"use server";

import { logActivity } from "@/server/audit";
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
  const { user: admin } = await requireSuperadmin();
  const store = await cookies();
  const own = store.get(SESSION_COOKIE)?.value;
  const owner = await db.query.users.findFirst({ where: and(eq(s.users.businessId, businessId), eq(s.users.role, "OWNER")) });
  if (!owner || !own) return;
  store.set(RETURN_COOKIE, own, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/",
    expires: new Date(Date.now() + IMPERSONATE_HOURS * 3_600_000),
  });
  // nähtav ka ettevõtte enda tegevuste logis (läbipaistvus)
  await logActivity({ action: "support.impersonation_started", summary: "Aegly tugi sisenes kontole (kliendi vaade)", businessId, actor: { name: "Aegly tugi", email: admin.email, userId: null } });
  await createSession(owner.id, { hours: IMPERSONATE_HOURS });
  redirect("/toolaud");
}

/** Lõpeta salongi kontol olemine ja naase oma kontole */
export async function stopImpersonation() {
  const store = await cookies();
  const back = store.get(RETURN_COOKIE)?.value;
  const current = await readSession();
  if (current) await logActivity({ action: "support.impersonation_ended", summary: "Aegly tugi lahkus kontolt" });
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
  const { user: admin } = await requireSuperadmin();
  const p = editSchema.safeParse(input);
  if (!p.success) return { message: p.error.issues[0]?.message ?? "Kontrolli välju" };
  await db.update(s.businesses).set({ name: p.data.name, email: p.data.email || null, phone: p.data.phone || null }).where(eq(s.businesses.id, businessId));
  await logActivity({ action: "support.business_updated", summary: "Aegly tugi muutis ettevõtte kontaktandmeid", businessId, actor: { name: "Aegly tugi", email: admin.email } });
  revalidatePath(`/platvorm/${businessId}`);
  return { ok: true, message: "Salvestatud." };
}

/** Uus ajutine parool kasutajale; kõik tema sessioonid lõpetatakse */
export async function resetUserPassword(userId: string): Promise<{ ok: true; password: string } | { ok: false; message: string }> {
  const { user: admin } = await requireSuperadmin();
  const user = await db.query.users.findFirst({ where: eq(s.users.id, userId) });
  if (!user) return { ok: false, message: "Kasutajat ei leitud" };
  if (isSuperadmin(user.email)) return { ok: false, message: "Platvormi halduri parooli siit muuta ei saa." };
  const password = randomBytes(9).toString("base64url");
  await db.update(s.users).set({ passwordHash: await hashPassword(password) }).where(eq(s.users.id, userId));
  await db.delete(s.sessions).where(eq(s.sessions.userId, userId));
  await logActivity({ action: "support.password_reset", summary: `Aegly tugi määras kasutajale ${user.name} ajutise parooli`, businessId: user.businessId, actor: { name: "Aegly tugi", email: admin.email } });
  return { ok: true, password };
}

/** Kustuta salong koos kõigi andmetega. Kinnituseks tuleb sisestada salongi lühinimi (slug). */
export async function deleteBusiness(businessId: string, confirmSlug: string): Promise<FormState> {
  const { business: own } = await requireSuperadmin();
  const b = await db.query.businesses.findFirst({ where: eq(s.businesses.id, businessId) });
  if (!b) return { message: "Klienti ei leitud" };
  if (b.id === own.id) return { message: "Oma kontot siit kustutada ei saa." };
  if (confirmSlug.trim() !== b.slug) return { message: `Kinnitamiseks sisesta täpselt: ${b.slug}` };
  await cancelSubscriptionNow(b.stripeSubscriptionId);
  await logActivity({ action: "platform.business_deleted", summary: `Kustutas kliendi ${b.name} (${b.slug})`, businessId: null });
  await db.delete(s.businesses).where(eq(s.businesses.id, businessId));
  revalidatePath("/platvorm");
  redirect("/platvorm");
}

/** Mitme salongi kustutamine korraga. Oma salongi ja platvormi haldurite salonge ei kustutata. */
export async function deleteBusinesses(ids: string[], confirmWord: string): Promise<{ ok: boolean; message: string }> {
  const { business: own } = await requireSuperadmin();
  if (confirmWord.trim() !== "KUSTUTA") return { ok: false, message: "Kinnitamiseks kirjuta KUSTUTA" };
  const unique = [...new Set(ids)].filter((id) => typeof id === "string" && id !== own.id).slice(0, 500);
  if (!unique.length) return { ok: false, message: "Ühtegi klienti pole valitud" };
  const owners = await db.query.users.findMany({ where: inArray(s.users.businessId, unique) });
  const protectedIds = new Set(owners.filter((u) => isSuperadmin(u.email)).map((u) => u.businessId));
  const toDelete = unique.filter((id) => !protectedIds.has(id));
  if (!toDelete.length) return { ok: false, message: "Valitud kliente ei saa kustutada (platvormi halduri konto)." };
  const subs = await db.select({ sub: s.businesses.stripeSubscriptionId }).from(s.businesses).where(inArray(s.businesses.id, toDelete));
  await Promise.all(subs.map((x) => cancelSubscriptionNow(x.sub)));
  const deleted = await db.delete(s.businesses).where(inArray(s.businesses.id, toDelete)).returning({ id: s.businesses.id, name: s.businesses.name });
  await logActivity({ action: "platform.business_deleted", summary: `Kustutas ${deleted.length} klienti: ${deleted.map((d) => d.name).join(", ")}`, businessId: null });
  revalidatePath("/platvorm");
  const skipped = unique.length - deleted.length;
  return { ok: true, message: `Kustutatud ${deleted.length} klienti.${skipped ? ` ${skipped} jäeti vahele (kaitstud).` : ""}` };
}

"use server";

import { logActivity } from "@/server/audit";
import { reportError } from "@/lib/report";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNull, ne } from "drizzle-orm";
import { z } from "zod";
import { db, schema as s } from "@/db";
import { requireManager, requireSession, destroySession, hashToken, SESSION_COOKIE } from "@/lib/session";
import { cookies } from "next/headers";
import { after } from "next/server";
import { appUrl } from "@/lib/app-url";
import { manageableRoles } from "@/lib/permissions";
import { createToken, sendAccountEmail } from "@/server/auth-tokens";
import { hashPassword, verifyPassword } from "@/lib/password";
import { validateNewPassword } from "@/server/pwned";
import type { FormState } from "@/components/ui/form";

export async function changePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user, business } = await requireSession();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  if (!(await verifyPassword(current, user.passwordHash))) return { errors: { current: ["Vale parool"] } };
  if (next === current) return { errors: { next: ["Uus parool peab erinema praegusest"] } };
  const pwError = await validateNewPassword(next, { email: user.email, name: user.name, business: business.name });
  if (pwError) return { errors: { next: [pwError] } };
  await db.update(s.users).set({ passwordHash: await hashPassword(next) }).where(eq(s.users.id, user.id));
  // logi välja teistest seadmetest (praegune sessioon jääb)
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  await db.delete(s.sessions).where(and(eq(s.sessions.userId, user.id), token ? ne(s.sessions.id, hashToken(token)) : undefined));
  await logActivity({ action: "security.password_changed", summary: "Muutis oma parooli" });
  return { ok: true, message: "Parool muudetud. Teised seadmed logiti välja." };
}

export async function updateAccount(input: { name: string }): Promise<FormState> {
  const { user } = await requireSession();
  const name = input.name.trim();
  if (name.length < 2) return { message: "Sisesta nimi" };
  await db.update(s.users).set({ name }).where(eq(s.users.id, user.id));
  revalidatePath("/seaded");
  return { ok: true, message: "Salvestatud." };
}

const inviteSchema = z.object({
  name: z.string().trim().min(2, "Sisesta nimi").max(80),
  email: z.email("Vigane e-post").transform((v) => v.toLowerCase().trim()),
  role: z.enum(["ADMIN", "STAFF"]),
  staffId: z.string().nullable(),
});

/** Kutse e-postiga: kasutaja määrab ise parooli lingi kaudu (kehtib 7 päeva) */
export async function inviteUser(input: z.input<typeof inviteSchema>): Promise<FormState> {
  const { business, user } = await requireManager();
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return { message: parsed.error.issues[0]?.message };
  const d = parsed.data;
  if (!manageableRoles(user.role).includes(d.role)) return { message: "Sul pole õigust seda rolli anda." };
  if (await db.query.users.findFirst({ where: eq(s.users.email, d.email) })) return { message: "Selle e-postiga Aegly kasutaja on juba olemas." };
  if (d.staffId) {
    const st = await db.query.staffMembers.findFirst({ where: and(eq(s.staffMembers.id, d.staffId), eq(s.staffMembers.businessId, business.id)) });
    if (!st) return { message: "Töötajat ei leitud" };
  }
  // vana kutse samale e-postile tühistatakse
  await db.update(s.authTokens).set({ usedAt: new Date() }).where(and(eq(s.authTokens.kind, "INVITE"), eq(s.authTokens.email, d.email), isNull(s.authTokens.usedAt)));
  const token = await createToken("INVITE", {
    email: d.email, businessId: business.id,
    data: { businessId: business.id, email: d.email, name: d.name, role: d.role, staffId: d.role === "STAFF" ? d.staffId : null, invitedBy: user.name },
  });
  await logActivity({ action: "user.invited", summary: `Kutsus ${d.name} (${d.email}) ${d.role === "ADMIN" ? "administraatoriks" : "töötajaks"}` });
  const base = await appUrl();
  after(() =>
    sendAccountEmail({
      businessId: business.id, to: d.email, kind: "ACCOUNT_INVITE",
      subject: `${user.name} kutsub sind Aeglysse – ${business.name}`,
      preheader: `${user.name} lisas sind ettevõtte ${business.name} meeskonda.`,
      heading: `Liitu ettevõttega ${business.name}`,
      greeting: `Tere, ${d.name.split(" ")[0]}!`,
      intro: `${user.name} kutsub sind ettevõtte ${business.name} Aegly kontole ${d.role === "ADMIN" ? "administraatorina" : "töötajana"}. Loo endale parool ja oledki sees.`,
      cta: { label: "Võta kutse vastu", url: `${base}/kutse?token=${token}` },
      note: "Kutse kehtib 7 päeva. Kui sa ei oodanud seda kutset, võid kirja kustutada.",
    }),
  );
  revalidatePath("/seaded");
  return { ok: true, message: `Kutse saadetud aadressile ${d.email}.` };
}

export async function cancelInvite(email: string) {
  const { business } = await requireManager();
  await db
    .update(s.authTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(s.authTokens.kind, "INVITE"), eq(s.authTokens.businessId, business.id), eq(s.authTokens.email, email), isNull(s.authTokens.usedAt)));
  await logActivity({ action: "user.invite_cancelled", summary: `Tühistas kutse: ${email}` });
  revalidatePath("/seaded");
}

async function targetUser(businessId: string, userId: string) {
  return db.query.users.findFirst({ where: and(eq(s.users.id, userId), eq(s.users.businessId, businessId), ne(s.users.role, "OWNER")) });
}

export async function setUserRole(userId: string, role: "ADMIN" | "STAFF") {
  const { business, user } = await requireSession();
  if (user.role !== "OWNER" || userId === user.id) return;
  const target = await targetUser(business.id, userId);
  if (!target) return;
  await logActivity({ action: "user.role", summary: `Muutis kasutaja ${target.name} rolliks ${role === "ADMIN" ? "administraator" : "töötaja"}`, target: { type: "user", id: userId } });
  await db.update(s.users).set({ role, ...(role === "ADMIN" ? { staffId: null } : {}) }).where(and(eq(s.users.id, userId), eq(s.users.businessId, business.id), ne(s.users.role, "OWNER")));
  revalidatePath("/seaded");
}

/** Seo töötaja-kasutaja töötaja profiiliga (määrab, kelle kalendrit ta näeb) */
export async function linkStaff(userId: string, staffId: string | null) {
  const { business, user } = await requireManager();
  const target = await targetUser(business.id, userId);
  if (!target || !manageableRoles(user.role).includes(target.role as "ADMIN" | "STAFF")) return;
  if (staffId && !(await db.query.staffMembers.findFirst({ where: and(eq(s.staffMembers.id, staffId), eq(s.staffMembers.businessId, business.id)) }))) return;
  await db.update(s.users).set({ staffId }).where(eq(s.users.id, userId));
  revalidatePath("/seaded");
}

export async function removeUser(userId: string) {
  const { business, user } = await requireManager();
  if (userId === user.id) return;
  const target = await targetUser(business.id, userId);
  if (!target || !manageableRoles(user.role).includes(target.role as "ADMIN" | "STAFF")) return;
  await db.delete(s.users).where(eq(s.users.id, userId));
  await logActivity({ action: "user.removed", summary: `Eemaldas kasutaja ${target.name} (${target.email})` });
  revalidatePath("/seaded");
}

export async function saveProtection(input: { noShowProtection: boolean; noShowThreshold: number }): Promise<FormState> {
  const { business } = await requireManager();
  if (![1, 2, 3, 5].includes(input.noShowThreshold)) return { message: "Vigane piir" };
  await db.update(s.businesses).set(input).where(eq(s.businesses.id, business.id));
  await logActivity({ action: "settings.protection", summary: input.noShowProtection ? `Lülitas sisse mitteilmumise kaitse (piir ${input.noShowThreshold})` : "Lülitas välja mitteilmumise kaitse" });
  revalidatePath("/seaded");
  return { ok: true, message: "Salvestatud." };
}

/** Konto kustutamine: ainult omanik, kinnitus ettevõtte nimega. Kustutab kõik andmed. */
export async function deleteBusiness(confirmName: string): Promise<FormState> {
  const { business, user } = await requireSession();
  if (user.role !== "OWNER") return { message: "Kontot saab kustutada ainult omanik" };
  if (confirmName.trim() !== business.name) return { message: "Nimi ei ühti" };
  // ettevõtte logi kustub koos ettevõttega → kirje jääb platvormi logisse
  await logActivity({ action: "business.deleted", summary: `Kustutas ettevõtte ${business.name} konto (${business.slug})`, businessId: null });
  await destroySession();
  await db.delete(s.businesses).where(eq(s.businesses.id, business.id));
  redirect("/registreeru");
}

/** Ühenda salongi Stripe'i konto (ainult omanik) – suunab Stripe'i liitumisvormile */
export async function connectStripe(): Promise<FormState> {
  const { business, user } = await requireSession();
  if (user.role !== "OWNER") return { message: "Makseid saab ühendada ainult omanik." };
  const { stripeConfigured, onboardingLink } = await import("@/server/stripe");
  if (!stripeConfigured()) return { message: "Stripe pole platvormil veel seadistatud." };
  let url: string;
  try {
    url = await onboardingLink(business.id, await appUrl());
  } catch (e) {
    reportError("stripe onboarding", e);
    return { message: "Stripe'iga ühendamine ebaõnnestus. Proovi hiljem uuesti." };
  }
  redirect(url);
}

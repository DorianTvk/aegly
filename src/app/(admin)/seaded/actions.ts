"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db, schema as s } from "@/db";
import { requireSession, destroySession } from "@/lib/session";
import { hashPassword, verifyPassword } from "@/lib/password";
import type { FormState } from "@/components/ui/form";

export async function changePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireSession();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  if (next.length < 8) return { errors: { next: ["Vähemalt 8 märki"] } };
  if (!(await verifyPassword(current, user.passwordHash))) return { errors: { current: ["Vale parool"] } };
  await db.update(s.users).set({ passwordHash: await hashPassword(next) }).where(eq(s.users.id, user.id));
  // logi välja teistest seadmetest
  return { ok: true, message: "Parool muudetud." };
}

export async function updateAccount(input: { name: string }): Promise<FormState> {
  const { user } = await requireSession();
  const name = input.name.trim();
  if (name.length < 2) return { message: "Sisesta nimi" };
  await db.update(s.users).set({ name }).where(eq(s.users.id, user.id));
  revalidatePath("/seaded");
  return { ok: true, message: "Salvestatud." };
}

const userSchema = z.object({
  name: z.string().trim().min(2, "Sisesta nimi"),
  email: z.email("Vigane e-post").transform((v) => v.toLowerCase()),
  role: z.enum(["ADMIN", "STAFF"]),
});

/** Uus kasutaja ajutise parooliga (kuvatakse üks kord). Kutse e-postiga lisandub koos teavitustega. */
export async function addUser(input: z.input<typeof userSchema>): Promise<FormState & { tempPassword?: string }> {
  const { business, user } = await requireSession();
  if (user.role !== "OWNER") return { message: "Kasutajaid saab lisada ainult omanik" };
  const parsed = userSchema.safeParse(input);
  if (!parsed.success) return { message: parsed.error.issues[0]?.message };
  const exists = await db.query.users.findFirst({ where: eq(s.users.email, parsed.data.email) });
  if (exists) return { message: "Selle e-postiga kasutaja on juba olemas" };
  const temp = randomBytes(6).toString("base64url");
  await db.insert(s.users).values({ ...parsed.data, businessId: business.id, passwordHash: await hashPassword(temp) });
  revalidatePath("/seaded");
  return { ok: true, message: "Kasutaja lisatud.", tempPassword: temp };
}

export async function setUserRole(userId: string, role: "ADMIN" | "STAFF") {
  const { business, user } = await requireSession();
  if (user.role !== "OWNER" || userId === user.id) return;
  await db.update(s.users).set({ role }).where(and(eq(s.users.id, userId), eq(s.users.businessId, business.id), ne(s.users.role, "OWNER")));
  revalidatePath("/seaded");
}

export async function removeUser(userId: string) {
  const { business, user } = await requireSession();
  if (user.role !== "OWNER" || userId === user.id) return;
  await db.delete(s.users).where(and(eq(s.users.id, userId), eq(s.users.businessId, business.id), ne(s.users.role, "OWNER")));
  revalidatePath("/seaded");
}

export async function saveProtection(input: { noShowProtection: boolean; noShowThreshold: number }): Promise<FormState> {
  const { business } = await requireSession();
  if (![1, 2, 3, 5].includes(input.noShowThreshold)) return { message: "Vigane piir" };
  await db.update(s.businesses).set(input).where(eq(s.businesses.id, business.id));
  revalidatePath("/seaded");
  return { ok: true, message: "Salvestatud." };
}

/** Konto kustutamine: ainult omanik, kinnitus ettevõtte nimega. Kustutab kõik andmed. */
export async function deleteBusiness(confirmName: string): Promise<FormState> {
  const { business, user } = await requireSession();
  if (user.role !== "OWNER") return { message: "Kontot saab kustutada ainult omanik" };
  if (confirmName.trim() !== business.name) return { message: "Nimi ei ühti" };
  await destroySession();
  await db.delete(s.businesses).where(eq(s.businesses.id, business.id));
  redirect("/registreeru");
}

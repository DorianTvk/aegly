"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createSession, destroySession } from "@/lib/session";
import { createBusinessWithOwner, findUserByEmail } from "@/server/business";
import type { FormState } from "@/components/ui/form";
import { parsePeriod, parsePlan } from "@/lib/plans";

const loginSchema = z.object({
  email: z.email("Sisesta kehtiv e-posti aadress").transform((v) => v.toLowerCase().trim()),
  password: z.string().min(1, "Sisesta parool"),
  next: z.string().optional(),
});

const registerSchema = z.object({
  businessName: z.string().trim().min(2, "Ettevõtte nimi on liiga lühike").max(80),
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

  const user = await findUserByEmail(parsed.data.email);
  const ok = await verifyPassword(parsed.data.password, user?.passwordHash);
  if (!user || !ok) return { message: "Vale e-post või parool." };

  await createSession(user.id);
  redirect(safeNext(parsed.data.next));
}

export async function register(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };

  if (await findUserByEmail(parsed.data.email)) {
    return { errors: { email: ["Selle e-postiga konto on juba olemas. Logi sisse."] } };
  }

  const { user } = await createBusinessWithOwner({
    businessName: parsed.data.businessName,
    ownerName: parsed.data.ownerName,
    email: parsed.data.email,
    passwordHash: await hashPassword(parsed.data.password),
    plan: parsePlan(formData.get("plan")),
    billingPeriod: parsePeriod(formData.get("period")),
  });
  await createSession(user.id);
  redirect("/toolaud");
}

export async function logout() {
  await destroySession();
  redirect("/logi-sisse");
}

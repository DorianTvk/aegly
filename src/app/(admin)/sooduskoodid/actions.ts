"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema as s } from "@/db";
import { requireManager } from "@/lib/session";
import { zonedDateTime, addDaysIso } from "@/lib/time";
import type { FormState } from "@/components/ui/form";

const codeSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-ZÕÄÖÜŠŽ0-9_-]{3,24}$/, "3–24 märki: tähed, numbrid, - või _"),
  kind: z.enum(["PERCENT", "FIXED", "FREE_SERVICE"]),
  value: z.number().int().min(0),
  minAmountCents: z.number().int().min(0).nullable(),
  startsOn: z.iso.date().nullable(),
  endsOn: z.iso.date().nullable(),
  maxUses: z.number().int().min(1).nullable(),
  maxUsesPerClient: z.number().int().min(1).nullable(),
  newClientsOnly: z.boolean(),
  combinable: z.boolean(),
  serviceIds: z.array(z.string()),
  categoryIds: z.array(z.string()),
  packageIds: z.array(z.string()),
  active: z.boolean(),
});
export type CodeInput = z.infer<typeof codeSchema>;

export async function saveCode(id: string | null, input: CodeInput): Promise<FormState> {
  const { business } = await requireManager();
  const parsed = codeSchema.safeParse(input);
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "Kontrolli välju" };
  const d = parsed.data;
  if (d.kind === "PERCENT" && (d.value < 1 || d.value > 100)) return { message: "Protsent peab olema 1–100" };
  if (d.kind === "FIXED" && d.value < 1) return { message: "Sisesta soodustuse summa" };
  if (d.kind === "FREE_SERVICE" && !d.serviceIds.length) return { message: "Vali teenus, mis on tasuta" };
  if (d.startsOn && d.endsOn && d.endsOn < d.startsOn) return { message: "Lõppkuupäev peab olema pärast algust" };

  const dup = await db.query.discountCodes.findFirst({
    where: and(eq(s.discountCodes.businessId, business.id), sql`upper(${s.discountCodes.code}) = ${d.code}`, id ? ne(s.discountCodes.id, id) : undefined),
  });
  if (dup) return { message: `Kood ${d.code} on juba olemas` };

  const tz = business.timezone;
  const values = {
    code: d.code,
    kind: d.kind,
    value: d.kind === "FREE_SERVICE" ? 0 : d.value,
    minAmountCents: d.minAmountCents,
    startsAt: d.startsOn ? zonedDateTime(d.startsOn, "00:00", tz) : null,
    endsAt: d.endsOn ? zonedDateTime(addDaysIso(d.endsOn, 1), "00:00", tz) : null,
    maxUses: d.maxUses,
    maxUsesPerClient: d.maxUsesPerClient,
    newClientsOnly: d.newClientsOnly,
    combinable: d.combinable,
    appliesToPackages: d.packageIds.length > 0,
    serviceIds: d.serviceIds,
    categoryIds: d.categoryIds,
    packageIds: d.packageIds,
    active: d.active,
  };
  if (id) await db.update(s.discountCodes).set(values).where(and(eq(s.discountCodes.id, id), eq(s.discountCodes.businessId, business.id)));
  else await db.insert(s.discountCodes).values({ ...values, businessId: business.id });
  revalidatePath("/sooduskoodid");
  return { ok: true, message: "Salvestatud." };
}

export async function setCodeActive(id: string, active: boolean) {
  const { business } = await requireManager();
  await db.update(s.discountCodes).set({ active }).where(and(eq(s.discountCodes.id, id), eq(s.discountCodes.businessId, business.id)));
  revalidatePath("/sooduskoodid");
}

export async function deleteCode(id: string) {
  const { business } = await requireManager();
  await db.delete(s.discountCodes).where(and(eq(s.discountCodes.id, id), eq(s.discountCodes.businessId, business.id)));
  revalidatePath("/sooduskoodid");
}

/** Juhuslik, kergesti loetav kood (ilma 0/O, 1/I segaduseta) */
export async function generateCode(): Promise<string> {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(randomBytes(8), (b) => alphabet[b % alphabet.length]).join("");
}

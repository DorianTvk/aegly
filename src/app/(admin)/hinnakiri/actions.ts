"use server";

import { logActivity } from "@/server/audit";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema as s } from "@/db";
import { requireManager } from "@/lib/session";
import type { FormState } from "@/components/ui/form";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable();

const ruleSchema = z.object({
  name: z.string().trim().min(2, "Sisesta nimi").max(60),
  kind: z.enum(["PERCENT", "FIXED"]),
  /** + lisatasu / − soodustus; FIXED sentides */
  value: z.number().int().refine((v) => v !== 0, "Väärtus ei saa olla 0"),
  weekdays: z.array(z.number().int().min(1).max(7)),
  fromTime: time,
  toTime: time,
  minLeadHours: z.number().int().min(0).nullable(),
  maxLeadHours: z.number().int().min(1).nullable(),
  dateFrom: z.iso.date().nullable(),
  dateTo: z.iso.date().nullable(),
  serviceIds: z.array(z.string()),
  categoryIds: z.array(z.string()),
  active: z.boolean(),
});
export type RuleInput = z.infer<typeof ruleSchema>;

export async function savePriceRule(id: string | null, input: RuleInput): Promise<FormState> {
  const { business } = await requireManager();
  const parsed = ruleSchema.safeParse(input);
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "Kontrolli välju" };
  const d = parsed.data;
  if (d.kind === "PERCENT" && Math.abs(d.value) > 100) return { message: "Protsent peab olema vahemikus −100 … +100" };
  if (d.dateFrom && d.dateTo && d.dateTo < d.dateFrom) return { message: "Lõppkuupäev peab olema pärast algust" };
  if (d.fromTime && d.toTime && d.toTime <= d.fromTime) return { message: "Kellaaja lõpp peab olema pärast algust" };
  if (id) {
    await db.update(s.priceRules).set(d).where(and(eq(s.priceRules.id, id), eq(s.priceRules.businessId, business.id)));
  } else {
    await db.insert(s.priceRules).values({ ...d, businessId: business.id });
  }
  revalidatePath("/hinnakiri");
  await logActivity({ action: "pricing.rule", summary: `${id ? "Muutis" : "Lisas"} hinnareegli` });
  return { ok: true, message: "Salvestatud." };
}

export async function togglePriceRule(id: string, active: boolean) {
  const { business } = await requireManager();
  await db.update(s.priceRules).set({ active }).where(and(eq(s.priceRules.id, id), eq(s.priceRules.businessId, business.id)));
  revalidatePath("/hinnakiri");
}

export async function deletePriceRule(id: string) {
  const { business } = await requireManager();
  await db.delete(s.priceRules).where(and(eq(s.priceRules.id, id), eq(s.priceRules.businessId, business.id)));
  revalidatePath("/hinnakiri");
}

export async function saveTaxSettings(input: { pricesIncludeVat: boolean; vatRate: string }): Promise<FormState> {
  const { business } = await requireManager();
  const rate = Number(input.vatRate);
  if (![0, 9, 13, 22, 24].includes(rate)) return { message: "Vigane KM määr" };
  await db.update(s.businesses).set({ pricesIncludeVat: input.pricesIncludeVat, vatRate: String(rate) }).where(eq(s.businesses.id, business.id));
  revalidatePath("/hinnakiri");
  return { ok: true, message: "Salvestatud." };
}

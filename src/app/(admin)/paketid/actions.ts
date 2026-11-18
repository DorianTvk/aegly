"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, schema as s } from "@/db";
import { requireManager } from "@/lib/session";
import type { FormState } from "@/components/ui/form";

const packageSchema = z.object({
  name: z.string().trim().min(2, "Sisesta nimi").max(80),
  type: z.enum(["MULTI_VISIT", "BUNDLE"]),
  description: z.string().trim().max(400).nullable(),
  priceCents: z.number().int().min(0, "Sisesta hind"),
  validityDays: z.number().int().min(1).nullable(),
  sellInWidget: z.boolean(),
  shareable: z.boolean(),
  active: z.boolean(),
  items: z.array(z.object({ serviceId: z.string(), quantity: z.number().int().min(1).max(50) })).min(1, "Lisa vähemalt üks teenus"),
});
export type PackageInput = z.infer<typeof packageSchema>;

export async function savePackage(id: string | null, input: PackageInput): Promise<FormState> {
  const { business } = await requireManager();
  const parsed = packageSchema.safeParse(input);
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "Kontrolli välju" };
  const d = parsed.data;
  if (d.type === "MULTI_VISIT" && d.items.length !== 1) return { message: "Kordade paketis on üks teenus" };

  const ids = [...new Set(d.items.map((i) => i.serviceId))];
  const own = await db.select({ id: s.services.id }).from(s.services).where(and(eq(s.services.businessId, business.id), inArray(s.services.id, ids)));
  if (own.length !== ids.length) return { message: "Vigane teenus" };

  const values = { name: d.name, type: d.type, description: d.description, priceCents: d.priceCents, validityDays: d.validityDays, sellInWidget: d.sellInWidget, shareable: d.shareable, active: d.active };
  await db.transaction(async (tx) => {
    let pid = id;
    if (pid) {
      const r = await tx.update(s.packages).set(values).where(and(eq(s.packages.id, pid), eq(s.packages.businessId, business.id))).returning({ id: s.packages.id });
      if (!r.length) throw new Error("Paketti ei leitud");
      await tx.delete(s.packageItems).where(eq(s.packageItems.packageId, pid));
    } else {
      pid = (await tx.insert(s.packages).values({ ...values, businessId: business.id }).returning({ id: s.packages.id }))[0].id;
    }
    // sama teenus mitu korda → liida kogused
    const merged = new Map<string, number>();
    for (const i of d.items) merged.set(i.serviceId, (merged.get(i.serviceId) ?? 0) + i.quantity);
    await tx.insert(s.packageItems).values([...merged].map(([serviceId, quantity]) => ({ packageId: pid!, serviceId, quantity })));
  });
  revalidatePath("/paketid");
  return { ok: true, message: "Salvestatud." };
}

/** Müüdud paketti ei kustutata (klientide saldod), vaid peidetakse */
export async function deletePackage(id: string) {
  const { business } = await requireManager();
  const sold = await db.$count(s.clientPackages, eq(s.clientPackages.packageId, id));
  if (sold > 0) await db.update(s.packages).set({ active: false, sellInWidget: false }).where(and(eq(s.packages.id, id), eq(s.packages.businessId, business.id)));
  else await db.delete(s.packages).where(and(eq(s.packages.id, id), eq(s.packages.businessId, business.id)));
  revalidatePath("/paketid");
}

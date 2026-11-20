"use server";

import { logActivity } from "@/server/audit";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema as s } from "@/db";
import { requireManager } from "@/lib/session";
import { storeImage } from "@/server/files";
import { readTranslations } from "@/lib/translations";
import type { FormState } from "@/components/ui/form";

const opt = (max: number) => z.string().trim().max(max).transform((v) => v || null);

const profileSchema = z.object({
  name: z.string().trim().min(2, "Sisesta ettevõtte nimi").max(80),
  registryCode: opt(20),
  vatNumber: opt(20),
  industry: opt(60),
  timezone: z.enum(["Europe/Tallinn", "Europe/Riga", "Europe/Vilnius", "Europe/Helsinki"]),
  description: opt(400),
  address: opt(160),
  phone: opt(30),
  email: z.union([z.literal(""), z.email("Vigane e-post")]).transform((v) => v || null),
  website: opt(120),
  instagram: opt(120),
  facebook: opt(120),
  widgetShowBanner: z.literal("on").optional(),
  logoInEmails: z.literal("on").optional(),
  removeLogo: z.literal("1").optional(),
  removeBanner: z.literal("1").optional(),
});

export async function saveBusinessProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const { business } = await requireManager();
  const parsed = profileSchema.safeParse(Object.fromEntries([...formData.entries()].filter(([, v]) => typeof v === "string")));
  if (!parsed.success) return { message: "Kontrolli välju.", errors: z.flattenError(parsed.error).fieldErrors };
  const { removeLogo, removeBanner, widgetShowBanner, logoInEmails, ...d } = parsed.data;

  const patch: Partial<typeof s.businesses.$inferInsert> = { ...d, widgetShowBanner: widgetShowBanner === "on", logoInEmails: logoInEmails === "on", translations: readTranslations(formData, ["description"]) };
  for (const [field, key] of [["logo", "logoUrl"], ["banner", "bannerUrl"]] as const) {
    const file = formData.get(field);
    if (file instanceof File && file.size > 0) {
      const r = await storeImage(business.id, file);
      if (!r.ok) return { message: r.reason, errors: { [field]: [r.reason] } };
      patch[key] = r.url;
    }
  }
  if (removeLogo) patch.logoUrl = null;
  if (removeBanner) patch.bannerUrl = null;

  await db.update(s.businesses).set(patch).where(eq(s.businesses.id, business.id));
  await logActivity({ action: "settings.profile", summary: "Muutis ettevõtte profiili" });
  revalidatePath("/profiil");
  revalidatePath("/vidin");
  revalidatePath("/toolaud");
  return { ok: true, message: "Salvestatud." };
}

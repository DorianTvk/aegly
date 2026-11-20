"use server";

import { logActivity } from "@/server/audit";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema as s } from "@/db";
import { requireManager } from "@/lib/session";
import { zonedDateTime } from "@/lib/time";
import { cleanTranslations } from "@/lib/translations";
import type { FormState } from "@/components/ui/form";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable();

const campaignSchema = z.object({
  name: z.string().trim().min(2, "Sisesta nimi").max(60),
  kind: z.enum(["PERCENT", "FIXED", "FIXED_PRICE"]),
  value: z.number().int().min(1, "Sisesta soodustus"),
  startDate: z.iso.date("Vali algus"),
  startTime: z.string().regex(/^\d\d:\d\d$/),
  endDate: z.iso.date("Vali lõpp"),
  endTime: z.string().regex(/^\d\d:\d\d$/),
  weekdays: z.array(z.number().int().min(1).max(7)),
  fromTime: time,
  toTime: time,
  serviceIds: z.array(z.string()),
  categoryIds: z.array(z.string()),
  staffIds: z.array(z.string()),
  packageIds: z.array(z.string()),
  combinable: z.boolean(),
  showBanner: z.boolean(),
  bannerText: z.string().trim().max(120).nullable(),
  bannerColor: z.string().regex(/^#[0-9a-f]{6}$/i),
  active: z.boolean(),
  translations: z.unknown().optional(),
});
export type CampaignInput = z.infer<typeof campaignSchema>;

export async function saveCampaign(id: string | null, input: CampaignInput): Promise<FormState & { id?: string }> {
  const { business } = await requireManager();
  const parsed = campaignSchema.safeParse(input);
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "Kontrolli välju" };
  const d = parsed.data;
  if (d.kind === "PERCENT" && d.value > 100) return { message: "Protsent peab olema 1–100" };
  const tz = business.timezone;
  const startsAt = zonedDateTime(d.startDate, d.startTime, tz);
  const endsAt = zonedDateTime(d.endDate, d.endTime, tz);
  if (endsAt <= startsAt) return { message: "Lõpp peab olema pärast algust" };
  if (d.fromTime && d.toTime && d.toTime <= d.fromTime) return { message: "Ajatingimuse lõpp peab olema pärast algust" };
  if (d.showBanner && !d.bannerText) return { message: "Sisesta bänneri tekst" };

  const values = {
    name: d.name, kind: d.kind, value: d.value, startsAt, endsAt,
    weekdays: d.weekdays, fromTime: d.fromTime, toTime: d.toTime,
    serviceIds: d.serviceIds, categoryIds: d.categoryIds, staffIds: d.staffIds, packageIds: d.packageIds,
    combinable: d.combinable, showBanner: d.showBanner, bannerText: d.bannerText, bannerColor: d.bannerColor, active: d.active,
    translations: cleanTranslations(d.translations, ["name", "bannerText"]),
  };
  let savedId = id;
  if (id) await db.update(s.campaigns).set(values).where(and(eq(s.campaigns.id, id), eq(s.campaigns.businessId, business.id)));
  else savedId = (await db.insert(s.campaigns).values({ ...values, businessId: business.id }).returning({ id: s.campaigns.id }))[0].id;
  await logActivity({ action: id ? "campaign.updated" : "campaign.created", summary: `${id ? "Muutis" : "Lisas"} kampaania ${d.name}` });
  revalidatePath("/kampaaniad");
  return { ok: true, message: "Salvestatud.", id: savedId! };
}

/** Lõpetab kampaania kohe (lõpuaeg = praegu) */
export async function endCampaign(id: string) {
  const { business } = await requireManager();
  await db.update(s.campaigns).set({ endsAt: new Date() }).where(and(eq(s.campaigns.id, id), eq(s.campaigns.businessId, business.id)));
  revalidatePath("/kampaaniad");
}

export async function deleteCampaign(id: string) {
  const { business } = await requireManager();
  await db.delete(s.campaigns).where(and(eq(s.campaigns.id, id), eq(s.campaigns.businessId, business.id)));
  revalidatePath("/kampaaniad");
}

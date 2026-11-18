"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema as s } from "@/db";
import { requireSession } from "@/lib/session";
import type { FormState } from "@/components/ui/form";

const hex = z.string().regex(/^#[0-9a-f]{6}$/i, "Vigane värv");
const domain = z
  .string()
  .trim()
  .toLowerCase()
  .transform((d) => d.replace(/^https?:\/\//, "").replace(/\/.*$/, ""))
  .refine((d) => /^(localhost(:\d+)?|([a-z0-9-]+\.)+[a-z]{2,})$/.test(d), "Vigane domeen");

const widgetSchema = z.object({
  widgetPrimary: hex,
  widgetButtonColor: hex,
  widgetBackground: hex,
  widgetTextColor: hex,
  widgetTheme: z.enum(["light", "dark", "auto"]),
  widgetFont: z.enum(["inherit", "Inter", "system"]),
  widgetButtonText: z.string().trim().min(2).max(30),
  widgetShowLogo: z.boolean(),
  widgetShowBanner: z.boolean(),
  widgetShowPrices: z.boolean(),
  widgetShowStaff: z.boolean(),
  widgetShowCampaignBanner: z.boolean(),
  widgetLanguages: z.array(z.enum(["et", "en", "ru"])).min(1, "Vali vähemalt üks keel"),
  widgetEmbed: z.enum(["popup", "iframe"]),
  allowedDomains: z.array(domain).max(10),
});
export type WidgetSettings = z.input<typeof widgetSchema>;

export async function saveWidgetSettings(input: WidgetSettings): Promise<FormState> {
  const { business } = await requireSession();
  const parsed = widgetSchema.safeParse(input);
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "Kontrolli välju" };
  await db
    .update(s.businesses)
    .set({ ...parsed.data, allowedDomains: [...new Set(parsed.data.allowedDomains)], widgetCustomizedAt: business.widgetCustomizedAt ?? new Date() })
    .where(eq(s.businesses.id, business.id));
  revalidatePath("/vidin");
  return { ok: true, message: "Muudatused avaldatud. Vidin uueneb kodulehel kohe." };
}

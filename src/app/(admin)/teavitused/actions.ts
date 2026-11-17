"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema as s } from "@/db";
import { requireSession } from "@/lib/session";
import type { FormState } from "@/components/ui/form";

const itemSchema = z.object({
  type: z.enum(["CONFIRMATION", "REMINDER", "CHANGED", "CANCELLED", "PAYMENT_PENDING", "WAITLIST", "REVIEW", "BIRTHDAY"]),
  emailEnabled: z.boolean(),
  smsEnabled: z.boolean(),
  offsetMinutes: z.number().int().min(0).max(10080).nullable(),
  emailSubject: z.string().max(200),
  emailBody: z.string().max(4000),
  smsBody: z.string().max(612, "SMS on liiga pikk (max 4 osa)"),
});

const schema = z.object({
  emailSenderName: z.string().trim().max(60),
  smsSender: z
    .string()
    .trim()
    .max(11, "SMS saatja on kuni 11 tähemärki")
    .regex(/^[A-Za-z0-9 ]*$/, "SMS saatjas on lubatud ainult ladina tähed ja numbrid"),
  replyToEmail: z.union([z.literal(""), z.email("Vigane e-post")]),
  googleReviewUrl: z.union([z.literal(""), z.url("Vigane link")]),
  items: z.array(itemSchema),
});
export type NotificationsInput = z.infer<typeof schema>;

export async function saveNotifications(input: NotificationsInput): Promise<FormState> {
  const { business } = await requireSession();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "Kontrolli välju" };
  const d = parsed.data;
  if (d.items.some((i) => i.smsEnabled) && !d.smsSender) return { message: "Sisesta SMS saatja nimi" };
  await db.transaction(async (tx) => {
    await tx
      .update(s.businesses)
      .set({ emailSenderName: d.emailSenderName || null, smsSender: d.smsSender || null, replyToEmail: d.replyToEmail || null, googleReviewUrl: d.googleReviewUrl || null })
      .where(eq(s.businesses.id, business.id));
    for (const it of d.items) {
      await tx
        .insert(s.notificationSettings)
        .values({ ...it, businessId: business.id })
        .onConflictDoUpdate({ target: [s.notificationSettings.businessId, s.notificationSettings.type], set: it });
    }
  });
  revalidatePath("/teavitused");
  return { ok: true, message: "Salvestatud." };
}

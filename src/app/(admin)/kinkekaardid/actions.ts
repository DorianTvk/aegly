"use server";

import { giftCode } from "@/lib/gift-code";

import { logActivity } from "@/server/audit";
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema as s } from "@/db";
import { requireManager } from "@/lib/session";
import type { FormState } from "@/components/ui/form";

/** GC-XXXX-XXX, ilma segadust tekitavate märkideta */

const sellSchema = z.object({
  valueCents: z.number().int().min(100, "Sisesta summa"),
  buyerName: z.string().trim().max(80),
  buyerEmail: z.union([z.literal(""), z.email("Vigane e-post")]),
  recipientName: z.string().trim().max(80),
  recipientEmail: z.union([z.literal(""), z.email("Vigane e-post")]),
  message: z.string().trim().max(300),
  paymentMethod: z.enum(["sularaha", "kaart", "ülekanne"]),
});
export type SellInput = z.infer<typeof sellSchema>;

export async function sellGiftCard(input: SellInput): Promise<FormState & { code?: string }> {
  const { business } = await requireManager();
  const parsed = sellSchema.safeParse(input);
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "Kontrolli välju" };
  const d = parsed.data;
  const expires = new Date();
  expires.setMonth(expires.getMonth() + business.giftCardValidityMonths);
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = giftCode();
    try {
      await db.insert(s.giftCards).values({
        businessId: business.id,
        code,
        buyerName: d.buyerName || null,
        buyerEmail: d.buyerEmail || null,
        recipientName: d.recipientName || null,
        recipientEmail: d.recipientEmail?.toLowerCase() || null,
        message: d.message || null,
        valueCents: d.valueCents,
        balanceCents: d.valueCents,
        expiresAt: expires,
        source: "ADMIN",
        paymentMethod: d.paymentMethod,
      });
      await logActivity({ action: "giftcard.sold", summary: `Müüs kinkekaardi ${code} (${(d.valueCents / 100).toFixed(2)} €)` });
      revalidatePath("/kinkekaardid");
      return { ok: true, message: `Kinkekaart ${code} loodud.`, code };
    } catch (e) {
      if (!String(e).includes("unique")) throw e;
    }
  }
  return { message: "Koodi loomine ebaõnnestus, proovi uuesti." };
}

export async function redeemGiftCard(id: string, amountCents: number, note: string): Promise<FormState> {
  const { business } = await requireManager();
  if (!Number.isInteger(amountCents) || amountCents <= 0) return { message: "Sisesta summa" };
  return db.transaction(async (tx) => {
    const [g] = await tx
      .update(s.giftCards)
      .set({ balanceCents: sql`${s.giftCards.balanceCents} - ${amountCents}` })
      .where(and(eq(s.giftCards.id, id), eq(s.giftCards.businessId, business.id), sql`${s.giftCards.balanceCents} >= ${amountCents}`, sql`${s.giftCards.expiresAt} > now()`))
      .returning();
    if (!g) return { message: "Saldo on väiksem või kaart on aegunud" };
    await tx.insert(s.giftCardRedemptions).values({ giftCardId: id, amountCents, note: note.trim() || null });
    await logActivity({ action: "giftcard.redeemed", summary: `Kasutas kinkekaardi ${g.code} saldost ${(amountCents / 100).toFixed(2)} €` });
    revalidatePath("/kinkekaardid");
    return { ok: true, message: "Saldo kasutatud." };
  });
}

const settingsSchema = z.object({
  giftCardsEnabled: z.boolean(),
  giftCardAmounts: z.array(z.number().int().min(100)).max(6),
  giftCardCustomAmount: z.boolean(),
  giftCardMinCents: z.number().int().min(100),
  giftCardValidityMonths: z.number().int().min(1).max(60),
});
export type GiftSettings = z.infer<typeof settingsSchema>;

export async function saveGiftSettings(input: GiftSettings): Promise<FormState> {
  const { business } = await requireManager();
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { message: "Kontrolli välju" };
  if (!parsed.data.giftCardAmounts.length && !parsed.data.giftCardCustomAmount) return { message: "Lisa vähemalt üks summa või luba vaba summa" };
  await db.update(s.businesses).set({ ...parsed.data, giftCardAmounts: [...parsed.data.giftCardAmounts].sort((a, b) => a - b) }).where(eq(s.businesses.id, business.id));
  revalidatePath("/kinkekaardid");
  return { ok: true, message: "Salvestatud." };
}

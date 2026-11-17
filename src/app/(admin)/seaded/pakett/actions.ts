"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireSession } from "@/lib/session";
import { canSwitchTo, parsePeriod, parsePlan, PLANS } from "@/lib/plans";
import { activeStaffCount } from "@/server/plans";
import type { FormState } from "@/components/ui/form";

/** Paketi vahetus. Maksmine (Stripe Billing) lisandub hiljem; seni muutub pakett kohe. */
export async function changePlan(input: { plan: string; period: string }): Promise<FormState> {
  const { business, user } = await requireSession();
  if (user.role !== "OWNER") return { message: "Paketti saab muuta ainult omanik." };
  const plan = parsePlan(input.plan);
  const period = parsePeriod(input.period);
  const active = await activeStaffCount(business.id);
  if (!canSwitchTo(plan, active)) {
    return { message: `Paketis „${PLANS[plan].name}“ on ${PLANS[plan].staffLimit === 1 ? "1 töötaja" : `kuni ${PLANS[plan].staffLimit} töötajat`}, sul on ${active} aktiivset. Muuda enne töötajaid mitteaktiivseks.` };
  }
  if (plan === business.plan && period === business.billingPeriod) return { ok: true, message: "See pakett on juba kasutusel." };
  await db.update(s.businesses).set({ plan, billingPeriod: period, planChangedAt: new Date() }).where(eq(s.businesses.id, business.id));
  revalidatePath("/seaded/pakett");
  revalidatePath("/tootajad");
  return { ok: true, message: `Pakett vahetatud: ${PLANS[plan].name}.` };
}

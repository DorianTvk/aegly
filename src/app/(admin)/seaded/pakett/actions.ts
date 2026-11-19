"use server";

import { reportError } from "@/lib/report";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireSession } from "@/lib/session";
import { appUrl } from "@/lib/app-url";
import { canSwitchTo, parsePeriod, parsePlan, PLANS } from "@/lib/plans";
import { activeStaffCount } from "@/server/plans";
import { billingEnabled, changeSubscription, portalUrl, subscriptionCheckout } from "@/server/billing";
import type { FormState } from "@/components/ui/form";

/**
 * Paketi valik/vahetus.
 * - Tellimust pole → Stripe'i makseleht (tellimuse alustamine)
 * - Tellimus olemas → pakett vahetatakse Stripe'is, hinnavahe arvestatakse proportsionaalselt
 * - Stripe pole seadistatud → pakett muutub kohe (arendus)
 */
export async function changePlan(input: { plan: string; period: string }): Promise<FormState> {
  const { business, user } = await requireSession();
  if (user.role !== "OWNER") return { message: "Paketti saab muuta ainult omanik." };
  const plan = parsePlan(input.plan);
  const period = parsePeriod(input.period);
  const active = await activeStaffCount(business.id);
  if (!canSwitchTo(plan, active)) {
    return { message: `Paketis „${PLANS[plan].name}“ on ${PLANS[plan].staffLimit === 1 ? "1 töötaja" : `kuni ${PLANS[plan].staffLimit} töötajat`}, sul on ${active} aktiivset. Muuda enne töötajaid mitteaktiivseks.` };
  }
  const hasLiveSub = !!business.stripeSubscriptionId && business.planStatus !== "SUSPENDED" && business.planStatus !== "PENDING";

  if (billingEnabled()) {
    if (hasLiveSub) {
      if (plan === business.plan && period === business.billingPeriod) return { ok: true, message: "See pakett on juba kasutusel." };
      try {
        await changeSubscription(business.stripeSubscriptionId!, plan, period);
      } catch (e) {
        reportError("billing change", e);
        return { message: "Paketi vahetus ebaõnnestus. Proovi uuesti." };
      }
      revalidatePath("/seaded/pakett");
      revalidatePath("/tootajad");
      return { ok: true, message: `Pakett vahetatud: ${PLANS[plan].name}. Hinnavahe arvestatakse järgmisel arvel.` };
    }
    let url: string;
    try {
      url = await subscriptionCheckout(business.id, plan, period, await appUrl());
    } catch (e) {
      reportError("billing checkout", e);
      return { message: "Makselehe avamine ebaõnnestus. Proovi uuesti." };
    }
    redirect(url);
  }

  if (plan === business.plan && period === business.billingPeriod) return { ok: true, message: "See pakett on juba kasutusel." };
  await db.update(s.businesses).set({ plan, billingPeriod: period, planChangedAt: new Date() }).where(eq(s.businesses.id, business.id));
  revalidatePath("/seaded/pakett");
  revalidatePath("/tootajad");
  return { ok: true, message: `Pakett vahetatud: ${PLANS[plan].name}.` };
}

/** Stripe'i kliendiportaal: arved, makseviis, tellimuse lõpetamine */
export async function openBillingPortal(): Promise<FormState> {
  const { business, user } = await requireSession();
  if (user.role !== "OWNER") return { message: "Arveldust haldab ainult omanik." };
  if (!billingEnabled() || !business.stripeCustomerId) return { message: "Arveid veel pole." };
  let url: string;
  try {
    url = await portalUrl(business.id, await appUrl());
  } catch (e) {
    reportError("billing portal", e);
    return { message: "Arvelduse avamine ebaõnnestus. Proovi uuesti." };
  }
  redirect(url);
}

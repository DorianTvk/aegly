"use server";

import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";
import { appUrl } from "@/lib/app-url";
import { canSwitchTo, parsePeriod, parsePlan, PLANS } from "@/lib/plans";
import { activeStaffCount } from "@/server/plans";
import { subscriptionCheckout } from "@/server/billing";

export async function startSubscription(input: { plan: string; period: string }): Promise<{ message: string } | null> {
  const session = await readSession();
  if (!session) redirect("/logi-sisse");
  if (session.user.role !== "OWNER") return { message: "Paketi saab aktiveerida salongi omanik." };
  const plan = parsePlan(input.plan);
  const period = parsePeriod(input.period);
  const active = await activeStaffCount(session.business.id);
  if (!canSwitchTo(plan, active)) return { message: `Paketti „${PLANS[plan].name}“ ei mahu sinu ${active} aktiivset töötajat. Vali suurem pakett.` };
  let url: string;
  try {
    url = await subscriptionCheckout(session.business.id, plan, period, await appUrl(), "/aktiveeri");
  } catch (e) {
    console.error("[billing] activate", e);
    return { message: "Makselehe avamine ebaõnnestus. Proovi uuesti." };
  }
  redirect(url);
}

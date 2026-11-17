"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireSession } from "@/lib/session";
import { isSuperadmin, parsePeriod, parsePlan, type PlanStatus } from "@/lib/plans";
import type { FormState } from "@/components/ui/form";

const STATUSES: PlanStatus[] = ["ACTIVE", "PAST_DUE", "SUSPENDED"];

/** Superadmin määrab salongi paketi käsitsi (nt testkliendid). Töötajate piiri siin ei kontrollita. */
export async function setBusinessPlan(input: { businessId: string; plan: string; period: string; status: string }): Promise<FormState> {
  const { user } = await requireSession();
  if (!isSuperadmin(user.email)) return { message: "Puudub ligipääs." };
  const status = (STATUSES as string[]).includes(input.status) ? (input.status as PlanStatus) : "ACTIVE";
  await db
    .update(s.businesses)
    .set({ plan: parsePlan(input.plan), billingPeriod: parsePeriod(input.period), planStatus: status, planChangedAt: new Date() })
    .where(eq(s.businesses.id, input.businessId));
  revalidatePath("/platvorm");
  return { ok: true, message: "Salvestatud." };
}

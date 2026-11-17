import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { canAddStaff, type PlanId } from "@/lib/plans";

export async function activeStaffCount(businessId: string): Promise<number> {
  return db.$count(s.staffMembers, and(eq(s.staffMembers.businessId, businessId), eq(s.staffMembers.active, true)));
}

export async function staffUsage(business: { id: string; plan: PlanId }) {
  const active = await activeStaffCount(business.id);
  return { active, canAdd: canAddStaff(business.plan, active) };
}

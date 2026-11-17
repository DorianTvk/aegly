import "server-only";
import { and, arrayContains, asc, eq, or, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";

export async function listServices(businessId: string) {
  const [services, categories, links, staff] = await Promise.all([
    db.query.services.findMany({
      where: and(eq(s.services.businessId, businessId), sql`${s.services.status} <> 'ARCHIVED'`),
      orderBy: [asc(s.services.sortOrder), asc(s.services.name)],
      with: { category: true },
    }),
    db.query.serviceCategories.findMany({ where: eq(s.serviceCategories.businessId, businessId), orderBy: [asc(s.serviceCategories.sortOrder)] }),
    db
      .select({ serviceId: s.staffServices.serviceId, staffId: s.staffServices.staffId })
      .from(s.staffServices)
      .innerJoin(s.staffMembers, eq(s.staffMembers.id, s.staffServices.staffId))
      .where(eq(s.staffMembers.businessId, businessId)),
    db.query.staffMembers.findMany({ where: eq(s.staffMembers.businessId, businessId), orderBy: [asc(s.staffMembers.sortOrder)] }),
  ]);
  const staffById = new Map(staff.map((m) => [m.id, m]));
  return {
    categories,
    services: services.map((sv) => ({
      ...sv,
      staff: links.filter((l) => l.serviceId === sv.id).map((l) => staffById.get(l.staffId)!).filter(Boolean),
    })),
  };
}

export async function getServiceForEdit(businessId: string, serviceId: string) {
  const service = await db.query.services.findFirst({
    where: and(eq(s.services.businessId, businessId), eq(s.services.id, serviceId)),
    with: { staff: true },
  });
  if (!service) return null;
  const [pkgs, campaigns, codes] = await Promise.all([
    db
      .select({ name: s.packages.name })
      .from(s.packageItems)
      .innerJoin(s.packages, eq(s.packages.id, s.packageItems.packageId))
      .where(and(eq(s.packageItems.serviceId, serviceId), eq(s.packages.active, true))),
    db.query.campaigns.findMany({
      where: and(
        eq(s.campaigns.businessId, businessId),
        eq(s.campaigns.active, true),
        or(
          arrayContains(s.campaigns.serviceIds, [serviceId]),
          service.categoryId ? arrayContains(s.campaigns.categoryIds, [service.categoryId]) : sql`false`,
          and(sql`cardinality(${s.campaigns.serviceIds}) = 0`, sql`cardinality(${s.campaigns.categoryIds}) = 0`),
        ),
      ),
    }),
    db.query.discountCodes.findMany({
      where: and(
        eq(s.discountCodes.businessId, businessId),
        eq(s.discountCodes.active, true),
        or(arrayContains(s.discountCodes.serviceIds, [serviceId]), sql`cardinality(${s.discountCodes.serviceIds}) = 0`),
      ),
    }),
  ]);
  return {
    service,
    related: { packages: pkgs.map((p) => p.name), campaigns: campaigns.map((c) => c.name), codes: codes.map((c) => c.code) },
  };
}

export async function getEditorOptions(businessId: string) {
  const [categories, staff, business] = await Promise.all([
    db.query.serviceCategories.findMany({ where: eq(s.serviceCategories.businessId, businessId), orderBy: [asc(s.serviceCategories.sortOrder)] }),
    db.query.staffMembers.findMany({
      where: and(eq(s.staffMembers.businessId, businessId), eq(s.staffMembers.active, true)),
      orderBy: [asc(s.staffMembers.sortOrder)],
    }),
    db.query.businesses.findFirst({ where: eq(s.businesses.id, businessId) }),
  ]);
  return { categories, staff, business: business! };
}

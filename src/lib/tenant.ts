import "server-only";
import { connection } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

/**
 * Praegune ettevõte ja kasutaja.
 * TODO(auth): asendada sessioonist loetava kasutajaga, kui sisselogimine valmis.
 * Seni kasutab arenduses ettevõtet DEMO_BUSINESS_SLUG (vaikimisi "studio-lumi").
 */
export async function getCurrentBusiness() {
  await connection();
  const slug = process.env.DEMO_BUSINESS_SLUG ?? "studio-lumi";
  const business = await db.query.businesses.findFirst({ where: eq(schema.businesses.slug, slug) });
  if (!business) throw new Error(`Ettevõtet "${slug}" ei leitud. Käivita npm run db:seed.`);
  return business;
}

export async function getCurrentUser(businessId: string) {
  const user = await db.query.users.findFirst({ where: eq(schema.users.businessId, businessId) });
  return user ?? { name: "Kasutaja", role: "OWNER" as const };
}

export const ROLE_LABEL = { OWNER: "Omanik", ADMIN: "Administraator", STAFF: "Töötaja" } as const;

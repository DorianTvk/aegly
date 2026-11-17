import "server-only";
import { eq, like } from "drizzle-orm";
import { db, schema as s } from "@/db";

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "salong"
  );
}

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name);
  const taken = new Set((await db.select({ slug: s.businesses.slug }).from(s.businesses).where(like(s.businesses.slug, `${base}%`))).map((r) => r.slug));
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
}

/** Uus ettevõte vaikimisi lahtiolekuaegadega (E–R 09–18, L 10–15, P suletud) */
export async function createBusinessWithOwner(input: { businessName: string; ownerName: string; email: string; passwordHash: string }) {
  return db.transaction(async (tx) => {
    const [business] = await tx
      .insert(s.businesses)
      .values({ name: input.businessName, slug: await uniqueSlug(input.businessName), email: input.email })
      .returning();
    await tx.insert(s.openingHours).values(
      [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
        businessId: business.id,
        weekday,
        closed: weekday === 7,
        startTime: weekday === 7 ? null : weekday === 6 ? "10:00" : "09:00",
        endTime: weekday === 7 ? null : weekday === 6 ? "15:00" : "18:00",
      })),
    );
    const [user] = await tx
      .insert(s.users)
      .values({ businessId: business.id, email: input.email, name: input.ownerName, passwordHash: input.passwordHash, role: "OWNER" })
      .returning();
    return { business, user };
  });
}

export async function findUserByEmail(email: string) {
  return db.query.users.findFirst({ where: eq(s.users.email, email.toLowerCase()) });
}

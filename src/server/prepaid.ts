import "server-only";
import { and, eq, gt, isNull, or, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { normalizeGiftCode } from "@/lib/gift-code";

/**
 * Ettemakstud väärtus broneerimisel: ostetud pakett (kasutuskord) ja kinkekaart (saldo).
 * Tühistamisel tagastatakse mõlemad (releasePrepaid).
 */

export type UsablePackage = { id: string; name: string; usesLeft: number };

/** Kliendi (e-posti järgi) kehtiv pakett, mis sisaldab seda teenust */
export async function findUsablePackage(businessId: string, email: string | null | undefined, serviceId: string, at: Date): Promise<UsablePackage | null> {
  const e = email?.trim().toLowerCase();
  if (!e) return null;
  const rows = await db
    .select({ id: s.clientPackages.id, name: s.packages.name, usesLeft: s.clientPackages.usesLeft, expiresAt: s.clientPackages.expiresAt })
    .from(s.clientPackages)
    .innerJoin(s.clients, eq(s.clients.id, s.clientPackages.clientId))
    .innerJoin(s.packages, eq(s.packages.id, s.clientPackages.packageId))
    .innerJoin(s.packageItems, and(eq(s.packageItems.packageId, s.packages.id), eq(s.packageItems.serviceId, serviceId)))
    .where(
      and(
        eq(s.clients.businessId, businessId),
        sql`lower(${s.clients.email}) = ${e}`,
        gt(s.clientPackages.usesLeft, 0),
        or(isNull(s.clientPackages.expiresAt), gt(s.clientPackages.expiresAt, at)),
      ),
    )
    // esimesena see, mis aegub kõige varem
    .orderBy(sql`${s.clientPackages.expiresAt} asc nulls last`)
    .limit(1);
  return rows[0] ? { id: rows[0].id, name: rows[0].name, usesLeft: rows[0].usesLeft } : null;
}

export type GiftCheck = { ok: true; id: string; code: string; balanceCents: number } | { ok: false; reason: string };

export async function checkGiftCard(businessId: string, raw: string): Promise<GiftCheck> {
  const code = normalizeGiftCode(raw);
  if (!code) return { ok: false, reason: "Sisesta kinkekaardi kood" };
  const g = await db.query.giftCards.findFirst({ where: and(eq(s.giftCards.businessId, businessId), eq(s.giftCards.code, code)) });
  if (!g) return { ok: false, reason: "Sellist kinkekaarti ei ole" };
  if (g.expiresAt < new Date()) return { ok: false, reason: "Kinkekaart on aegunud" };
  if (g.balanceCents <= 0) return { ok: false, reason: "Kinkekaardi saldo on kasutatud" };
  return { ok: true, id: g.id, code: g.code, balanceCents: g.balanceCents };
}

/**
 * Arvuta, kui palju jääb pärast paketti/kinkekaarti tasuda.
 * Pakett katab teenuse täielikult; kinkekaart katab kuni oma saldo.
 */
export function applyPrepaid(finalCents: number, depositPercent: number, opts: { pkg?: UsablePackage | null; gift?: { code: string; balanceCents: number } | null }) {
  if (opts.pkg) {
    return { payableCents: 0, depositCents: 0, giftCents: 0, line: { label: `Pakett: ${opts.pkg.name}`, amountCents: -finalCents, kind: "package" as const } };
  }
  const giftCents = opts.gift ? Math.min(opts.gift.balanceCents, finalCents) : 0;
  const payableCents = finalCents - giftCents;
  const depositCents = Math.min(Math.round((finalCents * depositPercent) / 100), payableCents);
  return {
    payableCents,
    depositCents,
    giftCents,
    line: giftCents > 0 ? { label: `Kinkekaart ${opts.gift!.code}`, amountCents: -giftCents, kind: "giftcard" as const } : null,
  };
}

/** Tühistatud broneering: paketi kord ja kinkekaardi saldo tagasi (korduvalt ohutu) */
export async function releasePrepaid(bookingId: string) {
  await db.transaction(async (tx) => {
    const [b] = await tx
      .select({ id: s.bookings.id, clientPackageId: s.bookings.clientPackageId, giftCardId: s.bookings.giftCardId, giftCardCents: s.bookings.giftCardCents })
      .from(s.bookings)
      .where(eq(s.bookings.id, bookingId))
      .for("update");
    if (!b) return;
    if (b.clientPackageId) {
      await tx.update(s.clientPackages).set({ usesLeft: sql`least(${s.clientPackages.usesLeft} + 1, ${s.clientPackages.usesTotal})` }).where(eq(s.clientPackages.id, b.clientPackageId));
    }
    if (b.giftCardId && b.giftCardCents > 0) {
      await tx.update(s.giftCards).set({ balanceCents: sql`${s.giftCards.balanceCents} + ${b.giftCardCents}` }).where(eq(s.giftCards.id, b.giftCardId));
      await tx.delete(s.giftCardRedemptions).where(and(eq(s.giftCardRedemptions.giftCardId, b.giftCardId), eq(s.giftCardRedemptions.bookingId, b.id)));
    }
    if (b.clientPackageId || b.giftCardCents > 0) {
      await tx.update(s.bookings).set({ clientPackageId: null, giftCardCents: 0 }).where(eq(s.bookings.id, b.id));
    }
  });
}

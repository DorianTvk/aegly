import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { computePrice, type CodeInput, type PriceResult } from "@/lib/pricing";
import { isoWeekday, localDate, localMinutes } from "@/lib/time";

export type CodeCheck = { ok: true; code: CodeInput } | { ok: false; reason: string };

/** Koodi kehtivuse kontroll väljaspool hinnaarvutust: olemasolu, aeg, kasutuskorrad, uus klient */
export async function checkDiscountCode(businessId: string, rawCode: string, opts: { clientEmail?: string | null; at?: Date } = {}): Promise<CodeCheck> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { ok: false, reason: "Sisesta kood" };
  const k = await db.query.discountCodes.findFirst({
    where: and(eq(s.discountCodes.businessId, businessId), sql`upper(${s.discountCodes.code}) = ${code}`),
  });
  const at = opts.at ?? new Date();
  if (!k || !k.active) return { ok: false, reason: "Sellist sooduskoodi ei ole" };
  if (k.startsAt && at < k.startsAt) return { ok: false, reason: "Kood ei kehti veel" };
  if (k.endsAt && at > k.endsAt) return { ok: false, reason: "Kood on aegunud" };
  if (k.maxUses !== null && k.usedCount >= k.maxUses) return { ok: false, reason: "Kood on ära kasutatud" };

  if (opts.clientEmail && (k.newClientsOnly || k.maxUsesPerClient !== null)) {
    const client = await db.query.clients.findFirst({
      where: and(eq(s.clients.businessId, businessId), sql`lower(${s.clients.email}) = ${opts.clientEmail.toLowerCase()}`),
    });
    if (client) {
      const visits = await db.$count(s.bookings, and(eq(s.bookings.clientId, client.id), sql`${s.bookings.status} <> 'CANCELLED'`));
      if (k.newClientsOnly && visits > 0) return { ok: false, reason: "Kood kehtib ainult uutele klientidele" };
      if (k.maxUsesPerClient !== null) {
        const used = await db.$count(s.bookings, and(eq(s.bookings.clientId, client.id), eq(s.bookings.discountCodeId, k.id)));
        if (used >= k.maxUsesPerClient) return { ok: false, reason: "Oled seda koodi juba kasutanud" };
      }
    }
  }
  return {
    ok: true,
    code: { id: k.id, code: k.code, kind: k.kind, value: k.value, minAmountCents: k.minAmountCents, combinable: k.combinable, serviceIds: k.serviceIds, categoryIds: k.categoryIds },
  };
}

/** Lõpphind konkreetsele broneeringule */
export async function quotePrice(
  businessId: string,
  input: { serviceId: string; staffId: string | null; startsAt: Date; code?: CodeInput | null; now?: Date },
): Promise<PriceResult | null> {
  const [business, service, rules, campaigns] = await Promise.all([
    db.query.businesses.findFirst({ where: eq(s.businesses.id, businessId) }),
    db.query.services.findFirst({ where: and(eq(s.services.id, input.serviceId), eq(s.services.businessId, businessId)), with: { staff: true } }),
    db.query.priceRules.findMany({ where: and(eq(s.priceRules.businessId, businessId), eq(s.priceRules.active, true)) }),
    db.query.campaigns.findMany({ where: and(eq(s.campaigns.businessId, businessId), eq(s.campaigns.active, true)) }),
  ]);
  if (!business || !service) return null;
  const tz = business.timezone;
  const isoDate = localDate(input.startsAt, tz);
  const now = input.now ?? new Date();
  const link = input.staffId ? service.staff.find((l) => l.staffId === input.staffId) : undefined;

  return computePrice({
    ctx: {
      isoDate,
      weekday: isoWeekday(isoDate),
      startMinutes: localMinutes(input.startsAt, tz),
      leadHours: Math.max(0, (input.startsAt.getTime() - now.getTime()) / 3_600_000),
      serviceId: service.id,
      categoryId: service.categoryId,
      staffId: input.staffId,
    },
    at: input.startsAt,
    baseCents: service.priceType === "FREE" ? 0 : service.priceCents,
    staffPriceCents: link?.priceCents ?? null,
    rules,
    campaigns,
    code: input.code,
    depositPercent: service.depositPercent,
    vatPercent: Number(service.vatRate ?? business.vatRate),
    pricesIncludeVat: business.pricesIncludeVat,
  });
}

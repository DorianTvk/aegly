import "server-only";
import { and, eq, gt, inArray, lt, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { localDate, localMinutes } from "@/lib/time";
import { getSlots } from "./availability";
import { checkDiscountCode, quotePrice } from "./pricing";

export type NewClient = { name: string; email?: string | null; phone?: string | null; consentSms?: boolean; consentMarketing?: boolean };

export type CreateBookingInput = {
  businessId: string;
  serviceId: string;
  /** null = "Ükskõik kes" – mootor valib vaba töötaja */
  staffId: string | null;
  startsAt: Date;
  client: { id: string } | NewClient;
  code?: string | null;
  source: "WIDGET" | "ADMIN";
  /** halduspaneel: käsitsi hind sentides (ülekirjutab arvutuse) */
  priceOverrideCents?: number | null;
  /** halduspaneel: ei kontrolli etteteatamisaega */
  ignoreLead?: boolean;
  paid?: boolean;
  /** vidin enne maksete lisandumist: ettemaks tasutakse kohapeal, broneering kinnitatakse kohe */
  deferPayment?: boolean;
  note?: string | null;
};

export type CreateBookingResult = { ok: true; bookingId: string; number: string } | { ok: false; reason: string };

async function nextNumber(): Promise<string> {
  const [row] = await db.select({ max: sql<number>`coalesce(max(substring(${s.bookings.number} from 4)::int), 20400)` }).from(s.bookings);
  return `BL-${Number(row.max) + 1}`;
}

/**
 * Loob broneeringu. Kontrollib, et aeg on endiselt vaba (lukuga, et kaks klienti ei saaks sama aega),
 * arvutab hinna mootoriga ja seob kliendi (olemasolev või uus e-posti järgi).
 */
export async function createBooking(input: CreateBookingInput): Promise<CreateBookingResult> {
  const business = await db.query.businesses.findFirst({ where: eq(s.businesses.id, input.businessId) });
  const service = await db.query.services.findFirst({ where: and(eq(s.services.id, input.serviceId), eq(s.services.businessId, input.businessId)) });
  if (!business || !service) return { ok: false, reason: "Teenust ei leitud" };
  const tz = business.timezone;
  const isoDate = localDate(input.startsAt, tz);
  const start = localMinutes(input.startsAt, tz);

  // 1. vaba aja kontroll mootoriga
  const { slots } = await getSlots(input.businessId, input.serviceId, input.staffId, isoDate, { ignoreLead: input.ignoreLead });
  const slot = slots.find((x) => x.start === start);
  if (!slot) return { ok: false, reason: "See aeg ei ole enam vaba. Vali teine aeg." };
  const staffId = input.staffId ?? slot.staffIds[0];

  // 2. klient
  let clientId: string;
  let clientEmail: string | null = null;
  if ("id" in input.client) {
    const c = await db.query.clients.findFirst({ where: and(eq(s.clients.id, input.client.id), eq(s.clients.businessId, input.businessId)) });
    if (!c) return { ok: false, reason: "Klienti ei leitud" };
    clientId = c.id;
    clientEmail = c.email;
  } else {
    const nc = input.client;
    clientEmail = nc.email?.toLowerCase().trim() || null;
    const existing = clientEmail
      ? await db.query.clients.findFirst({ where: and(eq(s.clients.businessId, input.businessId), sql`lower(${s.clients.email}) = ${clientEmail}`) })
      : null;
    if (existing) {
      clientId = existing.id;
      await db.update(s.clients).set({ phone: existing.phone ?? nc.phone ?? null }).where(eq(s.clients.id, existing.id));
    } else {
      const [c] = await db
        .insert(s.clients)
        .values({
          businessId: input.businessId, name: nc.name.trim(), email: clientEmail, phone: nc.phone?.trim() || null,
          consentTermsAt: new Date(), consentSms: nc.consentSms ?? false, consentMarketing: nc.consentMarketing ?? false,
        })
        .returning({ id: s.clients.id });
      clientId = c.id;
    }
  }

  // 3. hind
  let codeInput = null;
  if (input.code) {
    const check = await checkDiscountCode(input.businessId, input.code, { clientEmail });
    if (!check.ok) return { ok: false, reason: check.reason };
    codeInput = check.code;
  }
  const price = await quotePrice(input.businessId, { serviceId: service.id, staffId, startsAt: input.startsAt, code: codeInput });
  if (!price) return { ok: false, reason: "Hinda ei õnnestunud arvutada" };
  const final = input.priceOverrideCents ?? price.finalCents;
  const lines = input.priceOverrideCents != null && input.priceOverrideCents !== price.finalCents
    ? [...price.lines, { label: "Käsitsi muudetud hind", amountCents: input.priceOverrideCents - price.finalCents, kind: "info" as const }]
    : price.lines;
  const deposit = Math.round((final * service.depositPercent) / 100);

  const duration = (slot.end - slot.start) * 60_000;
  const endsAt = new Date(input.startsAt.getTime() + duration);

  // 4. salvestamine lukuga: sama töötaja kattuvad broneeringud keelatud
  try {
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${staffId}))`);
      const clash = await tx
        .select({ id: s.bookings.id })
        .from(s.bookings)
        .where(
          and(
            eq(s.bookings.staffId, staffId),
            inArray(s.bookings.status, ["HELD", "PENDING_PAYMENT", "CONFIRMED"]),
            lt(s.bookings.startsAt, new Date(endsAt.getTime() + service.bufferMinutes * 60_000)),
            gt(sql`${s.bookings.endsAt} + make_interval(mins => ${s.bookings.bufferMinutes})`, new Date(input.startsAt.getTime() - service.bufferBeforeMinutes * 60_000)),
          ),
        )
        .limit(1);
      if (clash.length) throw new Error("CLASH");

      const needsPayment = input.source === "WIDGET" && deposit > 0 && !input.paid && !input.deferPayment;
      const status = needsPayment ? "PENDING_PAYMENT" : business.autoConfirm || input.source === "ADMIN" ? "CONFIRMED" : "PENDING_PAYMENT";
      const [b] = await tx
        .insert(s.bookings)
        .values({
          number: await nextNumber(),
          businessId: input.businessId,
          clientId,
          serviceId: service.id,
          staffId,
          startsAt: input.startsAt,
          endsAt,
          bufferMinutes: service.bufferMinutes,
          status,
          source: input.source,
          basePriceCents: price.baseCents,
          finalPriceCents: final,
          depositCents: deposit,
          priceBreakdown: lines,
          discountCodeId: price.code?.id ?? null,
          campaignId: price.campaign?.id ?? null,
          note: input.note ?? null,
        })
        .returning({ id: s.bookings.id, number: s.bookings.number });
      if (price.code) await tx.update(s.discountCodes).set({ usedCount: sql`${s.discountCodes.usedCount} + 1` }).where(eq(s.discountCodes.id, price.code.id));
      if (input.paid && final > 0) {
        await tx.insert(s.payments).values({ businessId: input.businessId, bookingId: b.id, amountCents: final, status: "SUCCEEDED", method: "kohapeal" });
      }
      return b;
    });
    return { ok: true, bookingId: result.id, number: result.number };
  } catch (e) {
    if (e instanceof Error && e.message === "CLASH") return { ok: false, reason: "See aeg broneeriti just ära. Vali teine aeg." };
    throw e;
  }
}

"use server";

import { releasePrepaid } from "@/server/prepaid";
import { reportError } from "@/lib/report";

import { recordAttempt, widgetGuard } from "@/server/bot-protection";
import { canTakeDeposits, createDepositCheckout } from "@/server/stripe";
import { after } from "next/server";
import { appUrl } from "@/lib/app-url";
import { notifyBooking, notifySalon } from "@/server/notify";
import { recordActivity } from "@/server/activity";
import { smsConfigured } from "@/server/messaging";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema as s } from "@/db";
import { fromMinutes, todayIso, zonedDateTime } from "@/lib/time";
import { getSlots } from "@/server/availability";
import { checkDiscountCode, quotePrice } from "@/server/pricing";
import { applyPrepaid, checkGiftCard, findUsablePackage } from "@/server/prepaid";
import { startShopOrder } from "@/server/shop";
import { createBooking } from "@/server/bookings";
import { findPublicBusiness, firstFree, weekAvailability } from "@/server/widget";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const idStr = z.string().min(1).max(64);

async function ctx(slug: string, serviceId: string) {
  const business = await findPublicBusiness(slug);
  if (!business) return null;
  const service = await db.query.services.findFirst({
    where: and(eq(s.services.id, serviceId), eq(s.services.businessId, business.id), eq(s.services.status, "ACTIVE"), eq(s.services.bookableOnline, true)),
  });
  if (!service) return null;
  return { business, service };
}

/** W4: esimene vaba aeg iga töötaja ja "Ükskõik kes" jaoks */
export async function staffFirstFree(slug: string, serviceId: string, staffIds: string[]) {
  const c = await ctx(slug, idStr.parse(serviceId));
  if (!c) return null;
  const today = todayIso(c.business.timezone);
  const ids = z.array(idStr).max(50).parse(staffIds);
  const [any, ...each] = await Promise.all([firstFree(c.business.id, c.service.id, null, today), ...ids.map((id) => firstFree(c.business.id, c.service.id, id, today))]);
  const fmt = (r: { date: string; start: number } | null) => (r ? { date: r.date, time: fromMinutes(r.start) } : null);
  return { any: fmt(any), staff: Object.fromEntries(ids.map((id, i) => [id, fmt(each[i])])) as Record<string, { date: string; time: string } | null> };
}

/** W5: nädala riba (mis päevadel on vabu aegu) */
export async function weekDays(slug: string, serviceId: string, staffId: string | null, fromIso: string) {
  const c = await ctx(slug, idStr.parse(serviceId));
  if (!c) return [];
  return weekAvailability(c.business.id, c.service.id, staffId ? idStr.parse(staffId) : null, isoDate.parse(fromIso));
}

/** W5 / W5b: päeva vabad ajad; kui päev on täis, järgmine vaba päev */
export async function daySlots(slug: string, serviceId: string, staffId: string | null, date: string) {
  const c = await ctx(slug, idStr.parse(serviceId));
  if (!c) return { slots: [], reason: "closed" as const, next: null };
  const staff = staffId ? idStr.parse(staffId) : null;
  const d = isoDate.parse(date);
  const { slots, reason } = await getSlots(c.business.id, c.service.id, staff, d);
  const names = new Map((await db.query.staffMembers.findMany({ where: eq(s.staffMembers.businessId, c.business.id) })).map((m) => [m.id, m.name]));
  const next = slots.length ? null : await firstFree(c.business.id, c.service.id, staff, d, 30);
  return {
    slots: slots.map((x) => ({ time: fromMinutes(x.start), end: fromMinutes(x.end), staffId: x.staffIds[0], staffName: names.get(x.staffIds[0]) ?? "" })),
    reason: reason ?? null,
    next: next ? { date: next.date, time: fromMinutes(next.start) } : null,
  };
}

const quoteSchema = z.object({
  slug: z.string().max(80),
  serviceId: idStr,
  staffId: idStr,
  date: isoDate,
  time: hhmm,
  code: z.string().trim().max(40).optional(),
  email: z.string().trim().max(200).optional(),
  giftCode: z.string().trim().max(40).optional(),
  usePackage: z.boolean().optional(),
});

/** W6–W7: hind koos sooduskoodiga */
export async function quote(input: z.input<typeof quoteSchema>) {
  const q = quoteSchema.parse(input);
  const c = await ctx(q.slug, q.serviceId);
  if (!c) return { ok: false as const, reason: "Teenust ei leitud" };
  let code = null;
  let codeMessage: string | null = null;
  if (q.code) {
    const check = await checkDiscountCode(c.business.id, q.code, { clientEmail: q.email || null });
    if (check.ok) code = check.code;
    else codeMessage = check.reason;
  }
  const startsAt = zonedDateTime(q.date, q.time, c.business.timezone);
  const price = await quotePrice(c.business.id, { serviceId: c.service.id, staffId: q.staffId, startsAt, code });
  if (!price) return { ok: false as const, reason: "Hinda ei õnnestunud arvutada" };
  // ostetud pakett (sama e-postiga) või kinkekaart
  const pkg = q.email ? await findUsablePackage(c.business.id, q.email, c.service.id, startsAt) : null;
  const usePkg = !!pkg && q.usePackage !== false;
  let gift: { code: string; balanceCents: number } | null = null;
  let giftMessage: string | null = null;
  if (!usePkg && q.giftCode) {
    const g = await checkGiftCard(c.business.id, q.giftCode);
    if (g.ok) gift = g;
    else giftMessage = g.reason;
  }
  const prepaid = applyPrepaid(price.finalCents, c.service.depositPercent, { pkg: usePkg ? pkg : null, gift });
  if (code && !price.code) {
    codeMessage = price.codeRejected === "min-amount" ? "Kood nõuab suuremat summat" : price.codeRejected === "not-combinable" ? "Koodi ei saa kampaaniaga kombineerida" : "Kood ei kehti sellele teenusele";
  }
  return {
    ok: true as const,
    lines: [...price.lines.filter((l) => l.kind !== "info"), ...(prepaid.line ? [prepaid.line] : [])],
    finalCents: prepaid.payableCents,
    baseCents: price.staffCents,
    depositCents: prepaid.depositCents,
    payOnSiteCents: prepaid.payableCents - prepaid.depositCents,
    code: price.code ? { code: price.code.code, discountCents: price.code.discountCents } : null,
    codeMessage,
    pkg: pkg ? { name: pkg.name, usesLeft: pkg.usesLeft, applied: usePkg } : null,
    gift: gift && prepaid.giftCents > 0 ? { code: gift.code, appliedCents: prepaid.giftCents, balanceCents: gift.balanceCents } : null,
    giftMessage,
  };
}

const bookSchema = quoteSchema.extend({
  name: z.string().trim().min(2, "Sisesta nimi").max(80),
  email: z.email("Sisesta kehtiv e-post"),
  phone: z.string().trim().min(5, "Sisesta telefon").max(30),
  smsReminder: z.boolean(),
  terms: z.literal(true, { error: "Nõustu broneerimistingimustega" }),
  /** honeypot – peab jääma tühjaks */
  website: z.string().max(200).optional(),
});

/** W7 → W8: broneeringu loomine. Maksed lisanduvad hiljem – seni tasutakse ettemaks kohapeal. */
export async function book(input: z.input<typeof bookSchema>) {
  const parsed = bookSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, reason: parsed.error.issues[0]?.message ?? "Kontrolli andmeid" };
  const q = parsed.data;
  const guard = await widgetGuard("WIDGET_BOOK", q.email, q.website);
  if (guard.error) return { ok: false as const, reason: guard.error };
  const c = await ctx(q.slug, q.serviceId);
  if (!c) return { ok: false as const, reason: "Teenust ei leitud" };
  await recordAttempt("WIDGET_BOOK", guard.ip, q.email.toLowerCase(), true);
  const res = await createBooking({
    businessId: c.business.id,
    serviceId: c.service.id,
    staffId: q.staffId,
    startsAt: zonedDateTime(q.date, q.time, c.business.timezone),
    client: { name: q.name, email: q.email, phone: q.phone, consentSms: q.smsReminder && smsConfigured() },
    code: q.code || null,
    giftCode: q.giftCode || null,
    usePackage: !!q.usePackage,
    source: "WIDGET",
    // veebiettemaks ainult siis, kui salong on Stripe'i ühendanud; muidu tasub kohapeal
    deferPayment: !canTakeDeposits(c.business),
  });
  if (!res.ok) return res;
  const base = await appUrl();
  const b = await db.query.bookings.findFirst({ where: eq(s.bookings.id, res.bookingId) });
  if (b!.status === "PENDING_PAYMENT" && b!.depositCents > 0 && canTakeDeposits(c.business)) {
    // ettemaks: teavitused lähevad alles pärast makset (syncCheckout)
    try {
      const checkoutUrl = await createDepositCheckout(b!.id, base);
      return { ok: true as const, number: res.number, manageToken: b!.manageToken, finalCents: b!.finalPriceCents - b!.giftCardCents, prepaid: b!.clientPackageId ? ("package" as const) : b!.giftCardCents > 0 ? ("gift" as const) : null, depositCents: b!.depositCents, checkoutUrl };
    } catch (e) {
      reportError("stripe checkout", e);
      await db.update(s.bookings).set({ status: "CANCELLED", cancelledAt: new Date(), cancelReason: "Makse alustamine ebaõnnestus" }).where(eq(s.bookings.id, b!.id));
      await releasePrepaid(b!.id);
      return { ok: false as const, reason: "Makse alustamine ebaõnnestus. Proovi uuesti või võta ühendust teenusepakkujaga." };
    }
  }
  after(() =>
    Promise.all([
      res.status === "CONFIRMED" ? notifyBooking(res.bookingId, "CONFIRMATION", base) : null,
      notifySalon(res.bookingId, "NEW", base),
      recordActivity(c.business.id, "BOOKING_NEW", { bookingId: res.bookingId }),
    ]),
  );
  return { ok: true as const, number: res.number, manageToken: b!.manageToken, finalCents: b!.finalPriceCents - b!.giftCardCents, prepaid: b!.clientPackageId ? ("package" as const) : b!.giftCardCents > 0 ? ("gift" as const) : null, depositCents: b!.depositCents, checkoutUrl: null };
}

const waitSchema = z.object({ slug: z.string().max(80), serviceId: idStr, staffId: idStr.nullable(), date: isoDate, name: z.string().trim().min(2, "Sisesta nimi").max(80), email: z.email("Sisesta kehtiv e-post"), website: z.string().max(200).optional() });

/** W5b: ootenimekiri */
export async function joinWaitlist(input: z.input<typeof waitSchema>) {
  const parsed = waitSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, reason: parsed.error.issues[0]?.message ?? "Kontrolli andmeid" };
  const q = parsed.data;
  const guard = await widgetGuard("WIDGET_WAIT", q.email, q.website);
  if (guard.error) return { ok: false as const, reason: guard.error };
  const c = await ctx(q.slug, q.serviceId);
  if (!c) return { ok: false as const, reason: "Teenust ei leitud" };
  const email = q.email.toLowerCase();
  await recordAttempt("WIDGET_WAIT", guard.ip, email, true);
  let client = await db.query.clients.findFirst({ where: and(eq(s.clients.businessId, c.business.id), eq(s.clients.email, email)) });
  if (!client) [client] = await db.insert(s.clients).values({ businessId: c.business.id, name: q.name, email }).returning();
  await db.insert(s.waitlistEntries).values({ businessId: c.business.id, clientId: client.id, serviceId: c.service.id, staffId: q.staffId, date: q.date });
  const [y, m, d] = q.date.split("-");
  after(() => recordActivity(c.business.id, "WAITLIST", { body: `${q.name} · ${c.service.name} · ${d}.${m}.${y}` }));
  return { ok: true as const };
}

// ---------- Pood: kinkekaart ja pakett ----------

const giftSchema = z.object({
  slug: z.string().max(80),
  amountCents: z.number().int().positive(),
  buyerName: z.string().trim().min(2, "Sisesta nimi").max(80),
  buyerEmail: z.email("Sisesta kehtiv e-post"),
  forOther: z.boolean(),
  recipientName: z.string().trim().max(80).optional(),
  recipientEmail: z.union([z.literal(""), z.email("Sisesta saaja kehtiv e-post")]).optional(),
  message: z.string().trim().max(300).optional(),
  lang: z.enum(["et", "en", "ru"]),
  terms: z.literal(true, { error: "Nõustu tingimustega" }),
  website: z.string().max(200).optional(),
});

/** Kinkekaardi ost → Stripe'i makseleht */
export async function buyGiftCard(input: z.input<typeof giftSchema>) {
  const parsed = giftSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, reason: parsed.error.issues[0]?.message ?? "Kontrolli andmeid" };
  const q = parsed.data;
  if (q.forOther && !q.recipientEmail) return { ok: false as const, reason: "Sisesta saaja kehtiv e-post" };
  const guard = await widgetGuard("WIDGET_BOOK", q.buyerEmail, q.website);
  if (guard.error) return { ok: false as const, reason: guard.error };
  const b = await findPublicBusiness(q.slug);
  if (!b) return { ok: false as const, reason: "Teenust ei leitud" };
  await recordAttempt("WIDGET_BOOK", guard.ip, q.buyerEmail.toLowerCase(), true);
  try {
    return await startShopOrder(b, {
      kind: "GIFT_CARD", amountCents: q.amountCents, buyerName: q.buyerName, buyerEmail: q.buyerEmail, lang: q.lang,
      recipientName: q.forOther ? q.recipientName || null : null, recipientEmail: q.forOther ? q.recipientEmail || null : null, message: q.forOther ? q.message || null : null,
    }, await appUrl());
  } catch (e) {
    reportError("shop gift checkout", e);
    return { ok: false as const, reason: "Makse alustamine ebaõnnestus. Proovi uuesti või võta ühendust teenusepakkujaga." };
  }
}

const packageSchema = z.object({
  slug: z.string().max(80),
  packageId: idStr,
  buyerName: z.string().trim().min(2, "Sisesta nimi").max(80),
  buyerEmail: z.email("Sisesta kehtiv e-post"),
  buyerPhone: z.string().trim().max(30).optional(),
  lang: z.enum(["et", "en", "ru"]),
  terms: z.literal(true, { error: "Nõustu tingimustega" }),
  website: z.string().max(200).optional(),
});

/** Paketi ost → Stripe'i makseleht */
export async function buyPackage(input: z.input<typeof packageSchema>) {
  const parsed = packageSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, reason: parsed.error.issues[0]?.message ?? "Kontrolli andmeid" };
  const q = parsed.data;
  const guard = await widgetGuard("WIDGET_BOOK", q.buyerEmail, q.website);
  if (guard.error) return { ok: false as const, reason: guard.error };
  const b = await findPublicBusiness(q.slug);
  if (!b) return { ok: false as const, reason: "Teenust ei leitud" };
  await recordAttempt("WIDGET_BOOK", guard.ip, q.buyerEmail.toLowerCase(), true);
  try {
    return await startShopOrder(b, { kind: "PACKAGE", packageId: q.packageId, buyerName: q.buyerName, buyerEmail: q.buyerEmail, buyerPhone: q.buyerPhone || null, lang: q.lang }, await appUrl());
  } catch (e) {
    reportError("shop package checkout", e);
    return { ok: false as const, reason: "Makse alustamine ebaõnnestus. Proovi uuesti või võta ühendust teenusepakkujaga." };
  }
}

import "server-only";
import Stripe from "stripe";
import { and, eq, gt, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { formatShortDate, localDate, localTime } from "@/lib/time";
import { notifyBooking, notifySalon } from "./notify";
import { recordActivity } from "./activity";
import { industryByLabel } from "@/lib/industries";

/**
 * Stripe Connect (direct charges): klient maksab ettemaksu otse salongi Stripe'i kontole.
 * Aegly platvorm ise raha ei hoia ega võta vahendustasu.
 */

let client: Stripe | null = null;

export const stripeConfigured = () => !!process.env.STRIPE_SECRET_KEY;

export function stripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY puudub");
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY, { appInfo: { name: "Aegly" } });
  return client;
}

/** Kas salong saab veebis ettemakse vastu võtta */
export const canTakeDeposits = (b: { stripeAccountId: string | null; stripeChargesEnabled: boolean }) => stripeConfigured() && !!b.stripeAccountId && b.stripeChargesEnabled;

/** Ettemaksu tasumiseks on aega (Checkouti minimaalne aegumine on 30 min) */
const HOLD_MINUTES = 30;

// ---------- Salongi konto ühendamine ----------

/** Loo (vajadusel) salongi Stripe'i konto ja tagasta Stripe'i liitumisvormi link */
export async function onboardingLink(businessId: string, base: string): Promise<string> {
  const b = await db.query.businesses.findFirst({ where: eq(s.businesses.id, businessId) });
  if (!b) throw new Error("Ettevõtet ei leitud");
  let accountId = b.stripeAccountId;
  if (!accountId) {
    const owner = await db.query.users.findFirst({ where: and(eq(s.users.businessId, businessId), eq(s.users.role, "OWNER")) });
    const acct = await stripe().accounts.create({
      type: "standard",
      country: "EE",
      email: owner?.email,
      business_profile: { name: b.name, url: b.website ?? undefined, mcc: industryByLabel(b.industry)?.mcc },
      metadata: { businessId },
    });
    accountId = acct.id;
    await db.update(s.businesses).set({ stripeAccountId: accountId }).where(eq(s.businesses.id, businessId));
  }
  const link = await stripe().accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: `${base}/seaded?stripe=uuesti`,
    return_url: `${base}/seaded?stripe=tagasi`,
  });
  return link.url;
}

/** Värskenda salongi konto staatus Stripe'ist */
export async function syncAccount(accountId: string) {
  const acct = await stripe().accounts.retrieve(accountId);
  await applyAccount(acct);
  return acct;
}

export async function applyAccount(acct: Stripe.Account) {
  await db
    .update(s.businesses)
    .set({ stripeChargesEnabled: !!acct.charges_enabled, stripeDetailsSubmitted: !!acct.details_submitted })
    .where(eq(s.businesses.stripeAccountId, acct.id));
}

// ---------- Ettemaks ----------

/** Loo broneeringu ettemaksu Checkout ja hoia aega kinni kuni makse aegumiseni */
export async function createDepositCheckout(bookingId: string, base: string): Promise<string> {
  const b = await db.query.bookings.findFirst({ where: eq(s.bookings.id, bookingId), with: { service: true, client: true } });
  if (!b) throw new Error("Broneeringut ei leitud");
  const biz = await db.query.businesses.findFirst({ where: eq(s.businesses.id, b.businessId) });
  if (!biz?.stripeAccountId || b.depositCents <= 0) throw new Error("Ettemaks pole võimalik");

  const expiresAt = Math.floor(Date.now() / 1000) + HOLD_MINUTES * 60 + 30;
  const session = await stripe().checkout.sessions.create(
    {
      mode: "payment",
      locale: "et",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: b.depositCents,
            product_data: {
              name: `Ettemaks: ${b.service.name}`,
              description: `${formatShortDate(localDate(b.startsAt, biz.timezone))} kell ${localTime(b.startsAt, biz.timezone)} · ${biz.name}`,
            },
          },
        },
      ],
      customer_email: b.client.email ?? undefined,
      expires_at: expiresAt,
      success_url: `${base}/b/${b.manageToken}?makse=ok&s={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/b/${b.manageToken}?makse=katkestatud`,
      metadata: { bookingId: b.id, businessId: b.businessId },
      payment_intent_data: { description: `Broneering ${b.number}`, metadata: { bookingId: b.id } },
    },
    { stripeAccount: biz.stripeAccountId },
  );

  await db.insert(s.payments).values({
    businessId: b.businessId,
    bookingId: b.id,
    amountCents: b.depositCents,
    status: "PENDING",
    method: "stripe",
    stripeCheckoutSessionId: session.id,
    stripeAccountId: biz.stripeAccountId,
  });
  await db.update(s.bookings).set({ holdExpiresAt: new Date(expiresAt * 1000) }).where(eq(s.bookings.id, b.id));
  return session.url!;
}

/**
 * Kontrolli Checkouti seisu ja uuenda broneering. Kutsutakse webhookist ja ka siis,
 * kui klient naaseb makselehelt (nii töötab ka siis, kui webhook hilineb).
 */
export async function syncCheckout(sessionId: string, base: string): Promise<"paid" | "open" | "expired" | null> {
  const payment = await db.query.payments.findFirst({ where: eq(s.payments.stripeCheckoutSessionId, sessionId) });
  if (!payment?.bookingId || !payment.stripeAccountId) return null;
  if (payment.status === "SUCCEEDED" || payment.status === "REFUNDED") return "paid";

  const session = await stripe().checkout.sessions.retrieve(sessionId, {}, { stripeAccount: payment.stripeAccountId });
  if (session.payment_status === "paid") {
    const pi = typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null);
    const updated = await db
      .update(s.payments)
      .set({ status: "SUCCEEDED", stripePaymentIntentId: pi })
      .where(and(eq(s.payments.id, payment.id), eq(s.payments.status, "PENDING")))
      .returning({ id: s.payments.id });
    if (!updated.length) return "paid"; // teine päring jõudis ette
    const [b] = await db
      .update(s.bookings)
      .set({ status: "CONFIRMED", holdExpiresAt: null })
      .where(and(eq(s.bookings.id, payment.bookingId), eq(s.bookings.status, "PENDING_PAYMENT")))
      .returning({ id: s.bookings.id, businessId: s.bookings.businessId });
    if (b) {
      await Promise.all([
        notifyBooking(b.id, "CONFIRMATION", base),
        notifySalon(b.id, "NEW", base),
        recordActivity(b.businessId, "BOOKING_NEW", { bookingId: b.id }),
      ]);
    } else {
      // broneering jõuti vahepeal tühistada (nt aegus) – raha tagasi
      await refundBooking(payment.bookingId, "Broneering polnud enam kehtiv");
    }
    return "paid";
  }
  if (session.status === "expired") {
    await expirePayment(payment.id, payment.bookingId);
    return "expired";
  }
  return "open";
}

async function expirePayment(paymentId: string, bookingId: string) {
  await db.update(s.payments).set({ status: "FAILED" }).where(and(eq(s.payments.id, paymentId), eq(s.payments.status, "PENDING")));
  await db
    .update(s.bookings)
    .set({ status: "CANCELLED", cancelledAt: new Date(), cancelReason: "Ettemaks jäi tasumata", holdExpiresAt: null })
    .where(and(eq(s.bookings.id, bookingId), eq(s.bookings.status, "PENDING_PAYMENT")));
}

/** Tühista tasumata broneeringud, mille ettemaksu aeg on läbi (cron) */
export async function expireUnpaidHolds(now = new Date()) {
  const stale = await db
    .select({ id: s.payments.id, bookingId: s.payments.bookingId, sessionId: s.payments.stripeCheckoutSessionId, accountId: s.payments.stripeAccountId })
    .from(s.payments)
    .innerJoin(s.bookings, eq(s.bookings.id, s.payments.bookingId))
    .where(and(eq(s.payments.status, "PENDING"), eq(s.bookings.status, "PENDING_PAYMENT"), sql`${s.bookings.holdExpiresAt} < ${new Date(now.getTime() - 5 * 60_000)}`));
  let n = 0;
  for (const p of stale) {
    if (!p.bookingId) continue;
    // viimane kontroll Stripe'ist – äkki maksti just ära
    if (p.sessionId && p.accountId && stripeConfigured()) {
      const r = await syncCheckout(p.sessionId, process.env.APP_URL ?? "").catch(() => null);
      if (r === "paid") continue;
    }
    await expirePayment(p.id, p.bookingId);
    n++;
  }
  return n;
}

/** Tagasta broneeringu Stripe'i maksed. Tagastab tagastatud summa sentides. */
export async function refundBooking(bookingId: string, reason: string): Promise<number> {
  if (!stripeConfigured()) return 0;
  const paid = await db.query.payments.findMany({
    where: and(eq(s.payments.bookingId, bookingId), eq(s.payments.status, "SUCCEEDED"), gt(s.payments.amountCents, s.payments.refundedCents)),
  });
  let total = 0;
  for (const p of paid) {
    if (!p.stripePaymentIntentId || !p.stripeAccountId) continue;
    const amount = p.amountCents - p.refundedCents;
    await stripe().refunds.create(
      { payment_intent: p.stripePaymentIntentId, amount, metadata: { bookingId, reason: reason.slice(0, 200) } },
      { stripeAccount: p.stripeAccountId, idempotencyKey: `refund-${p.id}-${p.refundedCents}` },
    );
    await db.update(s.payments).set({ status: "REFUNDED", refundedCents: p.amountCents }).where(eq(s.payments.id, p.id));
    total += amount;
  }
  return total;
}

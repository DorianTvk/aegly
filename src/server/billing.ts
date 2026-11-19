import "server-only";
import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { PLANS, planPrice, type BillingPeriod, type PlanId, type PlanStatus } from "@/lib/plans";
import { stripe, stripeConfigured } from "./stripe";

/**
 * Aegly enda kuutellimus (Stripe Billing, platvormi konto).
 * Tooted, hinnad, käibemaks ja kliendiportaal luuakse Stripe'is automaatselt esimesel kasutusel.
 */

export const billingEnabled = stripeConfigured;

const VAT_PERCENT = 24; // Eesti käibemaks
const lookupKey = (plan: PlanId, period: BillingPeriod) => `aegly_${plan}_${period}`.toLowerCase();

/** Leia või loo paketi hind (lookup_key järgi) */
async function priceId(plan: PlanId, period: BillingPeriod): Promise<string> {
  const key = lookupKey(plan, period);
  const found = await stripe().prices.list({ lookup_keys: [key], active: true, limit: 1 });
  if (found.data[0]) return found.data[0].id;
  const products = await stripe().products.search({ query: `metadata['aegly_plan']:'${plan}'` }).catch(() => ({ data: [] as Stripe.Product[] }));
  const product = products.data[0] ?? (await stripe().products.create({ name: `Aegly ${PLANS[plan].name}`, metadata: { aegly_plan: plan } }));
  const price = await stripe().prices.create({
    product: product.id,
    currency: "eur",
    unit_amount: planPrice(plan, period),
    recurring: { interval: period === "YEAR" ? "year" : "month" },
    tax_behavior: "exclusive",
    lookup_key: key,
    metadata: { aegly_plan: plan, aegly_period: period },
  });
  return price.id;
}

/** Leia või loo käibemaksumäär (24%, lisandub hinnale) */
async function vatRateId(): Promise<string> {
  const list = await stripe().taxRates.list({ active: true, limit: 100 });
  const found = list.data.find((t) => t.metadata?.aegly === `ee-vat-${VAT_PERCENT}`);
  if (found) return found.id;
  const t = await stripe().taxRates.create({
    display_name: "Käibemaks",
    percentage: VAT_PERCENT,
    inclusive: false,
    country: "EE",
    jurisdiction: "EE",
    metadata: { aegly: `ee-vat-${VAT_PERCENT}` },
  });
  return t.id;
}

async function customerId(businessId: string): Promise<string> {
  const b = await db.query.businesses.findFirst({ where: eq(s.businesses.id, businessId) });
  if (!b) throw new Error("Ettevõtet ei leitud");
  if (b.stripeCustomerId) return b.stripeCustomerId;
  const c = await stripe().customers.create({
    name: b.name,
    email: b.email ?? undefined,
    preferred_locales: ["et"],
    metadata: { businessId },
  });
  await db.update(s.businesses).set({ stripeCustomerId: c.id }).where(eq(s.businesses.id, businessId));
  return c.id;
}

/** Alusta tellimust: tagastab Stripe'i makselehe aadressi */
export async function subscriptionCheckout(businessId: string, plan: PlanId, period: BillingPeriod, base: string, returnPath = "/seaded/pakett"): Promise<string> {
  const [customer, price, vat] = await Promise.all([customerId(businessId), priceId(plan, period), vatRateId()]);
  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    locale: "et",
    customer,
    customer_update: { name: "auto", address: "auto" },
    billing_address_collection: "required",
    tax_id_collection: { enabled: true },
    line_items: [{ price, quantity: 1, tax_rates: [vat] }],
    subscription_data: { metadata: { businessId, plan, period } },
    metadata: { businessId, kind: "aegly_subscription" },
    success_url: `${base}${returnPath}?tellimus=ok&s={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}${returnPath}?tellimus=katkestatud`,
  });
  return session.url!;
}

/** Vaheta olemasoleva tellimuse paketti (hinnavahe arvestatakse proportsionaalselt) */
export async function changeSubscription(subscriptionId: string, plan: PlanId, period: BillingPeriod) {
  const sub = await stripe().subscriptions.retrieve(subscriptionId);
  const item = sub.items.data[0];
  const updated = await stripe().subscriptions.update(subscriptionId, {
    items: [{ id: item.id, price: await priceId(plan, period), tax_rates: [await vatRateId()] }],
    proration_behavior: "always_invoice",
    cancel_at_period_end: false,
    metadata: { ...sub.metadata, plan, period },
  });
  await applySubscription(updated);
}

/** Leia või loo kliendiportaali seadistus (arved, makseviis, tühistamine perioodi lõpus) */
async function portalConfigId(): Promise<string> {
  const list = await stripe().billingPortal.configurations.list({ active: true, limit: 100 });
  const found = list.data.find((c) => c.metadata?.aegly === "v1");
  if (found) return found.id;
  const c = await stripe().billingPortal.configurations.create({
    business_profile: { headline: "Aegly – tellimus ja arved" },
    features: {
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      customer_update: { enabled: true, allowed_updates: ["name", "email", "address", "tax_id"] },
      subscription_cancel: { enabled: true, mode: "at_period_end", cancellation_reason: { enabled: true, options: ["too_expensive", "missing_features", "switched_service", "unused", "other"] } },
    },
    metadata: { aegly: "v1" },
  });
  return c.id;
}

export async function portalUrl(businessId: string, base: string): Promise<string> {
  const session = await stripe().billingPortal.sessions.create({
    customer: await customerId(businessId),
    configuration: await portalConfigId(),
    locale: "et",
    return_url: `${base}/seaded/pakett`,
  });
  return session.url;
}

function mapStatus(st: Stripe.Subscription.Status): PlanStatus {
  if (st === "active" || st === "trialing") return "ACTIVE";
  if (st === "past_due" || st === "unpaid") return "PAST_DUE";
  if (st === "incomplete") return "PENDING";
  return "SUSPENDED"; // canceled, incomplete_expired, paused
}

/** Kirjuta tellimuse seis ettevõttele (webhook, Checkoutist naasmine, paketi vahetus) */
export async function applySubscription(sub: Stripe.Subscription) {
  const businessId = sub.metadata?.businessId;
  if (!businessId) return;
  const item = sub.items.data[0];
  const meta = item?.price.metadata ?? {};
  const plan = (meta.aegly_plan ?? sub.metadata.plan) as PlanId | undefined;
  const period = (meta.aegly_period ?? sub.metadata.period) as BillingPeriod | undefined;
  const end = item?.current_period_end;
  const current = await db.query.businesses.findFirst({ where: eq(s.businesses.id, businessId) });
  if (!current) return;
  // vana (tühistatud) tellimus ei kirjuta üle uut
  if (current.stripeSubscriptionId && current.stripeSubscriptionId !== sub.id && sub.status === "canceled") return;
  await db
    .update(s.businesses)
    .set({
      stripeSubscriptionId: sub.id,
      planStatus: mapStatus(sub.status),
      planRenewsAt: end ? new Date(end * 1000) : null,
      planCancelAt: sub.cancel_at ? new Date(sub.cancel_at * 1000) : null,
      ...(plan && PLANS[plan] ? { plan } : {}),
      ...(period === "MONTH" || period === "YEAR" ? { billingPeriod: period } : {}),
      ...(plan !== current.plan || period !== current.billingPeriod ? { planChangedAt: new Date() } : {}),
    })
    .where(eq(s.businesses.id, businessId));
}

/** Checkoutist naasmisel – ära oota webhooki */
export async function syncSubscriptionCheckout(sessionId: string, businessId: string): Promise<boolean> {
  const session = await stripe().checkout.sessions.retrieve(sessionId, { expand: ["subscription"] });
  if (session.metadata?.businessId !== businessId || typeof session.subscription !== "object" || !session.subscription) return false;
  await applySubscription(session.subscription);
  return session.subscription.status === "active" || session.subscription.status === "trialing";
}

/** Ettevõtte kustutamisel: lõpeta tellimus kohe */
export async function cancelSubscriptionNow(subscriptionId: string | null) {
  if (!subscriptionId || !stripeConfigured()) return;
  await stripe()
    .subscriptions.cancel(subscriptionId)
    .catch((e) => console.error("[billing] cancel", e));
}

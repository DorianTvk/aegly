import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { emailHtml } from "@/lib/messages";
import { formatEuro } from "@/lib/time";
import { giftCode } from "@/lib/gift-code";
import { reportError } from "@/lib/report";
import { canTakeDeposits, stripe } from "./stripe";
import { sendEmail } from "./messaging";
import { recordActivity } from "./activity";
import { logActivity } from "./audit";

/**
 * Vidina pood: kinkekaardid ja paketid. Raha laekub otse teenusepakkuja Stripe'i kontole
 * (nagu ettemaksud); pärast makset luuakse kinkekaart või kliendi pakett ja saadetakse kirjad.
 */

type Biz = typeof s.businesses.$inferSelect;

export type ShopInfo = {
  gift: { amounts: number[]; custom: boolean; minCents: number; validityMonths: number } | null;
  packages: { id: string; name: string; description: string | null; priceCents: number; validityDays: number | null; type: "MULTI_VISIT" | "BUNDLE"; items: { serviceId: string; serviceName: string; quantity: number }[] }[];
};

/** Mida vidin müüb (ainult siis, kui teenusepakkuja saab veebimakseid vastu võtta) */
export async function shopInfo(b: Biz): Promise<ShopInfo> {
  if (!canTakeDeposits(b)) return { gift: null, packages: [] };
  const pkgs = await db.query.packages.findMany({
    where: and(eq(s.packages.businessId, b.id), eq(s.packages.active, true), eq(s.packages.sellInWidget, true)),
    orderBy: [asc(s.packages.sortOrder), asc(s.packages.name)],
  });
  const items = pkgs.length
    ? await db
        .select({ packageId: s.packageItems.packageId, serviceId: s.packageItems.serviceId, quantity: s.packageItems.quantity, name: s.services.name })
        .from(s.packageItems)
        .innerJoin(s.services, eq(s.services.id, s.packageItems.serviceId))
        .where(inArray(s.packageItems.packageId, pkgs.map((p) => p.id)))
    : [];
  return {
    gift: b.giftCardsEnabled
      ? { amounts: [...b.giftCardAmounts].sort((a, c) => a - c), custom: b.giftCardCustomAmount, minCents: b.giftCardMinCents, validityMonths: b.giftCardValidityMonths }
      : null,
    packages: pkgs
      .map((p) => ({
        id: p.id, name: p.name, description: p.description, priceCents: p.priceCents, validityDays: p.validityDays, type: p.type,
        items: items.filter((i) => i.packageId === p.id).map((i) => ({ serviceId: i.serviceId, serviceName: i.name, quantity: i.quantity })),
      }))
      .filter((p) => p.items.length > 0 && p.priceCents > 0),
  };
}

const MAX_GIFT_CENTS = 100_000; // 1000 €

export type GiftOrderInput = { amountCents: number; buyerName: string; buyerEmail: string; recipientName?: string | null; recipientEmail?: string | null; message?: string | null; lang: string };
export type PackageOrderInput = { packageId: string; buyerName: string; buyerEmail: string; buyerPhone?: string | null; lang: string };

/** Alusta kinkekaardi või paketi ostu → Stripe'i makselehe aadress */
export async function startShopOrder(b: Biz, input: ({ kind: "GIFT_CARD" } & GiftOrderInput) | ({ kind: "PACKAGE" } & PackageOrderInput), base: string): Promise<{ ok: true; url: string } | { ok: false; reason: string }> {
  if (!canTakeDeposits(b) || !b.stripeAccountId) return { ok: false, reason: "Veebimaksed pole saadaval" };
  let amountCents: number;
  let productName: string;
  let description: string;
  let data: typeof s.shopOrders.$inferInsert.data = {};
  if (input.kind === "GIFT_CARD") {
    if (!b.giftCardsEnabled) return { ok: false, reason: "Kinkekaarte ei müüda" };
    const fixed = b.giftCardAmounts.includes(input.amountCents);
    if (!fixed && (!b.giftCardCustomAmount || input.amountCents < b.giftCardMinCents)) return { ok: false, reason: "Vali summa" };
    if (!Number.isInteger(input.amountCents) || input.amountCents <= 0 || input.amountCents > MAX_GIFT_CENTS) return { ok: false, reason: "Vali summa" };
    amountCents = input.amountCents;
    productName = `Kinkekaart ${formatEuro(amountCents)} – ${b.name}`;
    description = `Kehtib ${b.giftCardValidityMonths} kuud. Kood saadetakse e-postiga.`;
    data = { recipientName: input.recipientName || null, recipientEmail: input.recipientEmail?.toLowerCase() || null, message: input.message || null };
  } else {
    const p = await db.query.packages.findFirst({
      where: and(eq(s.packages.id, input.packageId), eq(s.packages.businessId, b.id), eq(s.packages.active, true), eq(s.packages.sellInWidget, true)),
    });
    if (!p || p.priceCents <= 0) return { ok: false, reason: "Paketti ei leitud" };
    amountCents = p.priceCents;
    productName = `${p.name} – ${b.name}`;
    description = p.validityDays ? `Kehtib ${p.validityDays} päeva ostust.` : "Pakett seotakse sinu e-postiga.";
    data = { packageId: p.id };
  }
  const [order] = await db
    .insert(s.shopOrders)
    .values({
      businessId: b.id, kind: input.kind, amountCents, buyerName: input.buyerName.trim(), buyerEmail: input.buyerEmail.toLowerCase().trim(),
      buyerPhone: input.kind === "PACKAGE" ? input.buyerPhone?.trim() || null : null, lang: input.lang, data, stripeAccountId: b.stripeAccountId,
    })
    .returning({ id: s.shopOrders.id });
  const session = await stripe().checkout.sessions.create(
    {
      mode: "payment",
      locale: input.lang === "ru" ? "ru" : input.lang === "en" ? "en" : "et",
      line_items: [{ quantity: 1, price_data: { currency: "eur", unit_amount: amountCents, product_data: { name: productName, description } } }],
      customer_email: input.buyerEmail,
      success_url: `${base}/w/${b.slug}/ost?s={CHECKOUT_SESSION_ID}&lang=${input.lang}`,
      cancel_url: `${base}/w/${b.slug}?lang=${input.lang}`,
      metadata: { shopOrderId: order.id, businessId: b.id },
      payment_intent_data: { description: input.kind === "GIFT_CARD" ? "Kinkekaart" : "Pakett", metadata: { shopOrderId: order.id } },
    },
    { stripeAccount: b.stripeAccountId },
  );
  await db.update(s.shopOrders).set({ stripeCheckoutSessionId: session.id }).where(eq(s.shopOrders.id, order.id));
  return { ok: true, url: session.url! };
}

export type ShopResult =
  | { status: "paid"; kind: "GIFT_CARD"; code: string; amountCents: number; expiresAt: Date; recipientEmail: string | null; buyerEmail: string }
  | { status: "paid"; kind: "PACKAGE"; packageName: string; uses: number; expiresAt: Date | null; buyerEmail: string }
  | { status: "open" | "expired" };

/**
 * Kontrolli makse seisu ja täida tellimus (luuakse kaart/pakett, saadetakse kirjad).
 * Kutsutakse webhookist ja tagasipöördumise lehelt – mõlemast korduvalt ohutu.
 */
export async function syncShopOrder(sessionId: string, base: string): Promise<ShopResult | null> {
  const order = await db.query.shopOrders.findFirst({ where: eq(s.shopOrders.stripeCheckoutSessionId, sessionId) });
  if (!order?.stripeAccountId) return null;
  if (order.status === "PENDING") {
    const session = await stripe().checkout.sessions.retrieve(sessionId, {}, { stripeAccount: order.stripeAccountId });
    if (session.payment_status === "paid") {
      const pi = typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null);
      const [won] = await db
        .update(s.shopOrders)
        .set({ status: "PAID", paidAt: new Date(), stripePaymentIntentId: pi })
        .where(and(eq(s.shopOrders.id, order.id), eq(s.shopOrders.status, "PENDING")))
        .returning({ id: s.shopOrders.id });
      if (won) await fulfil(order.id, base).catch((e) => reportError("shop fulfil", e, { order: order.id }));
    } else if (session.status === "expired") {
      await db.update(s.shopOrders).set({ status: "EXPIRED" }).where(and(eq(s.shopOrders.id, order.id), eq(s.shopOrders.status, "PENDING")));
      return { status: "expired" };
    } else return { status: "open" };
  }
  if (order.status === "EXPIRED") return { status: "expired" };
  return describe(order.id);
}

async function describe(orderId: string): Promise<ShopResult | null> {
  const o = await db.query.shopOrders.findFirst({ where: eq(s.shopOrders.id, orderId) });
  if (!o?.resultId) return null;
  if (o.kind === "GIFT_CARD") {
    const g = await db.query.giftCards.findFirst({ where: eq(s.giftCards.id, o.resultId) });
    return g ? { status: "paid", kind: "GIFT_CARD", code: g.code, amountCents: g.valueCents, expiresAt: g.expiresAt, recipientEmail: g.recipientEmail, buyerEmail: o.buyerEmail } : null;
  }
  const cp = await db.query.clientPackages.findFirst({ where: eq(s.clientPackages.id, o.resultId), with: { package: true } });
  return cp ? { status: "paid", kind: "PACKAGE", packageName: cp.package.name, uses: cp.usesTotal, expiresAt: cp.expiresAt, buyerEmail: o.buyerEmail } : null;
}

const fmtDate = (d: Date, tz: string) => d.toLocaleDateString("et-EE", { timeZone: tz, day: "numeric", month: "numeric", year: "numeric" });

async function fulfil(orderId: string, base: string) {
  const o = (await db.query.shopOrders.findFirst({ where: eq(s.shopOrders.id, orderId) }))!;
  const b = (await db.query.businesses.findFirst({ where: eq(s.businesses.id, o.businessId) }))!;
  const html = (body: string) => emailHtml({ body, salon: b.name, color: b.widgetPrimary, logoUrl: b.logoInEmails ? b.logoUrl : null });
  const bookUrl = `${base}/w/${b.slug}`;
  const actor = { name: `${o.buyerName} (veebipood)`, email: o.buyerEmail };

  if (o.kind === "GIFT_CARD") {
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + b.giftCardValidityMonths);
    let card: { id: string; code: string } | null = null;
    for (let i = 0; i < 5 && !card; i++) {
      const code = giftCode();
      [card] = await db
        .insert(s.giftCards)
        .values({
          businessId: b.id, code, buyerName: o.buyerName, buyerEmail: o.buyerEmail, recipientName: o.data.recipientName ?? null,
          recipientEmail: o.data.recipientEmail ?? null, message: o.data.message ?? null, valueCents: o.amountCents, balanceCents: o.amountCents,
          expiresAt, source: "WIDGET", paymentMethod: "stripe",
        })
        .onConflictDoNothing()
        .returning({ id: s.giftCards.id, code: s.giftCards.code });
    }
    if (!card) throw new Error("Kinkekaardi koodi loomine ebaõnnestus");
    await db.update(s.shopOrders).set({ resultId: card.id }).where(eq(s.shopOrders.id, o.id));
    const amount = formatEuro(o.amountCents, { decimals: true });
    const until = fmtDate(expiresAt, b.timezone);
    const forOther = !!o.data.recipientEmail && o.data.recipientEmail !== o.buyerEmail;
    const buyerText = forOther
      ? `Tere ${o.buyerName.split(" ")[0]}!\n\nAitäh! Ostsid kinkekaardi ${amount} ettevõttele ${b.name}. Saatsime selle aadressile ${o.data.recipientEmail}.\n\nKinkekaardi kood: ${card.code}\nKehtib kuni: ${until}`
      : `Tere ${o.buyerName.split(" ")[0]}!\n\nAitäh! Siin on sinu kinkekaart ${amount} ettevõttele ${b.name}.\n\nKinkekaardi kood: ${card.code}\nKehtib kuni: ${until}\n\nKoodi saab kasutada veebis broneerides (väli „Kinkekaart“) või kohapeal.\n${bookUrl}`;
    await sendEmail({ businessId: b.id, kind: "SHOP_GIFT_BUYER", to: o.buyerEmail, subject: `Sinu kinkekaart – ${b.name}`, text: buyerText, html: html(buyerText), fromName: b.name, replyTo: b.email, dedupeKey: `shop-buyer-${o.id}` });
    if (forOther) {
      const who = o.data.recipientName ? ` ${o.data.recipientName.split(" ")[0]}` : "";
      const text = `Tere${who}!\n\n${o.buyerName} kinkis sulle kinkekaardi ${amount} ettevõttele ${b.name}.${o.data.message ? `\n\n„${o.data.message}“` : ""}\n\nKinkekaardi kood: ${card.code}\nKehtib kuni: ${until}\n\nBroneeri aeg ja sisesta kood väljale „Kinkekaart“:\n${bookUrl}`;
      await sendEmail({ businessId: b.id, kind: "SHOP_GIFT_RECIPIENT", to: o.data.recipientEmail!, subject: `${o.buyerName} kinkis sulle kinkekaardi – ${b.name}`, text, html: html(text), fromName: b.name, replyTo: b.email, dedupeKey: `shop-recipient-${o.id}` });
    }
    await recordActivity(b.id, "SHOP_GIFT", { body: `${o.buyerName} · ${amount}${forOther ? ` · kingitus: ${o.data.recipientName ?? o.data.recipientEmail}` : ""}` });
    await logActivity({ action: "giftcard.sold", summary: `Ostis veebist kinkekaardi ${card.code} (${amount})`, businessId: b.id, actor });
    return;
  }

  // pakett → klient (e-posti järgi) + kasutuskorrad
  const p = await db.query.packages.findFirst({ where: eq(s.packages.id, o.data.packageId!) });
  if (!p) throw new Error("Paketti ei leitud");
  const items = await db.query.packageItems.findMany({ where: eq(s.packageItems.packageId, p.id) });
  const uses = items.reduce((n, i) => n + i.quantity, 0);
  let client = await db.query.clients.findFirst({ where: and(eq(s.clients.businessId, b.id), sql`lower(${s.clients.email}) = ${o.buyerEmail}`) });
  if (!client) {
    [client] = await db
      .insert(s.clients)
      .values({ businessId: b.id, name: o.buyerName, email: o.buyerEmail, phone: o.buyerPhone, consentTermsAt: new Date() })
      .returning();
  }
  const expiresAt = p.validityDays ? new Date(Date.now() + p.validityDays * 86_400_000) : null;
  const [cp] = await db.insert(s.clientPackages).values({ clientId: client.id, packageId: p.id, usesTotal: uses, usesLeft: uses, expiresAt }).returning({ id: s.clientPackages.id });
  await db.update(s.shopOrders).set({ resultId: cp.id }).where(eq(s.shopOrders.id, o.id));
  const price = formatEuro(o.amountCents, { decimals: true });
  const text = `Tere ${o.buyerName.split(" ")[0]}!\n\nAitäh! Ostsid paketi „${p.name}“ (${price}).\n\nSisaldab: ${uses} ${uses === 1 ? "korda" : "korda"}${expiresAt ? `\nKehtib kuni: ${fmtDate(expiresAt, b.timezone)}` : ""}\n\nBroneerides kasuta sama e-posti aadressi (${o.buyerEmail}) – pakett arvestatakse automaatselt ja aja eest tasuda pole vaja.\n${bookUrl}`;
  await sendEmail({ businessId: b.id, kind: "SHOP_PACKAGE", to: o.buyerEmail, subject: `Sinu pakett: ${p.name} – ${b.name}`, text, html: html(text), fromName: b.name, replyTo: b.email, dedupeKey: `shop-package-${o.id}` });
  await recordActivity(b.id, "SHOP_PACKAGE", { body: `${o.buyerName} · ${p.name} · ${price}` });
  await logActivity({ action: "package.sold", summary: `Ostis veebist paketi ${p.name} (${price})`, businessId: b.id, actor, target: { type: "client", id: client.id } });
}

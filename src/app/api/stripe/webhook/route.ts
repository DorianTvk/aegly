import { reportError } from "@/lib/report";
import type Stripe from "stripe";
import { applyAccount, stripe, stripeConfigured, syncCheckout } from "@/server/stripe";
import { applySubscription } from "@/server/billing";
import { syncShopOrder } from "@/server/shop";

/**
 * Stripe'i webhook. Samale aadressile saadavad kaks Stripe'i sihtkohta:
 * - "Connected accounts" (STRIPE_WEBHOOK_SECRET): salongide ettemaksud ja kontod
 * - "Your account" (STRIPE_BILLING_WEBHOOK_SECRET): Aegly enda kuutellimused
 */
export async function POST(req: Request) {
  const secrets = [process.env.STRIPE_WEBHOOK_SECRET, process.env.STRIPE_BILLING_WEBHOOK_SECRET].filter(Boolean) as string[];
  if (!stripeConfigured() || !secrets.length) return new Response("Stripe pole seadistatud", { status: 503 });
  const sig = req.headers.get("stripe-signature") ?? "";
  const body = await req.text();
  let event: Stripe.Event | null = null;
  for (const secret of secrets) {
    try {
      event = stripe().webhooks.constructEvent(body, sig, secret);
      break;
    } catch {
      /* proovi järgmist */
    }
  }
  if (!event) return new Response("Vigane allkiri", { status: 400 });
  const base = (process.env.APP_URL ?? new URL(req.url).origin).replace(/\/$/, "");

  try {
    if (event.account) {
      // salongi konto sündmused (Connect)
      switch (event.type) {
        case "checkout.session.completed":
        case "checkout.session.async_payment_succeeded":
        case "checkout.session.async_payment_failed":
        case "checkout.session.expired": {
          const sess = event.data.object as Stripe.Checkout.Session;
          // vidina pood (kinkekaart/pakett) või broneeringu ettemaks
          if (sess.metadata?.shopOrderId) await syncShopOrder(sess.id, base);
          else await syncCheckout(sess.id, base);
          break;
        }
        case "account.updated":
          await applyAccount(event.data.object as Stripe.Account);
          break;
      }
    } else {
      // platvormi enda sündmused (Aegly tellimus)
      switch (event.type) {
        case "checkout.session.completed": {
          const sess = event.data.object as Stripe.Checkout.Session;
          if (sess.mode === "subscription" && typeof sess.subscription === "string") await applySubscription(await stripe().subscriptions.retrieve(sess.subscription));
          break;
        }
        case "customer.subscription.created":
        case "customer.subscription.updated":
        case "customer.subscription.deleted":
          await applySubscription(event.data.object as Stripe.Subscription);
          break;
        case "invoice.paid":
        case "invoice.payment_failed": {
          const inv = event.data.object as Stripe.Invoice;
          const subId = inv.parent?.subscription_details?.subscription;
          if (typeof subId === "string") await applySubscription(await stripe().subscriptions.retrieve(subId));
          break;
        }
        case "account.updated":
          await applyAccount(event.data.object as Stripe.Account);
          break;
      }
    }
  } catch (e) {
    reportError("stripe webhook", e, { event: event.type });
    return new Response("Töötlemine ebaõnnestus", { status: 500 }); // Stripe proovib uuesti
  }
  return Response.json({ received: true });
}

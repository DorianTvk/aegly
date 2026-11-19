import type Stripe from "stripe";
import { applyAccount, stripe, stripeConfigured, syncCheckout } from "@/server/stripe";

/**
 * Stripe'i webhook (Connect: sündmused salongide kontodelt).
 * Seadista Stripe'is: Developers → Webhooks → endpoint "Connected accounts" → see aadress.
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeConfigured() || !secret) return new Response("Stripe pole seadistatud", { status: 503 });
  const sig = req.headers.get("stripe-signature");
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(body, sig ?? "", secret);
  } catch {
    return new Response("Vigane allkiri", { status: 400 });
  }
  const base = (process.env.APP_URL ?? new URL(req.url).origin).replace(/\/$/, "");
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
    case "checkout.session.async_payment_failed":
    case "checkout.session.expired":
      await syncCheckout((event.data.object as Stripe.Checkout.Session).id, base);
      break;
    case "account.updated":
      await applyAccount(event.data.object as Stripe.Account);
      break;
  }
  return Response.json({ received: true });
}

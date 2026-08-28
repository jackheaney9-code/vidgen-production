import type Stripe from "stripe";

import { getEnv, hasStripe } from "@/lib/env";
import { jsonError, jsonOk } from "@/lib/http";
import { getStripe } from "@/lib/stripe/client";
import { fulfillStripePurchase } from "@/lib/stripe/fulfill";
import { packFromStripePrice } from "@/lib/stripe/prices";

export const runtime = "nodejs";

function customerIdFrom(session: Stripe.Checkout.Session): string | null {
  if (typeof session.customer === "string") {
    return session.customer;
  }
  if (session.customer && typeof session.customer === "object" && "id" in session.customer) {
    return session.customer.id;
  }
  return null;
}

async function creditsFromSession(
  stripe: Stripe,
  session: Stripe.Checkout.Session,
): Promise<number> {
  const expanded = await stripe.checkout.sessions.retrieve(session.id, {
    expand: ["line_items.data.price"],
  });
  const price = expanded.line_items?.data[0]?.price;
  if (price && typeof price === "object") {
    const pack = packFromStripePrice(price);
    if (pack) {
      return pack.credits;
    }
  }
  const fromMeta = Number.parseInt(session.metadata?.credits ?? "", 10);
  if (Number.isFinite(fromMeta) && fromMeta > 0) {
    return fromMeta;
  }
  throw new Error("Could not determine which credit pack was purchased.");
}

export async function POST(request: Request) {
  if (!hasStripe()) {
    return jsonError("Stripe is not configured", 400);
  }
  const stripe = getStripe();
  const secret = getEnv("STRIPE_WEBHOOK_SECRET");
  if (!secret) {
    return jsonError("Stripe webhook secret is missing", 500);
  }
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return jsonError("Missing Stripe signature", 400);
  }

  let event: Stripe.Event;
  try {
    const raw = await request.text();
    event = stripe.webhooks.constructEvent(raw, signature, secret);
  } catch {
    return jsonError("Invalid Stripe signature", 400);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    try {
      const customerId = customerIdFrom(session);
      const userId = session.metadata?.userId ?? null;
      const credits = await creditsFromSession(stripe, session);
      const amountPaid = session.amount_total ?? 0;
      await fulfillStripePurchase({
        sessionId: session.id,
        customerId,
        userId,
        credits,
        amountPaid,
      });
    } catch (error) {
      console.error("Stripe webhook fulfillment failed", error);
      return jsonError(
        error instanceof Error ? error.message : "Webhook fulfillment failed",
        500,
      );
    }
  }

  return jsonOk({ received: true });
}

import Stripe from "stripe";

import { CREDIT_PACKS_CATALOG } from "@/lib/constants";
import { getAppUrl, getEnv, hasStripe } from "@/lib/env";
import { HttpError } from "@/lib/errors";
import type { CreditPack, CreditPackId } from "@/types";

export function getCreditPack(id: CreditPackId): CreditPack {
  const pack = CREDIT_PACKS_CATALOG.find((item) => item.id === id);
  if (!pack) {
    throw new HttpError(400, "Unknown credit pack");
  }
  return pack;
}

export function getStripe(): Stripe {
  const key = getEnv("STRIPE_SECRET_KEY");
  if (!key) {
    throw new HttpError(500, "Stripe is not configured");
  }
  return new Stripe(key);
}

export async function createCheckoutSession(input: {
  userId: string;
  email: string;
  pack: CreditPack;
}): Promise<string> {
  if (!hasStripe()) {
    throw new HttpError(500, "Stripe is not configured");
  }
  const stripe = getStripe();
  const appUrl = getAppUrl();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: input.email,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: input.pack.priceCents,
          product_data: {
            name: `${input.pack.name} — ${input.pack.credits} Lumina credits`,
            description: input.pack.blurb,
          },
        },
      },
    ],
    metadata: {
      userId: input.userId,
      pack: input.pack.id,
      credits: String(input.pack.credits),
    },
    success_url: `${appUrl}/dashboard/billing?status=success`,
    cancel_url: `${appUrl}/dashboard/billing?status=cancelled`,
  });
  if (!session.url) {
    throw new HttpError(500, "Stripe did not return a checkout URL");
  }
  return session.url;
}

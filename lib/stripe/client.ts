import Stripe from "stripe";

import { getEnv, hasStripe } from "@/lib/env";
import { HttpError } from "@/lib/errors";

let stripe: Stripe | null = null;

/** Server Stripe SDK. Use test keys (`sk_test_...`). */
export function getStripe(): Stripe {
  const key = getEnv("STRIPE_SECRET_KEY");
  if (!key) {
    throw new HttpError(500, "Stripe is not configured");
  }
  if (!key.startsWith("sk_test_") && !key.startsWith("sk_live_")) {
    throw new HttpError(500, "STRIPE_SECRET_KEY looks invalid.");
  }
  if (!stripe) {
    stripe = new Stripe(key);
  }
  return stripe;
}

export function isStripeConfigured(): boolean {
  return hasStripe();
}

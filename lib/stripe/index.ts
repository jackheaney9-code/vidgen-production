import { getAppUrl, hasStripe } from "@/lib/env";
import { HttpError } from "@/lib/errors";
import { getStripe } from "@/lib/stripe/client";
import type { CreditPack, Profile } from "@/types";

export { getStripe } from "@/lib/stripe/client";
export {
  ensureStripeCreditPrices,
  findPackByPriceId,
  getCreditPack,
  resolveCheckoutPrice,
} from "@/lib/stripe/prices";

export async function getOrCreateStripeCustomer(input: {
  profile: Profile;
  email: string;
  userId: string;
}): Promise<string> {
  const stripe = getStripe();
  if (input.profile.stripeCustomerId) {
    return input.profile.stripeCustomerId;
  }
  const existing = await stripe.customers.list({
    email: input.email,
    limit: 1,
  });
  const reused = existing.data[0];
  if (reused) {
    await stripe.customers.update(reused.id, {
      metadata: { userId: input.userId },
    });
    return reused.id;
  }
  const customer = await stripe.customers.create({
    email: input.email,
    metadata: { userId: input.userId },
  });
  return customer.id;
}

export async function createCheckoutSession(input: {
  userId: string;
  email: string;
  customerId: string;
  pack: CreditPack;
  stripePriceId: string;
}): Promise<string> {
  if (!hasStripe()) {
    throw new HttpError(500, "Stripe is not configured");
  }
  const stripe = getStripe();
  const appUrl = getAppUrl();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: input.customerId,
    line_items: [
      {
        price: input.stripePriceId,
        quantity: 1,
      },
    ],
    metadata: {
      userId: input.userId,
      pack: input.pack.id,
      credits: String(input.pack.credits),
      priceId: input.stripePriceId,
    },
    success_url: `${appUrl}/dashboard/billing?status=success`,
    cancel_url: `${appUrl}/dashboard/billing?status=cancelled`,
  });
  if (!session.url) {
    throw new HttpError(500, "Stripe did not return a checkout URL");
  }
  return session.url;
}

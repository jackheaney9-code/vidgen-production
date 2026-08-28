import { requireUserWithProfile } from "@/lib/auth/require-user";
import { createPurchase, updateCredits, updateStripeCustomerId } from "@/lib/db";
import { checkoutSchema } from "@/lib/db/schema";
import { hasStripe } from "@/lib/env";
import { jsonError, jsonFromUnknown, jsonOk } from "@/lib/http";
import {
  createCheckoutSession,
  getOrCreateStripeCustomer,
  resolveCheckoutPrice,
} from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { user, profile } = await requireUserWithProfile();
    const body: unknown = await request.json();
    const parsed = checkoutSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Choose a credit pack.", 400);
    }

    const { pack, stripePriceId } = await resolveCheckoutPrice(parsed.data.priceId);

    if (!hasStripe()) {
      const updated = await updateCredits(
        user.id,
        pack.credits,
        `demo_purchase_${pack.id}`,
      );
      await createPurchase({
        id: crypto.randomUUID(),
        userId: user.id,
        stripeSessionId: `demo_${crypto.randomUUID()}`,
        creditsPurchased: pack.credits,
        amountPaid: pack.priceCents,
        createdAt: new Date().toISOString(),
      });
      return jsonOk({
        demo: true,
        credits: updated.credits,
        added: pack.credits,
      });
    }

    const customerId = await getOrCreateStripeCustomer({
      profile,
      email: profile.email,
      userId: user.id,
    });
    if (profile.stripeCustomerId !== customerId) {
      await updateStripeCustomerId(user.id, customerId);
    }

    const url = await createCheckoutSession({
      userId: user.id,
      email: profile.email,
      customerId,
      pack,
      stripePriceId,
    });
    return jsonOk({ url });
  } catch (error) {
    return jsonFromUnknown(error);
  }
}

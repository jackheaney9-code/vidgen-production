import { createCheckoutSession, getCreditPack } from "@/lib/stripe";
import { requireUserWithProfile } from "@/lib/auth/require-user";
import { checkoutSchema } from "@/lib/db/schema";
import { updateCredits } from "@/lib/db";
import { jsonError, jsonFromUnknown, jsonOk } from "@/lib/http";
import { hasStripe } from "@/lib/env";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { user, profile } = await requireUserWithProfile();
    const body: unknown = await request.json();
    const parsed = checkoutSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Choose a credit pack.", 400);
    }
    const pack = getCreditPack(parsed.data.pack);

    if (!hasStripe()) {
      const updated = await updateCredits(
        user.id,
        pack.credits,
        `demo_purchase_${pack.id}`,
      );
      return jsonOk({
        demo: true,
        credits: updated.credits,
        added: pack.credits,
      });
    }

    const url = await createCheckoutSession({
      userId: user.id,
      email: profile.email,
      pack,
    });
    return jsonOk({ demo: false, url });
  } catch (error) {
    return jsonFromUnknown(error);
  }
}

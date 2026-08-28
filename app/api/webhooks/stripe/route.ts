import { z } from "zod";

import { jsonError, jsonFromUnknown, jsonOk } from "@/lib/http";
import { getEnv, hasStripe, hasSupabase, isDemoMode } from "@/lib/env";
import { getStripe } from "@/lib/stripe";
import { updateCredits } from "@/lib/db";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const metadataSchema = z.object({
  userId: z.string().min(1),
  credits: z.string().min(1),
  pack: z.string().min(1),
});

export async function POST(request: Request) {
  try {
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
    const raw = await request.text();
    const event = stripe.webhooks.constructEvent(raw, signature, secret);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const parsed = metadataSchema.safeParse(session.metadata);
      if (!parsed.success) {
        return jsonError("Checkout metadata missing", 400);
      }
      const credits = Number.parseInt(parsed.data.credits, 10);
      if (!Number.isFinite(credits) || credits <= 0) {
        return jsonError("Invalid credit amount", 400);
      }
      if (isDemoMode() || !hasSupabase()) {
        await updateCredits(
          parsed.data.userId,
          credits,
          `stripe_purchase_${parsed.data.pack}`,
          null,
          session.id,
        );
      } else {
        const admin = createSupabaseAdmin();
        const { data: profile, error: profileError } = await admin
          .from("profiles")
          .select("credits")
          .eq("id", parsed.data.userId)
          .single();
        if (profileError) {
          throw new Error(profileError.message);
        }
        const current = z.number().parse(profile.credits);
        const { error: updateError } = await admin
          .from("profiles")
          .update({
            credits: current + credits,
            updated_at: new Date().toISOString(),
          })
          .eq("id", parsed.data.userId);
        if (updateError) {
          throw new Error(updateError.message);
        }
        const { error: txError } = await admin.from("credit_transactions").insert({
          user_id: parsed.data.userId,
          amount: credits,
          reason: `stripe_purchase_${parsed.data.pack}`,
          stripe_session_id: session.id,
        });
        if (txError) {
          throw new Error(txError.message);
        }
      }
    }

    return jsonOk({ received: true });
  } catch (error) {
    return jsonFromUnknown(error);
  }
}

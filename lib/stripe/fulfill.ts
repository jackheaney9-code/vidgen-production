import { fileFulfillStripePurchase } from "@/lib/db/file-store";
import { usesFileStore } from "@/lib/db";
import { HttpError } from "@/lib/errors";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import type { Profile, Purchase } from "@/types";

function isUniqueViolation(error: { code?: string; message: string }): boolean {
  return (
    error.code === "23505" ||
    error.message.toLowerCase().includes("duplicate") ||
    error.message.toLowerCase().includes("unique")
  );
}

function mapProfileRow(data: {
  id: string;
  email: string;
  credits: number;
  stripe_customer_id: string | null;
  created_at: string;
  updated_at: string;
}): Profile {
  return {
    id: data.id,
    email: data.email,
    credits: data.credits,
    stripeCustomerId: data.stripe_customer_id,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function getProfileByStripeCustomerId(
  customerId: string,
): Promise<Profile | null> {
  if (usesFileStore()) {
    const { fileGetProfileByStripeCustomerId } = await import("@/lib/db/file-store");
    return fileGetProfileByStripeCustomerId(customerId);
  }
  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("profiles")
    .select("*")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    return null;
  }
  return mapProfileRow(data);
}

export async function getPurchaseBySessionId(
  sessionId: string,
): Promise<Purchase | null> {
  if (usesFileStore()) {
    const { fileGetPurchaseBySessionId } = await import("@/lib/db/file-store");
    return fileGetPurchaseBySessionId(sessionId);
  }
  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("purchases")
    .select("*")
    .eq("stripe_session_id", sessionId)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    return null;
  }
  return {
    id: data.id,
    userId: data.user_id,
    stripeSessionId: data.stripe_session_id,
    creditsPurchased: data.credits_purchased,
    amountPaid: data.amount_paid,
    createdAt: data.created_at,
  };
}

export async function fulfillStripePurchase(input: {
  sessionId: string;
  customerId: string | null;
  userId: string | null;
  credits: number;
  amountPaid: number;
}): Promise<{ duplicate: boolean; profile: Profile | null }> {
  if (usesFileStore()) {
    return fileFulfillStripePurchase(input);
  }

  const existing = await getPurchaseBySessionId(input.sessionId);
  const profile = await resolveProfile(input.customerId, input.userId);
  if (existing) {
    return { duplicate: true, profile };
  }
  if (!profile) {
    throw new HttpError(500, "No profile matches this Stripe customer.");
  }

  const admin = createSupabaseAdmin();
  const { error: purchaseError } = await admin.from("purchases").insert({
    user_id: profile.id,
    stripe_session_id: input.sessionId,
    credits_purchased: input.credits,
    amount_paid: input.amountPaid,
  });
  if (purchaseError) {
    if (isUniqueViolation(purchaseError)) {
      return { duplicate: true, profile };
    }
    throw new Error(purchaseError.message);
  }

  const { error: updateError } = await admin
    .from("profiles")
    .update({
      credits: profile.credits + input.credits,
      updated_at: new Date().toISOString(),
    })
    .eq("id", profile.id);
  if (updateError) {
    throw new Error(updateError.message);
  }

  return {
    duplicate: false,
    profile: { ...profile, credits: profile.credits + input.credits },
  };
}

async function resolveProfile(
  customerId: string | null,
  userId: string | null,
): Promise<Profile | null> {
  if (customerId) {
    const byCustomer = await getProfileByStripeCustomerId(customerId);
    if (byCustomer) {
      return byCustomer;
    }
  }
  if (!userId) {
    return null;
  }
  if (usesFileStore()) {
    const { fileGetProfile } = await import("@/lib/db/file-store");
    return fileGetProfile(userId);
  }
  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    return null;
  }
  return mapProfileRow(data);
}

import { z } from "zod";

import { HttpError } from "@/lib/errors";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { Ad, CreditTransaction, Profile } from "@/types";
import { adSchema, creditTransactionSchema } from "@/lib/db/schema";

const profileRowSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  credits: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
});

const adRowSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  product_name: z.string(),
  product_description: z.string(),
  audience: z.string(),
  style: z.string(),
  product_image_path: z.string(),
  script: z.unknown(),
  video_path: z.string().nullable(),
  voice_path: z.string().nullable(),
  final_path: z.string().nullable(),
  status: z.string(),
  error: z.string().nullable(),
  credit_deducted: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

function mapProfile(row: z.infer<typeof profileRowSchema>): Profile {
  return {
    id: row.id,
    email: row.email,
    credits: row.credits,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAd(row: z.infer<typeof adRowSchema>): Ad {
  return adSchema.parse({
    id: row.id,
    userId: row.user_id,
    productName: row.product_name,
    productDescription: row.product_description,
    audience: row.audience,
    style: row.style,
    productImagePath: row.product_image_path,
    script: row.script,
    videoPath: row.video_path,
    voicePath: row.voice_path,
    finalPath: row.final_path,
    status: row.status,
    error: row.error,
    creditDeducted: row.credit_deducted,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export async function supabaseGetProfile(id: string): Promise<Profile | null> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    return null;
  }
  return mapProfile(profileRowSchema.parse(data));
}

export async function supabaseCreateProfile(input: {
  id: string;
  email: string;
  credits: number;
}): Promise<Profile> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("profiles")
    .insert({
      id: input.id,
      email: input.email.toLowerCase(),
      credits: input.credits,
    })
    .select("*")
    .single();
  if (error) {
    throw new Error(error.message);
  }
  return mapProfile(profileRowSchema.parse(data));
}

export async function supabaseUpdateCredits(
  userId: string,
  delta: number,
  reason: string,
  adId: string | null,
  stripeSessionId: string | null,
): Promise<Profile> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.rpc("apply_credit_delta", {
    p_delta: delta,
    p_reason: reason,
    p_ad_id: adId,
    p_stripe_session_id: stripeSessionId,
  });
  if (error) {
    if (error.message.includes("insufficient_credits")) {
      throw new HttpError(402, "You need at least 1 credit to generate a video.");
    }
    throw new Error(error.message);
  }
  if (typeof data === "object" && data !== null) {
    return mapProfile(profileRowSchema.parse(data));
  }
  const profile = await supabaseGetProfile(userId);
  if (!profile) {
    throw new Error("Profile not found");
  }
  return profile;
}

export async function supabaseListAds(userId: string): Promise<Ad[]> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("ads")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => mapAd(adRowSchema.parse(row)));
}

export async function supabaseGetAd(id: string): Promise<Ad | null> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("ads")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    return null;
  }
  return mapAd(adRowSchema.parse(data));
}

export async function supabaseCreateAd(ad: Ad): Promise<Ad> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("ads")
    .insert({
      id: ad.id,
      user_id: ad.userId,
      product_name: ad.productName,
      product_description: ad.productDescription,
      audience: ad.audience,
      style: ad.style,
      product_image_path: ad.productImagePath,
      script: ad.script,
      video_path: ad.videoPath,
      voice_path: ad.voicePath,
      final_path: ad.finalPath,
      status: ad.status,
      error: ad.error,
      credit_deducted: ad.creditDeducted,
    })
    .select("*")
    .single();
  if (error) {
    throw new Error(error.message);
  }
  return mapAd(adRowSchema.parse(data));
}

export async function supabaseUpdateAd(
  id: string,
  patch: Partial<Ad>,
): Promise<Ad> {
  const supabase = await createSupabaseServer();
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (patch.productName !== undefined) payload.product_name = patch.productName;
  if (patch.productDescription !== undefined) {
    payload.product_description = patch.productDescription;
  }
  if (patch.audience !== undefined) payload.audience = patch.audience;
  if (patch.style !== undefined) payload.style = patch.style;
  if (patch.productImagePath !== undefined) {
    payload.product_image_path = patch.productImagePath;
  }
  if (patch.script !== undefined) payload.script = patch.script;
  if (patch.videoPath !== undefined) payload.video_path = patch.videoPath;
  if (patch.voicePath !== undefined) payload.voice_path = patch.voicePath;
  if (patch.finalPath !== undefined) payload.final_path = patch.finalPath;
  if (patch.status !== undefined) payload.status = patch.status;
  if (patch.error !== undefined) payload.error = patch.error;
  if (patch.creditDeducted !== undefined) {
    payload.credit_deducted = patch.creditDeducted;
  }

  const { data, error } = await supabase
    .from("ads")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();
  if (error) {
    throw new Error(error.message);
  }
  return mapAd(adRowSchema.parse(data));
}

export async function supabaseListTransactions(
  userId: string,
): Promise<CreditTransaction[]> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("credit_transactions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []).map((row) =>
    creditTransactionSchema.parse({
      id: z.string().parse(row.id),
      userId: z.string().parse(row.user_id),
      amount: z.number().parse(row.amount),
      reason: z.string().parse(row.reason),
      adId: row.ad_id === null ? null : z.string().parse(row.ad_id),
      stripeSessionId:
        row.stripe_session_id === null
          ? null
          : z.string().parse(row.stripe_session_id),
      createdAt: z.string().parse(row.created_at),
    }),
  );
}

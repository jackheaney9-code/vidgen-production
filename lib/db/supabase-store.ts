import { z } from "zod";

import { creditHeld } from "@/lib/constants";
import { HttpError } from "@/lib/errors";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { Ad, AdScript, CreditTransaction, Profile, Purchase } from "@/types";
import type { Database } from "@/types/database";
import { adSchema, adScriptSchema, purchaseSchema } from "@/lib/db/schema";

type GenerationUpdate = Database["public"]["Tables"]["generations"]["Update"];

function scriptToText(script: AdScript | null): string | null {
  if (!script) {
    return null;
  }
  return JSON.stringify(script);
}

function scriptFromText(value: string | null): AdScript | null {
  if (!value) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(value);
    const result = adScriptSchema.safeParse(parsed);
    if (result.success) {
      return result.data;
    }
  } catch {
    // Stored as plain voiceover text
  }
  return {
    hook: value.slice(0, 80),
    body: value,
    cta: "",
    fullText: value,
    visualPrompt: value,
    onScreenText: [],
    durationSeconds: 18,
  };
}

const profileRowSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  credits: z.number().int(),
  stripe_customer_id: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

const generationRowSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  status: z.string(),
  product_name: z.string(),
  product_description: z.string(),
  target_audience: z.string(),
  style: z.string(),
  product_image_path: z.string(),
  script: z.string().nullable(),
  video_url: z.string().nullable(),
  voiceover_url: z.string().nullable(),
  final_video_url: z.string().nullable(),
  error_message: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

function mapProfile(row: z.infer<typeof profileRowSchema>): Profile {
  return {
    id: row.id,
    email: row.email,
    credits: row.credits,
    stripeCustomerId: row.stripe_customer_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAd(row: z.infer<typeof generationRowSchema>): Ad {
  return adSchema.parse({
    id: row.id,
    userId: row.user_id,
    productName: row.product_name,
    productDescription: row.product_description,
    audience: row.target_audience,
    style: row.style,
    productImagePath: row.product_image_path,
    script: scriptFromText(row.script),
    videoPath: row.video_url,
    voicePath: row.voiceover_url,
    finalPath: row.final_video_url,
    status: row.status,
    error: row.error_message,
    creditDeducted: creditHeld(row.status),
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
  _userId: string,
  delta: number,
): Promise<Profile> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.rpc("apply_credit_delta", {
    p_delta: delta,
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
  throw new Error("Profile not found");
}

export async function supabaseListAds(userId: string): Promise<Ad[]> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("generations")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => mapAd(generationRowSchema.parse(row)));
}

export async function supabaseGetAd(id: string): Promise<Ad | null> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("generations")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    return null;
  }
  return mapAd(generationRowSchema.parse(data));
}

export async function supabaseCreateAd(ad: Ad): Promise<Ad> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("generations")
    .insert({
      id: ad.id,
      user_id: ad.userId,
      product_name: ad.productName,
      product_description: ad.productDescription,
      target_audience: ad.audience,
      style: ad.style,
      product_image_path: ad.productImagePath,
      script: scriptToText(ad.script),
      video_url: ad.videoPath,
      voiceover_url: ad.voicePath,
      final_video_url: ad.finalPath,
      status: ad.status,
      error_message: ad.error,
    })
    .select("*")
    .single();
  if (error) {
    throw new Error(error.message);
  }
  return mapAd(generationRowSchema.parse(data));
}

export async function supabaseUpdateAd(
  id: string,
  patch: Partial<Ad>,
): Promise<Ad> {
  const supabase = await createSupabaseServer();
  const payload: GenerationUpdate = {
    updated_at: new Date().toISOString(),
  };
  if (patch.productName !== undefined) payload.product_name = patch.productName;
  if (patch.productDescription !== undefined) {
    payload.product_description = patch.productDescription;
  }
  if (patch.audience !== undefined) payload.target_audience = patch.audience;
  if (patch.style !== undefined) payload.style = patch.style;
  if (patch.productImagePath !== undefined) {
    payload.product_image_path = patch.productImagePath;
  }
  if (patch.script !== undefined) payload.script = scriptToText(patch.script);
  if (patch.videoPath !== undefined) payload.video_url = patch.videoPath;
  if (patch.voicePath !== undefined) payload.voiceover_url = patch.voicePath;
  if (patch.finalPath !== undefined) payload.final_video_url = patch.finalPath;
  if (patch.status !== undefined) payload.status = patch.status;
  if (patch.error !== undefined) payload.error_message = patch.error;

  const { data, error } = await supabase
    .from("generations")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();
  if (error) {
    throw new Error(error.message);
  }
  return mapAd(generationRowSchema.parse(data));
}

export async function supabaseListPurchases(userId: string): Promise<Purchase[]> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("purchases")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []).map((row) =>
    purchaseSchema.parse({
      id: row.id,
      userId: row.user_id,
      stripeSessionId: row.stripe_session_id,
      creditsPurchased: row.credits_purchased,
      amountPaid: row.amount_paid,
      createdAt: row.created_at,
    }),
  );
}

export async function supabaseListTransactions(
  userId: string,
): Promise<CreditTransaction[]> {
  const purchases = await supabaseListPurchases(userId);
  return purchases.map((item) => ({
    id: item.id,
    userId: item.userId,
    amount: item.creditsPurchased,
    reason: "stripe_purchase",
    adId: null,
    stripeSessionId: item.stripeSessionId,
    createdAt: item.createdAt,
  }));
}

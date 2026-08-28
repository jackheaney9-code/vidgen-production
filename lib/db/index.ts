import { hasSupabase, isDemoMode } from "@/lib/env";
import {
  fileCreateAd,
  fileCreateProfile,
  fileCreatePurchase,
  fileGetAd,
  fileGetProfile,
  fileGetProfileByEmail,
  fileListAds,
  fileListPurchases,
  fileListTransactions,
  fileUpdateAd,
  fileUpdateCredits,
} from "@/lib/db/file-store";
import {
  supabaseCreateAd,
  supabaseCreateProfile,
  supabaseGetAd,
  supabaseGetProfile,
  supabaseListAds,
  supabaseListPurchases,
  supabaseListTransactions,
  supabaseUpdateAd,
  supabaseUpdateCredits,
} from "@/lib/db/supabase-store";
import type { Ad, CreditTransaction, Profile, Purchase } from "@/types";

export function usesFileStore(): boolean {
  return isDemoMode() || !hasSupabase();
}

export async function getProfile(id: string): Promise<Profile | null> {
  if (usesFileStore()) {
    return fileGetProfile(id);
  }
  return supabaseGetProfile(id);
}

export async function getProfileByEmail(email: string) {
  return fileGetProfileByEmail(email);
}

export async function createProfile(input: {
  id: string;
  email: string;
  credits: number;
  passwordHash?: string;
}): Promise<Profile> {
  if (usesFileStore()) {
    return fileCreateProfile(input);
  }
  return supabaseCreateProfile(input);
}

export async function updateCredits(
  userId: string,
  delta: number,
  reason: string,
  adId: string | null = null,
  stripeSessionId: string | null = null,
): Promise<Profile> {
  if (usesFileStore()) {
    return fileUpdateCredits(userId, delta, reason, adId, stripeSessionId);
  }
  return supabaseUpdateCredits(userId, delta);
}

export async function listAds(userId: string): Promise<Ad[]> {
  if (usesFileStore()) {
    return fileListAds(userId);
  }
  return supabaseListAds(userId);
}

export async function getAd(id: string): Promise<Ad | null> {
  if (usesFileStore()) {
    return fileGetAd(id);
  }
  return supabaseGetAd(id);
}

export async function createAd(ad: Ad): Promise<Ad> {
  if (usesFileStore()) {
    return fileCreateAd(ad);
  }
  return supabaseCreateAd(ad);
}

export async function updateAd(id: string, patch: Partial<Ad>): Promise<Ad> {
  if (usesFileStore()) {
    return fileUpdateAd(id, patch);
  }
  return supabaseUpdateAd(id, patch);
}

export async function listTransactions(
  userId: string,
): Promise<CreditTransaction[]> {
  if (usesFileStore()) {
    return fileListTransactions(userId);
  }
  return supabaseListTransactions(userId);
}

export async function createPurchase(purchase: Purchase): Promise<Purchase> {
  if (usesFileStore()) {
    return fileCreatePurchase(purchase);
  }
  throw new Error("Purchases are written by the Stripe webhook in production.");
}

export async function listPurchases(userId: string): Promise<Purchase[]> {
  if (usesFileStore()) {
    return fileListPurchases(userId);
  }
  return supabaseListPurchases(userId);
}

import { VIDEO_CREDIT_COST } from "@/lib/constants";
import {
  canRefundVideoCredit,
  hasActiveVideoCredit,
  hasPersistedActiveCredit,
} from "@/lib/credit-state";
import { getAd, getProfile, updateAd, updateCredits } from "@/lib/db";
import { HttpError } from "@/lib/errors";
import type { Ad, Profile } from "@/types";

export {
  canRefundVideoCredit,
  hasActiveVideoCredit,
  hasPersistedActiveCredit,
  legacyStatusImpliesVideoCreditCharged,
} from "@/lib/credit-state";

export async function requireCredits(profile: Profile): Promise<void> {
  if (profile.credits <= 0) {
    throw new HttpError(402, "You need at least 1 credit to generate a video.");
  }
}

export async function deductVideoCredit(ad: Ad): Promise<Profile> {
  if (hasActiveVideoCredit(ad)) {
    const profile = await getProfile(ad.userId);
    if (!profile) {
      throw new HttpError(404, "Profile not found");
    }
    return profile;
  }
  try {
    const profile = await updateCredits(
      ad.userId,
      -VIDEO_CREDIT_COST,
      "video_generation",
      ad.id,
    );
    await updateAd(ad.id, {
      creditCharged: true,
      creditRefunded: false,
      creditDeducted: true,
    });
    return profile;
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_CREDITS") {
      throw new HttpError(402, "You need at least 1 credit to generate a video.");
    }
    throw error;
  }
}

/** Flags-only charge used by generate-video. Ignores status-derived creditHeld. */
export async function chargeVideoCreditOnce(ad: Ad, profile: Profile): Promise<Ad> {
  if (hasPersistedActiveCredit(ad)) {
    return ad;
  }
  await requireCredits(profile);
  try {
    await updateCredits(ad.userId, -VIDEO_CREDIT_COST, "video_generation", ad.id);
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_CREDITS") {
      throw new HttpError(402, "You need at least 1 credit to generate a video.");
    }
    throw error;
  }
  return updateAd(ad.id, {
    creditCharged: true,
    creditRefunded: false,
    creditDeducted: true,
  });
}

export async function refundVideoCredit(adId: string): Promise<void> {
  const ad = await getAd(adId);
  if (!ad) {
    return;
  }
  await refundVideoCreditOnce(ad);
}

export async function refundVideoCreditOnce(ad: Ad): Promise<Ad> {
  if (!canRefundVideoCredit(ad)) {
    return ad;
  }
  await updateCredits(ad.userId, VIDEO_CREDIT_COST, "generation_refund", ad.id);
  return updateAd(ad.id, {
    creditRefunded: true,
    creditDeducted: false,
  });
}

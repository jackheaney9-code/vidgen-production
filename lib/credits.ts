import { VIDEO_CREDIT_COST } from "@/lib/constants";
import { getAd, getProfile, updateAd, updateCredits } from "@/lib/db";
import { HttpError } from "@/lib/errors";
import type { Ad, Profile } from "@/types";

export async function requireCredits(profile: Profile): Promise<void> {
  if (profile.credits <= 0) {
    throw new HttpError(402, "You need at least 1 credit to generate a video.");
  }
}

export async function deductVideoCredit(ad: Ad): Promise<Profile> {
  if (ad.creditDeducted) {
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
    await updateAd(ad.id, { creditDeducted: true });
    return profile;
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_CREDITS") {
      throw new HttpError(402, "You need at least 1 credit to generate a video.");
    }
    throw error;
  }
}

export async function refundVideoCredit(adId: string): Promise<void> {
  const ad = await getAd(adId);
  if (!ad || !ad.creditDeducted) {
    return;
  }
  await updateCredits(ad.userId, VIDEO_CREDIT_COST, "generation_refund", ad.id);
  await updateAd(adId, { creditDeducted: false });
}

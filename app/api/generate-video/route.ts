import { loadOwnedAd } from "@/lib/ads";
import { requireUserWithProfile } from "@/lib/auth/require-user";
import { deductVideoCredit, refundVideoCredit, requireCredits } from "@/lib/credits";
import { SIGNED_URL_TTL_SECONDS } from "@/lib/constants";
import { updateAd } from "@/lib/db";
import { jsonError, jsonFromUnknown, jsonOk } from "@/lib/http";
import { runWithPipelineContext } from "@/lib/pipeline/context";
import { compositeVideo } from "@/lib/pipeline/composite";
import { buildMotionPrompt, generateVideo } from "@/lib/pipeline/video";
import { generateVoiceover } from "@/lib/pipeline/voice";
import { getSignedMediaUrl } from "@/lib/storage";
import { z } from "zod";
import type { Ad } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const bodySchema = z.object({
  generationId: z.string().min(1).optional(),
  adId: z.string().min(1).optional(),
});

export async function GET(request: Request) {
  try {
    await requireUserWithProfile();
    const url = new URL(request.url);
    const generationId =
      url.searchParams.get("generationId") ?? url.searchParams.get("adId");
    if (!generationId) {
      return jsonError("generationId is required", 400);
    }
    const ad = await loadOwnedAd(generationId);
    return jsonOk(await toProgress(ad));
  } catch (error) {
    return jsonFromUnknown(error);
  }
}

export async function POST(request: Request) {
  try {
    const { profile } = await requireUserWithProfile();

    const body: unknown = await request.json();
    const parsed = bodySchema.safeParse(body);
    const generationId = parsed.success
      ? (parsed.data.generationId ?? parsed.data.adId)
      : null;
    if (!generationId) {
      return jsonError("generationId is required", 400);
    }

    const ad = await loadOwnedAd(generationId);
    if (!ad.script) {
      return jsonError("Approve a script before generating video.", 400);
    }

    if (ad.status === "completed" && ad.finalPath) {
      return jsonOk(await toProgress(ad));
    }
    if (
      ad.status === "generating_video" ||
      ad.status === "generating_voice" ||
      ad.status === "compositing"
    ) {
      return jsonOk(await toProgress(ad));
    }

    await requireCredits(profile);
    await deductVideoCredit(ad);
    await updateAd(ad.id, { status: "generating_video", error: null });

    try {
      const result = await runWithPipelineContext(
        { userId: ad.userId, generationId: ad.id },
        async () => produce(ad),
      );
      return jsonOk(result);
    } catch (error) {
      await refundVideoCredit(ad.id);
      await updateAd(ad.id, {
        status: "failed",
        error: error instanceof Error ? error.message : "Video generation failed",
      });
      throw error;
    }
  } catch (error) {
    return jsonFromUnknown(error);
  }
}

async function produce(ad: Ad) {
  const scriptText = ad.script?.fullText ?? "";
  const summary = [ad.script?.hook, ad.script?.body, ad.script?.cta]
    .filter(Boolean)
    .join(" ");
  const motionPrompt = buildMotionPrompt(summary || scriptText);
  const imageUrl = await getSignedMediaUrl(ad.productImagePath);

  await updateAd(ad.id, { status: "generating_video", error: null });
  const videoUrl =
    ad.videoPath && ad.status !== "failed"
      ? await getSignedMediaUrl(ad.videoPath)
      : await generateVideo(imageUrl, motionPrompt);
  await updateAd(ad.id, {
    videoPath: videoUrl,
    status: "generating_voice",
    error: null,
  });

  const voiceUrl =
    ad.voicePath && ad.status !== "failed"
      ? await getSignedMediaUrl(ad.voicePath)
      : await generateVoiceover(scriptText);
  await updateAd(ad.id, {
    voicePath: voiceUrl,
    status: "compositing",
    error: null,
  });

  const finalUrl = await compositeVideo(videoUrl, voiceUrl);
  const completed = await updateAd(ad.id, {
    finalPath: finalUrl,
    status: "completed",
    error: null,
  });

  return {
    generationId: completed.id,
    status: completed.status,
    videoUrl: await getSignedMediaUrl(completed.finalPath ?? finalUrl, SIGNED_URL_TTL_SECONDS),
  };
}

async function toProgress(ad: Ad) {
  return {
    generationId: ad.id,
    status: ad.status,
    videoUrl: ad.finalPath
      ? await getSignedMediaUrl(ad.finalPath, SIGNED_URL_TTL_SECONDS)
      : null,
    error: ad.error,
  };
}

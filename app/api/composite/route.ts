import { loadOwnedAd } from "@/lib/ads";
import { refundVideoCredit } from "@/lib/credits";
import { requireUserWithProfile } from "@/lib/auth/require-user";
import { SIGNED_URL_TTL_SECONDS } from "@/lib/constants";
import { updateAd } from "@/lib/db";
import { generateBodySchema } from "@/lib/db/schema";
import { jsonError, jsonFromUnknown, jsonOk } from "@/lib/http";
import { runWithPipelineContext } from "@/lib/pipeline/context";
import { compositeVideo } from "@/lib/pipeline/composite";
import { getSignedMediaUrl } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    await requireUserWithProfile();
    const body: unknown = await request.json();
    const parsed = generateBodySchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("adId is required", 400);
    }

    const ad = await loadOwnedAd(parsed.data.adId);
    if (!ad.videoPath || !ad.voicePath) {
      return jsonError("Video and voiceover must exist before compositing.", 400);
    }

    await updateAd(ad.id, { status: "compositing", error: null });

    try {
      const videoUrl = await getSignedMediaUrl(ad.videoPath);
      const audioUrl = await getSignedMediaUrl(ad.voicePath);
      const finalUrl = await runWithPipelineContext(
        { userId: ad.userId, generationId: ad.id },
        () => compositeVideo(videoUrl, audioUrl),
      );
      const updated = await updateAd(ad.id, {
        finalPath: finalUrl,
        status: "completed",
        error: null,
      });
      return jsonOk({
        ad: updated,
        url: await getSignedMediaUrl(updated.finalPath ?? finalUrl, SIGNED_URL_TTL_SECONDS),
      });
    } catch (error) {
      await refundVideoCredit(ad.id);
      await updateAd(ad.id, {
        status: "failed",
        error: error instanceof Error ? error.message : "Composite failed",
      });
      throw error;
    }
  } catch (error) {
    return jsonFromUnknown(error);
  }
}

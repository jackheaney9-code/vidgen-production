import { loadOwnedAd } from "@/lib/ads";
import { refundVideoCredit } from "@/lib/credits";
import { requireUserWithProfile } from "@/lib/auth/require-user";
import { updateAd } from "@/lib/db";
import { generateBodySchema } from "@/lib/db/schema";
import { jsonError, jsonFromUnknown, jsonOk } from "@/lib/http";
import { runWithPipelineContext } from "@/lib/pipeline/context";
import { generateVoiceover } from "@/lib/pipeline/voice";

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
    if (!ad.script) {
      return jsonError("A script is required for voiceover.", 400);
    }

    await updateAd(ad.id, { status: "generating_voice", error: null });

    try {
      const voiceUrl = await runWithPipelineContext(
        { userId: ad.userId, generationId: ad.id },
        () => generateVoiceover(ad.script?.fullText ?? ""),
      );
      const updated = await updateAd(ad.id, {
        voicePath: voiceUrl,
        status: "generating_voice",
        error: null,
      });
      return jsonOk({ ad: updated, url: voiceUrl });
    } catch (error) {
      await refundVideoCredit(ad.id);
      await updateAd(ad.id, {
        status: "failed",
        error: error instanceof Error ? error.message : "Voiceover failed",
      });
      throw error;
    }
  } catch (error) {
    return jsonFromUnknown(error);
  }
}

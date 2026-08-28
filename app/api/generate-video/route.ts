import { loadOwnedAd } from "@/lib/ads";
import { deductVideoCredit, refundVideoCredit, requireCredits } from "@/lib/credits";
import { requireUserWithProfile } from "@/lib/auth/require-user";
import { updateAd } from "@/lib/db";
import { generateBodySchema } from "@/lib/db/schema";
import { jsonError, jsonFromUnknown, jsonOk } from "@/lib/http";
import { generateProductVideo } from "@/lib/pipeline/video";
import { localStorageRoot, saveUserFile } from "@/lib/storage";
import { readFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const { profile } = await requireUserWithProfile();
    await requireCredits(profile);

    const body: unknown = await request.json();
    const parsed = generateBodySchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("adId is required", 400);
    }

    const ad = await loadOwnedAd(parsed.data.adId);
    if (!ad.script) {
      return jsonError("Approve a script before generating video.", 400);
    }

    await deductVideoCredit(ad);
    await updateAd(ad.id, { status: "video_pending", error: null });

    try {
      const relative = `${ad.id}/video.mp4`;
      const outputPath = path.join(localStorageRoot(), ad.userId, relative);
      await generateProductVideo({ ad, outputPath });
      const bytes = await readFile(outputPath);
      const stored = await saveUserFile(ad.userId, relative, bytes);
      const updated = await updateAd(ad.id, {
        videoPath: stored,
        status: "video_ready",
        error: null,
      });
      return jsonOk({ ad: updated });
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

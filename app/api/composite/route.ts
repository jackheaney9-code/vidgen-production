import { readFile } from "fs/promises";
import path from "path";

import { loadOwnedAd } from "@/lib/ads";
import { refundVideoCredit, requireCredits } from "@/lib/credits";
import { requireUserWithProfile } from "@/lib/auth/require-user";
import { updateAd } from "@/lib/db";
import { generateBodySchema } from "@/lib/db/schema";
import { jsonError, jsonFromUnknown, jsonOk } from "@/lib/http";
import { compositeVideo } from "@/lib/pipeline/composite";
import { getSignedMediaUrl, localStorageRoot, resolveLocalPath, saveUserFile } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 60;

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
    if (!ad.videoPath || !ad.voicePath) {
      return jsonError("Video and voiceover must exist before compositing.", 400);
    }

    await updateAd(ad.id, { status: "compositing", error: null });

    try {
      const relative = `${ad.id}/final.mp4`;
      const outputPath = path.join(localStorageRoot(), ad.userId, relative);
      await compositeVideo({
        videoPath: resolveLocalPath(ad.videoPath),
        voicePath: resolveLocalPath(ad.voicePath),
        outputPath,
      });
      const bytes = await readFile(outputPath);
      const stored = await saveUserFile(ad.userId, relative, bytes);
      const updated = await updateAd(ad.id, {
        finalPath: stored,
        status: "complete",
        error: null,
      });
      return jsonOk({
        ad: updated,
        url: await getSignedMediaUrl(stored),
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

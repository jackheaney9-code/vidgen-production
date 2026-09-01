import { loadOwnedAd } from "@/lib/ads";
import { requireUserWithProfile } from "@/lib/auth/require-user";
import { chargeVideoCreditOnce, refundVideoCreditOnce } from "@/lib/credits";
import { jsonError, jsonFromUnknown, jsonOk } from "@/lib/http";
import {
  startGenerateVideo,
  syncGenerateVideo,
  toVideoProgress,
} from "@/lib/pipeline/generate-video-service";
import { getRunwayTask, startRunwayGeneration } from "@/lib/pipeline/runway";
import { hasRunway } from "@/lib/env";
import { updateAd } from "@/lib/db";
import { getSignedMediaUrl, readMediaBytes, saveUserFile } from "@/lib/storage";
import { z } from "zod";
import type { Ad, Profile } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  generationId: z.string().min(1).optional(),
  adId: z.string().min(1).optional(),
});

export async function GET(request: Request) {
  try {
    const { profile } = await requireUserWithProfile();
    const url = new URL(request.url);
    const generationId =
      url.searchParams.get("generationId") ?? url.searchParams.get("adId");
    if (!generationId) {
      return jsonError("generationId is required", 400);
    }
    const ad = await loadOwnedAd(generationId);
    const synced = await syncGenerateVideo(ad, createDeps(profile));
    return jsonOk(toVideoProgress(synced));
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
    const started = await startGenerateVideo(ad, createDeps(profile));
    return jsonOk(toVideoProgress(started));
  } catch (error) {
    return jsonFromUnknown(error);
  }
}

function createDeps(profile: Profile) {
  return {
    hasRunway,
    startRunway: startRunwayGeneration,
    getRunwayTask,
    download: readMediaBytes,
    async saveVideo(userId: string, generationId: string, bytes: Buffer) {
      return saveUserFile(userId, `${generationId}/video.mp4`, bytes);
    },
    persist: (id: string, patch: Partial<Ad>) => updateAd(id, patch),
    chargeOnce: (current: Ad) => chargeVideoCreditOnce(current, profile),
    refundOnce: refundVideoCreditOnce,
    signProductImage: (path: string) => getSignedMediaUrl(path),
  };
}

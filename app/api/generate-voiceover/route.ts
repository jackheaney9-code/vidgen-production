import { loadOwnedAd } from "@/lib/ads";
import { requireUserWithProfile } from "@/lib/auth/require-user";
import { getAd, updateAd } from "@/lib/db";
import { jsonError, jsonFromUnknown, jsonOk } from "@/lib/http";
import { hasElevenLabs, isDemoMode } from "@/lib/env";
import {
  generateVoice,
  toVoiceProgress,
} from "@/lib/pipeline/generate-voice-service";
import { synthesizeSpeech } from "@/lib/pipeline/voice";
import { saveUserFile } from "@/lib/storage";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  generationId: z.string().min(1).optional(),
  adId: z.string().min(1).optional(),
});

export async function POST(request: Request) {
  try {
    await requireUserWithProfile();

    const body: unknown = await request.json();
    const parsed = bodySchema.safeParse(body);
    const generationId = parsed.success
      ? (parsed.data.generationId ?? parsed.data.adId)
      : null;
    if (!generationId) {
      return jsonError("generationId is required", 400);
    }

    const ad = await loadOwnedAd(generationId);
    const updated = await generateVoice(ad, {
      canSynthesize: () => hasElevenLabs() || isDemoMode(),
      synthesize: (text) => synthesizeSpeech(text),
      async saveVoice(userId, id, bytes) {
        return saveUserFile(userId, `${id}/voice.mp3`, bytes);
      },
      persist: (id, patch) => updateAd(id, patch),
      load: (id) => getAd(id),
    });
    return jsonOk(toVoiceProgress(updated));
  } catch (error) {
    return jsonFromUnknown(error);
  }
}

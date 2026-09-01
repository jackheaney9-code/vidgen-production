import { HttpError } from "../errors.ts";
import type { Ad, AdScript } from "../../types/index.ts";

export const VOICE_FAILED_MESSAGE =
  "Voice generation failed. Your picture is saved — you can try the voiceover again.";

export const VOICE_NOT_READY_MESSAGE = "Picture is required before generating a voiceover.";

export type VoiceProgress = {
  generationId: string;
  status: Ad["status"];
  videoReady: boolean;
  voiceReady: boolean;
  finalReady: boolean;
  error: string | null;
};

export type GenerateVoiceDeps = {
  canSynthesize: () => boolean;
  synthesize: (text: string) => Promise<Buffer>;
  saveVoice: (userId: string, generationId: string, bytes: Buffer) => Promise<string>;
  persist: (id: string, patch: Partial<Ad>) => Promise<Ad>;
  load: (id: string) => Promise<Ad | null>;
};

export function toVoiceProgress(ad: Ad): VoiceProgress {
  return {
    generationId: ad.id,
    status: ad.status,
    videoReady: Boolean(ad.videoPath),
    voiceReady: Boolean(ad.voicePath),
    finalReady: Boolean(ad.finalPath),
    error: ad.error,
  };
}

export function shouldSkipVoiceGeneration(ad: Ad): boolean {
  if (ad.voicePath) {
    return true;
  }
  if (ad.status === "compositing" || ad.status === "completed") {
    return true;
  }
  return false;
}

export function voiceoverTextFromScript(script: AdScript): string {
  const preferred = sanitizeVoiceoverText(script.fullText);
  if (preferred) {
    return preferred;
  }
  return sanitizeVoiceoverText([script.hook, script.body, script.cta].filter(Boolean).join(" "));
}

export function sanitizeVoiceoverText(text: string): string {
  return text
    .replace(/\*\*/g, "")
    .replace(/\bHOOK\s*(\([^)]*\))?\s*:\s*/gi, "")
    .replace(/\bBODY\s*(\([^)]*\))?\s*:\s*/gi, "")
    .replace(/\bCTA\s*(\([^)]*\))?\s*:\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function generateVoice(ad: Ad, deps: GenerateVoiceDeps): Promise<Ad> {
  if (shouldSkipVoiceGeneration(ad)) {
    return ad;
  }

  if (!ad.script) {
    throw new HttpError(400, "A script is required for voiceover.");
  }
  if (!ad.videoPath) {
    throw new HttpError(409, VOICE_NOT_READY_MESSAGE);
  }
  if (ad.status !== "generating_voice") {
    throw new HttpError(409, "This generation is not ready for voiceover.");
  }

  const text = voiceoverTextFromScript(ad.script);
  if (!text) {
    throw new HttpError(400, "A script is required for voiceover.");
  }

  if (!deps.canSynthesize()) {
    throw new HttpError(503, "Voice generation is not configured.");
  }

  const latest = await deps.persist(ad.id, {
    status: "generating_voice",
    error: null,
  });

  let audio: Buffer;
  try {
    audio = await deps.synthesize(text);
  } catch (error) {
    console.error("ElevenLabs voice synthesis failed", error);
    await deps.persist(ad.id, {
      status: "generating_voice",
      error: VOICE_FAILED_MESSAGE,
    });
    throw new HttpError(502, VOICE_FAILED_MESSAGE);
  }

  const current = (await deps.load(ad.id)) ?? latest;
  if (current.voicePath) {
    return current;
  }

  try {
    const objectPath = await deps.saveVoice(ad.userId, ad.id, audio);
    return await deps.persist(ad.id, {
      voicePath: objectPath,
      status: "compositing",
      error: null,
    });
  } catch (error) {
    console.error("Voice storage failed", error);
    await deps.persist(ad.id, {
      status: "generating_voice",
      error: VOICE_FAILED_MESSAGE,
    });
    throw new HttpError(502, VOICE_FAILED_MESSAGE);
  }
}

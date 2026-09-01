import { getElevenLabsVoiceId, getEnv, hasElevenLabs } from "@/lib/env";
import { HttpError } from "@/lib/errors";
import { runCommand } from "@/lib/ffmpeg";
import { readMediaBytes } from "@/lib/storage";
import { mkdir } from "fs/promises";
import os from "node:os";
import path from "path";

import { VOICE_FAILED_MESSAGE } from "./generate-voice-service";

const RACHEL_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

/** Provider adapter. Callers persist the returned bytes; do not store provider URLs. */
export async function synthesizeSpeech(
  script: string,
  voiceId?: string,
): Promise<Buffer> {
  if (hasElevenLabs()) {
    return synthesizeElevenLabs(script, voiceId ?? getElevenLabsVoiceId());
  }
  return synthesizeEspeak(script);
}

async function synthesizeElevenLabs(
  script: string,
  voiceId: string,
): Promise<Buffer> {
  const apiKey = getEnv("ELEVENLABS_API_KEY");
  if (!apiKey) {
    throw new HttpError(503, "Voice generation is not configured.");
  }

  const id = voiceId || RACHEL_VOICE_ID;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    let res: Response;
    try {
      res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${id}`, {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: script,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      });
    } catch (error) {
      console.error("ElevenLabs request failed", error);
      throw new HttpError(502, VOICE_FAILED_MESSAGE);
    }

    if (res.ok) {
      return Buffer.from(await res.arrayBuffer());
    }
    if (res.status === 429 || res.status === 503) {
      const retryAfter = Number(res.headers.get("retry-after"));
      const waitMs =
        Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(retryAfter * 1000, 20_000)
          : 1500 * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      continue;
    }
    const detail = await res.text().catch(() => "");
    console.error("ElevenLabs rejected the job", res.status, detail.slice(0, 200));
    throw new HttpError(502, VOICE_FAILED_MESSAGE);
  }
  throw new HttpError(502, VOICE_FAILED_MESSAGE);
}

async function synthesizeEspeak(script: string): Promise<Buffer> {
  const tmpDir = path.join(os.tmpdir(), "lumina-voice");
  await mkdir(tmpDir, { recursive: true });
  const wavPath = path.join(tmpDir, `voice-${Date.now()}.wav`);
  const mp3Path = path.join(tmpDir, `voice-${Date.now()}.mp3`);
  await runCommand("espeak-ng", [
    "-v",
    "en-us",
    "-s",
    "148",
    "-p",
    "42",
    "-w",
    wavPath,
    script,
  ]);
  await runCommand("ffmpeg", [
    "-y",
    "-i",
    wavPath,
    "-codec:a",
    "libmp3lame",
    "-b:a",
    "192k",
    mp3Path,
  ]);
  return readMediaBytes(mp3Path);
}

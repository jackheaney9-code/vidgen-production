import { mkdir } from "fs/promises";
import path from "path";

import { runCommand } from "@/lib/ffmpeg";
import { getElevenLabsVoiceId, getEnv, hasElevenLabs } from "@/lib/env";

export async function generateVoiceover(input: {
  text: string;
  outputPath: string;
}): Promise<void> {
  await mkdir(path.dirname(input.outputPath), { recursive: true });
  if (hasElevenLabs()) {
    await generateWithElevenLabs(input.text, input.outputPath);
    return;
  }
  await generateWithEspeak(input.text, input.outputPath);
}

async function generateWithElevenLabs(
  text: string,
  outputPath: string,
): Promise<void> {
  const apiKey = getEnv("ELEVENLABS_API_KEY");
  if (!apiKey) {
    await generateWithEspeak(text, outputPath);
    return;
  }

  const voiceId = getElevenLabsVoiceId();
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.75,
        },
      }),
    },
  );

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`ElevenLabs rejected the job: ${detail.slice(0, 500)}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  const mp3Path = outputPath.replace(/\.m4a$/i, ".mp3");
  const { writeFile } = await import("fs/promises");
  await writeFile(mp3Path, buffer);
  if (mp3Path !== outputPath) {
    await runCommand("ffmpeg", [
      "-y",
      "-i",
      mp3Path,
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      outputPath,
    ]);
  }
}

async function generateWithEspeak(
  text: string,
  outputPath: string,
): Promise<void> {
  const wavPath = outputPath.replace(/\.m4a$/i, ".wav");
  await runCommand("espeak-ng", [
    "-v",
    "en-us",
    "-s",
    "148",
    "-p",
    "42",
    "-w",
    wavPath,
    text,
  ]);
  await runCommand("ffmpeg", [
    "-y",
    "-i",
    wavPath,
    "-af",
    "afade=t=in:st=0:d=0.12,afade=t=out:st=0:d=0.2",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    outputPath,
  ]);
}

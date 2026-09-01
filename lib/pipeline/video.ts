import { mkdir, writeFile } from "fs/promises";
import os from "node:os";
import path from "path";

import { getEnv, hasRunway } from "@/lib/env";
import { getDrawtextFont, escapeDrawtext, runCommand, ffmpegSupportsDrawtext } from "@/lib/ffmpeg";
import { savePipelineFile, readMediaBytes } from "@/lib/storage";
import { pollRunwayTask, startRunwayGeneration } from "@/lib/pipeline/runway";

export function buildMotionPrompt(scriptSummary: string): string {
  const summary = scriptSummary.replace(/\s+/g, " ").trim().slice(0, 280);
  return `Product advertisement. ${summary}. Smooth camera movement, professional lighting, 15 seconds.`;
}

export async function generateVideo(
  imageUrl: string,
  prompt: string,
): Promise<string> {
  if (hasRunway()) {
    return generateWithRunway(imageUrl, prompt);
  }
  return generateKenBurnsFromUrl(imageUrl, prompt);
}

async function generateWithRunway(
  imageUrl: string,
  prompt: string,
): Promise<string> {
  const apiKey = getEnv("RUNWAY_API_KEY");
  if (!apiKey) {
    return generateKenBurnsFromUrl(imageUrl, prompt);
  }
  const id = await startRunwayGeneration(imageUrl, prompt);
  return pollRunwayTask(id);
}

async function generateKenBurnsFromUrl(
  imageUrl: string,
  prompt: string,
): Promise<string> {
  const imageBytes = await readMediaBytes(imageUrl);
  const tmpDir = path.join(os.tmpdir(), "lumina-video");
  await mkdir(tmpDir, { recursive: true });
  const imagePath = path.join(tmpDir, `still-${Date.now()}.jpg`);
  const outputPath = path.join(tmpDir, `clip-${Date.now()}.mp4`);
  await writeFile(imagePath, imageBytes);
  await renderKenBurns(imagePath, outputPath, prompt);
  const bytes = await readMediaBytes(outputPath);
  const stored = await savePipelineFile("video.mp4", bytes);
  return stored.url;
}

async function renderKenBurns(
  imagePath: string,
  outputPath: string,
  prompt: string,
): Promise<void> {
  await mkdir(path.dirname(outputPath), { recursive: true });
  const duration = 8;
  const fps = 25;
  const frames = duration * fps;
  const font = ffmpegSupportsDrawtext() ? getDrawtextFont() : null;
  const line = escapeDrawtext(truncate(prompt.split(".")[0] ?? "Lumina", 48));

  const textFilters =
    font !== null
      ? `,drawtext=fontfile=${font}:text='${line}':fontcolor=white:fontsize=42:x=(w-text_w)/2:y=h*0.12:enable='between(t,0,3)':shadowcolor=black@0.6:shadowx=2:shadowy=2`
      : "";

  const filter = `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='min(zoom+0.0012,1.18)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=1080x1920:fps=${fps},format=yuv420p,eq=contrast=1.08:saturation=1.12:brightness=0.02,vignette=PI/5${textFilters}`;

  await runCommand("ffmpeg", [
    "-y",
    "-loop",
    "1",
    "-i",
    imagePath,
    "-vf",
    filter,
    "-t",
    String(duration),
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-preset",
    "veryfast",
    "-crf",
    "20",
    "-movflags",
    "+faststart",
    outputPath,
  ]);
}

function truncate(value: string, max: number): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max - 1)}…`;
}

import { readFile } from "fs/promises";
import path from "path";

import { getDrawtextFont, escapeDrawtext, runCommand } from "@/lib/ffmpeg";
import { getEnv, getRunwayModel, hasRunway } from "@/lib/env";
import { resolveLocalPath } from "@/lib/storage";
import type { Ad } from "@/types";

const RUNWAY_API = "https://api.dev.runwayml.com/v1";

export async function generateProductVideo(input: {
  ad: Ad;
  outputPath: string;
}): Promise<void> {
  const imagePath = resolveLocalPath(input.ad.productImagePath);
  if (hasRunway()) {
    await generateWithRunway(input.ad, imagePath, input.outputPath);
    return;
  }
  await generateKenBurnsVideo(input.ad, imagePath, input.outputPath);
}

async function generateWithRunway(
  ad: Ad,
  imagePath: string,
  outputPath: string,
): Promise<void> {
  const apiKey = getEnv("RUNWAY_API_KEY");
  if (!apiKey) {
    await generateKenBurnsVideo(ad, imagePath, outputPath);
    return;
  }

  const imageBytes = await readFile(imagePath);
  const promptImage = `data:image/jpeg;base64,${imageBytes.toString("base64")}`;
  const promptText =
    ad.script?.visualPrompt ??
    `Cinematic vertical product commercial of ${ad.productName}`;

  const created = await fetch(`${RUNWAY_API}/image_to_video`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "X-Runway-Version": "2024-11-06",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: getRunwayModel(),
      promptImage,
      promptText,
      duration: 8,
      ratio: "720:1280",
    }),
  });

  if (!created.ok) {
    const detail = await created.text();
    throw new Error(`Runway rejected the job: ${detail.slice(0, 500)}`);
  }

  const createdBody: unknown = await created.json();
  const id = readTaskId(createdBody);
  if (!id) {
    throw new Error("Runway did not return a task id");
  }

  const videoUrl = await pollRunwayTask(apiKey, id);
  const videoRes = await fetch(videoUrl);
  if (!videoRes.ok) {
    throw new Error("Could not download the Runway video");
  }
  const buffer = Buffer.from(await videoRes.arrayBuffer());
  const { writeFile, mkdir } = await import("fs/promises");
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, buffer);
}

async function pollRunwayTask(apiKey: string, id: string): Promise<string> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await sleep(3000);
    const res = await fetch(`${RUNWAY_API}/tasks/${id}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "X-Runway-Version": "2024-11-06",
      },
    });
    if (!res.ok) {
      continue;
    }
    const body: unknown = await res.json();
    const status = readStringField(body, "status");
    if (status === "SUCCEEDED" || status === "completed") {
      const url = readOutputUrl(body);
      if (url) {
        return url;
      }
    }
    if (status === "FAILED" || status === "failed") {
      throw new Error("Runway generation failed");
    }
  }
  throw new Error("Runway generation timed out");
}

async function generateKenBurnsVideo(
  ad: Ad,
  imagePath: string,
  outputPath: string,
): Promise<void> {
  const { mkdir } = await import("fs/promises");
  await mkdir(path.dirname(outputPath), { recursive: true });

  const duration = Math.min(ad.script?.durationSeconds ?? 12, 12);
  const fps = 25;
  const frames = duration * fps;
  const font = getDrawtextFont();
  const hook = escapeDrawtext(truncate(ad.script?.hook ?? ad.productName, 48));
  const name = escapeDrawtext(truncate(ad.productName, 32));
  const cta = escapeDrawtext(truncate(ad.script?.cta ?? "Shop now", 42));

  const textFilters =
    font !== null
      ? `,drawtext=fontfile=${font}:text='${hook}':fontcolor=white:fontsize=42:x=(w-text_w)/2:y=h*0.12:enable='between(t,0,3)':shadowcolor=black@0.6:shadowx=2:shadowy=2,drawtext=fontfile=${font}:text='${name}':fontcolor=white:fontsize=36:x=(w-text_w)/2:y=h*0.82:enable='between(t,2,${duration - 2})':shadowcolor=black@0.7:shadowx=2:shadowy=2,drawtext=fontfile=${font}:text='${cta}':fontcolor=white:fontsize=34:x=(w-text_w)/2:y=h*0.88:enable='gte(t,${duration - 3})':shadowcolor=black@0.7:shadowx=2:shadowy=2`
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readTaskId(body: unknown): string | null {
  if (!isRecord(body)) {
    return null;
  }
  const id = body.id;
  return typeof id === "string" ? id : null;
}

function readStringField(body: unknown, key: string): string | null {
  if (!isRecord(body)) {
    return null;
  }
  const value = body[key];
  return typeof value === "string" ? value : null;
}

function readOutputUrl(body: unknown): string | null {
  if (!isRecord(body)) {
    return null;
  }
  const output = body.output;
  if (Array.isArray(output) && typeof output[0] === "string") {
    return output[0];
  }
  if (typeof output === "string") {
    return output;
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

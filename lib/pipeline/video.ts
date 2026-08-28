import { mkdir, writeFile } from "fs/promises";
import os from "node:os";
import path from "path";

import { PIPELINE_TIMEOUT_MS } from "@/lib/constants";
import { getEnv, getRunwayModel, hasRunway } from "@/lib/env";
import { getDrawtextFont, escapeDrawtext, runCommand } from "@/lib/ffmpeg";
import { savePipelineFile, mimeFromPath, readMediaBytes } from "@/lib/storage";

const RUNWAY_API = "https://api.dev.runwayml.com/v1";
const RUNWAY_VERSION = "2024-11-06";

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

  const promptImage = await toRunwayImage(imageUrl);
  const created = await fetchWithRetry(`${RUNWAY_API}/image_to_video`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "X-Runway-Version": RUNWAY_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: getRunwayModel(),
      promptImage,
      init_image: promptImage,
      promptText: prompt,
      duration: 10,
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

  return pollRunwayTask(apiKey, id);
}

async function pollRunwayTask(apiKey: string, id: string): Promise<string> {
  const deadline = Date.now() + PIPELINE_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await sleep(3000);
    const res = await fetch(`${RUNWAY_API}/tasks/${id}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "X-Runway-Version": RUNWAY_VERSION,
      },
    });
    if (res.status === 429) {
      await sleep(retryDelay(res, 4000));
      continue;
    }
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
      throw new Error("Runway finished without a video URL.");
    }
    if (status === "FAILED" || status === "failed" || status === "CANCELLED") {
      throw new Error("Runway generation failed");
    }
  }
  throw new Error("Runway generation timed out after 3 minutes.");
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
  const font = getDrawtextFont();
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

async function toRunwayImage(imageUrl: string): Promise<string> {
  if (/^https?:\/\//i.test(imageUrl)) {
    return imageUrl;
  }
  const bytes = await readMediaBytes(imageUrl);
  const mime = mimeFromPath(imageUrl);
  return `data:${mime};base64,${imageBytesToBase64(bytes)}`;
}

function imageBytesToBase64(bytes: Buffer): string {
  return bytes.toString("base64");
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  attempts = 4,
): Promise<Response> {
  let last: Response | null = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const res = await fetch(url, init);
    last = res;
    if (res.status !== 429 && res.status !== 503) {
      return res;
    }
    await sleep(retryDelay(res, 1500 * 2 ** attempt));
  }
  return last ?? fetch(url, init);
}

function retryDelay(res: Response, fallback: number): number {
  const header = res.headers.get("retry-after");
  const seconds = header ? Number(header) : NaN;
  if (Number.isFinite(seconds) && seconds > 0) {
    return Math.min(seconds * 1000, 20_000);
  }
  return Math.min(fallback, 20_000);
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

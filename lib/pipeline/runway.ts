import { PIPELINE_TIMEOUT_MS } from "@/lib/constants";
import { getEnv, getRunwayModel } from "@/lib/env";
import { mimeFromPath, readMediaBytes } from "@/lib/storage";

const RUNWAY_API = "https://api.dev.runwayml.com/v1";
const RUNWAY_VERSION = "2024-11-06";

export type RunwayTaskStatus =
  | "PENDING"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED"
  | "UNKNOWN";

export type RunwayTaskState = {
  status: RunwayTaskStatus;
  outputUrl: string | null;
};

export async function startRunwayGeneration(
  imageUrl: string,
  prompt: string,
): Promise<string> {
  const apiKey = requireRunwayKey();
  const promptImage = await toRunwayImage(imageUrl);
  const created = await fetchWithRetry(`${RUNWAY_API}/image_to_video`, {
    method: "POST",
    headers: runwayHeaders(apiKey),
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
    console.error("Runway image_to_video rejected", created.status, detail.slice(0, 500));
    throw new Error("Picture generation could not be started.");
  }

  const createdBody: unknown = await created.json();
  const id = readTaskId(createdBody);
  if (!id) {
    throw new Error("Picture generation could not be started.");
  }
  return id;
}

export async function getRunwayTask(taskId: string): Promise<RunwayTaskState> {
  const apiKey = requireRunwayKey();
  const res = await fetch(`${RUNWAY_API}/tasks/${taskId}`, {
    headers: runwayHeaders(apiKey),
  });
  if (res.status === 429) {
    return { status: "RUNNING", outputUrl: null };
  }
  if (!res.ok) {
    console.error("Runway task lookup failed", res.status);
    return { status: "UNKNOWN", outputUrl: null };
  }
  const body: unknown = await res.json();
  return normalizeRunwayTask(body);
}

export function normalizeRunwayTask(body: unknown): RunwayTaskState {
  const raw = (readStringField(body, "status") ?? "").toUpperCase();
  if (raw === "SUCCEEDED" || raw === "COMPLETED") {
    return { status: "SUCCEEDED", outputUrl: readOutputUrl(body) };
  }
  if (raw === "FAILED") {
    return { status: "FAILED", outputUrl: null };
  }
  if (raw === "CANCELLED" || raw === "CANCELED") {
    return { status: "CANCELLED", outputUrl: null };
  }
  if (raw === "PENDING" || raw === "THROTTLED") {
    return { status: "PENDING", outputUrl: null };
  }
  if (raw === "RUNNING" || raw === "IN_PROGRESS") {
    return { status: "RUNNING", outputUrl: null };
  }
  return { status: "UNKNOWN", outputUrl: readOutputUrl(body) };
}

/** Kept for demo/tests. Production generate-video must not call this. */
export async function pollRunwayTask(taskId: string): Promise<string> {
  const deadline = Date.now() + PIPELINE_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await sleep(3000);
    const task = await getRunwayTask(taskId);
    if (task.status === "SUCCEEDED") {
      if (task.outputUrl) {
        return task.outputUrl;
      }
      throw new Error("Picture generation finished without a video.");
    }
    if (task.status === "FAILED" || task.status === "CANCELLED") {
      throw new Error("Picture generation failed.");
    }
  }
  throw new Error("Picture generation timed out.");
}

function requireRunwayKey(): string {
  const apiKey = getEnv("RUNWAY_API_KEY");
  if (!apiKey) {
    throw new Error("Picture generation is not configured.");
  }
  return apiKey;
}

function runwayHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    "X-Runway-Version": RUNWAY_VERSION,
    "Content-Type": "application/json",
  };
}

async function toRunwayImage(imageUrl: string): Promise<string> {
  if (/^https?:\/\//i.test(imageUrl)) {
    return imageUrl;
  }
  const bytes = await readMediaBytes(imageUrl);
  const mime = mimeFromPath(imageUrl);
  return `data:${mime};base64,${bytes.toString("base64")}`;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readTaskId(body: unknown): string | null {
  if (!isRecord(body)) {
    return null;
  }
  return typeof body.id === "string" ? body.id : null;
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

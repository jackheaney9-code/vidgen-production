import { HttpError } from "../errors.ts";
import { hasPersistedActiveCredit } from "../credit-state.ts";
import type { RunwayTaskState } from "./runway";
import type { Ad } from "../../types";

export const VIDEO_RECOVERY_MESSAGE =
  "This generation needs manual recovery. Picture generation was interrupted before a job id was saved.";

export const PICTURE_FAILED_MESSAGE = "Picture generation failed. Please try again.";

export type VideoProgress = {
  generationId: string;
  status: Ad["status"];
  hasRunwayTask: boolean;
  videoReady: boolean;
  voiceReady: boolean;
  finalReady: boolean;
  error: string | null;
  recoveryRequired: boolean;
};

export type GenerateVideoDeps = {
  hasRunway: () => boolean;
  startRunway: (imageUrl: string, prompt: string) => Promise<string>;
  getRunwayTask: (taskId: string) => Promise<RunwayTaskState>;
  download: (url: string) => Promise<Buffer>;
  saveVideo: (userId: string, generationId: string, bytes: Buffer) => Promise<string>;
  persist: (id: string, patch: Partial<Ad>) => Promise<Ad>;
  chargeOnce: (ad: Ad) => Promise<Ad>;
  refundOnce: (ad: Ad) => Promise<Ad>;
  signProductImage: (path: string) => Promise<string>;
};

export function isLegacyStuckVideo(ad: Ad): boolean {
  return ad.status === "generating_video" && !ad.runwayTaskId;
}

export function toVideoProgress(ad: Ad): VideoProgress {
  const recoveryRequired = isLegacyStuckVideo(ad);
  return {
    generationId: ad.id,
    status: ad.status,
    hasRunwayTask: Boolean(ad.runwayTaskId),
    videoReady: Boolean(ad.videoPath),
    voiceReady: Boolean(ad.voicePath),
    finalReady: Boolean(ad.finalPath),
    error: recoveryRequired ? VIDEO_RECOVERY_MESSAGE : ad.error,
    recoveryRequired,
  };
}

export function shouldReuseExistingJob(ad: Ad): boolean {
  if (ad.runwayTaskId) {
    return true;
  }
  if (ad.videoPath) {
    return true;
  }
  if (
    ad.status === "generating_voice" ||
    ad.status === "compositing" ||
    ad.status === "completed"
  ) {
    return true;
  }
  return false;
}

export async function startGenerateVideo(
  ad: Ad,
  deps: GenerateVideoDeps,
): Promise<Ad> {
  if (!ad.script) {
    throw new HttpError(400, "Approve a script before generating video.");
  }
  if (shouldReuseExistingJob(ad)) {
    return ad;
  }
  if (isLegacyStuckVideo(ad)) {
    throw new HttpError(409, VIDEO_RECOVERY_MESSAGE);
  }

  if (!deps.hasRunway()) {
    throw new HttpError(503, "Picture generation is not configured.");
  }

  let charged = ad;
  if (!hasPersistedActiveCredit(ad)) {
    charged = await deps.chargeOnce(ad);
  }

  charged = await deps.persist(charged.id, {
    status: "generating_video",
    creditCharged: true,
    creditRefunded: false,
    error: null,
  });

  const summary = [ad.script.hook, ad.script.body, ad.script.cta]
    .filter(Boolean)
    .join(" ");
  const clipped = (summary || ad.script.fullText).replace(/\s+/g, " ").trim().slice(0, 280);
  const prompt = `Product advertisement. ${clipped}. Smooth camera movement, professional lighting, 15 seconds.`;
  const imageUrl = await deps.signProductImage(ad.productImagePath);

  let taskId: string;
  try {
    taskId = await deps.startRunway(imageUrl, prompt);
  } catch (error) {
    console.error("Runway start failed", error);
    await failAndRefund(charged, deps, PICTURE_FAILED_MESSAGE);
    throw new HttpError(502, PICTURE_FAILED_MESSAGE);
  }

  try {
    return await deps.persist(charged.id, {
      runwayTaskId: taskId,
      status: "generating_video",
      creditCharged: true,
      creditRefunded: false,
      error: null,
    });
  } catch (error) {
    console.error(
      "Failed to persist Runway task id after provider create; manual recovery required",
      error,
    );
    throw new HttpError(500, VIDEO_RECOVERY_MESSAGE);
  }
}

export async function syncGenerateVideo(
  ad: Ad,
  deps: GenerateVideoDeps,
): Promise<Ad> {
  if (ad.status === "completed" || ad.status === "failed") {
    return ad;
  }
  if (ad.videoPath) {
    return ad;
  }
  if (!ad.runwayTaskId) {
    return ad;
  }

  const task = await deps.getRunwayTask(ad.runwayTaskId);
  if (task.status === "PENDING" || task.status === "RUNNING" || task.status === "UNKNOWN") {
    return ad;
  }

  if (task.status === "FAILED" || task.status === "CANCELLED") {
    return failAndRefund(ad, deps, PICTURE_FAILED_MESSAGE);
  }

  if (task.status !== "SUCCEEDED" || !task.outputUrl) {
    return ad;
  }

  const bytes = await deps.download(task.outputUrl);
  const objectPath = await deps.saveVideo(ad.userId, ad.id, bytes);
  return deps.persist(ad.id, {
    videoPath: objectPath,
    status: "generating_voice",
    error: null,
  });
}

async function failAndRefund(
  ad: Ad,
  deps: GenerateVideoDeps,
  message: string,
): Promise<Ad> {
  const refunded = await deps.refundOnce(ad);
  return deps.persist(refunded.id, {
    status: "failed",
    error: message,
  });
}

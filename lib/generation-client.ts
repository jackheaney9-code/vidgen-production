import { AD_STATUSES, type AdStatus } from "../types/index.ts";

/** Interval for GET /api/generate-video while status is generating_video. */
export const RUNWAY_POLL_INTERVAL_MS = 3_000;

const MAX_TRANSIENT_FAILURES = 4;

export const VIDEO_RECOVERY_USER_MESSAGE =
  "This generation was interrupted before its video job could be saved. Please contact support or start a new generation after the credit is resolved.";

export type VideoProgress = {
  generationId: string;
  status: AdStatus;
  hasRunwayTask: boolean;
  videoReady: boolean;
  voiceReady: boolean;
  finalReady: boolean;
  error: string | null;
  recoveryRequired: boolean;
};

export type ApiJsonResult = {
  status: number;
  ok: boolean;
  data: unknown;
  parseError: boolean;
  empty: boolean;
};

export type ProduceOutcome =
  | { kind: "progress"; progress: VideoProgress }
  | { kind: "recovery" }
  | { kind: "payment"; message: string }
  | { kind: "error"; message: string };

export type ProduceGuard = {
  tryBegin: () => boolean;
  end: () => void;
  isLocked: () => boolean;
};

type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<Pick<Response, "ok" | "status" | "text">>;

const STATUS_SET = new Set<string>(AD_STATUSES);

export function isAdStatus(value: string): value is AdStatus {
  return STATUS_SET.has(value);
}

export function isProduceLockedStatus(status: AdStatus): boolean {
  return (
    status === "generating_video" ||
    status === "generating_voice" ||
    status === "compositing" ||
    status === "completed"
  );
}

export function shouldPollRunway(args: {
  status: AdStatus;
  hasRunwayTask: boolean;
  recoveryRequired?: boolean;
}): boolean {
  if (args.recoveryRequired) {
    return false;
  }
  if (args.status !== "generating_video") {
    return false;
  }
  return args.hasRunwayTask;
}

export function shouldAutoProduce(args: {
  autoProduce: boolean;
  hasScript: boolean;
  finalPath: string | null;
  status: AdStatus;
}): boolean {
  if (!args.autoProduce || !args.hasScript || args.finalPath) {
    return false;
  }
  return args.status === "pending";
}

export function createProduceGuard(): ProduceGuard {
  let locked = false;
  return {
    tryBegin() {
      if (locked) {
        return false;
      }
      locked = true;
      return true;
    },
    end() {
      locked = false;
    },
    isLocked() {
      return locked;
    },
  };
}

export async function readApiJson(
  res: Pick<Response, "ok" | "status" | "text">,
): Promise<ApiJsonResult> {
  const text = await res.text();
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      status: res.status,
      ok: res.ok,
      data: null,
      parseError: false,
      empty: true,
    };
  }
  try {
    return {
      status: res.status,
      ok: res.ok,
      data: JSON.parse(trimmed) as unknown,
      parseError: false,
      empty: false,
    };
  } catch {
    return {
      status: res.status,
      ok: res.ok,
      data: null,
      parseError: true,
      empty: false,
    };
  }
}

export function parseVideoProgress(data: unknown): VideoProgress | null {
  if (typeof data !== "object" || data === null) {
    return null;
  }
  const record = data as Record<string, unknown>;
  if (typeof record.generationId !== "string" || !record.generationId) {
    return null;
  }
  if (typeof record.status !== "string" || !isAdStatus(record.status)) {
    return null;
  }
  return {
    generationId: record.generationId,
    status: record.status,
    hasRunwayTask: Boolean(record.hasRunwayTask),
    videoReady: Boolean(record.videoReady),
    voiceReady: Boolean(record.voiceReady),
    finalReady: Boolean(record.finalReady),
    error: typeof record.error === "string" ? record.error : null,
    recoveryRequired: Boolean(record.recoveryRequired),
  };
}

export function userFacingVideoError(
  progress: Pick<VideoProgress, "recoveryRequired" | "error"> | null,
  fallback = "Generation failed",
): string {
  if (progress?.recoveryRequired) {
    return VIDEO_RECOVERY_USER_MESSAGE;
  }
  if (progress?.error) {
    return progress.error;
  }
  return fallback;
}

function errorMessageFromData(data: unknown, fallback: string): string {
  if (
    typeof data === "object" &&
    data !== null &&
    "error" in data &&
    typeof data.error === "string" &&
    data.error.trim()
  ) {
    return data.error;
  }
  return fallback;
}

export async function postGenerateVideo(
  generationId: string,
  fetchImpl: FetchLike = fetch,
): Promise<ProduceOutcome> {
  let res: Pick<Response, "ok" | "status" | "text">;
  try {
    res = await fetchImpl("/api/generate-video", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ generationId, adId: generationId }),
    });
  } catch {
    return {
      kind: "error",
      message: "Could not start video generation. Check your connection and try again.",
    };
  }

  const parsed = await readApiJson(res);
  if (res.status === 409 || parseVideoProgress(parsed.data)?.recoveryRequired) {
    return { kind: "recovery" };
  }
  if (res.status === 402) {
    return {
      kind: "payment",
      message: errorMessageFromData(
        parsed.data,
        "You need at least 1 credit to generate a video.",
      ),
    };
  }
  if (res.status === 401) {
    return { kind: "error", message: "Session expired. Sign in again to continue." };
  }
  if (parsed.parseError || parsed.empty) {
    return { kind: "error", message: "Could not start video generation." };
  }
  if (!res.ok) {
    return {
      kind: "error",
      message: errorMessageFromData(parsed.data, "Could not start video generation."),
    };
  }
  const progress = parseVideoProgress(parsed.data);
  if (!progress) {
    return { kind: "error", message: "Could not start video generation." };
  }
  if (progress.recoveryRequired || (progress.status === "generating_video" && !progress.hasRunwayTask)) {
    return { kind: "recovery" };
  }
  return { kind: "progress", progress };
}

export function createRunwayPoller(opts: {
  generationId: string;
  intervalMs?: number;
  fetchImpl?: FetchLike;
  onProgress: (progress: VideoProgress) => void;
  onFatalError?: (message: string) => void;
}): { start: (immediate?: boolean) => void; stop: () => void; isInFlight: () => boolean } {
  const intervalMs = opts.intervalMs ?? RUNWAY_POLL_INTERVAL_MS;
  const fetchFn = opts.fetchImpl ?? fetch;
  let stopped = false;
  let started = false;
  let inFlight = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let consecutiveTransient = 0;

  function clearTimer() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function stop() {
    stopped = true;
    clearTimer();
  }

  function schedule() {
    if (stopped) {
      return;
    }
    clearTimer();
    timer = setTimeout(() => {
      timer = null;
      void runTick();
    }, intervalMs);
  }

  async function runTick() {
    if (stopped || inFlight) {
      return;
    }
    inFlight = true;
    try {
      let res: Pick<Response, "ok" | "status" | "text">;
      try {
        res = await fetchFn(
          `/api/generate-video?generationId=${encodeURIComponent(opts.generationId)}`,
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
          },
        );
      } catch {
        consecutiveTransient += 1;
        if (consecutiveTransient >= MAX_TRANSIENT_FAILURES) {
          opts.onFatalError?.(
            "Network error while checking video status. Refresh the page to try again.",
          );
          stop();
        }
        return;
      }

      if (stopped) {
        return;
      }

      if (res.status === 401) {
        opts.onFatalError?.("Session expired. Sign in again to continue.");
        stop();
        return;
      }

      const parsed = await readApiJson(res);

      if (res.ok && !parsed.parseError) {
        const progress = parseVideoProgress(parsed.data);
        if (progress) {
          consecutiveTransient = 0;
          opts.onProgress(progress);
          if (
            progress.recoveryRequired ||
            !shouldPollRunway({
              status: progress.status,
              hasRunwayTask: progress.hasRunwayTask,
              recoveryRequired: progress.recoveryRequired,
            })
          ) {
            stop();
          }
          return;
        }
      }

      consecutiveTransient += 1;
      if (consecutiveTransient >= MAX_TRANSIENT_FAILURES) {
        const message =
          res.status >= 500
            ? "Video status is temporarily unavailable. Refresh the page to try again."
            : errorMessageFromData(parsed.data, "Could not check video status.");
        opts.onFatalError?.(message);
        stop();
      }
    } finally {
      inFlight = false;
      if (!stopped) {
        schedule();
      }
    }
  }

  function start(immediate = true) {
    if (stopped || started) {
      return;
    }
    started = true;
    if (immediate) {
      void runTick();
    } else {
      schedule();
    }
  }

  return {
    start,
    stop,
    isInFlight: () => inFlight,
  };
}

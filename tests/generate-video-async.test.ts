import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import path from "node:path";

import { HttpError } from "../lib/errors.ts";
import type { Ad } from "../types/index.ts";
import type { RunwayTaskState } from "../lib/pipeline/runway.ts";
import {
  isLegacyStuckVideo,
  shouldReuseExistingJob,
  startGenerateVideo,
  syncGenerateVideo,
  toVideoProgress,
  VIDEO_RECOVERY_MESSAGE,
  type GenerateVideoDeps,
} from "../lib/pipeline/generate-video-service.ts";

function baseAd(overrides: Partial<Ad> = {}): Ad {
  const now = "2026-09-01T00:00:00.000Z";
  return {
    id: "gen-1",
    userId: "user-1",
    productName: "Aurum",
    productDescription: "A night serum.",
    audience: "Testers",
    style: "showcase",
    productImagePath: "user-1/gen-1/product.png",
    script: {
      hook: "Hook",
      body: "Body",
      cta: "Buy",
      fullText: "Hook Body Buy",
      visualPrompt: "prompt",
      onScreenText: [],
      durationSeconds: 15,
    },
    videoPath: null,
    voicePath: null,
    finalPath: null,
    status: "pending",
    error: null,
    runwayTaskId: null,
    creditCharged: false,
    creditRefunded: false,
    creditDeducted: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createHarness(ad: Ad) {
  const store = { ad, credits: 2 };
  const calls = {
    start: 0,
    get: 0,
    download: 0,
    save: 0,
    charge: 0,
    refund: 0,
  };
  let task: RunwayTaskState = { status: "PENDING", outputUrl: null };
  let startError: Error | null = null;
  let persistTaskIdError: Error | null = null;

  const deps: GenerateVideoDeps = {
    hasRunway: () => true,
    async startRunway() {
      calls.start += 1;
      if (startError) {
        throw startError;
      }
      return "task_1";
    },
    async getRunwayTask() {
      calls.get += 1;
      return task;
    },
    async download() {
      calls.download += 1;
      return Buffer.from("mp4");
    },
    async saveVideo(userId, generationId) {
      calls.save += 1;
      return `${userId}/${generationId}/video.mp4`;
    },
    async persist(id, patch) {
      if (persistTaskIdError && patch.runwayTaskId) {
        throw persistTaskIdError;
      }
      store.ad = {
        ...store.ad,
        ...patch,
        id,
        creditDeducted: store.ad.creditCharged && !store.ad.creditRefunded,
      };
      if (patch.creditCharged !== undefined) {
        store.ad.creditDeducted = patch.creditCharged && !(patch.creditRefunded ?? store.ad.creditRefunded);
      }
      return store.ad;
    },
    async chargeOnce(current) {
      if (current.creditCharged && !current.creditRefunded) {
        return current;
      }
      calls.charge += 1;
      store.credits -= 1;
      store.ad = {
        ...current,
        creditCharged: true,
        creditRefunded: false,
        creditDeducted: true,
      };
      return store.ad;
    },
    async refundOnce(current) {
      if (!current.creditCharged || current.creditRefunded || current.finalPath) {
        return current;
      }
      calls.refund += 1;
      store.credits += 1;
      store.ad = {
        ...current,
        creditRefunded: true,
        creditDeducted: false,
      };
      return store.ad;
    },
    async signProductImage(pathValue) {
      return `https://signed.example/${pathValue}`;
    },
  };

  return {
    store,
    calls,
    deps,
    setTask(next: RunwayTaskState) {
      task = next;
    },
    failStart(error: Error) {
      startError = error;
    },
    failPersistTaskId() {
      persistTaskIdError = new Error("db write failed");
    },
  };
}

test("1. first POST deducts once, starts one task, persists id", async () => {
  const harness = createHarness(baseAd());
  const result = await startGenerateVideo(harness.store.ad, harness.deps);
  assert.equal(harness.calls.charge, 1);
  assert.equal(harness.calls.start, 1);
  assert.equal(harness.calls.get, 0);
  assert.equal(result.runwayTaskId, "task_1");
  assert.equal(result.status, "generating_video");
  assert.equal(result.creditCharged, true);
  assert.equal(result.creditRefunded, false);
  assert.equal(harness.store.credits, 1);
});

test("2. duplicate POST does not charge or start a second task", async () => {
  const harness = createHarness(baseAd());
  await startGenerateVideo(harness.store.ad, harness.deps);
  const second = await startGenerateVideo(harness.store.ad, harness.deps);
  assert.equal(harness.calls.charge, 1);
  assert.equal(harness.calls.start, 1);
  assert.equal(second.runwayTaskId, "task_1");
});

test("3. GET pending queries existing task once and does not charge", async () => {
  const harness = createHarness(
    baseAd({
      status: "generating_video",
      runwayTaskId: "task_1",
      creditCharged: true,
    }),
  );
  harness.setTask({ status: "RUNNING", outputUrl: null });
  const result = await syncGenerateVideo(harness.store.ad, harness.deps);
  assert.equal(harness.calls.get, 1);
  assert.equal(harness.calls.charge, 0);
  assert.equal(harness.calls.start, 0);
  assert.equal(result.status, "generating_video");
});

test("4. GET succeeded stores video and sets generating_voice", async () => {
  const harness = createHarness(
    baseAd({
      status: "generating_video",
      runwayTaskId: "task_1",
      creditCharged: true,
    }),
  );
  harness.setTask({ status: "SUCCEEDED", outputUrl: "https://runway.example/out.mp4" });
  const result = await syncGenerateVideo(harness.store.ad, harness.deps);
  assert.equal(harness.calls.download, 1);
  assert.equal(harness.calls.save, 1);
  assert.equal(result.videoPath, "user-1/gen-1/video.mp4");
  assert.equal(result.status, "generating_voice");
  assert.equal(harness.calls.refund, 0);
});

test("5. GET failed refunds once", async () => {
  const harness = createHarness(
    baseAd({
      status: "generating_video",
      runwayTaskId: "task_1",
      creditCharged: true,
      creditRefunded: false,
    }),
  );
  harness.setTask({ status: "FAILED", outputUrl: null });
  const result = await syncGenerateVideo(harness.store.ad, harness.deps);
  assert.equal(result.status, "failed");
  assert.equal(result.creditRefunded, true);
  assert.equal(harness.calls.refund, 1);
  assert.equal(harness.store.credits, 3);
});

test("6. repeated failed GET does not refund again", async () => {
  const harness = createHarness(
    baseAd({
      status: "generating_video",
      runwayTaskId: "task_1",
      creditCharged: true,
    }),
  );
  harness.setTask({ status: "FAILED", outputUrl: null });
  await syncGenerateVideo(harness.store.ad, harness.deps);
  const second = await syncGenerateVideo(harness.store.ad, harness.deps);
  assert.equal(harness.calls.refund, 1);
  assert.equal(second.creditRefunded, true);
});

test("7. completed skips provider and credit changes", async () => {
  const harness = createHarness(
    baseAd({
      status: "completed",
      runwayTaskId: "task_1",
      videoPath: "user-1/gen-1/video.mp4",
      finalPath: "user-1/gen-1/final.mp4",
      creditCharged: true,
    }),
  );
  const result = await syncGenerateVideo(harness.store.ad, harness.deps);
  assert.equal(harness.calls.get, 0);
  assert.equal(harness.calls.charge, 0);
  assert.equal(harness.calls.refund, 0);
  assert.equal(result.status, "completed");
});

test("8. legacy stuck row does not start or charge", async () => {
  const stuck = baseAd({
    status: "generating_video",
    runwayTaskId: null,
    creditCharged: true,
    creditRefunded: false,
  });
  assert.equal(isLegacyStuckVideo(stuck), true);
  const harness = createHarness(stuck);
  await assert.rejects(
    () => startGenerateVideo(stuck, harness.deps),
    (error: unknown) =>
      error instanceof HttpError &&
      error.status === 409 &&
      error.message === VIDEO_RECOVERY_MESSAGE,
  );
  assert.equal(harness.calls.start, 0);
  assert.equal(harness.calls.charge, 0);
  const progress = toVideoProgress(stuck);
  assert.equal(progress.recoveryRequired, true);
  assert.equal(progress.hasRunwayTask, false);
});

test("9. Runway start failure refunds once", async () => {
  const harness = createHarness(baseAd());
  harness.failStart(new Error("provider down"));
  await assert.rejects(
    () => startGenerateVideo(harness.store.ad, harness.deps),
    (error: unknown) => error instanceof HttpError && error.status === 502,
  );
  assert.equal(harness.calls.charge, 1);
  assert.equal(harness.calls.start, 1);
  assert.equal(harness.calls.refund, 1);
  assert.equal(harness.store.ad.status, "failed");
  assert.equal(harness.store.ad.creditRefunded, true);
});

test("10. existing task means no POST to Runway", async () => {
  const harness = createHarness(
    baseAd({
      status: "generating_video",
      runwayTaskId: "task_1",
      creditCharged: true,
    }),
  );
  assert.equal(shouldReuseExistingJob(harness.store.ad), true);
  const result = await startGenerateVideo(harness.store.ad, harness.deps);
  assert.equal(harness.calls.start, 0);
  assert.equal(harness.calls.charge, 0);
  assert.equal(result.runwayTaskId, "task_1");
});

test("GET with no task id does not create a task", async () => {
  const harness = createHarness(
    baseAd({ status: "generating_video", creditCharged: true, runwayTaskId: null }),
  );
  const result = await syncGenerateVideo(harness.store.ad, harness.deps);
  assert.equal(harness.calls.get, 0);
  assert.equal(harness.calls.start, 0);
  assert.equal(result.status, "generating_video");
});

test("route no longer polls Runway or runs voice/composite in POST", () => {
  const route = readFileSync(
    path.join(process.cwd(), "app/api/generate-video/route.ts"),
    "utf8",
  );
  assert.doesNotMatch(route, /pollRunwayTask/);
  assert.doesNotMatch(route, /generateVoiceover/);
  assert.doesNotMatch(route, /compositeVideo/);
  assert.doesNotMatch(route, /produce\(/);
  assert.match(route, /startGenerateVideo/);
  assert.match(route, /syncGenerateVideo/);
});

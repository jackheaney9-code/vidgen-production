import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import {
  createProduceGuard,
  createRunwayPoller,
  isProduceLockedStatus,
  postGenerateVideo,
  postGenerateVoiceover,
  RUNWAY_POLL_INTERVAL_MS,
  shouldAutoProduce,
  shouldPollRunway,
  shouldStartVoice,
  VIDEO_RECOVERY_USER_MESSAGE,
  type VideoProgress,
} from "../lib/generation-client.ts";

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jsonResponse(status: number, body: unknown): Pick<Response, "ok" | "status" | "text"> {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  };
}

function htmlResponse(status: number): Pick<Response, "ok" | "status" | "text"> {
  return {
    ok: false,
    status,
    text: async () => "<html>gateway timeout</html>",
  };
}

function progress(overrides: Partial<VideoProgress> = {}): VideoProgress {
  return {
    generationId: "gen-1",
    status: "generating_video",
    hasRunwayTask: true,
    videoReady: false,
    voiceReady: false,
    finalReady: false,
    error: null,
    recoveryRequired: false,
    ...overrides,
  };
}

test("Produce sends POST once", async () => {
  let posts = 0;
  const fetchImpl = async (url: string, init?: RequestInit) => {
    assert.equal(url, "/api/generate-video");
    assert.equal(init?.method, "POST");
    posts += 1;
    return jsonResponse(200, progress());
  };
  const outcome = await postGenerateVideo("gen-1", fetchImpl);
  assert.equal(outcome.kind, "progress");
  if (outcome.kind === "progress") {
    assert.equal(outcome.progress.status, "generating_video");
    assert.equal(outcome.progress.hasRunwayTask, true);
  }
  assert.equal(posts, 1);
});

test("Successful POST enters polling", async () => {
  const outcome = await postGenerateVideo("gen-1", async () => jsonResponse(200, progress()));
  assert.equal(outcome.kind, "progress");
  if (outcome.kind !== "progress") {
    throw new Error("expected progress");
  }
  assert.equal(
    shouldPollRunway({
      status: outcome.progress.status,
      hasRunwayTask: outcome.progress.hasRunwayTask,
      recoveryRequired: outcome.progress.recoveryRequired,
    }),
    true,
  );
});

test("POST returning existing progress is success, not an error", async () => {
  const outcome = await postGenerateVideo("gen-1", async () =>
    jsonResponse(
      200,
      progress({ status: "generating_video", hasRunwayTask: true }),
    ),
  );
  assert.equal(outcome.kind, "progress");
});

test("generating_video causes GET generate-video polling", async () => {
  const calls: Array<{ url: string; method: string }> = [];
  const poller = createRunwayPoller({
    generationId: "gen-1",
    intervalMs: 20,
    fetchImpl: async (url, init) => {
      calls.push({ url, method: String(init?.method ?? "GET") });
      return jsonResponse(200, progress());
    },
    onProgress() {},
  });
  poller.start(true);
  await wait(5);
  poller.stop();
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.method, "GET");
  assert.equal(calls[0]?.url, "/api/generate-video?generationId=gen-1");
});

test("repeated polling never POSTs again", async () => {
  const methods: string[] = [];
  const poller = createRunwayPoller({
    generationId: "gen-1",
    intervalMs: 15,
    fetchImpl: async (url, init) => {
      methods.push(String(init?.method ?? "GET"));
      assert.match(url, /\/api\/generate-video\?generationId=/);
      return jsonResponse(200, progress());
    },
    onProgress() {},
  });
  poller.start(true);
  await wait(70);
  poller.stop();
  assert.ok(methods.length >= 2);
  assert.ok(methods.every((method) => method === "GET"));
});

test("GET returning generating_video continues polling", async () => {
  let gets = 0;
  const poller = createRunwayPoller({
    generationId: "gen-1",
    intervalMs: 15,
    fetchImpl: async () => {
      gets += 1;
      return jsonResponse(200, progress({ status: "generating_video", hasRunwayTask: true }));
    },
    onProgress() {},
  });
  poller.start(true);
  await wait(70);
  poller.stop();
  assert.ok(gets >= 3);
});

test("GET returning generating_voice stops Runway polling", async () => {
  let gets = 0;
  const statuses: string[] = [];
  const poller = createRunwayPoller({
    generationId: "gen-1",
    intervalMs: 15,
    fetchImpl: async () => {
      gets += 1;
      return jsonResponse(
        200,
        progress({
          status: "generating_voice",
          hasRunwayTask: true,
          videoReady: true,
        }),
      );
    },
    onProgress(next) {
      statuses.push(next.status);
    },
  });
  poller.start(true);
  await wait(80);
  poller.stop();
  assert.equal(gets, 1);
  assert.deepEqual(statuses, ["generating_voice"]);
});

test("page load with recoverable generating_video resumes polling without POST", () => {
  assert.equal(
    shouldAutoProduce({
      autoProduce: true,
      hasScript: true,
      finalPath: null,
      status: "generating_video",
    }),
    false,
  );
  assert.equal(
    shouldPollRunway({
      status: "generating_video",
      hasRunwayTask: true,
      recoveryRequired: false,
    }),
    true,
  );
});

test("page load with legacy stuck/manual-recovery state does not POST", () => {
  assert.equal(
    shouldAutoProduce({
      autoProduce: true,
      hasScript: true,
      finalPath: null,
      status: "generating_video",
    }),
    false,
  );
  assert.equal(
    shouldPollRunway({
      status: "generating_video",
      hasRunwayTask: false,
      recoveryRequired: false,
    }),
    false,
  );
  assert.equal(
    shouldPollRunway({
      status: "generating_video",
      hasRunwayTask: false,
      recoveryRequired: true,
    }),
    false,
  );
  assert.match(VIDEO_RECOVERY_USER_MESSAGE, /interrupted before its video job could be saved/);
  assert.doesNotMatch(VIDEO_RECOVERY_USER_MESSAGE, /task/i);
  assert.doesNotMatch(VIDEO_RECOVERY_USER_MESSAGE, /runway/i);
});

test("completed never polls Runway", () => {
  assert.equal(
    shouldPollRunway({
      status: "completed",
      hasRunwayTask: true,
    }),
    false,
  );
});

test("failed stops polling", async () => {
  let gets = 0;
  const poller = createRunwayPoller({
    generationId: "gen-1",
    intervalMs: 15,
    fetchImpl: async () => {
      gets += 1;
      return jsonResponse(
        200,
        progress({ status: "failed", hasRunwayTask: true, error: "Picture generation failed. Please try again." }),
      );
    },
    onProgress() {},
  });
  poller.start(true);
  await wait(80);
  poller.stop();
  assert.equal(gets, 1);
});

test("component unmount cancels timer and overlapping polls are prevented", async () => {
  let gets = 0;
  let resolveFirst: ((value: Pick<Response, "ok" | "status" | "text">) => void) | null = null;
  const poller = createRunwayPoller({
    generationId: "gen-1",
    intervalMs: 15,
    fetchImpl: async () => {
      gets += 1;
      if (gets === 1) {
        return await new Promise<Pick<Response, "ok" | "status" | "text">>((resolve) => {
          resolveFirst = resolve;
        });
      }
      return jsonResponse(200, progress());
    },
    onProgress() {},
  });
  poller.start(true);
  await wait(5);
  assert.equal(gets, 1);
  assert.equal(poller.isInFlight(), true);
  await wait(50);
  assert.equal(gets, 1);
  poller.stop();
  resolveFirst?.(jsonResponse(200, progress()));
  await wait(50);
  assert.equal(gets, 1);
});

test("double-click Produce only causes one POST", async () => {
  const guard = createProduceGuard();
  let posts = 0;
  const fetchImpl = async (_url: string, init?: RequestInit) => {
    assert.equal(init?.method, "POST");
    posts += 1;
    await wait(40);
    return jsonResponse(200, progress());
  };

  async function click() {
    if (isProduceLockedStatus("pending")) {
      return;
    }
    if (!guard.tryBegin()) {
      return;
    }
    try {
      await postGenerateVideo("gen-1", fetchImpl);
    } finally {
      guard.end();
    }
  }

  void click();
  void click();
  await wait(80);
  assert.equal(posts, 1);
});

test("polling handles 401, non-JSON, and modest 5xx retries without runaway loops", async () => {
  let unauthorizedGets = 0;
  const authPoller = createRunwayPoller({
    generationId: "gen-1",
    intervalMs: 15,
    fetchImpl: async () => {
      unauthorizedGets += 1;
      return jsonResponse(401, { error: "Unauthorized" });
    },
    onProgress() {},
  });
  authPoller.start(true);
  await wait(80);
  authPoller.stop();
  assert.equal(unauthorizedGets, 1);

  let serverErrors = 0;
  let fatal = 0;
  const serverPoller = createRunwayPoller({
    generationId: "gen-1",
    intervalMs: 10,
    fetchImpl: async () => {
      serverErrors += 1;
      return htmlResponse(502);
    },
    onProgress() {},
    onFatalError() {
      fatal += 1;
    },
  });
  serverPoller.start(true);
  await wait(20);
  assert.ok(serverErrors >= 1);
  assert.equal(fatal, 0);
  await wait(80);
  serverPoller.stop();
  assert.equal(fatal, 1);
  assert.ok(serverErrors >= 4);
  assert.ok(serverErrors <= 6);
});

test("produce is locked while picture/voice/composite/completed", () => {
  assert.equal(isProduceLockedStatus("pending"), false);
  assert.equal(isProduceLockedStatus("failed"), false);
  assert.equal(isProduceLockedStatus("generating_video"), true);
  assert.equal(isProduceLockedStatus("generating_voice"), true);
  assert.equal(isProduceLockedStatus("compositing"), true);
  assert.equal(isProduceLockedStatus("completed"), true);
});

test("generation page wires async Runway polling without provider calls", () => {
  const source = readFileSync(
    path.join(process.cwd(), "components/features/generation-result.tsx"),
    "utf8",
  );
  const client = readFileSync(path.join(process.cwd(), "lib/generation-client.ts"), "utf8");
  assert.match(source, /createRunwayPoller/);
  assert.match(source, /postGenerateVideo/);
  assert.match(source, /postGenerateVoiceover/);
  assert.match(source, /Voice generated\. Composite is next/);
  assert.match(source, /VIDEO_RECOVERY_USER_MESSAGE/);
  assert.doesNotMatch(source, /setInterval/);
  assert.doesNotMatch(source, /elevenlabs/i);
  assert.doesNotMatch(source, /\/api\/composite/);
  assert.doesNotMatch(client, /startRunwayGeneration/);
  assert.doesNotMatch(client, /getRunwayTask/);
  assert.match(client, /method: "GET"/);
  assert.equal(RUNWAY_POLL_INTERVAL_MS, 3_000);
});

test("4. repeated frontend voice starts only one POST at a time", async () => {
  const guard = createProduceGuard();
  let posts = 0;
  const fetchImpl = async (url: string, init?: RequestInit) => {
    assert.equal(url, "/api/generate-voiceover");
    assert.equal(init?.method, "POST");
    posts += 1;
    await wait(40);
    return jsonResponse(200, {
      generationId: "gen-1",
      status: "compositing",
      videoReady: true,
      voiceReady: true,
      finalReady: false,
      error: null,
    });
  };

  async function start() {
    if (!shouldStartVoice({
      status: "generating_voice",
      videoReady: true,
      voiceReady: false,
    })) {
      return;
    }
    if (!guard.tryBegin()) {
      return;
    }
    try {
      await postGenerateVoiceover("gen-1", fetchImpl);
    } finally {
      guard.end();
    }
  }

  void start();
  void start();
  await wait(80);
  assert.equal(posts, 1);
});

test("5. refresh at generating_voice resumes voice generation safely", () => {
  assert.equal(
    shouldStartVoice({
      status: "generating_voice",
      videoReady: true,
      voiceReady: false,
    }),
    true,
  );
  assert.equal(
    shouldAutoProduce({
      autoProduce: true,
      hasScript: true,
      finalPath: null,
      status: "generating_voice",
    }),
    false,
  );
});

test("6. compositing never starts voice", () => {
  assert.equal(
    shouldStartVoice({
      status: "compositing",
      videoReady: true,
      voiceReady: true,
    }),
    false,
  );
});

test("7. completed never starts voice", () => {
  assert.equal(
    shouldStartVoice({
      status: "completed",
      videoReady: true,
      voiceReady: true,
    }),
    false,
  );
});

test("voice client sanitizes provider errors", async () => {
  const outcome = await postGenerateVoiceover("gen-1", async () =>
    jsonResponse(502, { error: "ElevenLabs rejected the job: request_id=abc" }),
  );
  assert.equal(outcome.kind, "error");
  if (outcome.kind === "error") {
    assert.doesNotMatch(outcome.message, /elevenlabs/i);
    assert.doesNotMatch(outcome.message, /request_id/);
  }
});

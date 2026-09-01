import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { HttpError } from "../lib/errors.ts";
import type { Ad, AdScript } from "../types/index.ts";
import {
  generateVoice,
  sanitizeVoiceoverText,
  shouldSkipVoiceGeneration,
  toVoiceProgress,
  voiceoverTextFromScript,
  VOICE_FAILED_MESSAGE,
  type GenerateVoiceDeps,
} from "../lib/pipeline/generate-voice-service.ts";

function script(overrides: Partial<AdScript> = {}): AdScript {
  return {
    hook: "Glow in seconds.",
    body: "Aurum rebuilds overnight.",
    cta: "Shop Aurum.",
    fullText: "Glow in seconds. Aurum rebuilds overnight. Shop Aurum.",
    visualPrompt: "prompt",
    onScreenText: [],
    durationSeconds: 15,
    ...overrides,
  };
}

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
    script: script(),
    videoPath: "user-1/gen-1/video.mp4",
    voicePath: null,
    finalPath: null,
    status: "generating_voice",
    error: null,
    runwayTaskId: "task_1",
    creditCharged: true,
    creditRefunded: false,
    creditDeducted: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createHarness(ad: Ad) {
  const store = { ad };
  const calls = { synthesize: 0, save: 0, persist: 0 };
  let synthesizeError: Error | null = null;
  const texts: string[] = [];

  const deps: GenerateVoiceDeps = {
    canSynthesize: () => true,
    async synthesize(text) {
      calls.synthesize += 1;
      texts.push(text);
      if (synthesizeError) {
        throw synthesizeError;
      }
      return Buffer.from("fake-mp3");
    },
    async saveVoice(userId, generationId, bytes) {
      calls.save += 1;
      assert.equal(userId, store.ad.userId);
      assert.equal(generationId, store.ad.id);
      assert.ok(bytes.length > 0);
      return `${userId}/${generationId}/voice.mp3`;
    },
    async persist(id, patch) {
      calls.persist += 1;
      store.ad = { ...store.ad, ...patch, id, updatedAt: new Date().toISOString() };
      return store.ad;
    },
    async load() {
      return store.ad;
    },
  };

  return {
    store,
    calls,
    texts,
    deps,
    failSynthesize() {
      synthesizeError = new Error("ElevenLabs rejected the job: request_id=secret");
    },
  };
}

test("1. generating_voice + video + no voice calls ElevenLabs once", async () => {
  const { deps, calls, texts } = createHarness(baseAd());
  const result = await generateVoice(baseAd(), deps);
  assert.equal(calls.synthesize, 1);
  assert.equal(texts[0], "Glow in seconds. Aurum rebuilds overnight. Shop Aurum.");
  assert.equal(result.status, "compositing");
});

test("2. voice success saves object path and sets compositing", async () => {
  const { deps, calls, store } = createHarness(baseAd());
  const result = await generateVoice(baseAd(), deps);
  assert.equal(calls.save, 1);
  assert.equal(result.voicePath, "user-1/gen-1/voice.mp3");
  assert.equal(result.status, "compositing");
  assert.equal(result.videoPath, "user-1/gen-1/video.mp4");
  assert.equal(store.ad.creditCharged, true);
  assert.equal(store.ad.creditRefunded, false);
});

test("3. duplicate POST after voiceover_url exists does not call ElevenLabs", async () => {
  const existing = baseAd({
    voicePath: "user-1/gen-1/voice.mp3",
    status: "compositing",
  });
  const { deps, calls } = createHarness(existing);
  const result = await generateVoice(existing, deps);
  assert.equal(calls.synthesize, 0);
  assert.equal(calls.save, 0);
  assert.equal(result.voicePath, "user-1/gen-1/voice.mp3");
  assert.equal(result.status, "compositing");
});

test("6. compositing does not call voice", async () => {
  const { deps, calls } = createHarness(
    baseAd({ status: "compositing", voicePath: "user-1/gen-1/voice.mp3" }),
  );
  const result = await generateVoice(baseAd({
    status: "compositing",
    voicePath: "user-1/gen-1/voice.mp3",
  }), deps);
  assert.equal(calls.synthesize, 0);
  assert.equal(result.status, "compositing");
});

test("7. completed does not call voice", async () => {
  const ad = baseAd({
    status: "completed",
    voicePath: "user-1/gen-1/voice.mp3",
    finalPath: "user-1/gen-1/final.mp4",
  });
  const { deps, calls } = createHarness(ad);
  const result = await generateVoice(ad, deps);
  assert.equal(calls.synthesize, 0);
  assert.equal(result.status, "completed");
});

test("8. ElevenLabs failure preserves video, does not refund, stays recoverable", async () => {
  const { deps, calls, failSynthesize, store } = createHarness(baseAd());
  failSynthesize();
  await assert.rejects(() => generateVoice(baseAd(), deps), (error: unknown) => {
    assert.ok(error instanceof HttpError);
    assert.equal(error.status, 502);
    assert.equal(error.message, VOICE_FAILED_MESSAGE);
    assert.doesNotMatch(error.message, /elevenlabs/i);
    assert.doesNotMatch(error.message, /request_id/);
    return true;
  });
  assert.equal(calls.synthesize, 1);
  assert.equal(calls.save, 0);
  assert.equal(store.ad.status, "generating_voice");
  assert.equal(store.ad.videoPath, "user-1/gen-1/video.mp4");
  assert.equal(store.ad.voicePath, null);
  assert.equal(store.ad.creditCharged, true);
  assert.equal(store.ad.creditRefunded, false);
  assert.equal(store.ad.error, VOICE_FAILED_MESSAGE);
});

test("voiceover uses fullText and does not re-concatenate labeled sections", () => {
  const text = voiceoverTextFromScript(
    script({
      hook: "Hook",
      body: "Body",
      cta: "CTA",
      fullText: "**Glow now.** Aurum rebuilds overnight. Shop Aurum.",
    }),
  );
  assert.equal(text, "Glow now. Aurum rebuilds overnight. Shop Aurum.");
  assert.doesNotMatch(text, /\*\*/);
  const labeled = sanitizeVoiceoverText(
    "HOOK (first 3 seconds): Hello BODY (middle): Middle CTA (last 3 seconds): Buy",
  );
  assert.doesNotMatch(labeled, /HOOK/i);
  assert.doesNotMatch(labeled, /BODY/i);
  assert.doesNotMatch(labeled, /CTA:/i);
});

test("shouldSkipVoiceGeneration covers compositing and completed", () => {
  assert.equal(shouldSkipVoiceGeneration(baseAd()), false);
  assert.equal(
    shouldSkipVoiceGeneration(baseAd({ voicePath: "user-1/gen-1/voice.mp3" })),
    true,
  );
  assert.equal(shouldSkipVoiceGeneration(baseAd({ status: "completed" })), true);
});

test("progress JSON does not include provider ids", () => {
  const progress = toVoiceProgress(baseAd({ runwayTaskId: "task_secret" }));
  assert.equal("hasRunwayTask" in progress, false);
  assert.deepEqual(Object.keys(progress).sort(), [
    "error",
    "finalReady",
    "generationId",
    "status",
    "videoReady",
    "voiceReady",
  ]);
});

test("9. production storage uses saveUserFile voice.mp3 and not local data dir", () => {
  const route = readFileSync(
    path.join(process.cwd(), "app/api/generate-voiceover/route.ts"),
    "utf8",
  );
  const service = readFileSync(
    path.join(process.cwd(), "lib/pipeline/generate-voice-service.ts"),
    "utf8",
  );
  assert.match(route, /saveUserFile\(userId, `\$\{id\}\/voice\.mp3`/);
  assert.doesNotMatch(route, /process\.cwd\(\)/);
  assert.doesNotMatch(route, /refundVideoCredit/);
  assert.doesNotMatch(route, /chargeVideoCredit|deductVideoCredit|updateCredits/);
  assert.doesNotMatch(route, /startRunway|getRunwayTask/);
  assert.doesNotMatch(service, /process\.cwd\(\)/);
  assert.doesNotMatch(service, /data\/storage/);
});

test("10. route returns sanitized JSON and does not refund", () => {
  const route = readFileSync(
    path.join(process.cwd(), "app/api/generate-voiceover/route.ts"),
    "utf8",
  );
  const voice = readFileSync(path.join(process.cwd(), "lib/pipeline/voice.ts"), "utf8");
  assert.match(route, /toVoiceProgress/);
  assert.doesNotMatch(voice, /ElevenLabs rejected the job: \$\{/);
  assert.match(voice, /VOICE_FAILED_MESSAGE/);
});

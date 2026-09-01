import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, test } from "node:test";
import path from "node:path";

import { HttpError, getErrorMessage } from "../lib/errors.ts";
import { hasSupabase, isDemoMode } from "../lib/env.ts";

const originalEnv = {
  DEMO_MODE: process.env.DEMO_MODE,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
};

afterEach(() => {
  restore("DEMO_MODE");
  restore("NEXT_PUBLIC_SUPABASE_URL");
  restore("NEXT_PUBLIC_SUPABASE_ANON_KEY");
});

function restore(name: keyof typeof originalEnv) {
  const value = originalEnv[name];
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

function usesLocalDiskStorage(): boolean {
  return isDemoMode() || !hasSupabase();
}

function jsonFromUnknown(error: unknown): { status: number; body: { error: string } } {
  if (error instanceof HttpError) {
    return { status: error.status, body: { error: error.message } };
  }
  return { status: 500, body: { error: getErrorMessage(error) } };
}

test("production Supabase mode does not use local disk storage", () => {
  process.env.DEMO_MODE = "false";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  assert.equal(usesLocalDiskStorage(), false);
});

test("demo mode still uses local disk storage", () => {
  process.env.DEMO_MODE = "true";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  assert.equal(usesLocalDiskStorage(), true);
});

test("local mode without Supabase uses local disk storage", () => {
  process.env.DEMO_MODE = "false";
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  assert.equal(usesLocalDiskStorage(), true);
});

test("saveUserFile writes locally only after the Supabase early-return", () => {
  const source = readFileSync(path.join(process.cwd(), "lib/storage.ts"), "utf8");
  const start = source.indexOf("export async function saveUserFile");
  const end = source.indexOf("export async function savePipelineFile");
  assert.ok(start >= 0 && end > start);
  const fn = source.slice(start, end);
  const mkdirAt = fn.indexOf("await mkdir(");
  const writeAt = fn.indexOf("await writeFile(");
  const supabaseUploadAt = fn.indexOf("supabase.storage.from(BUCKET).upload");
  const earlyReturnAt = fn.indexOf("return objectPath;");
  assert.ok(supabaseUploadAt >= 0, "Supabase upload must remain in saveUserFile");
  assert.ok(earlyReturnAt >= 0, "Supabase path must return the object path");
  assert.ok(mkdirAt > earlyReturnAt, "mkdir must not run on the Supabase path");
  assert.ok(writeAt > earlyReturnAt, "writeFile must not run on the Supabase path");
});

test("generate-script awaits handleCreate and handleRegenerate", () => {
  const source = readFileSync(
    path.join(process.cwd(), "app/api/generate-script/route.ts"),
    "utf8",
  );
  assert.match(source, /return await handleCreate\(/);
  assert.match(source, /return await handleRegenerate\(/);
  assert.doesNotMatch(source, /return handleCreate\(/);
  assert.doesNotMatch(source, /return handleRegenerate\(/);
});

test("awaited handleCreate rejection is caught and returned as JSON", async () => {
  async function handleCreate(): Promise<Response> {
    throw new Error("EROFS: read-only file system");
  }

  async function post() {
    try {
      return await handleCreate();
    } catch (error) {
      const mapped = jsonFromUnknown(error);
      return new Response(JSON.stringify(mapped.body), {
        status: mapped.status,
        headers: { "content-type": "application/json" },
      });
    }
  }

  const res = await post();
  assert.equal(res.status, 500);
  assert.equal(res.headers.get("content-type"), "application/json");
  const payload: unknown = await res.json();
  assert.deepEqual(payload, { error: "EROFS: read-only file system" });
});

test("unawaited handleCreate rejection is not caught", async () => {
  async function handleCreate(): Promise<Response> {
    throw new Error("EROFS: read-only file system");
  }

  async function post() {
    try {
      return handleCreate();
    } catch {
      return new Response(JSON.stringify({ error: "caught" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }
  }

  await assert.rejects(post, /EROFS: read-only file system/);
});

test("HttpError stays a JSON non-2xx with its status", () => {
  const mapped = jsonFromUnknown(new HttpError(401, "Sign in to continue."));
  assert.equal(mapped.status, 401);
  assert.deepEqual(mapped.body, { error: "Sign in to continue." });
});

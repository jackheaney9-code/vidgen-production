import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, test } from "node:test";
import path from "node:path";

import { getAnthropicModel } from "../lib/env.ts";

const originalModel = process.env.ANTHROPIC_MODEL;

afterEach(() => {
  if (originalModel === undefined) {
    delete process.env.ANTHROPIC_MODEL;
  } else {
    process.env.ANTHROPIC_MODEL = originalModel;
  }
});

test("code default is claude-sonnet-4-6 when ANTHROPIC_MODEL is unset", () => {
  delete process.env.ANTHROPIC_MODEL;
  assert.equal(getAnthropicModel(), "claude-sonnet-4-6");
});

test("ANTHROPIC_MODEL overrides the code default", () => {
  process.env.ANTHROPIC_MODEL = "claude-sonnet-4-20250514";
  assert.equal(getAnthropicModel(), "claude-sonnet-4-20250514");
});

test("retired snapshot id is no longer the code default", () => {
  const source = readFileSync(path.join(process.cwd(), "lib/env.ts"), "utf8");
  assert.match(source, /"claude-sonnet-4-6"/);
  assert.doesNotMatch(source, /claude-sonnet-4-20250514/);
});

test("Anthropic failures use a sanitized customer message", () => {
  const source = readFileSync(
    path.join(process.cwd(), "lib/pipeline/script.ts"),
    "utf8",
  );
  assert.match(source, /console\.error\("Anthropic script generation failed"/);
  assert.match(source, /throw new Error\(SCRIPT_UNAVAILABLE\)/);
  assert.match(
    source,
    /Script generation is temporarily unavailable\. Please try again\./,
  );
});

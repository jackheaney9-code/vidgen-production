import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import path from "node:path";

import { creditHeld } from "../lib/constants.ts";

function hasActiveVideoCredit(ad: {
  status: string;
  creditCharged: boolean;
  creditRefunded: boolean;
}): boolean {
  if (ad.creditRefunded) {
    return false;
  }
  if (ad.creditCharged) {
    return true;
  }
  return creditHeld(ad.status);
}

function legacyStatusImpliesVideoCreditCharged(status: string): boolean {
  return creditHeld(status);
}

function fixture(
  status:
    | "pending"
    | "generating_script"
    | "generating_video"
    | "generating_voice"
    | "compositing"
    | "completed"
    | "failed",
  flags: { creditCharged?: boolean; creditRefunded?: boolean } = {},
) {
  return {
    status,
    creditCharged: flags.creditCharged ?? false,
    creditRefunded: flags.creditRefunded ?? false,
  };
}

test("A: pending generation is uncharged and not refunded", () => {
  const ad = fixture("pending");
  assert.equal(ad.creditCharged, false);
  assert.equal(ad.creditRefunded, false);
  assert.equal(hasActiveVideoCredit(ad), false);
  assert.equal(legacyStatusImpliesVideoCreditCharged("pending"), false);
});

test("B: a generation that has paid for production is charged", () => {
  const ad = fixture("generating_video", { creditCharged: true });
  assert.equal(ad.creditCharged, true);
  assert.equal(hasActiveVideoCredit(ad), true);
});

test("C: reading credit state never mutates flags", () => {
  const ad = fixture("generating_video", { creditCharged: true, creditRefunded: false });
  const before = { ...ad };
  hasActiveVideoCredit(ad);
  legacyStatusImpliesVideoCreditCharged(ad.status);
  assert.deepEqual(ad, before);
});

test("D: credit_refunded does not hold a charge or invent a new one", () => {
  const refunded = fixture("failed", { creditCharged: true, creditRefunded: true });
  assert.equal(hasActiveVideoCredit(refunded), false);
  const refundedOnly = fixture("pending", { creditCharged: false, creditRefunded: true });
  assert.equal(hasActiveVideoCredit(refundedOnly), false);
});

test("E: completed generation remains charged and not refunded", () => {
  const ad = fixture("completed", { creditCharged: true, creditRefunded: false });
  assert.equal(ad.creditCharged, true);
  assert.equal(ad.creditRefunded, false);
  assert.equal(hasActiveVideoCredit(ad), true);
  assert.equal(legacyStatusImpliesVideoCreditCharged("completed"), true);
});

test("F: migration backfill classifies old generating_video as charged", () => {
  assert.equal(legacyStatusImpliesVideoCreditCharged("generating_video"), true);
  assert.equal(legacyStatusImpliesVideoCreditCharged("generating_voice"), true);
  assert.equal(legacyStatusImpliesVideoCreditCharged("compositing"), true);
  assert.equal(legacyStatusImpliesVideoCreditCharged("completed"), true);
  assert.equal(legacyStatusImpliesVideoCreditCharged("pending"), false);
  assert.equal(legacyStatusImpliesVideoCreditCharged("generating_script"), false);
  assert.equal(legacyStatusImpliesVideoCreditCharged("failed"), false);

  const sql = readFileSync(
    path.join(process.cwd(), "supabase/migrations/002_video_credit_state.sql"),
    "utf8",
  );
  assert.match(sql, /credit_charged = true/);
  assert.match(sql, /generating_video/);
  assert.doesNotMatch(sql, /credit_refunded = true/);
  assert.doesNotMatch(sql, /update public\.profiles/i);
});

test("GET ads and generate-video progress paths do not deduct or refund", () => {
  const adsRoute = readFileSync(
    path.join(process.cwd(), "app/api/ads/[id]/route.ts"),
    "utf8",
  );
  const videoRoute = readFileSync(
    path.join(process.cwd(), "app/api/generate-video/route.ts"),
    "utf8",
  );
  const getFn = videoRoute.slice(
    videoRoute.indexOf("export async function GET"),
    videoRoute.indexOf("export async function POST"),
  );
  assert.doesNotMatch(adsRoute, /deductVideoCredit|refundVideoCredit|updateCredits/);
  assert.doesNotMatch(getFn, /deductVideoCredit|refundVideoCredit|updateCredits/);
});

test("credit-state module prefers persisted flags over status", () => {
  const source = readFileSync(path.join(process.cwd(), "lib/credit-state.ts"), "utf8");
  assert.match(source, /if \(ad\.creditRefunded\)/);
  assert.match(source, /if \(ad\.creditCharged\)/);
  assert.match(source, /creditHeld\(ad\.status\)/);
  assert.match(source, /hasPersistedActiveCredit/);
  assert.match(source, /Generate-video uses `hasPersistedActiveCredit` only/);
});

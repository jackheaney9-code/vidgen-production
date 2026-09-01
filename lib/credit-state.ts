import { creditHeld } from "@/lib/constants";

/**
 * True when this generation currently holds a deducted video credit.
 * Prefers persisted flags; falls back to `creditHeld(status)` so the
 * synchronous Produce path still works if flags are not yet written.
 * Phase B: remove the `creditHeld` fallback.
 */
export function hasActiveVideoCredit(ad: {
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

/** Same statuses as the Phase A SQL backfill of `credit_charged`. */
export function legacyStatusImpliesVideoCreditCharged(status: string): boolean {
  return creditHeld(status);
}

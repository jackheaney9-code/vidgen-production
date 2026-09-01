import { creditHeld } from "./constants.ts";

/**
 * Persisted flags are the source of truth for generate-video (Phase B).
 * `creditHeld(status)` remains for other legacy routes until later phases.
 */
export function hasPersistedActiveCredit(ad: {
  creditCharged: boolean;
  creditRefunded: boolean;
}): boolean {
  return ad.creditCharged && !ad.creditRefunded;
}

export function canRefundVideoCredit(ad: {
  creditCharged: boolean;
  creditRefunded: boolean;
  finalPath: string | null;
}): boolean {
  return ad.creditCharged && !ad.creditRefunded && !ad.finalPath;
}

/**
 * True when this generation currently holds a deducted video credit.
 * Generate-video uses `hasPersistedActiveCredit` only.
 * Other routes may still use this helper, including a status fallback.
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

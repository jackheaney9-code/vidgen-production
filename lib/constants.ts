import type { AdStyle, CreditPack } from "@/types";

export const APP_NAME = "Lumina";

export const STYLE_META: Record<
  AdStyle,
  { label: string; description: string }
> = {
  showcase: {
    label: "Product Showcase",
    description: "Hero product, studio light, slow orbit.",
  },
  lifestyle: {
    label: "Lifestyle",
    description: "In someone’s hands, real rooms, lived-in light.",
  },
  before_after: {
    label: "Before/After",
    description: "The problem, then the product, then the proof.",
  },
};

export const CREDIT_PACKS_CATALOG: CreditPack[] = [
  {
    id: "credit_1",
    name: "1 credit",
    credits: 1,
    priceCents: 1500,
    lookupKey: "lumina_credit_1",
    envPriceVar: "STRIPE_PRICE_1_CREDIT",
    blurb: "One finished video ad.",
    popular: false,
  },
  {
    id: "credit_3",
    name: "3 credits",
    credits: 3,
    priceCents: 2900,
    lookupKey: "lumina_credit_3",
    envPriceVar: "STRIPE_PRICE_3_CREDITS",
    blurb: "Iterate on the hook without buying another pack.",
    popular: true,
  },
  {
    id: "credit_5",
    name: "5 credits",
    credits: 5,
    priceCents: 4900,
    lookupKey: "lumina_credit_5",
    envPriceVar: "STRIPE_PRICE_5_CREDITS",
    blurb: "A small campaign’s worth of cuts.",
    popular: false,
  },
];

export const SIGNUP_BONUS_CREDITS = 3;
export const VIDEO_CREDIT_COST = 1;
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
] as const;

export const SESSION_COOKIE = "lumina_session";
export const SIGNED_URL_TTL_SECONDS = 7 * 24 * 60 * 60;
export const PIPELINE_TIMEOUT_MS = 3 * 60 * 1000;

export function formatUsd(cents: number): string {
  const dollars = cents / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(dollars);
}

/**
 * Statuses that previously implied a video credit had already been deducted.
 * Phase A persists this as `credit_charged`. Phase B should stop treating
 * status as credit proof and use `creditCharged` / `creditRefunded` only.
 */
export function creditHeld(status: string): boolean {
  return (
    status === "generating_video" ||
    status === "generating_voice" ||
    status === "compositing" ||
    status === "completed"
  );
}

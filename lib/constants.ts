import type { AdStyle, CreditPack } from "@/types";

export const APP_NAME = "Lumina";

export const STYLE_META: Record<
  AdStyle,
  { label: string; description: string }
> = {
  cinematic: {
    label: "Cinematic",
    description: "Slow push-in, film grain, dramatic light.",
  },
  ugc: {
    label: "UGC",
    description: "Handheld, native social, talking-to-camera energy.",
  },
  luxury: {
    label: "Luxury",
    description: "Editorial stillness, gold, shadow, restraint.",
  },
  energetic: {
    label: "Energetic",
    description: "Punchy type, product hero, quick rhythm.",
  },
  minimal: {
    label: "Minimal",
    description: "Quiet frame, one claim, lots of air.",
  },
};

export const CREDIT_PACKS_CATALOG: CreditPack[] = [
  {
    id: "spark",
    name: "Spark",
    credits: 5,
    priceCents: 1200,
    blurb: "A handful of ads to test a product line.",
    popular: false,
  },
  {
    id: "studio",
    name: "Studio",
    credits: 15,
    priceCents: 2900,
    blurb: "Enough to iterate hooks, styles, and CTAs.",
    popular: true,
  },
  {
    id: "campaign",
    name: "Campaign",
    credits: 50,
    priceCents: 8900,
    blurb: "A month of creative for a live campaign.",
    popular: false,
  },
];

export const SIGNUP_BONUS_CREDITS = 3;
export const VIDEO_CREDIT_COST = 1;
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
] as const;

export const SESSION_COOKIE = "lumina_session";

export function formatUsd(cents: number): string {
  const dollars = cents / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(dollars);
}

export const AD_STYLES = ["showcase", "lifestyle", "before_after"] as const;

export type AdStyle = (typeof AD_STYLES)[number];

export const AD_STATUSES = [
  "pending",
  "generating_script",
  "generating_video",
  "generating_voice",
  "compositing",
  "completed",
  "failed",
] as const;

export type AdStatus = (typeof AD_STATUSES)[number];

export const CREDIT_PACKS = ["spark", "studio", "campaign"] as const;

export type CreditPackId = (typeof CREDIT_PACKS)[number];

export interface AdScript {
  hook: string;
  body: string;
  cta: string;
  fullText: string;
  visualPrompt: string;
  onScreenText: string[];
  durationSeconds: number;
}

export interface Profile {
  id: string;
  email: string;
  credits: number;
  stripeCustomerId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Ad {
  id: string;
  userId: string;
  productName: string;
  productDescription: string;
  audience: string;
  style: AdStyle;
  productImagePath: string;
  script: AdScript | null;
  videoPath: string | null;
  voicePath: string | null;
  finalPath: string | null;
  status: AdStatus;
  error: string | null;
  creditDeducted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreditTransaction {
  id: string;
  userId: string;
  amount: number;
  reason: string;
  adId: string | null;
  stripeSessionId: string | null;
  createdAt: string;
}

export interface Purchase {
  id: string;
  userId: string;
  stripeSessionId: string;
  creditsPurchased: number;
  amountPaid: number;
  createdAt: string;
}

export interface AuthUser {
  id: string;
  email: string;
}

export interface ProviderStatus {
  demoMode: boolean;
  anthropic: boolean;
  runway: boolean;
  elevenLabs: boolean;
  stripe: boolean;
  supabase: boolean;
}

export interface CreditPack {
  id: CreditPackId;
  name: string;
  credits: number;
  priceCents: number;
  blurb: string;
  popular: boolean;
}

export type { Database, Json } from "@/types/database";
export type {
  CompositeJobInput,
  PipelineResult,
  PipelineStep,
  ScriptJobInput,
  VideoJobInput,
  VoiceJobInput,
} from "@/types/pipeline";

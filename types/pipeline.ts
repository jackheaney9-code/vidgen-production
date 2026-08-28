import type { AdScript, AdStatus, AdStyle } from "@/types"

export type PipelineStep =
  | "script"
  | "video"
  | "voiceover"
  | "composite"

export interface ScriptJobInput {
  productName: string
  productDescription: string
  audience: string
  style: AdStyle
}

export interface VideoJobInput {
  adId: string
  productImagePath: string
  visualPrompt: string
}

export interface VoiceJobInput {
  adId: string
  fullText: string
}

export interface CompositeJobInput {
  adId: string
  videoPath: string
  voicePath: string
}

export interface PipelineResult {
  status: AdStatus
  script?: AdScript
  videoPath?: string
  voicePath?: string
  finalPath?: string
  error?: string
}

export type { AdScript, AdStatus, AdStyle }

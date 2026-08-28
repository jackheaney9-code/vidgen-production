import type { AdScript, AdStatus, AdStyle } from "@/types"

export type PipelineStep =
  | "script"
  | "video"
  | "voiceover"
  | "composite"

export interface ScriptInput {
  productName: string
  productDescription: string
  targetAudience: string
  style: AdStyle
  duration: 15 | 30
}

export interface ScriptJobInput {
  productName: string
  productDescription: string
  audience: string
  style: AdStyle
  duration?: 15 | 30
}

export interface VideoJobInput {
  imageUrl: string
  prompt: string
}

export interface VoiceJobInput {
  script: string
  voiceId?: string
}

export interface CompositeJobInput {
  videoUrl: string
  audioUrl: string
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

"use client"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

import type { ProviderStatus } from "@/types"

export function DemoBanner({ providers }: { providers: ProviderStatus }) {
  if (!providers.demoMode && providers.anthropic && providers.runway && providers.elevenLabs) {
    return null
  }
  const mocks: string[] = []
  if (!providers.anthropic) mocks.push("Claude scripts")
  if (!providers.runway) mocks.push("Runway picture")
  if (!providers.elevenLabs) mocks.push("ElevenLabs voice")
  if (!providers.stripe) mocks.push("Stripe checkout")
  return (
    <Alert className="border-primary/20 bg-primary/5">
      <AlertTitle>Demo providers</AlertTitle>
      <AlertDescription>
        {mocks.length > 0
          ? `Running local stand-ins for ${mocks.join(", ")}. Add keys in .env.local to go live.`
          : "Demo mode is on. File storage is local until Supabase is configured."}
      </AlertDescription>
    </Alert>
  )
}

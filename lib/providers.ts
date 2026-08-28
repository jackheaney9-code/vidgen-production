import {
  hasAnthropic,
  hasElevenLabs,
  hasRunway,
  hasStripe,
  hasSupabase,
  isDemoMode,
} from "@/lib/env";
import type { ProviderStatus } from "@/types";

export function getProviderStatus(): ProviderStatus {
  return {
    demoMode: isDemoMode(),
    anthropic: hasAnthropic(),
    runway: hasRunway(),
    elevenLabs: hasElevenLabs(),
    stripe: hasStripe(),
    supabase: hasSupabase(),
  };
}

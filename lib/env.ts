function readEnv(name: string): string | undefined {
  const value = process.env[name];
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function getEnv(name: string): string | undefined {
  return readEnv(name);
}

export function requireEnv(name: string): string {
  const value = readEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function isDemoMode(): boolean {
  if (readEnv("DEMO_MODE") === "true") {
    return true;
  }
  if (readEnv("DEMO_MODE") === "false") {
    return false;
  }
  return !readEnv("NEXT_PUBLIC_SUPABASE_URL");
}

export function hasAnthropic(): boolean {
  return Boolean(readEnv("ANTHROPIC_API_KEY"));
}

export function hasRunway(): boolean {
  return Boolean(readEnv("RUNWAY_API_KEY"));
}

export function hasElevenLabs(): boolean {
  return Boolean(readEnv("ELEVENLABS_API_KEY"));
}

export function hasStripe(): boolean {
  return Boolean(readEnv("STRIPE_SECRET_KEY"));
}

export function hasSupabase(): boolean {
  return Boolean(
    readEnv("NEXT_PUBLIC_SUPABASE_URL") &&
      readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  );
}

export function getAppUrl(): string {
  const explicit = readEnv("NEXT_PUBLIC_APP_URL");
  if (explicit) {
    return explicit.replace(/\/$/, "");
  }
  const vercel = readEnv("VERCEL_URL");
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//, "");
    return `https://${host}`;
  }
  return "http://127.0.0.1:43127";
}

export function getSessionSecret(): string {
  return (
    readEnv("SESSION_SECRET") ??
    "lumina-demo-session-secret-change-me-32b"
  );
}

export function getElevenLabsVoiceId(): string {
  return readEnv("ELEVENLABS_VOICE_ID") ?? "21m00Tcm4TlvDq8ikWAM";
}

export function getRunwayModel(): string {
  return readEnv("RUNWAY_MODEL") ?? "gen4.5";
}

export function getAnthropicModel(): string {
  return readEnv("ANTHROPIC_MODEL") ?? "claude-sonnet-4-20250514";
}

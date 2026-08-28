"use server";

import { createAdFromForm, saveScriptForAd } from "@/lib/ads";
import { clearSessionCookie } from "@/lib/auth/session";
import { getErrorMessage, HttpError } from "@/lib/errors";
import type { Ad } from "@/types";

export async function createAdAction(
  formData: FormData,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const ad = await createAdFromForm(formData);
    return { ok: true, id: ad.id };
  } catch (error) {
    if (error instanceof HttpError) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function updateScriptAction(
  adId: string,
  script: unknown,
): Promise<{ ok: true; ad: Ad } | { ok: false; error: string }> {
  try {
    const ad = await saveScriptForAd(adId, script);
    return { ok: true, ad };
  } catch (error) {
    if (error instanceof HttpError) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  const { hasSupabase, isDemoMode } = await import("@/lib/env");
  if (!isDemoMode() && hasSupabase()) {
    const { createSupabaseServer } = await import("@/lib/supabase/server");
    const supabase = await createSupabaseServer();
    await supabase.auth.signOut();
  }
}

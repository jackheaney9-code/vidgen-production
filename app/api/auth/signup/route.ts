import { createProfile, getProfile, getProfileByEmail } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { setSessionCookie } from "@/lib/auth/session";
import { SIGNUP_BONUS_CREDITS } from "@/lib/constants";
import { authSchema } from "@/lib/db/schema";
import { HttpError } from "@/lib/errors";
import { jsonError, jsonFromUnknown, jsonOk } from "@/lib/http";
import { hasSupabase, isDemoMode } from "@/lib/env";
import { createSupabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const parsed = authSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Use a valid email and a password of at least 8 characters.", 400);
    }

    if (!isDemoMode() && hasSupabase()) {
      const supabase = await createSupabaseServer();
      const { data, error } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
      });
      if (error || !data.user) {
        return jsonError(error?.message ?? "Could not create account", 400);
      }
      const existing = await getProfile(data.user.id);
      if (!existing) {
        await createProfile({
          id: data.user.id,
          email: parsed.data.email,
          credits: SIGNUP_BONUS_CREDITS,
        });
      }
      return jsonOk({ ok: true });
    }

    const existing = await getProfileByEmail(parsed.data.email);
    if (existing) {
      throw new HttpError(409, "An account with that email already exists.");
    }

    const id = crypto.randomUUID();
    const passwordHash = await hashPassword(parsed.data.password);
    const profile = await createProfile({
      id,
      email: parsed.data.email,
      credits: SIGNUP_BONUS_CREDITS,
      passwordHash,
    });
    await setSessionCookie({ id: profile.id, email: profile.email });
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonFromUnknown(error);
  }
}

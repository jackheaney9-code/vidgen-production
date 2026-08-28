import { hasSupabase, isDemoMode } from "@/lib/env";
import { getDemoSessionUser } from "@/lib/auth/session";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getProfile } from "@/lib/db";
import { HttpError } from "@/lib/errors";
import type { AuthUser, Profile } from "@/types";

export async function getCurrentUser(): Promise<AuthUser | null> {
  if (isDemoMode() || !hasSupabase()) {
    return getDemoSessionUser();
  }
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user || !data.user.email) {
    return null;
  }
  return { id: data.user.id, email: data.user.email };
}

export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new HttpError(401, "Sign in to continue.");
  }
  return user;
}

export async function requireUserWithProfile(): Promise<{
  user: AuthUser;
  profile: Profile;
}> {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  if (!profile) {
    throw new HttpError(401, "Profile missing. Sign in again.");
  }
  return { user, profile };
}

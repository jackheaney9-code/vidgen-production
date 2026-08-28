import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getEnv, hasSupabase } from "@/lib/env";

export async function createSupabaseServer() {
  if (!hasSupabase()) {
    throw new Error("Supabase is not configured");
  }
  const url = getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!url || !key) {
    throw new Error("Supabase is not configured");
  }
  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const cookie of cookiesToSet) {
            cookieStore.set(cookie.name, cookie.value, cookie.options);
          }
        } catch {
          // Called from a Server Component; middleware will refresh the session.
        }
      },
    },
  });
}

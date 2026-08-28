import { createBrowserClient } from "@supabase/ssr";

import { getEnv, hasSupabase } from "@/lib/env";
import type { Database } from "@/types/database";

export function createSupabaseBrowser() {
  if (!hasSupabase()) {
    throw new Error("Supabase is not configured");
  }
  const url = getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!url || !key) {
    throw new Error("Supabase is not configured");
  }
  return createBrowserClient<Database>(url, key);
}

export function createClient() {
  return createSupabaseBrowser();
}

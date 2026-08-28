import { createBrowserClient as createSsrBrowserClient } from "@supabase/ssr";

import { getEnv, hasSupabase } from "@/lib/env";
import type { Database } from "@/types/database";

export function createBrowserClient() {
  if (!hasSupabase()) {
    throw new Error("Supabase is not configured");
  }
  const url = getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!url || !key) {
    throw new Error("Supabase is not configured");
  }
  return createSsrBrowserClient<Database>(url, key);
}

export const createClient = createBrowserClient;
export const createSupabaseBrowser = createBrowserClient;

import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";

import { getEnv } from "@/lib/env";
import type { Database } from "@/types/database";

export function createSupabaseAdmin() {
  const url = getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error("Supabase service role is not configured");
  }
  return createSupabaseJsClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

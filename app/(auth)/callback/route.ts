import { NextResponse } from "next/server";

import { getAppUrl, hasSupabase } from "@/lib/env";
import { createServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextPath = url.searchParams.get("next") ?? "/dashboard";
  const origin = url.origin || getAppUrl();
  const safeNext = nextPath.startsWith("/") ? nextPath : "/dashboard";

  if (!code || !hasSupabase()) {
    return NextResponse.redirect(new URL(`/login?error=auth`, origin));
  }

  try {
    const supabase = await createServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(new URL(`/login?error=auth`, origin));
    }
    return NextResponse.redirect(new URL(safeNext, origin));
  } catch {
    return NextResponse.redirect(new URL(`/login?error=auth`, origin));
  }
}

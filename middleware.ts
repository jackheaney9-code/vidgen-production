import { type NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE } from "@/lib/constants";
import { hasSupabase, isDemoMode } from "@/lib/env";
import { updateSupabaseSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApp =
    pathname.startsWith("/dashboard") || pathname.startsWith("/create");
  if (!isApp) {
    return NextResponse.next();
  }

  if (!isDemoMode() && hasSupabase()) {
    const { response, user } = await updateSupabaseSession(request);
    if (!user) {
      const login = new URL("/login", request.url);
      login.searchParams.set("next", pathname);
      return NextResponse.redirect(login);
    }
    return response;
  }

  const session = request.cookies.get(SESSION_COOKIE)?.value;
  if (!session) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/create", "/create/:path*"],
};

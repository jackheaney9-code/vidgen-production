import { getProfileByEmail } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { setSessionCookie } from "@/lib/auth/session";
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
      return jsonError("Check your email and password.", 400);
    }

    if (!isDemoMode() && hasSupabase()) {
      const supabase = await createSupabaseServer();
      const { error } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      });
      if (error) {
        return jsonError("Email or password is incorrect.", 401);
      }
      return jsonOk({ ok: true });
    }

    const record = await getProfileByEmail(parsed.data.email);
    if (!record || !record.passwordHash) {
      throw new HttpError(401, "Email or password is incorrect.");
    }
    const matches = await verifyPassword(parsed.data.password, record.passwordHash);
    if (!matches) {
      throw new HttpError(401, "Email or password is incorrect.");
    }
    await setSessionCookie({ id: record.id, email: record.email });
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonFromUnknown(error);
  }
}

import { createProfile, getProfileByEmail } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { setSessionCookie } from "@/lib/auth/session";
import { SIGNUP_BONUS_CREDITS } from "@/lib/constants";
import { jsonFromUnknown, jsonOk } from "@/lib/http";

export const runtime = "nodejs";

const DEMO_EMAIL = "studio@lumina.dev";
const DEMO_PASSWORD = "lumina-demo";

export async function POST() {
  try {
    const record = await getProfileByEmail(DEMO_EMAIL);
    if (!record) {
      const passwordHash = await hashPassword(DEMO_PASSWORD);
      const profile = await createProfile({
        id: crypto.randomUUID(),
        email: DEMO_EMAIL,
        credits: SIGNUP_BONUS_CREDITS,
        passwordHash,
      });
      await setSessionCookie({ id: profile.id, email: profile.email });
      return jsonOk({ ok: true, email: profile.email });
    }
    await setSessionCookie({ id: record.id, email: record.email });
    return jsonOk({ ok: true, email: record.email });
  } catch (error) {
    return jsonFromUnknown(error);
  }
}

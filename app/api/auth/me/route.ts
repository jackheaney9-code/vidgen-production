import { requireUserWithProfile } from "@/lib/auth/require-user";
import { jsonFromUnknown, jsonOk } from "@/lib/http";
import { getProviderStatus } from "@/lib/providers";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { user, profile } = await requireUserWithProfile();
    return jsonOk({
      user,
      profile,
      providers: getProviderStatus(),
    });
  } catch (error) {
    return jsonFromUnknown(error);
  }
}

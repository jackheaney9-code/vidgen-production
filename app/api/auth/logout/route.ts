import { logoutAction } from "@/app/actions/ads";
import { jsonFromUnknown, jsonOk } from "@/lib/http";

export const runtime = "nodejs";

export async function POST() {
  try {
    await logoutAction();
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonFromUnknown(error);
  }
}

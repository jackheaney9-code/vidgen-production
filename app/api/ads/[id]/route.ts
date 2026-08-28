import { getAdPayload } from "@/lib/ads";
import { jsonError, jsonFromUnknown, jsonOk } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    if (!id) {
      return jsonError("Missing ad id", 400);
    }
    const payload = await getAdPayload(id);
    return jsonOk(payload);
  } catch (error) {
    return jsonFromUnknown(error);
  }
}

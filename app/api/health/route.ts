import { jsonOk } from "@/lib/http";
import { getProviderStatus } from "@/lib/providers";

export const runtime = "nodejs";

export async function GET() {
  return jsonOk({
    ok: true,
    providers: getProviderStatus(),
  });
}

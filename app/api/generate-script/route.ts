import { loadOwnedAd } from "@/lib/ads";
import { requireCredits } from "@/lib/credits";
import { requireUserWithProfile } from "@/lib/auth/require-user";
import { updateAd } from "@/lib/db";
import { generateBodySchema } from "@/lib/db/schema";
import { jsonError, jsonFromUnknown, jsonOk } from "@/lib/http";
import { generateAdScript } from "@/lib/pipeline/script";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { profile } = await requireUserWithProfile();
    await requireCredits(profile);

    const body: unknown = await request.json();
    const parsed = generateBodySchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("adId is required", 400);
    }

    const ad = await loadOwnedAd(parsed.data.adId);
    await updateAd(ad.id, { status: "script_pending", error: null });

    try {
      const script = await generateAdScript({
        productName: ad.productName,
        productDescription: ad.productDescription,
        audience: ad.audience,
        style: ad.style,
      });
      const updated = await updateAd(ad.id, {
        script,
        status: "script_ready",
        error: null,
      });
      return jsonOk({ ad: updated });
    } catch (error) {
      await updateAd(ad.id, {
        status: "failed",
        error: error instanceof Error ? error.message : "Script generation failed",
      });
      throw error;
    }
  } catch (error) {
    return jsonFromUnknown(error);
  }
}

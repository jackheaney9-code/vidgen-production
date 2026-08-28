import { createAdFromForm } from "@/lib/ads";
import { listAds } from "@/lib/db";
import { requireUserWithProfile } from "@/lib/auth/require-user";
import { jsonFromUnknown, jsonOk } from "@/lib/http";
import { getSignedMediaUrl } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { user } = await requireUserWithProfile();
    const ads = await listAds(user.id);
    const withUrls = await Promise.all(
      ads.map(async (ad) => ({
        ...ad,
        productImageUrl: await getSignedMediaUrl(ad.productImagePath),
        finalUrl: ad.finalPath ? await getSignedMediaUrl(ad.finalPath) : null,
      })),
    );
    return jsonOk({ ads: withUrls });
  } catch (error) {
    return jsonFromUnknown(error);
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const ad = await createAdFromForm(formData);
    return jsonOk({ ad });
  } catch (error) {
    return jsonFromUnknown(error);
  }
}

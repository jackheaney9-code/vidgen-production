import {
  createGenerationFromBrief,
  loadOwnedAd,
} from "@/lib/ads";
import { requireUserWithProfile } from "@/lib/auth/require-user";
import { generateBodySchema, scriptInputSchema } from "@/lib/db/schema";
import { updateAd } from "@/lib/db";
import { jsonError, jsonFromUnknown, jsonOk } from "@/lib/http";
import { generateScript, scriptFromGeneratedText } from "@/lib/pipeline/script";
import type { ScriptInput } from "@/types/pipeline";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    await requireUserWithProfile();

    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      return await handleCreate(await request.formData());
    }

    const body: unknown = await request.json();
    const existing = generateBodySchema.safeParse(body);
    if (existing.success) {
      return await handleRegenerate(existing.data.adId, existing.data.duration);
    }

    return jsonError("Upload a product image to start a generation.", 400);
  } catch (error) {
    return jsonFromUnknown(error);
  }
}

async function handleCreate(form: FormData) {
  const parsed = scriptInputSchema.safeParse({
    productName: form.get("productName"),
    productDescription: form.get("productDescription"),
    targetAudience: form.get("targetAudience") ?? form.get("audience"),
    style: form.get("style"),
    duration: coerceDuration(form.get("duration")),
  });
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Check the brief.", 400);
  }

  const image = form.get("image");
  const useSample = form.get("useSample") === "true";
  const file = image instanceof File && image.size > 0 ? image : null;
  if (!file && !useSample) {
    return jsonError("Upload a product image.", 400);
  }

  const scriptInput: ScriptInput = parsed.data;
  const scriptText = await generateScript(scriptInput);
  const ad = await createGenerationFromBrief({
    ...scriptInput,
    scriptText,
    image: file,
    useSample,
  });

  return jsonOk({
    generationId: ad.id,
    script: scriptText,
  });
}

async function handleRegenerate(adId: string, duration?: 15 | 30) {
  const ad = await loadOwnedAd(adId);
  await updateAd(ad.id, { status: "generating_script", error: null });
  try {
    const scriptInput: ScriptInput = {
      productName: ad.productName,
      productDescription: ad.productDescription,
      targetAudience: ad.audience,
      style: ad.style,
      duration: duration ?? (ad.script?.durationSeconds === 30 ? 30 : 15),
    };
    const scriptText = await generateScript(scriptInput);
    const script = scriptFromGeneratedText(scriptText, scriptInput);
    const updated = await updateAd(ad.id, {
      script,
      status: "pending",
      error: null,
    });
    return jsonOk({
      generationId: updated.id,
      script: scriptText,
      ad: updated,
    });
  } catch (error) {
    await updateAd(ad.id, {
      status: "failed",
      error: error instanceof Error ? error.message : "Script generation failed",
    });
    throw error;
  }
}

function coerceDuration(value: unknown): 15 | 30 | undefined {
  const raw = typeof value === "string" || typeof value === "number" ? Number(value) : NaN;
  if (raw === 15 || raw === 30) {
    return raw;
  }
  return undefined;
}

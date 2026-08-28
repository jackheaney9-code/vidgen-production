import path from "path";

import { requireUserWithProfile } from "@/lib/auth/require-user";
import { ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from "@/lib/constants";
import { createAd, getAd, updateAd } from "@/lib/db";
import { HttpError } from "@/lib/errors";
import { adScriptSchema } from "@/lib/db/schema";
import { parseGeneratedScript } from "@/lib/pipeline/script-format";
import { getSignedMediaUrl, saveUserFile } from "@/lib/storage";
import type { Ad, AdScript, AdStyle } from "@/types";
import { AD_STYLES } from "@/types";
import type { ScriptInput } from "@/types/pipeline";

export async function createAdFromForm(formData: FormData): Promise<Ad> {
  const { user } = await requireUserWithProfile();
  const productName = readString(formData, "productName");
  const productDescription = readString(formData, "productDescription");
  const audience = readString(formData, "audience");
  const style = parseStyle(readString(formData, "style"));
  const useSample = formData.get("useSample") === "true";

  const adId = crypto.randomUUID();
  const imagePath = await storeProductImage(user.id, adId, formData, useSample);

  const now = new Date().toISOString();
  const ad: Ad = {
    id: adId,
    userId: user.id,
    productName,
    productDescription,
    audience,
    style,
    productImagePath: imagePath,
    script: null,
    videoPath: null,
    voicePath: null,
    finalPath: null,
    status: "pending",
    error: null,
    creditDeducted: false,
    createdAt: now,
    updatedAt: now,
  };
  return createAd(ad);
}

export async function createGenerationFromBrief(input: {
  productName: string;
  productDescription: string;
  targetAudience: string;
  style: AdStyle;
  duration: 15 | 30;
  scriptText: string;
  image: File | null;
  useSample: boolean;
}): Promise<Ad> {
  const { user } = await requireUserWithProfile();
  const adId = crypto.randomUUID();
  const formData = new FormData();
  if (input.image) {
    formData.set("image", input.image);
  }
  const imagePath = await storeProductImage(user.id, adId, formData, input.useSample);
  const scriptInput: ScriptInput = {
    productName: input.productName,
    productDescription: input.productDescription,
    targetAudience: input.targetAudience,
    style: input.style,
    duration: input.duration,
  };
  const script = parseGeneratedScript(input.scriptText, scriptInput);
  const now = new Date().toISOString();
  const ad: Ad = {
    id: adId,
    userId: user.id,
    productName: input.productName,
    productDescription: input.productDescription,
    audience: input.targetAudience,
    style: input.style,
    productImagePath: imagePath,
    script,
    videoPath: null,
    voicePath: null,
    finalPath: null,
    status: "pending",
    error: null,
    creditDeducted: false,
    createdAt: now,
    updatedAt: now,
  };
  return createAd(ad);
}

export async function saveScriptForAd(
  adId: string,
  scriptInput: unknown,
): Promise<Ad> {
  const { user } = await requireUserWithProfile();
  const ad = await getAd(adId);
  if (!ad || ad.userId !== user.id) {
    throw new HttpError(404, "Ad not found");
  }
  const parsedObject = adScriptSchema.safeParse(scriptInput);
  if (parsedObject.success) {
    return updateAd(adId, {
      script: parsedObject.data,
      status: "pending",
      error: null,
    });
  }
  if (typeof scriptInput === "string" && scriptInput.trim().length > 0) {
    const duration = ad.script?.durationSeconds === 30 ? 30 : 15;
    const parsedText: AdScript = parseGeneratedScript(scriptInput, {
      productName: ad.productName,
      style: ad.style,
      duration,
    });
    return updateAd(adId, {
      script: parsedText,
      status: "pending",
      error: null,
    });
  }
  throw new HttpError(400, "Script is missing required fields.");
}

export async function loadOwnedAd(adId: string): Promise<Ad> {
  const { user } = await requireUserWithProfile();
  const ad = await getAd(adId);
  if (!ad || ad.userId !== user.id) {
    throw new HttpError(404, "Ad not found");
  }
  return ad;
}

export async function getAdPayload(adId: string) {
  const ad = await loadOwnedAd(adId);
  return {
    ad,
    productImageUrl: await getSignedMediaUrl(ad.productImagePath),
    videoUrl: ad.videoPath ? await getSignedMediaUrl(ad.videoPath) : null,
    voiceUrl: ad.voicePath ? await getSignedMediaUrl(ad.voicePath) : null,
    finalUrl: ad.finalPath ? await getSignedMediaUrl(ad.finalPath) : null,
  };
}

async function storeProductImage(
  userId: string,
  adId: string,
  formData: FormData,
  useSample: boolean,
): Promise<string> {
  if (useSample) {
    const { readFile } = await import("fs/promises");
    const sampleSrc = path.join(process.cwd(), "public", "samples", "serum.png");
    const bytes = await readFile(sampleSrc);
    return saveUserFile(userId, `${adId}/product.png`, bytes);
  }

  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) {
    throw new HttpError(400, "Upload a product image.");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new HttpError(400, "Image must be 8MB or smaller.");
  }
  if (!isAllowedImage(file.type)) {
    throw new HttpError(400, "Use a JPG, PNG, or WebP image.");
  }
  const ext = extensionForType(file.type);
  const bytes = Buffer.from(await file.arrayBuffer());
  return saveUserFile(userId, `${adId}/product.${ext}`, bytes);
}

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim().length < 2) {
    throw new HttpError(400, `Missing ${key}`);
  }
  return value.trim();
}

function isAdStyle(value: string): value is AdStyle {
  return AD_STYLES.some((style) => style === value);
}

function parseStyle(value: string): AdStyle {
  if (isAdStyle(value)) {
    return value;
  }
  throw new HttpError(400, "Choose a valid style.");
}

function isAllowedImage(type: string): boolean {
  return ALLOWED_IMAGE_TYPES.some((item) => item === type);
}

function extensionForType(type: string): string {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

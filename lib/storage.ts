import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "node:url";

import { SIGNED_URL_TTL_SECONDS } from "@/lib/constants";
import { HttpError } from "@/lib/errors";
import { hasSupabase, isDemoMode } from "@/lib/env";
import { requirePipelineContext } from "@/lib/pipeline/context";
import { createSupabaseServer } from "@/lib/supabase/server";

const STORAGE_ROOT = path.join(process.cwd(), "data", "storage");
const BUCKET = "ads";

export function localStorageRoot(): string {
  return STORAGE_ROOT;
}

export function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

export async function saveUserFile(
  userId: string,
  relativePath: string,
  bytes: Buffer,
): Promise<string> {
  const objectPath = `${userId}/${relativePath}`.replaceAll("\\", "/");

  if (!isDemoMode() && hasSupabase()) {
    const supabase = await createSupabaseServer();
    const { error } = await supabase.storage.from(BUCKET).upload(objectPath, bytes, {
      upsert: true,
      contentType: contentTypeFromPath(relativePath),
    });
    if (error) {
      throw new Error(error.message);
    }
    return objectPath;
  }

  const dest = path.join(STORAGE_ROOT, objectPath);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, bytes);
  return objectPath;
}

export async function savePipelineFile(
  relativePath: string,
  bytes: Buffer,
): Promise<{ objectPath: string; url: string }> {
  const { userId, generationId } = requirePipelineContext();
  const objectPath = await saveUserFile(
    userId,
    `${generationId}/${relativePath}`,
    bytes,
  );
  const url = await getSignedMediaUrl(objectPath, SIGNED_URL_TTL_SECONDS);
  return { objectPath, url };
}

export async function getSignedMediaUrl(
  objectPath: string,
  expiresIn = 60 * 60,
): Promise<string> {
  if (isHttpUrl(objectPath) || objectPath.startsWith("/api/media/")) {
    return objectPath;
  }
  if (isDemoMode() || !hasSupabase()) {
    return `/api/media/${objectPath}`;
  }

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(objectPath, expiresIn);
  if (error || !data) {
    throw new Error(error?.message ?? "Could not sign media URL");
  }
  return data.signedUrl;
}

export async function getPublicMediaUrl(objectPath: string): Promise<string> {
  if (isHttpUrl(objectPath) || objectPath.startsWith("/api/media/")) {
    return objectPath;
  }
  if (isDemoMode() || !hasSupabase()) {
    return `/api/media/${objectPath}`;
  }
  // The ads bucket is private; a "public" URL is a long-lived signed link.
  return getSignedMediaUrl(objectPath, SIGNED_URL_TTL_SECONDS);
}

export function resolveLocalPath(objectPath: string): string {
  const normalized = objectPath.replaceAll("\\", "/");
  if (normalized.includes("..")) {
    throw new HttpError(400, "Invalid media path");
  }
  if (normalized.startsWith("/api/media/")) {
    return path.join(STORAGE_ROOT, normalized.slice("/api/media/".length));
  }
  return path.join(STORAGE_ROOT, objectPath);
}

export async function readMediaBytes(source: string): Promise<Buffer> {
  if (source.startsWith("data:")) {
    const comma = source.indexOf(",");
    if (comma < 0) {
      throw new Error("Invalid data URI");
    }
    return Buffer.from(source.slice(comma + 1), "base64");
  }
  if (source.startsWith("file://")) {
    return readFile(fileURLToPath(source));
  }
  if (isHttpUrl(source)) {
    const res = await fetch(source);
    if (!res.ok) {
      throw new Error(`Could not download media (${res.status})`);
    }
    return Buffer.from(await res.arrayBuffer());
  }
  if (source.startsWith("/api/media/")) {
    return readFile(resolveLocalPath(source));
  }
  if (path.isAbsolute(source)) {
    return readFile(source);
  }
  return readFile(resolveLocalPath(source));
}

export function mimeFromPath(filePath: string): string {
  return contentTypeFromPath(filePath);
}

function contentTypeFromPath(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".m4a")) return "audio/mp4";
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".wav")) return "audio/wav";
  return "image/jpeg";
}

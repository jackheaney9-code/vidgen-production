import { mkdir, writeFile } from "fs/promises";
import path from "path";

import { HttpError } from "@/lib/errors";
import { hasSupabase, isDemoMode } from "@/lib/env";
import { createSupabaseServer } from "@/lib/supabase/server";

const STORAGE_ROOT = path.join(process.cwd(), "data", "storage");
const BUCKET = "ads";

export function localStorageRoot(): string {
  return STORAGE_ROOT;
}

export async function saveUserFile(
  userId: string,
  relativePath: string,
  bytes: Buffer,
): Promise<string> {
  const objectPath = `${userId}/${relativePath}`.replaceAll("\\", "/");
  const dest = path.join(STORAGE_ROOT, objectPath);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, bytes);

  if (!isDemoMode() && hasSupabase()) {
    const supabase = await createSupabaseServer();
    const { error } = await supabase.storage.from(BUCKET).upload(objectPath, bytes, {
      upsert: true,
      contentType: contentTypeFromPath(relativePath),
    });
    if (error) {
      throw new Error(error.message);
    }
  }

  return objectPath;
}

export async function getSignedMediaUrl(
  objectPath: string,
  expiresIn = 60 * 60,
): Promise<string> {
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

export function resolveLocalPath(objectPath: string): string {
  const normalized = objectPath.replaceAll("\\", "/");
  if (normalized.includes("..")) {
    throw new HttpError(400, "Invalid media path");
  }
  return path.join(STORAGE_ROOT, objectPath);
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

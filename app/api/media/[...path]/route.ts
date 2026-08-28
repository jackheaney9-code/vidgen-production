import { readFile, stat } from "fs/promises";

import { requireUser } from "@/lib/auth/require-user";
import { jsonError, jsonFromUnknown } from "@/lib/http";
import { resolveLocalPath } from "@/lib/storage";

export const runtime = "nodejs";

function contentTypeFromPath(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".m4a")) return "audio/mp4";
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    const user = await requireUser();
    const { path: segments } = await context.params;
    if (!segments || segments.length === 0) {
      return jsonError("Missing media path", 400);
    }
    const objectPath = segments.join("/");
    if (!objectPath.startsWith(`${user.id}/`)) {
      return jsonError("Forbidden", 403);
    }
    const filePath = resolveLocalPath(objectPath);
    const info = await stat(filePath);
    if (!info.isFile()) {
      return jsonError("Not found", 404);
    }
    const bytes = await readFile(filePath);
    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": contentTypeFromPath(filePath),
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (error) {
    return jsonFromUnknown(error);
  }
}

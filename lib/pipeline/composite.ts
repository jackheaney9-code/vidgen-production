import { mkdir, writeFile } from "fs/promises";
import os from "node:os";
import path from "path";

import { SIGNED_URL_TTL_SECONDS } from "@/lib/constants";
import { runCommand } from "@/lib/ffmpeg";
import {
  getSignedMediaUrl,
  readMediaBytes,
  savePipelineFile,
} from "@/lib/storage";

export async function compositeVideo(
  videoUrl: string,
  audioUrl: string,
): Promise<string> {
  const tmpDir = path.join(os.tmpdir(), "lumina-composite");
  await mkdir(tmpDir, { recursive: true });
  const stamp = Date.now();
  const videoPath = path.join(tmpDir, `video-${stamp}.mp4`);
  const audioPath = path.join(tmpDir, `audio-${stamp}.mp3`);
  const outputPath = path.join(tmpDir, `final-${stamp}.mp4`);

  await writeFile(videoPath, await readMediaBytes(videoUrl));
  await writeFile(audioPath, await readMediaBytes(audioUrl));

  try {
    await runCommand(
      "ffmpeg",
      [
        "-y",
        "-i",
        videoPath,
        "-i",
        audioPath,
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-shortest",
        outputPath,
      ],
      120_000,
    );
  } catch {
    await runCommand(
      "ffmpeg",
      [
        "-y",
        "-stream_loop",
        "-1",
        "-i",
        videoPath,
        "-i",
        audioPath,
        "-map",
        "0:v:0",
        "-map",
        "1:a:0",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "20",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-shortest",
        "-movflags",
        "+faststart",
        "-pix_fmt",
        "yuv420p",
        outputPath,
      ],
      120_000,
    );
  }

  const bytes = await readMediaBytes(outputPath);
  const stored = await savePipelineFile("final.mp4", bytes);
  return getSignedMediaUrl(stored.objectPath, SIGNED_URL_TTL_SECONDS);
}

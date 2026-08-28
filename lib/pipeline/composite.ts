import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, writeFile } from "fs/promises";
import os from "node:os";
import path from "path";

import { SIGNED_URL_TTL_SECONDS } from "@/lib/constants";
import { getFfprobePath, runCommand } from "@/lib/ffmpeg";
import {
  getSignedMediaUrl,
  readMediaBytes,
  savePipelineFile,
} from "@/lib/storage";

const execFileAsync = promisify(execFile);

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

  const videoSeconds = await probeDuration(videoPath);
  const audioSeconds = await probeDuration(audioPath);
  const audioLonger = audioSeconds > videoSeconds + 0.2;

  if (audioLonger) {
    await loopVideoToAudio(videoPath, audioPath, outputPath);
  } else {
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
      await loopVideoToAudio(videoPath, audioPath, outputPath);
    }
  }

  const bytes = await readMediaBytes(outputPath);
  const stored = await savePipelineFile("final.mp4", bytes);
  return getSignedMediaUrl(stored.objectPath, SIGNED_URL_TTL_SECONDS);
}

async function loopVideoToAudio(
  videoPath: string,
  audioPath: string,
  outputPath: string,
): Promise<void> {
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

async function probeDuration(filePath: string): Promise<number> {
  try {
    const { stdout } = await execFileAsync(getFfprobePath(), [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "csv=p=0",
      filePath,
    ]);
    const value = Number(stdout.trim());
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

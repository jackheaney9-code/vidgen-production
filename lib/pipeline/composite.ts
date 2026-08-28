import { mkdir } from "fs/promises";
import path from "path";

import { runCommand } from "@/lib/ffmpeg";

export async function compositeVideo(input: {
  videoPath: string;
  voicePath: string;
  outputPath: string;
}): Promise<void> {
  await mkdir(path.dirname(input.outputPath), { recursive: true });
  await runCommand("ffmpeg", [
    "-y",
    "-stream_loop",
    "-1",
    "-i",
    input.videoPath,
    "-i",
    input.voicePath,
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
    input.outputPath,
  ]);
}

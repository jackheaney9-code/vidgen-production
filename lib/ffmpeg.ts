import { spawn } from "child_process";
import { existsSync } from "fs";

const DEFAULT_FONTS = [
  "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
  "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
];

export function getDrawtextFont(): string | null {
  for (const font of DEFAULT_FONTS) {
    if (existsSync(font)) {
      return font;
    }
  }
  return null;
}

export function escapeDrawtext(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/:/g, "\\:")
    .replace(/%/g, "\\%")
    .replace(/\n/g, " ");
}

export function getFfmpegPath(): string {
  if (existsSync("/usr/bin/ffmpeg")) {
    return "/usr/bin/ffmpeg";
  }
  try {
    // Bundled binary for Vercel.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const resolved = require("ffmpeg-static") as string | null;
    if (typeof resolved === "string" && existsSync(resolved)) {
      return resolved;
    }
  } catch {
    // Fall through to PATH.
  }
  return "ffmpeg";
}

export function ffmpegSupportsDrawtext(): boolean {
  return !getFfmpegPath().includes("ffmpeg-static");
}

export function getFfprobePath(): string {
  if (existsSync("/usr/bin/ffprobe")) {
    return "/usr/bin/ffprobe";
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("ffprobe-static") as { path?: string };
    if (typeof mod.path === "string" && existsSync(mod.path)) {
      return mod.path;
    }
  } catch {
    // Fall through to PATH.
  }
  return "ffprobe";
}

export function runCommand(
  command: string,
  args: string[],
  timeoutMs = 90_000,
): Promise<void> {
  const bin =
    command === "ffmpeg"
      ? getFfmpegPath()
      : command === "ffprobe"
        ? getFfprobePath()
        : command;
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`${command} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve();
        return;
      }
      const detail = stderr.trim().slice(-2000);
      reject(new Error(detail || `${command} exited with code ${code}`));
    });
  });
}

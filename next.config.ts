import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@anthropic-ai/sdk",
    "jose",
    "ffmpeg-static",
    "ffprobe-static",
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
}

export default nextConfig

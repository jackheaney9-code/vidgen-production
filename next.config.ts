import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  serverExternalPackages: ["@anthropic-ai/sdk", "jose"],
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
}

export default nextConfig

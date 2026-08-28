import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { STYLE_META } from "@/lib/constants"
import type { Ad } from "@/types"

const STATUS_LABEL: Record<Ad["status"], string> = {
  draft: "Draft",
  script_pending: "Writing",
  script_ready: "Script ready",
  video_pending: "Filming",
  video_ready: "Picture ready",
  voice_pending: "Voice",
  voice_ready: "Voice ready",
  compositing: "Composite",
  complete: "Ready",
  failed: "Failed",
}

export function AdCard({
  ad,
  imageUrl,
}: {
  ad: Ad
  imageUrl: string
}) {
  return (
    <Link
      href={`/dashboard/ads/${ad.id}`}
      className="group overflow-hidden rounded-xl border border-white/8 bg-card transition-colors hover:border-primary/40"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={ad.productName}
          className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <Badge className="absolute top-3 left-3">{STATUS_LABEL[ad.status]}</Badge>
      </div>
      <div className="p-4">
        <p className="font-heading text-lg">{ad.productName}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {STYLE_META[ad.style].label} · {ad.audience}
        </p>
      </div>
    </Link>
  )
}

import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  formatCreatedAt,
  isGeneratingStatus,
  statusBadgeLabel,
  statusBadgeVariant,
} from "@/lib/generation-status"
import type { GenerationListItem } from "@/types/generation"

export function GenerationCard({ item }: { item: GenerationListItem }) {
  const label = statusBadgeLabel(item.status)
  const generating = isGeneratingStatus(item.status)

  return (
    <Link href={`/generations/${item.id}`} className="block h-full">
      <Card className="h-full py-0 transition-colors hover:ring-primary/40">
        <div className="relative aspect-[4/5] bg-muted">
          {item.finalUrl ? (
            <video
              className="size-full object-cover"
              src={item.finalUrl}
              poster={item.productImageUrl}
              muted
              playsInline
              preload="metadata"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.productImageUrl}
              alt={item.productName}
              className="size-full object-cover"
            />
          )}
          <Badge
            variant={statusBadgeVariant(item.status)}
            className="absolute top-3 left-3"
          >
            {label}
          </Badge>
          {generating && (
            <div className="absolute inset-x-0 bottom-0 h-1 overflow-hidden bg-black/40">
              <div className="h-full w-1/2 animate-pulse bg-primary" />
            </div>
          )}
        </div>
        <CardHeader className="gap-1 pb-4">
          <CardTitle className="font-heading text-lg">{item.productName}</CardTitle>
          <CardDescription>{formatCreatedAt(item.createdAt)}</CardDescription>
        </CardHeader>
      </Card>
    </Link>
  )
}

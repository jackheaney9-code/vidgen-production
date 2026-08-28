import { GenerationCard } from "@/components/features/generation-card"
import type { Ad } from "@/types"

export function AdCard({
  ad,
  imageUrl,
}: {
  ad: Ad
  imageUrl: string
}) {
  return (
    <GenerationCard
      item={{
        ...ad,
        productImageUrl: imageUrl,
        finalUrl: null,
      }}
    />
  )
}

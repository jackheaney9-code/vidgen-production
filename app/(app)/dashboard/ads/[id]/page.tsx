import { notFound } from "next/navigation"

import { AdStudio } from "@/components/features/ad-studio"
import { getAdPayload } from "@/lib/ads"

export default async function AdDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ produce?: string }>
}) {
  const { id } = await params
  const { produce } = await searchParams
  try {
    const payload = await getAdPayload(id)
    return (
      <div className="space-y-8">
        <div>
          <p className="text-xs tracking-[0.2em] text-primary uppercase">Studio</p>
          <h1 className="mt-2 font-heading text-4xl">{payload.ad.productName}</h1>
        </div>
        <AdStudio initial={payload} autoProduce={produce === "1"} />
      </div>
    )
  } catch {
    notFound()
  }
}

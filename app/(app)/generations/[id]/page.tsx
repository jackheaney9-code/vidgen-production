import { notFound } from "next/navigation"

import { GenerationResult } from "@/components/features/generation-result"
import { getAdPayload } from "@/lib/ads"

export const dynamic = "force-dynamic"

export default async function GenerationPage({
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
      <GenerationResult initial={payload} autoProduce={produce === "1"} />
    )
  } catch {
    notFound()
  }
}

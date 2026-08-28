import { redirect } from "next/navigation"

export default async function LegacyAdDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ produce?: string }>
}) {
  const { id } = await params
  const { produce } = await searchParams
  const query = produce ? `?produce=${encodeURIComponent(produce)}` : ""
  redirect(`/generations/${id}${query}`)
}

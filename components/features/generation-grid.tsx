"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { PlusIcon } from "lucide-react"

import { GenerationCard } from "@/components/features/generation-card"
import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { isGeneratingStatus, POLL_INTERVAL_MS } from "@/lib/generation-status"
import { cn } from "@/lib/utils"
import type { GenerationListItem } from "@/types/generation"

export function GenerationGrid({
  initial,
}: {
  initial: GenerationListItem[]
}) {
  const [items, setItems] = useState(initial)

  useEffect(() => {
    setItems(initial)
  }, [initial])

  const inProgress = items.some((item) => isGeneratingStatus(item.status))

  useEffect(() => {
    if (!inProgress) {
      return
    }
    let cancelled = false

    async function refresh() {
      const res = await fetch("/api/ads")
      const data: unknown = await res.json()
      if (!cancelled && isListPayload(data)) {
        setItems(data.ads)
      }
    }

    const timer = window.setInterval(() => {
      void refresh()
    }, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [inProgress])

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/15 px-6 py-16 text-center">
        <p className="font-heading text-2xl">No videos yet. Create your first ad!</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Write a script for free, then spend 1 credit on picture, voice, and composite.
        </p>
        <Link href="/create" className={cn(buttonVariants(), "mt-6")}>
          <PlusIcon />
          Create New Ad
        </Link>
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <GenerationCard key={item.id} item={item} />
      ))}
    </div>
  )
}

export function GenerationGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Skeleton className="aspect-[4/5] rounded-xl" />
      <Skeleton className="aspect-[4/5] rounded-xl" />
      <Skeleton className="aspect-[4/5] rounded-xl" />
    </div>
  )
}

function isListPayload(value: unknown): value is { ads: GenerationListItem[] } {
  return (
    typeof value === "object" &&
    value !== null &&
    "ads" in value &&
    Array.isArray((value as { ads: unknown }).ads)
  )
}

"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"
import { hasSupabase } from "@/lib/env"
import { cn } from "@/lib/utils"

export function CreditBalance({
  initialCredits,
  className,
}: {
  initialCredits: number
  className?: string
}) {
  const [credits, setCredits] = useState(initialCredits)

  useEffect(() => {
    let cancelled = false

    async function loadFromApi() {
      const res = await fetch("/api/credits")
      if (!res.ok) {
        return
      }
      const data: unknown = await res.json()
      if (
        !cancelled &&
        typeof data === "object" &&
        data !== null &&
        "credits" in data &&
        typeof data.credits === "number"
      ) {
        setCredits(data.credits)
      }
    }

    async function load() {
      if (!hasSupabase()) {
        await loadFromApi()
        return
      }
      try {
        const { createBrowserClient } = await import("@/lib/supabase/client")
        const supabase = createBrowserClient()
        const { data: auth } = await supabase.auth.getUser()
        const userId = auth.user?.id
        if (!userId) {
          await loadFromApi()
          return
        }
        const { data, error } = await supabase
          .from("profiles")
          .select("credits")
          .eq("id", userId)
          .maybeSingle()
        if (cancelled) {
          return
        }
        if (!error && data && typeof data.credits === "number") {
          setCredits(data.credits)
        }
      } catch {
        await loadFromApi()
      }
    }

    void load()
    const onFocus = () => {
      void load()
    }
    window.addEventListener("focus", onFocus)

    let unsubscribe: (() => void) | undefined
    if (hasSupabase()) {
      void (async () => {
        try {
          const { createBrowserClient } = await import("@/lib/supabase/client")
          const supabase = createBrowserClient()
          const { data: auth } = await supabase.auth.getUser()
          const userId = auth.user?.id
          if (!userId || cancelled) {
            return
          }
          const channel = supabase
            .channel(`credits:${userId}`)
            .on(
              "postgres_changes",
              {
                event: "UPDATE",
                schema: "public",
                table: "profiles",
                filter: `id=eq.${userId}`,
              },
              (payload) => {
                const next = payload.new
                if (
                  next &&
                  typeof next === "object" &&
                  "credits" in next &&
                  typeof next.credits === "number"
                ) {
                  setCredits(next.credits)
                }
              },
            )
            .subscribe()
          unsubscribe = () => {
            void supabase.removeChannel(channel)
          }
        } catch {
          // Demo studio has no realtime channel.
        }
      })()
    }

    return () => {
      cancelled = true
      window.removeEventListener("focus", onFocus)
      unsubscribe?.()
    }
  }, [])

  return (
    <Link
      href="/dashboard/billing"
      className={cn(
        buttonVariants({ variant: "outline" }),
        "hidden sm:inline-flex",
        className,
      )}
    >
      {credits} {credits === 1 ? "credit" : "credits"}
    </Link>
  )
}

"use client"

import { useState } from "react"
import { Loader2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { CREDIT_PACKS_CATALOG, formatUsd } from "@/lib/constants"
import { cn } from "@/lib/utils"
import type { CreditPackId } from "@/types"
import { toast } from "sonner"

export function PricingTable({
  signedIn,
  compact = false,
}: {
  signedIn: boolean
  compact?: boolean
}) {
  const [pending, setPending] = useState<CreditPackId | null>(null)

  async function buy(pack: CreditPackId) {
    if (!signedIn) {
      window.location.href = "/signup"
      return
    }
    setPending(pack)
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pack }),
      })
      const data: unknown = await res.json()
      if (!res.ok) {
        const message =
          typeof data === "object" &&
          data !== null &&
          "error" in data &&
          typeof data.error === "string"
            ? data.error
            : "Checkout failed"
        throw new Error(message)
      }
      if (
        typeof data === "object" &&
        data !== null &&
        "demo" in data &&
        data.demo === true
      ) {
        toast.success("Credits added to your demo studio.")
        window.location.href = "/dashboard/billing?status=success"
        return
      }
      if (
        typeof data === "object" &&
        data !== null &&
        "url" in data &&
        typeof data.url === "string"
      ) {
        window.location.href = data.url
        return
      }
      throw new Error("Checkout did not return a URL")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Checkout failed")
    } finally {
      setPending(null)
    }
  }

  return (
    <section id="pricing" className={cn("py-20", !compact && "border-t border-white/5")}>
      <div className="mx-auto max-w-6xl px-4">
        {!compact && (
          <>
            <p className="text-xs tracking-[0.2em] text-primary uppercase">Credits</p>
            <h2 className="mt-3 font-heading text-4xl tracking-tight">
              Pay for the ads you actually make.
            </h2>
          </>
        )}
        <div className={cn("grid gap-4 md:grid-cols-3", compact ? "" : "mt-10")}>
          {CREDIT_PACKS_CATALOG.map((pack) => (
            <div
              key={pack.id}
              className={cn(
                "flex flex-col rounded-xl border bg-card p-6",
                pack.popular ? "border-primary/50" : "border-white/8",
              )}
            >
              {pack.popular && (
                <p className="mb-3 text-xs tracking-wide text-primary">Most used</p>
              )}
              <h3 className="font-heading text-2xl">{pack.name}</h3>
              <p className="mt-1 text-3xl font-medium">{formatUsd(pack.priceCents)}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {pack.credits} credits
              </p>
              <p className="mt-4 flex-1 text-sm text-muted-foreground">{pack.blurb}</p>
              <Button
                className="mt-6"
                variant={pack.popular ? "default" : "outline"}
                onClick={() => buy(pack.id)}
                disabled={pending !== null}
              >
                {pending === pack.id ? (
                  <Loader2Icon className="animate-spin" />
                ) : (
                  "Buy credits"
                )}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

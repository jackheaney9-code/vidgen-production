"use client"

import { useState } from "react"
import { Loader2Icon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CREDIT_PACKS_CATALOG, formatUsd } from "@/lib/constants"
import { cn } from "@/lib/utils"
import type { CreditPackId } from "@/types"
import { toast } from "sonner"

export function PricingCards({
  signedIn,
  compact = false,
}: {
  signedIn: boolean
  compact?: boolean
}) {
  const [pending, setPending] = useState<CreditPackId | null>(null)

  async function buy(packId: CreditPackId) {
    if (!signedIn) {
      window.location.href = "/login"
      return
    }
    const pack = CREDIT_PACKS_CATALOG.find((item) => item.id === packId)
    if (!pack) {
      toast.error("Unknown credit pack")
      return
    }
    setPending(packId)
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId: pack.lookupKey }),
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
        toast.success("Credits added to your studio.")
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
    <div className={cn("grid gap-4 md:grid-cols-3", compact ? "" : "mt-10")}>
      {CREDIT_PACKS_CATALOG.map((pack) => (
        <Card
          key={pack.id}
          className={cn(
            "bg-card py-0",
            pack.popular ? "ring-2 ring-primary/60" : "ring-white/8",
          )}
        >
          <CardHeader className="pt-6">
            {pack.popular && (
              <Badge className="w-fit">Most popular</Badge>
            )}
            <CardTitle className="font-heading text-2xl">
              {pack.credits} {pack.credits === 1 ? "video" : "videos"}
            </CardTitle>
            <p className="text-3xl font-medium">{formatUsd(pack.priceCents)}</p>
            <CardDescription>
              {pack.credits} {pack.credits === 1 ? "credit" : "credits"} · pay once
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{pack.blurb}</p>
          </CardContent>
          <CardFooter className="border-0 bg-transparent">
            <Button
              className="w-full"
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
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}

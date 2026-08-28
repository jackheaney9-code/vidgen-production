"use client"

import { PricingCards } from "@/components/features/pricing-cards"
import { cn } from "@/lib/utils"

export function PricingTable({
  signedIn,
  compact = false,
}: {
  signedIn: boolean
  compact?: boolean
}) {
  return (
    <section id="pricing" className={cn("py-20", !compact && "border-t border-white/5")}>
      <div className="mx-auto max-w-6xl px-4">
        {!compact && (
          <>
            <p className="text-xs tracking-[0.2em] text-primary uppercase">Credits</p>
            <h2 className="mt-3 font-heading text-4xl tracking-tight">
              Pay for the ads you actually make.
            </h2>
            <p className="mt-4 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm">
              3 free videos on signup. Packs are one-time, not a subscription.
            </p>
          </>
        )}
        <PricingCards signedIn={signedIn} compact={compact} />
      </div>
    </section>
  )
}

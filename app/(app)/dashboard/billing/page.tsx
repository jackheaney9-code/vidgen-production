import { CreditBalance } from "@/components/features/credit-balance"
import { PricingCards } from "@/components/features/pricing-cards"
import { requireUserWithProfile } from "@/lib/auth/require-user"
import { listPurchases } from "@/lib/db"
import { formatUsd } from "@/lib/constants"

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { user, profile } = await requireUserWithProfile()
  const { status } = await searchParams
  const purchases = await listPurchases(user.id)

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-heading text-4xl">Credits</h1>
        <p className="mt-2 text-muted-foreground">
          Each finished video uses one credit. Packs are one-time, not a subscription.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <CreditBalance initialCredits={profile.credits} className="inline-flex" />
        </div>
        {status === "success" && (
          <p className="mt-3 text-sm text-primary">Credits added. Go make the next ad.</p>
        )}
        {status === "cancelled" && (
          <p className="mt-3 text-sm text-muted-foreground">Checkout cancelled. Nothing charged.</p>
        )}
      </div>
      <PricingCards signedIn compact />
      <div>
        <h2 className="font-heading text-2xl">Ledger</h2>
        {purchases.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No purchases yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-white/8 rounded-xl border border-white/8">
            {purchases.map((item) => (
              <li key={item.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span>
                  {item.creditsPurchased} credits · {formatUsd(item.amountPaid)}
                </span>
                <span className="text-primary">+{item.creditsPurchased}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
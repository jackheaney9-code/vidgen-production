import { PricingTable } from "@/components/features/pricing-table"
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
          You have {profile.credits} {profile.credits === 1 ? "credit" : "credits"}. Each
          finished video uses one.
        </p>
        {status === "success" && (
          <p className="mt-3 text-sm text-primary">Credits added. Go make the next ad.</p>
        )}
        {status === "cancelled" && (
          <p className="mt-3 text-sm text-muted-foreground">Checkout cancelled. Nothing charged.</p>
        )}
      </div>
      <PricingTable signedIn compact />
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

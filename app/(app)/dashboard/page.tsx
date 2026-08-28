import Link from "next/link"
import { PlusIcon } from "lucide-react"

import { CreditBalance } from "@/components/features/credit-balance"
import { DemoBanner } from "@/components/features/demo-banner"
import { GenerationGrid } from "@/components/features/generation-grid"
import { buttonVariants } from "@/components/ui/button"
import { requireUserWithProfile } from "@/lib/auth/require-user"
import { listAds } from "@/lib/db"
import { getProviderStatus } from "@/lib/providers"
import { getSignedMediaUrl } from "@/lib/storage"
import { cn } from "@/lib/utils"

export default async function DashboardPage() {
  const { user, profile } = await requireUserWithProfile()
  const ads = await listAds(user.id)
  const items = await Promise.all(
    ads.map(async (ad) => ({
      ...ad,
      productImageUrl: await getSignedMediaUrl(ad.productImagePath),
      finalUrl: ad.finalPath ? await getSignedMediaUrl(ad.finalPath) : null,
    })),
  )

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-4xl">Your videos</h1>
          <p className="mt-2 text-muted-foreground">
            {profile.credits} {profile.credits === 1 ? "credit" : "credits"} left · 1
            credit per finished video.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CreditBalance initialCredits={profile.credits} className="inline-flex" />
          <Link
            href="/dashboard/billing"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Buy Credits
          </Link>
          <Link href="/create" className={cn(buttonVariants())}>
            <PlusIcon />
            Create New Ad
          </Link>
        </div>
      </div>
      <DemoBanner providers={getProviderStatus()} />
      <GenerationGrid initial={items} />
    </div>
  )
}

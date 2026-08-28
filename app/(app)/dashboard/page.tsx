import Link from "next/link"

import { AdCard } from "@/components/features/ad-card"
import { DemoBanner } from "@/components/features/demo-banner"
import { buttonVariants } from "@/components/ui/button"
import { requireUserWithProfile } from "@/lib/auth/require-user"
import { listAds } from "@/lib/db"
import { getProviderStatus } from "@/lib/providers"
import { getSignedMediaUrl } from "@/lib/storage"
import { cn } from "@/lib/utils"

export default async function DashboardPage() {
  const { user, profile } = await requireUserWithProfile()
  const ads = await listAds(user.id)
  const withImages = await Promise.all(
    ads.map(async (ad) => ({
      ad,
      imageUrl: await getSignedMediaUrl(ad.productImagePath),
    })),
  )

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-4xl">Ads</h1>
          <p className="mt-2 text-muted-foreground">
            {profile.credits} {profile.credits === 1 ? "credit" : "credits"} left · 1 credit
            per finished video.
          </p>
        </div>
        <Link href="/create" className={cn(buttonVariants())}>
          New ad
        </Link>
      </div>
      <DemoBanner providers={getProviderStatus()} />
      {withImages.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 px-6 py-16 text-center">
          <p className="font-heading text-2xl">No ads yet</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Start with a product still. The script comes back before you spend a credit.
          </p>
          <Link href="/create" className={cn(buttonVariants(), "mt-6")}>
            Brief the first one
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {withImages.map((item) => (
            <AdCard key={item.ad.id} ad={item.ad} imageUrl={item.imageUrl} />
          ))}
        </div>
      )}
    </div>
  )
}

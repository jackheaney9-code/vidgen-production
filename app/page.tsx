import { LandingContent } from "@/components/features/landing-content"
import { PricingTable } from "@/components/features/pricing-table"
import { SiteFooter } from "@/components/features/site-footer"
import { SiteHeader } from "@/components/features/site-header"
import { getCurrentUser } from "@/lib/auth/require-user"

export const dynamic = "force-dynamic"

export default async function HomePage() {
  const user = await getCurrentUser()
  return (
    <div className="min-h-screen">
      <SiteHeader signedIn={Boolean(user)} />
      <main>
        <LandingContent />
        <PricingTable signedIn={Boolean(user)} />
      </main>
      <SiteFooter />
    </div>
  )
}

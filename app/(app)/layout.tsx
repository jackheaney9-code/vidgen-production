import { redirect } from "next/navigation"

import { DashboardHeader } from "@/components/features/dashboard-header"
import { getCurrentUser } from "@/lib/auth/require-user"
import { createProfile, getProfile } from "@/lib/db"
import { SIGNUP_BONUS_CREDITS } from "@/lib/constants"

export const dynamic = "force-dynamic"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()
  if (!user) {
    redirect("/login")
  }
  let profile = await getProfile(user.id)
  if (!profile) {
    profile = await createProfile({
      id: user.id,
      email: user.email,
      credits: SIGNUP_BONUS_CREDITS,
    })
  }
  return (
    <div className="min-h-screen">
      <DashboardHeader email={profile.email} credits={profile.credits} />
      <div className="mx-auto max-w-6xl px-4 py-8">{children}</div>
    </div>
  )
}

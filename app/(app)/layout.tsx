import { redirect } from "next/navigation"

import { DashboardHeader } from "@/components/features/dashboard-header"
import { requireUserWithProfile } from "@/lib/auth/require-user"
import { HttpError } from "@/lib/errors"

export const dynamic = "force-dynamic"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  try {
    const { profile } = await requireUserWithProfile()
    return (
      <div className="min-h-screen">
        <DashboardHeader email={profile.email} credits={profile.credits} />
        <div className="mx-auto max-w-6xl px-4 py-8">{children}</div>
      </div>
    )
  } catch (error) {
    if (error instanceof HttpError && error.status === 401) {
      redirect("/login")
    }
    throw error
  }
}

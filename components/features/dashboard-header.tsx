"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"

import { Logo } from "@/components/features/logo"
import { CreditBalance } from "@/components/features/credit-balance"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import type { Profile } from "@/types"

export function DashboardHeader({
  email,
  credits,
}: {
  email: string
  credits: number
}) {
  const router = useRouter()

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/")
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Logo />
        <div className="flex items-center gap-2">
          <CreditBalance initialCredits={credits} />
          <Link href="/create" className={cn(buttonVariants())}>
            New ad
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger
              className="hidden sm:inline-flex"
              render={<Button variant="ghost" />}
            >
              {email}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem render={<Link href="/dashboard" />}>
                Ads
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href="/dashboard/billing" />}>
                Billing
              </DropdownMenuItem>
              <DropdownMenuItem onClick={logout}>Sign out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}

export function creditsLabel(profile: Profile): string {
  return `${profile.credits} ${profile.credits === 1 ? "credit" : "credits"}`
}

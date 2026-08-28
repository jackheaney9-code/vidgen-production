"use client"

import Link from "next/link"
import { useState } from "react"
import { MenuIcon } from "lucide-react"

import { Logo } from "@/components/features/logo"
import { Button, buttonVariants } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Logo />
        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          <Link href="/#how" className="transition-colors hover:text-foreground">
            How it works
          </Link>
          <Link href="/#pricing" className="transition-colors hover:text-foreground">
            Pricing
          </Link>
          <Link href="/#faq" className="transition-colors hover:text-foreground">
            FAQ
          </Link>
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          {signedIn ? (
            <Link href="/dashboard" className={cn(buttonVariants())}>
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className={cn(buttonVariants({ variant: "ghost" }))}>
                Sign in
              </Link>
              <Link href="/login" className={cn(buttonVariants())}>
                Try Free
              </Link>
            </>
          )}
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            className="md:hidden"
            render={<Button variant="ghost" size="icon" />}
          >
            <MenuIcon />
          </SheetTrigger>
          <SheetContent side="right" className="w-72">
            <SheetHeader>
              <SheetTitle>Lumina</SheetTitle>
            </SheetHeader>
            <div className="mt-6 flex flex-col gap-3">
              <Link href="/#how" onClick={() => setOpen(false)}>
                How it works
              </Link>
              <Link href="/#pricing" onClick={() => setOpen(false)}>
                Pricing
              </Link>
              <Link href="/#faq" onClick={() => setOpen(false)}>
                FAQ
              </Link>
              <Link
                href={signedIn ? "/dashboard" : "/login"}
                className={cn(buttonVariants(), "mt-4")}
                onClick={() => setOpen(false)}
              >
                {signedIn ? "Dashboard" : "Try Free"}
              </Link>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}

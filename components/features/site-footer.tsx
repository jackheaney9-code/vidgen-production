import Link from "next/link"

import { Logo } from "@/components/features/logo"

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/#how", label: "How it works" },
      { href: "/#pricing", label: "Pricing" },
      { href: "/#faq", label: "FAQ" },
    ],
  },
  {
    title: "Studio",
    links: [
      { href: "/login", label: "Sign in" },
      { href: "/create", label: "Create an ad" },
      { href: "/dashboard", label: "Dashboard" },
    ],
  },
  {
    title: "Credits",
    links: [
      { href: "/dashboard/billing", label: "Buy credits" },
      { href: "/login", label: "Try free" },
    ],
  },
] as const

export function SiteFooter() {
  return (
    <footer className="border-t border-white/5 py-12">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm text-muted-foreground">
            Product stills into scroll-stopping video ads. Script, voice, and
            picture in one credit.
          </p>
        </div>
        {COLUMNS.map((column) => (
          <div key={column.title}>
            <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">
              {column.title}
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              {column.links.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="hover:text-primary">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mx-auto mt-10 flex max-w-6xl flex-col gap-2 px-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} Lumina. Pay per video.</p>
        <p>9:16 MP4 · 15 or 30 seconds · no subscription</p>
      </div>
    </footer>
  )
}

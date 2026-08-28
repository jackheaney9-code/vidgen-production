import Link from "next/link"

export function SiteFooter() {
  return (
    <footer className="border-t border-white/5 py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>Lumina — product stills into video ads.</p>
        <div className="flex gap-5">
          <Link href="/login" className="hover:text-foreground">
            Sign in
          </Link>
          <Link href="/dashboard/billing" className="hover:text-foreground">
            Credits
          </Link>
        </div>
      </div>
    </footer>
  )
}

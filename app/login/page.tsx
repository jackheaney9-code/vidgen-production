import Link from "next/link"
import { redirect } from "next/navigation"
import { Suspense } from "react"

import { AuthForm } from "@/components/features/auth-form"
import { Logo } from "@/components/features/logo"
import { getCurrentUser } from "@/lib/auth/require-user"

export const dynamic = "force-dynamic"

export default async function LoginPage() {
  const user = await getCurrentUser()
  if (user) {
    redirect("/dashboard")
  }
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <Logo className="mb-10 justify-center" />
      <h1 className="font-heading text-4xl">Sign in</h1>
      <p className="mt-2 mb-8 text-sm text-muted-foreground">
        New here?{" "}
        <Link href="/signup" className="text-primary">
          Create a studio
        </Link>
      </p>
      <Suspense>
        <AuthForm mode="login" />
      </Suspense>
    </div>
  )
}

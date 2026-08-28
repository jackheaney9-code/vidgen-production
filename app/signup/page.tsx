import Link from "next/link"
import { redirect } from "next/navigation"
import { Suspense } from "react"

import { AuthForm } from "@/components/features/auth-form"
import { Logo } from "@/components/features/logo"
import { getCurrentUser } from "@/lib/auth/require-user"

export const dynamic = "force-dynamic"

export default async function SignupPage() {
  const user = await getCurrentUser()
  if (user) {
    redirect("/dashboard")
  }
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <Logo className="mb-10 justify-center" />
      <h1 className="font-heading text-4xl">Open a studio</h1>
      <p className="mt-2 mb-8 text-sm text-muted-foreground">
        Already have one?{" "}
        <Link href="/login" className="text-primary">
          Sign in
        </Link>
      </p>
      <Suspense>
        <AuthForm mode="signup" />
      </Suspense>
    </div>
  )
}

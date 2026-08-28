"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { createBrowserClient } from "@/lib/supabase/client"
import { hasSupabase } from "@/lib/env"

export function AuthForm() {
  const router = useRouter()
  const search = useSearchParams()
  const next = search.get("next") ?? "/dashboard"
  const authError = search.get("error")
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(
    authError === "auth" ? "Sign-in didn’t complete. Try again." : null,
  )
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState<"google" | "magic" | "demo" | null>(null)
  const supabaseReady = hasSupabase()

  async function google() {
    if (!supabaseReady) {
      setError("Add Supabase keys to enable Google sign-in.")
      return
    }
    setPending("google")
    setError(null)
    try {
      const supabase = createBrowserClient()
      const origin = window.location.origin
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/callback?next=${encodeURIComponent(next)}`,
        },
      })
      if (oauthError) {
        throw oauthError
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed")
      setPending(null)
    }
  }

  async function magicLink(event: React.FormEvent) {
    event.preventDefault()
    if (!supabaseReady) {
      setError("Add Supabase keys to send a magic link, or use the demo studio.")
      return
    }
    setPending("magic")
    setError(null)
    setNotice(null)
    try {
      const supabase = createBrowserClient()
      const origin = window.location.origin
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${origin}/callback?next=${encodeURIComponent(next)}`,
        },
      })
      if (otpError) {
        throw otpError
      }
      setNotice(`Check ${email} for a sign-in link.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the link")
    } finally {
      setPending(null)
    }
  }

  async function demo() {
    setPending("demo")
    setError(null)
    try {
      const res = await fetch("/api/auth/demo", { method: "POST" })
      const data: unknown = await res.json()
      if (!res.ok) {
        const message =
          typeof data === "object" &&
          data !== null &&
          "error" in data &&
          typeof data.error === "string"
            ? data.error
            : "Demo studio failed"
        throw new Error(message)
      }
      router.push("/dashboard")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Demo studio failed")
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Couldn’t sign in</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {notice && (
        <Alert>
          <AlertTitle>Link sent</AlertTitle>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}
      <Button
        type="button"
        className="h-10 w-full"
        onClick={google}
        disabled={pending !== null}
      >
        {pending === "google" && <Loader2Icon className="animate-spin" />}
        Continue with Google
      </Button>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or email a link
        <span className="h-px flex-1 bg-border" />
      </div>
      <form onSubmit={magicLink} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-10"
          />
        </div>
        <Button type="submit" variant="outline" className="h-10 w-full" disabled={pending !== null}>
          {pending === "magic" && <Loader2Icon className="animate-spin" />}
          Send magic link
        </Button>
      </form>
      <Button
        type="button"
        variant="ghost"
        className="h-10 w-full"
        onClick={demo}
        disabled={pending !== null}
      >
        {pending === "demo" && <Loader2Icon className="animate-spin" />}
        Continue with a demo studio
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        New Google and magic-link accounts get 3 credits. Demo mode works without Supabase.
      </p>
    </div>
  )
}

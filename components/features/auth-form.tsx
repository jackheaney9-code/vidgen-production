"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter()
  const search = useSearchParams()
  const next = search.get("next") ?? "/dashboard"
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [demoPending, setDemoPending] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      const res = await fetch(mode === "login" ? "/api/auth/login" : "/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const data: unknown = await res.json()
      if (!res.ok) {
        const message =
          typeof data === "object" &&
          data !== null &&
          "error" in data &&
          typeof data.error === "string"
            ? data.error
            : "Could not continue"
        throw new Error(message)
      }
      router.push(next)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not continue")
    } finally {
      setPending(false)
    }
  }

  async function demo() {
    setDemoPending(true)
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
      setDemoPending(false)
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
      <form onSubmit={submit} className="space-y-4">
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
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            minLength={8}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-10"
          />
        </div>
        <Button type="submit" className="h-10 w-full" disabled={pending}>
          {pending && <Loader2Icon className="animate-spin" />}
          {mode === "login" ? "Sign in" : "Create studio"}
        </Button>
      </form>
      <Button
        type="button"
        variant="outline"
        className="h-10 w-full"
        onClick={demo}
        disabled={demoPending}
      >
        {demoPending && <Loader2Icon className="animate-spin" />}
        Continue with a demo studio
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Demo studios start with 3 credits. No API keys required.
      </p>
    </div>
  )
}

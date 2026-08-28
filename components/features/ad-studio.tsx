"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { CheckIcon, Loader2Icon, CircleAlertIcon } from "lucide-react"

import { updateScriptAction } from "@/app/actions/ads"
import { Button, buttonVariants } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { Ad, AdScript } from "@/types"

type StudioPayload = {
  ad: Ad
  productImageUrl: string
  videoUrl: string | null
  voiceUrl: string | null
  finalUrl: string | null
}

type ProduceStep = "script" | "video" | "voice" | "composite" | "done"

const STEP_LABEL: Record<ProduceStep, string> = {
  script: "Writing script",
  video: "Generating picture",
  voice: "Recording voiceover",
  composite: "Laying picture and voice",
  done: "Ready to ship",
}

export function AdStudio({
  initial,
  autoProduce = false,
}: {
  initial: StudioPayload
  autoProduce?: boolean
}) {
  const [payload, setPayload] = useState(initial)
  const [script, setScript] = useState<AdScript | null>(initial.ad.script)
  const [busy, setBusy] = useState<ProduceStep | null>(
    initial.ad.status === "pending" && !initial.ad.script
      ? "script"
      : initial.ad.status === "generating_script"
        ? "script"
        : null,
  )
  const [error, setError] = useState<string | null>(initial.ad.error)
  const [payment, setPayment] = useState(false)

  const started = useRef(false)

  const ad = payload.ad

  useEffect(() => {
    if (started.current) {
      return
    }
    started.current = true
    if (ad.status === "pending" && !ad.script) {
      void runScript()
      return
    }
    if (autoProduce && ad.script && !ad.finalPath) {
      void produce()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function refresh(): Promise<StudioPayload | null> {
    const res = await fetch(`/api/ads/${ad.id}`)
    const data: unknown = await res.json()
    if (!res.ok || !isPayload(data)) {
      return null
    }
    setPayload(data)
    setScript(data.ad.script)
    return data
  }

  async function runScript() {
    setBusy("script")
    setError(null)
    try {
      await postJson("/api/generate-script", { adId: ad.id })
      await refresh()
    } catch (err) {
      handleErr(err)
    } finally {
      setBusy(null)
    }
  }

  async function saveScript() {
    if (!script) return
    setBusy("script")
    setError(null)
    const result = await updateScriptAction(ad.id, script)
    if (!result.ok) {
      setError(result.error)
      setBusy(null)
      return
    }
    setPayload((current) => ({ ...current, ad: result.ad }))
    setBusy(null)
  }

  async function produce() {
    setError(null)
    setPayment(false)
    try {
      let current = payload.ad
      if (!current.videoPath) {
        setBusy("video")
        await postJson("/api/generate-video", { adId: ad.id })
        const next = await refresh()
        if (next) current = next.ad
      }
      if (!current.voicePath) {
        setBusy("voice")
        await postJson("/api/generate-voiceover", { adId: ad.id })
        const next = await refresh()
        if (next) current = next.ad
      }
      if (!current.finalPath) {
        setBusy("composite")
        await postJson("/api/composite", { adId: ad.id })
        await refresh()
      }
      setBusy("done")
    } catch (err) {
      handleErr(err)
      await refresh()
    } finally {
      setTimeout(() => setBusy(null), 400)
    }
  }

  function handleErr(err: unknown) {
    if (err instanceof PaymentRequiredError) {
      setPayment(true)
      setError(err.message)
      return
    }
    setError(err instanceof Error ? err.message : "Generation failed")
  }

  const canProduce =
    Boolean(script) &&
    busy === null &&
    ad.status !== "completed" &&
    ad.status !== "generating_script" &&
    ad.status !== "generating_video" &&
    ad.status !== "generating_voice" &&
    ad.status !== "compositing"

  return (
    <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="space-y-4">
        <div className="overflow-hidden rounded-xl border border-white/8 bg-card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={payload.productImageUrl}
            alt={ad.productName}
            className="aspect-[4/5] w-full object-cover"
          />
          <div className="p-4">
            <p className="font-heading text-2xl">{ad.productName}</p>
            <p className="mt-2 text-sm text-muted-foreground">{ad.productDescription}</p>
            <p className="mt-3 text-xs tracking-wide text-muted-foreground uppercase">
              {ad.style} · {ad.audience}
            </p>
          </div>
        </div>
        {payload.finalUrl && (
          <video
            className="w-full rounded-xl border border-white/8"
            src={payload.finalUrl}
            controls
            playsInline
          />
        )}
      </div>

      <div className="space-y-6">
        <PipelineRail status={ad.status} busy={busy} scriptReady={Boolean(script)} />

        {error && (
          <Alert variant="destructive">
            <CircleAlertIcon />
            <AlertTitle>{payment ? "Out of credits" : "Generation stopped"}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {payment && (
          <Link href="/dashboard/billing" className={cn(buttonVariants())}>
            Buy credits
          </Link>
        )}

        {busy && (
          <div className="flex items-center gap-3 rounded-xl border border-white/8 bg-card p-4 text-sm">
            <Loader2Icon className="size-4 animate-spin text-primary" />
            {STEP_LABEL[busy]}
          </div>
        )}

        {script && (
          <div className="space-y-4 rounded-xl border border-white/8 bg-card p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-xl">Script</h2>
              <span className="text-xs text-muted-foreground">
                {script.durationSeconds}s
              </span>
            </div>
            <Field
              label="Hook"
              value={script.hook}
              onChange={(value) => setScript({ ...script, hook: value })}
            />
            <Field
              label="Body"
              value={script.body}
              onChange={(value) => setScript({ ...script, body: value })}
            />
            <Field
              label="CTA"
              value={script.cta}
              onChange={(value) => setScript({ ...script, cta: value })}
            />
            <div className="space-y-2">
              <Label>Voiceover</Label>
              <Textarea
                value={script.fullText}
                onChange={(event) =>
                  setScript({ ...script, fullText: event.target.value })
                }
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={saveScript} disabled={busy !== null}>
                Save edits
              </Button>
              <Button type="button" onClick={produce} disabled={!canProduce}>
                {busy && busy !== "done" ? (
                  <Loader2Icon className="animate-spin" />
                ) : (
                  "Produce video ad"
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Producing deducts 1 credit before picture starts. Failures refund the credit.
            </p>
          </div>
        )}

        {payload.finalUrl && (
          <a
            href={payload.finalUrl}
            download={`${ad.productName}-lumina.mp4`}
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Download MP4
          </a>
        )}
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input className="h-10" value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  )
}

function PipelineRail({
  status,
  busy,
  scriptReady,
}: {
  status: Ad["status"]
  busy: ProduceStep | null
  scriptReady: boolean
}) {
  const steps = [
    { key: "script", label: "Script", done: scriptReady },
    {
      key: "video",
      label: "Picture",
      done: status === "generating_voice" || status === "compositing" || status === "completed",
    },
    {
      key: "voice",
      label: "Voice",
      done: status === "compositing" || status === "completed",
    },
    { key: "composite", label: "Composite", done: status === "completed" },
  ] as const

  return (
    <ol className="grid grid-cols-4 gap-2">
      {steps.map((step) => {
        const active = busy === step.key
        return (
          <li
            key={step.key}
            className={cn(
              "rounded-lg border px-2 py-3 text-center text-xs",
              step.done
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-white/8 text-muted-foreground",
            )}
          >
            <span className="mx-auto mb-1 flex size-5 items-center justify-center">
              {active ? (
                <Loader2Icon className="size-3.5 animate-spin" />
              ) : step.done ? (
                <CheckIcon className="size-3.5" />
              ) : (
                <span className="size-1.5 rounded-full bg-current" />
              )}
            </span>
            {step.label}
          </li>
        )
      })}
    </ol>
  )
}

class PaymentRequiredError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "PaymentRequiredError"
  }
}

async function postJson(url: string, body: { adId: string }): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data: unknown = await res.json().catch(() => null)
  if (res.status === 402) {
    const message =
      typeof data === "object" &&
      data !== null &&
      "error" in data &&
      typeof data.error === "string"
        ? data.error
        : "You need at least 1 credit to generate a video."
    throw new PaymentRequiredError(message)
  }
  if (!res.ok) {
    const message =
      typeof data === "object" &&
      data !== null &&
      "error" in data &&
      typeof data.error === "string"
        ? data.error
        : "Request failed"
    throw new Error(message)
  }
}

function isPayload(value: unknown): value is StudioPayload {
  return typeof value === "object" && value !== null && "ad" in value
}

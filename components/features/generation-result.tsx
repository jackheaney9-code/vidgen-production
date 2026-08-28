"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import {
  CheckIcon,
  CircleAlertIcon,
  DownloadIcon,
  Loader2Icon,
  PlusIcon,
} from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { STYLE_META } from "@/lib/constants"
import {
  formatCreatedAt,
  isGeneratingStatus,
  POLL_INTERVAL_MS,
  statusBadgeLabel,
  statusBadgeVariant,
} from "@/lib/generation-status"
import { cn } from "@/lib/utils"
import type { Ad, AdScript } from "@/types"

export type GenerationPayload = {
  ad: Ad
  productImageUrl: string
  videoUrl: string | null
  voiceUrl: string | null
  finalUrl: string | null
}

type PipelineStep = "script" | "video" | "voice" | "composite"

const STEP_COPY: Record<PipelineStep, string> = {
  script: "Writing script",
  video: "Generating picture",
  voice: "Recording voiceover",
  composite: "Laying picture and voice",
}

export function GenerationResult({
  initial,
  autoProduce = false,
}: {
  initial: GenerationPayload
  autoProduce?: boolean
}) {
  const [payload, setPayload] = useState(initial)
  const [busy, setBusy] = useState(isGeneratingStatus(initial.ad.status))
  const [error, setError] = useState<string | null>(initial.ad.error)
  const [payment, setPayment] = useState(false)
  const started = useRef(false)
  const ad = payload.ad
  const generating = isGeneratingStatus(ad.status) || busy

  useEffect(() => {
    if (started.current) {
      return
    }
    started.current = true
    if (autoProduce && ad.script && !ad.finalPath && ad.status !== "completed") {
      if (isGeneratingStatus(ad.status)) {
        setBusy(true)
      } else {
        void produce()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!isGeneratingStatus(ad.status) && !busy) {
      return
    }
    const id = ad.id
    const timer = window.setInterval(() => {
      void (async () => {
        const res = await fetch(`/api/ads/${id}`)
        const data: unknown = await res.json()
        if (!res.ok || !isPayload(data)) {
          return
        }
        setPayload(data)
        setError(data.ad.error)
        if (!isGeneratingStatus(data.ad.status)) {
          setBusy(false)
        }
      })()
    }, POLL_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [ad.status, busy, ad.id])

  async function refresh(): Promise<GenerationPayload | null> {
    const res = await fetch(`/api/ads/${ad.id}`)
    const data: unknown = await res.json()
    if (!res.ok || !isPayload(data)) {
      return null
    }
    setPayload(data)
    setError(data.ad.error)
    if (!isGeneratingStatus(data.ad.status)) {
      setBusy(false)
    }
    return data
  }

  async function produce() {
    setError(null)
    setPayment(false)
    setBusy(true)
    try {
      await postJson("/api/generate-video", {
        generationId: ad.id,
        adId: ad.id,
      })
      await refresh()
    } catch (err) {
      if (err instanceof PaymentRequiredError) {
        setPayment(true)
        setError(err.message)
      } else {
        setError(err instanceof Error ? err.message : "Generation failed")
      }
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const script = ad.script
  const canProduce =
    Boolean(script) && !generating && ad.status === "pending"

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs tracking-[0.2em] text-primary uppercase">Result</p>
          <h1 className="mt-2 font-heading text-4xl">{ad.productName}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant={statusBadgeVariant(ad.status)}>
              {statusBadgeLabel(ad.status)}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {formatCreatedAt(ad.createdAt)}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/create" className={cn(buttonVariants())}>
            <PlusIcon />
            Create Another
          </Link>
          {payload.finalUrl && (
            <a
              href={payload.finalUrl}
              download={`${ad.productName}-lumina.mp4`}
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              <DownloadIcon />
              Download
            </a>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertTitle>{payment ? "Out of credits" : "Generation stopped"}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {payment && (
        <Link href="/dashboard/billing" className={cn(buttonVariants())}>
          Buy Credits
        </Link>
      )}

      <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-4">
          <Card className="py-0">
            {payload.finalUrl ? (
              <video
                className="aspect-[9/16] w-full bg-black object-contain"
                src={payload.finalUrl}
                poster={payload.productImageUrl}
                controls
                playsInline
              />
            ) : (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={payload.productImageUrl}
                  alt={ad.productName}
                  className="aspect-[9/16] w-full object-cover"
                />
                {generating && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/45">
                    <Loader2Icon className="size-8 animate-spin text-primary" />
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <PipelineSteps status={ad.status} scriptReady={Boolean(script)} />

          {generating && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Loader2Icon className="size-4 animate-spin text-primary" />
                  {STEP_COPY[stepFromStatus(ad.status)]}
                </CardTitle>
                <CardDescription>This usually takes 1–2 minutes.</CardDescription>
              </CardHeader>
              <CardContent>
                <Progress value={progressFromStatus(ad.status)} className="w-full" />
              </CardContent>
            </Card>
          )}

          {script && <ScriptPreview script={script} />}

          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <MetaRow label="Created" value={formatCreatedAt(ad.createdAt)} />
              <MetaRow label="Style" value={STYLE_META[ad.style].label} />
              <MetaRow
                label="Duration"
                value={`${script?.durationSeconds ?? 15}s`}
              />
              <MetaRow label="Audience" value={ad.audience} />
            </CardContent>
          </Card>

          {canProduce && (
            <Button type="button" onClick={() => void produce()} disabled={busy}>
              {busy ? <Loader2Icon className="animate-spin" /> : null}
              Produce video ad
            </Button>
          )}
          {ad.status === "failed" && !generating && (
            <Button type="button" onClick={() => void produce()}>
              Try again
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function ScriptPreview({ script }: { script: AdScript }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Script</CardTitle>
        <CardDescription>Approved voiceover for this ad.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <PreviewBlock label="Hook" value={script.hook} />
        <PreviewBlock label="Body" value={script.body} />
        <PreviewBlock label="CTA" value={script.cta} />
        <PreviewBlock label="Voiceover" value={script.fullText} />
      </CardContent>
    </Card>
  )
}

function PreviewBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 text-sm text-pretty">{value}</p>
    </div>
  )
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  )
}

function PipelineSteps({
  status,
  scriptReady,
}: {
  status: Ad["status"]
  scriptReady: boolean
}) {
  const steps = [
    { key: "script", label: "Script", done: scriptReady },
    {
      key: "video",
      label: "Picture",
      done:
        status === "generating_voice" ||
        status === "compositing" ||
        status === "completed",
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
        const active = stepFromStatus(status) === step.key && isGeneratingStatus(status)
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

function stepFromStatus(status: Ad["status"]): PipelineStep {
  if (status === "generating_script") return "script"
  if (status === "generating_video") return "video"
  if (status === "generating_voice") return "voice"
  if (status === "compositing") return "composite"
  if (status === "completed") return "composite"
  return "video"
}

function progressFromStatus(status: Ad["status"]): number {
  if (status === "completed") return 100
  if (status === "compositing") return 80
  if (status === "generating_voice") return 55
  if (status === "generating_video") return 30
  if (status === "generating_script") return 12
  return 20
}

class PaymentRequiredError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "PaymentRequiredError"
  }
}

async function postJson(
  url: string,
  body: { adId?: string; generationId?: string },
): Promise<void> {
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

function isPayload(value: unknown): value is GenerationPayload {
  return typeof value === "object" && value !== null && "ad" in value
}

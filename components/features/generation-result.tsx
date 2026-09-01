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
  createProduceGuard,
  createRunwayPoller,
  isProduceLockedStatus,
  postGenerateVideo,
  readApiJson,
  shouldAutoProduce,
  shouldPollRunway,
  VIDEO_RECOVERY_USER_MESSAGE,
  userFacingVideoError,
  type VideoProgress,
} from "@/lib/generation-client"
import {
  formatCreatedAt,
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
  const [produceInFlight, setProduceInFlight] = useState(false)
  const [hasRunwayTask, setHasRunwayTask] = useState(Boolean(initial.ad.runwayTaskId))
  const [recoveryRequired, setRecoveryRequired] = useState(
    initial.ad.status === "generating_video" && !initial.ad.runwayTaskId,
  )
  const [error, setError] = useState<string | null>(
    initial.ad.status === "generating_video" && !initial.ad.runwayTaskId
      ? VIDEO_RECOVERY_USER_MESSAGE
      : initial.ad.error,
  )
  const [payment, setPayment] = useState(false)
  const started = useRef(false)
  const produceGuard = useRef(createProduceGuard())
  const ad = payload.ad
  const adIdRef = useRef(ad.id)
  adIdRef.current = ad.id
  const pictureBusy =
    produceInFlight ||
    shouldPollRunway({
      status: ad.status,
      hasRunwayTask,
      recoveryRequired,
    })
  const voiceNext = ad.status === "generating_voice"
  const compositing = ad.status === "compositing"

  async function refresh(): Promise<GenerationPayload | null> {
    try {
      const res = await fetch(`/api/ads/${adIdRef.current}`, {
        credentials: "include",
        cache: "no-store",
      })
      const parsed = await readApiJson(res)
      if (!res.ok || !isPayload(parsed.data)) {
        return null
      }
      setPayload(parsed.data)
      setHasRunwayTask(Boolean(parsed.data.ad.runwayTaskId))
      if (parsed.data.ad.status === "generating_video" && !parsed.data.ad.runwayTaskId) {
        setRecoveryRequired(true)
        setError(VIDEO_RECOVERY_USER_MESSAGE)
      } else if (parsed.data.ad.error && parsed.data.ad.status === "failed") {
        setError(parsed.data.ad.error)
      }
      return parsed.data
    } catch {
      return null
    }
  }

  function applyProgress(progress: VideoProgress) {
    if (progress.recoveryRequired || (progress.status === "generating_video" && !progress.hasRunwayTask)) {
      setRecoveryRequired(true)
      setHasRunwayTask(false)
      setError(VIDEO_RECOVERY_USER_MESSAGE)
      setPayload((prev) => ({
        ...prev,
        ad: {
          ...prev.ad,
          status: progress.status,
          error: VIDEO_RECOVERY_USER_MESSAGE,
        },
      }))
      return
    }

    setHasRunwayTask(progress.hasRunwayTask)
    setPayload((prev) => ({
      ...prev,
      ad: {
        ...prev.ad,
        status: progress.status,
        error: progress.status === "failed" ? progress.error : null,
      },
    }))

    if (progress.status === "failed") {
      setError(userFacingVideoError(progress, "Picture generation failed. Please try again."))
      return
    }

    if (progress.status !== "generating_video") {
      void refresh()
    }
  }

  const applyProgressRef = useRef(applyProgress)
  applyProgressRef.current = applyProgress

  useEffect(() => {
    if (started.current) {
      return
    }
    started.current = true
    if (
      shouldAutoProduce({
        autoProduce,
        hasScript: Boolean(ad.script),
        finalPath: ad.finalPath,
        status: ad.status,
      })
    ) {
      void produce()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const poll = shouldPollRunway({
      status: ad.status,
      hasRunwayTask,
      recoveryRequired,
    })
    if (!poll) {
      return
    }
    const poller = createRunwayPoller({
      generationId: ad.id,
      onProgress: (progress) => {
        applyProgressRef.current(progress)
      },
      onFatalError: (message) => {
        setError(message)
      },
    })
    poller.start(true)
    return () => poller.stop()
  }, [ad.id, ad.status, hasRunwayTask, recoveryRequired])

  async function produce() {
    if (isProduceLockedStatus(ad.status)) {
      return
    }
    if (!produceGuard.current.tryBegin()) {
      return
    }
    setError(null)
    setPayment(false)
    setProduceInFlight(true)
    try {
      const outcome = await postGenerateVideo(ad.id)
      if (outcome.kind === "recovery") {
        setRecoveryRequired(true)
        setError(VIDEO_RECOVERY_USER_MESSAGE)
        return
      }
      if (outcome.kind === "payment") {
        setPayment(true)
        setError(outcome.message)
        return
      }
      if (outcome.kind === "error") {
        setError(outcome.message)
        return
      }
      applyProgress(outcome.progress)
    } finally {
      produceGuard.current.end()
      setProduceInFlight(false)
    }
  }

  const script = ad.script
  const canProduce =
    Boolean(script) && ad.status === "pending" && !produceInFlight && !recoveryRequired
  const canRetry =
    ad.status === "failed" && !produceInFlight && !recoveryRequired && !pictureBusy

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
          <AlertTitle>
            {payment ? "Out of credits" : recoveryRequired ? "Manual recovery needed" : "Generation stopped"}
          </AlertTitle>
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
            ) : payload.videoUrl && !pictureBusy ? (
              <video
                className="aspect-[9/16] w-full bg-black object-contain"
                src={payload.videoUrl}
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
                {pictureBusy && (
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

          {pictureBusy && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Loader2Icon className="size-4 animate-spin text-primary" />
                  {STEP_COPY.video}
                </CardTitle>
                <CardDescription>This usually takes 1–2 minutes.</CardDescription>
              </CardHeader>
              <CardContent>
                <Progress value={progressFromStatus(ad.status)} className="w-full" />
              </CardContent>
            </Card>
          )}

          {voiceNext && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Video generated. Voice generation is next.</CardTitle>
                <CardDescription>
                  Picture is ready. Voiceover will start in a later step.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Progress value={progressFromStatus("generating_voice")} className="w-full" />
              </CardContent>
            </Card>
          )}

          {compositing && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Loader2Icon className="size-4 animate-spin text-primary" />
                  {STEP_COPY.composite}
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
            <Button
              type="button"
              onClick={() => void produce()}
              disabled={produceInFlight || isProduceLockedStatus(ad.status)}
            >
              {produceInFlight ? <Loader2Icon className="animate-spin" /> : null}
              Produce video ad
            </Button>
          )}
          {canRetry && (
            <Button
              type="button"
              onClick={() => void produce()}
              disabled={produceInFlight}
            >
              {produceInFlight ? <Loader2Icon className="animate-spin" /> : null}
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
        const active =
          (step.key === "script" && status === "generating_script") ||
          (step.key === "video" && status === "generating_video") ||
          (step.key === "composite" && status === "compositing")
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

function progressFromStatus(status: Ad["status"]): number {
  if (status === "completed") return 100
  if (status === "compositing") return 80
  if (status === "generating_voice") return 55
  if (status === "generating_video") return 30
  if (status === "generating_script") return 12
  return 20
}

function isPayload(value: unknown): value is GenerationPayload {
  return typeof value === "object" && value !== null && "ad" in value
}

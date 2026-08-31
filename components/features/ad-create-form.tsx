"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ImageIcon, Loader2Icon, SparklesIcon } from "lucide-react"

import { updateScriptAction } from "@/app/actions/ads"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { MAX_UPLOAD_BYTES, STYLE_META } from "@/lib/constants"
import { AD_STYLES, type AdStyle } from "@/types"
import { cn } from "@/lib/utils"

const STYLE_OPTIONS: { value: AdStyle; label: string }[] = [
  { value: "showcase", label: "Product Showcase" },
  { value: "lifestyle", label: "Lifestyle" },
  { value: "before_after", label: "Before/After" },
]

export function AdCreateForm() {
  const router = useRouter()
  const [style, setStyle] = useState<AdStyle>("showcase")
  const [duration, setDuration] = useState<15 | 30>(15)
  const [preview, setPreview] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [useSample, setUseSample] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<"script" | "video" | null>(null)
  const [generationId, setGenerationId] = useState<string | null>(null)
  const [script, setScript] = useState<string>("")

  function applyImage(file: File) {
    if (file.size > MAX_UPLOAD_BYTES) {
      setError("Image must be 4MB or smaller.")
      return
    }
    setError(null)
    setUseSample(false)
    setImageFile(file)
    setPreview(URL.createObjectURL(file))
  }

  async function generate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending("script")
    setError(null)
    if (imageFile && imageFile.size > MAX_UPLOAD_BYTES) {
      setError("Image must be 4MB or smaller.")
      setPending(null)
      return
    }
    const form = event.currentTarget
    const data = new FormData()
    data.set("productName", String(new FormData(form).get("productName") ?? ""))
    data.set("productDescription", String(new FormData(form).get("productDescription") ?? ""))
    data.set("targetAudience", String(new FormData(form).get("targetAudience") ?? ""))
    data.set("style", style)
    data.set("duration", String(duration))
    data.set("useSample", useSample ? "true" : "false")
    if (imageFile) {
      data.set("image", imageFile)
    }

    try {
      const res = await fetch("/api/generate-script", {
        method: "POST",
        body: data,
      })
      const payload = await readApiPayload(res)
      if (!res.ok) {
        throw new Error(errorMessage(payload, `Couldn’t write the script. (${res.status})`))
      }
      if (
        typeof payload !== "object" ||
        payload === null ||
        !("generationId" in payload) ||
        !("script" in payload) ||
        typeof payload.generationId !== "string" ||
        typeof payload.script !== "string"
      ) {
        throw new Error("Script response was incomplete.")
      }
      setGenerationId(payload.generationId)
      setScript(payload.script)
    } catch (err) {
      setError(sanitizeClientError(err, "Couldn’t write the script."))
    } finally {
      setPending(null)
    }
  }

  async function approve() {
    if (!generationId) {
      return
    }
    setPending("video")
    setError(null)
    try {
      const saved = await updateScriptAction(generationId, script)
      if (!saved.ok) {
        throw new Error(saved.error)
      }
      router.push(`/generations/${generationId}?produce=1`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t save the script.")
      setPending(null)
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Couldn’t continue</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={generate} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-2xl">Brief</CardTitle>
            <CardDescription>
              Script generation is free. You spend a credit only when you approve picture.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Product image</Label>
              <div
                onDragOver={(event) => {
                  event.preventDefault()
                  setDragging(true)
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                  event.preventDefault()
                  setDragging(false)
                  const file = event.dataTransfer.files[0]
                  if (file) applyImage(file)
                }}
                className={cn(
                  "relative flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed bg-card/50 p-6 text-center transition-colors",
                  dragging ? "border-primary bg-primary/10" : "border-white/15",
                  preview && "p-0",
                )}
              >
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={preview}
                    alt="Product preview"
                    className="max-h-80 rounded-xl object-contain"
                  />
                ) : (
                  <>
                    <ImageIcon className="size-8 text-muted-foreground" />
                    <p className="mt-3 text-sm">Drop a JPG, PNG, or WebP — or click to browse.</p>
                    <p className="mt-1 text-xs text-muted-foreground">Max 4MB. Vertical crops work best.</p>
                  </>
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="absolute inset-0 cursor-pointer opacity-0"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) applyImage(file)
                  }}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setUseSample(true)
                  setImageFile(null)
                  setPreview("/samples/serum.png")
                }}
              >
                Use the Aurum sample
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="productName">Product name</Label>
              <Input id="productName" name="productName" required minLength={2} className="h-10" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="productDescription">Description</Label>
              <Textarea
                id="productDescription"
                name="productDescription"
                required
                minLength={8}
                placeholder="A night serum with 2% bakuchiol. Goes on like water, wears like silk."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="targetAudience">Target audience</Label>
              <Input
                id="targetAudience"
                name="targetAudience"
                required
                minLength={2}
                placeholder="Women 28–40 who already buy clean beauty"
                className="h-10"
              />
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Style</Label>
                <Select
                  value={style}
                  onValueChange={(value) => {
                    if (isAdStyle(value)) {
                      setStyle(value)
                    }
                  }}
                >
                  <SelectTrigger className="h-10 w-full min-w-full">
                    <SelectValue>
                      {(value: string | null) =>
                        STYLE_OPTIONS.find((item) => item.value === value)?.label ??
                        "Choose a style"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {STYLE_OPTIONS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                        <span className="sr-only">{STYLE_META[item.value].description}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Duration</Label>
                <Tabs
                  value={String(duration)}
                  onValueChange={(value) => setDuration(value === "30" ? 30 : 15)}
                >
                  <TabsList className="h-10 w-full">
                    <TabsTrigger value="15" className="flex-1">
                      15s
                    </TabsTrigger>
                    <TabsTrigger value="30" className="flex-1">
                      30s
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>
          </CardContent>
          <CardFooter className="border-0 bg-transparent pb-6">
            <Button type="submit" className="h-10" disabled={pending !== null}>
              {pending === "script" ? (
                <Loader2Icon className="animate-spin" />
              ) : (
                <SparklesIcon />
              )}
              Generate Script
            </Button>
          </CardFooter>
        </Card>
      </form>

      {(pending === "script" || script) && (
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-2xl">Script</CardTitle>
            <CardDescription>
              Edit the copy, then approve. Picture, voice, and composite cost 1 credit.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pending === "script" && !script ? (
              <div className="flex min-h-48 items-center gap-3 text-sm text-muted-foreground">
                <Loader2Icon className="size-4 animate-spin text-primary" />
                Writing the {duration}-second script…
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="script">Preview</Label>
                <Textarea
                  id="script"
                  value={script}
                  onChange={(event) => setScript(event.target.value)}
                  className="min-h-56 font-mono text-sm leading-relaxed"
                />
              </div>
            )}
          </CardContent>
          {script && (
            <CardFooter className="border-0 bg-transparent pb-6">
              <Button
                type="button"
                className="h-10"
                onClick={approve}
                disabled={pending !== null}
              >
                {pending === "video" && <Loader2Icon className="animate-spin" />}
                Approve & Generate Video
              </Button>
            </CardFooter>
          )}
        </Card>
      )}
    </div>
  )
}

function isAdStyle(value: unknown): value is AdStyle {
  return typeof value === "string" && AD_STYLES.some((item) => item === value)
}

function errorMessage(payload: unknown, fallback: string): string {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    return payload.error
  }
  return fallback
}

function sanitizeClientError(err: unknown, fallback: string): string {
  const raw = err instanceof Error ? err.message : fallback
  if (/unexpected end of json input/i.test(raw) || /is not valid json/i.test(raw)) {
    return fallback
  }
  return raw
}

async function readApiPayload(res: Response): Promise<unknown> {
  const contentType = (res.headers.get("content-type") ?? "").toLowerCase()
  const text = await res.text()
  const trimmed = text.trim()
  const declaredJson = contentType.includes("application/json")
  const looksLikeJson = trimmed.startsWith("{") || trimmed.startsWith("[")

  if (trimmed && (declaredJson || looksLikeJson)) {
    try {
      return JSON.parse(trimmed) as unknown
    } catch {
      throw new Error(`Request failed (${res.status}): the server returned invalid JSON.`)
    }
  }

  if (!trimmed) {
    throw new Error(`Request failed (${res.status}): empty response.`)
  }

  const sanitized = trimmed.replace(/\s+/g, " ").slice(0, 180)
  throw new Error(`Request failed (${res.status}): ${sanitized}`)
}


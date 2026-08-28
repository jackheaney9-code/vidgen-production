"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2Icon, ImageIcon } from "lucide-react"

import { createAdAction } from "@/app/actions/ads"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { STYLE_META } from "@/lib/constants"
import { AD_STYLES, type AdStyle } from "@/types"
import { cn } from "@/lib/utils"

export function AdCreateForm() {
  const router = useRouter()
  const [style, setStyle] = useState<AdStyle>("showcase")
  const [preview, setPreview] = useState<string | null>(null)
  const [useSample, setUseSample] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)
    const form = new FormData(event.currentTarget)
    form.set("style", style)
    form.set("useSample", useSample ? "true" : "false")
    const result = await createAdAction(form)
    if (!result.ok) {
      setError(result.error)
      setPending(false)
      return
    }
    router.push(`/dashboard/ads/${result.id}`)
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Couldn’t save the brief</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-3">
        <Label>Product still</Label>
        <label
          className={cn(
            "flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-white/15 bg-card/50 p-6 text-center",
            preview && "p-0",
          )}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Product preview" className="max-h-80 rounded-xl object-contain" />
          ) : (
            <>
              <ImageIcon className="size-8 text-muted-foreground" />
              <p className="mt-3 text-sm">Drop a JPG, PNG, or WebP — or click to browse.</p>
              <p className="mt-1 text-xs text-muted-foreground">Max 8MB. Vertical crops work best.</p>
            </>
          )}
          <input
            name="image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (!file) return
              setUseSample(false)
              setPreview(URL.createObjectURL(file))
            }}
          />
        </label>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setUseSample(true)
            setPreview("/samples/serum.png")
          }}
        >
          Use the Aurum sample
        </Button>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="productName">Product name</Label>
          <Input id="productName" name="productName" required minLength={2} className="h-10" />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="productDescription">What it is</Label>
          <Textarea
            id="productDescription"
            name="productDescription"
            required
            minLength={8}
            placeholder="A night serum with 2% bakuchiol. Goes on like water, wears like silk."
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="audience">Audience</Label>
          <Input
            id="audience"
            name="audience"
            required
            minLength={2}
            placeholder="Women 28–40 who already buy clean beauty"
            className="h-10"
          />
        </div>
      </div>

      <div className="space-y-3">
        <Label>Style</Label>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {AD_STYLES.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setStyle(item)}
              className={cn(
                "rounded-xl border p-4 text-left transition-colors",
                style === item
                  ? "border-primary bg-primary/10"
                  : "border-white/10 hover:border-white/25",
              )}
            >
              <p className="font-medium">{STYLE_META[item].label}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {STYLE_META[item].description}
              </p>
            </button>
          ))}
        </div>
      </div>

      <Button type="submit" className="h-10" disabled={pending}>
        {pending && <Loader2Icon className="animate-spin" />}
        Write the script
      </Button>
    </form>
  )
}

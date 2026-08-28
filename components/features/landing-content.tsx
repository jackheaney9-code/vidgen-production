import { FilmIcon, MicIcon, PenLineIcon, SparklesIcon } from "lucide-react"

import { STYLE_META } from "@/lib/constants"
import { AD_STYLES } from "@/types"

const STEPS = [
  {
    title: "Brief the product",
    body: "Drop a photo, name the product, and pick who it’s for.",
    icon: SparklesIcon,
  },
  {
    title: "Approve the script",
    body: "Claude writes a 15–30s voiceover. You edit the hook before anything renders.",
    icon: PenLineIcon,
  },
  {
    title: "Picture and voice",
    body: "Runway builds the picture. ElevenLabs reads the line. One credit, one ad.",
    icon: MicIcon,
  },
  {
    title: "Composite and ship",
    body: "ffmpeg lays the voice on the picture. You download a vertical MP4.",
    icon: FilmIcon,
  },
]

export function LandingContent() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_oklch(0.45_0.08_75_/_0.25),_transparent_55%)]" />
        <div className="grain absolute inset-0 opacity-40" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:py-28">
          <div>
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs tracking-wide text-primary">
              1 credit · 1 video ad
            </p>
            <h1 className="font-heading text-5xl leading-[0.95] tracking-tight text-balance sm:text-6xl lg:text-7xl">
              Stills that{" "}
              <span className="text-gold">sell.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground text-pretty">
              Lumina turns a product photo into a 15–30 second ad: script, voice,
              and picture, composited into a vertical MP4 you can run the same day.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="/signup"
                className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground"
              >
                Make an ad
              </a>
              <a
                href="#how"
                className="inline-flex h-11 items-center justify-center rounded-lg border border-border px-5 text-sm font-medium"
              >
                See the pipeline
              </a>
            </div>
            <p className="mt-6 text-xs text-muted-foreground">
              Demo mode runs locally without API keys. Plug in Claude, Runway,
              ElevenLabs, and Stripe when you are ready.
            </p>
          </div>
          <HeroFrame />
        </div>
      </section>

      <section id="how" className="border-t border-white/5 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <p className="text-xs tracking-[0.2em] text-primary uppercase">Pipeline</p>
          <h2 className="mt-3 font-heading text-4xl tracking-tight">
            Four steps. One credit.
          </h2>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, index) => (
              <div
                key={step.title}
                className="rounded-xl border border-white/8 bg-card/60 p-5"
              >
                <step.icon className="size-5 text-primary" />
                <p className="mt-4 text-xs text-muted-foreground">0{index + 1}</p>
                <h3 className="mt-1 font-heading text-xl">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="styles" className="border-t border-white/5 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <p className="text-xs tracking-[0.2em] text-primary uppercase">Looks</p>
          <h2 className="mt-3 font-heading text-4xl tracking-tight">
            Five treatments. Same product.
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {AD_STYLES.map((style) => (
              <div
                key={style}
                className="aspect-[3/4] rounded-xl border border-white/8 bg-gradient-to-b from-white/8 to-transparent p-5"
              >
                <p className="font-heading text-2xl">{STYLE_META[style].label}</p>
                <p className="mt-3 text-sm text-muted-foreground">
                  {STYLE_META[style].description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}

function HeroFrame() {
  return (
    <div className="relative mx-auto w-full max-w-sm">
      <div className="absolute -inset-6 rounded-[2rem] bg-primary/10 blur-2xl" />
      <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#1a1612] shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 text-[11px] tracking-wide text-white/50">
          <span>LUMINA · 9:16</span>
          <span>00:18</span>
        </div>
        <div className="relative mx-4 mb-4 aspect-[9/16] overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_50%_30%,_#c4a574,_#2a2118_58%,_#120e0a)]">
          <div className="absolute inset-x-8 top-[18%] h-[48%] rounded-[40%] bg-gradient-to-b from-[#f2e2c4] to-[#8a6a3a] opacity-90" />
          <div className="absolute inset-x-16 top-[14%] h-[12%] rounded-full bg-[#f7efe0]" />
          <p className="absolute inset-x-0 top-8 text-center text-[11px] tracking-[0.25em] text-white/80">
            AURUM
          </p>
          <div className="absolute inset-x-6 bottom-10 rounded-lg bg-black/35 px-3 py-2 text-center text-sm text-white backdrop-blur-sm">
            Quiet things tend to last.
          </div>
        </div>
      </div>
    </div>
  )
}

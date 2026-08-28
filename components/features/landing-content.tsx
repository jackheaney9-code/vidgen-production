import Link from "next/link"
import {
  ArrowDownIcon,
  ArrowRightIcon,
  ImageIcon,
  PenLineIcon,
  SparklesIcon,
} from "lucide-react"

import { LandingFaq } from "@/components/features/landing-faq"
import { PricingCards } from "@/components/features/pricing-cards"
import { Reveal } from "@/components/features/reveal"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const STEPS = [
  {
    title: "Upload your product photo",
    body: "A clean still is enough. JPG, PNG, or WebP — the bottle, the jar, the thing you sell.",
    icon: ImageIcon,
  },
  {
    title: "AI writes your script",
    body: "Review the hook, body, and CTA. Edit every line before a credit is spent.",
    icon: PenLineIcon,
  },
  {
    title: "Get your video ad in 60 seconds",
    body: "Picture, voice, and composite land as a vertical MP4 you can post the same hour.",
    icon: SparklesIcon,
  },
] as const

export function LandingContent({ signedIn }: { signedIn: boolean }) {
  const ctaHref = signedIn ? "/create" : "/login"
  const ctaLabel = signedIn ? "Create your next ad" : "Try Free — 3 credits included"

  return (
    <>
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_oklch(0.55_0.14_82_/_0.28),_transparent_58%)]" />
        <div className="pointer-events-none absolute -top-24 right-[-10%] size-[28rem] rounded-full bg-primary/15 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-[-8%] size-[22rem] rounded-full bg-[oklch(0.5_0.08_55_/_0.2)] blur-3xl" />
        <div className="grain absolute inset-0 opacity-35" />
        <div className="relative mx-auto max-w-6xl px-4 py-16 lg:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs tracking-wide text-primary">
              3 free videos on signup · no subscription
            </p>
            <h1 className="font-heading text-4xl leading-[1.02] tracking-tight text-balance sm:text-5xl lg:text-6xl">
              Turn any product photo into a{" "}
              <span className="text-gold">scroll-stopping video ad.</span> In 60
              seconds.
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground text-pretty">
              No filming. No editing. No agency. Just upload and go.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href={ctaHref}
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "h-11 px-6 text-sm shadow-[0_0_40px_oklch(0.84_0.12_82_/_0.35)]",
                )}
              >
                {ctaLabel}
              </Link>
              <Link
                href="#how"
                className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11 px-6")}
              >
                How it works
              </Link>
            </div>
          </div>

          <div className="mt-14 grid items-center gap-4 sm:grid-cols-[1fr_auto_1fr] sm:gap-6">
            <HeroStill />
            <div className="flex justify-center">
              <span className="flex size-10 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
                <ArrowDownIcon className="size-4 sm:hidden" />
                <ArrowRightIcon className="hidden size-4 sm:block" />
                <span className="sr-only">becomes</span>
              </span>
            </div>
            <HeroVideo />
          </div>
        </div>
      </section>

      <section id="how" className="border-t border-white/5 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <Reveal>
            <p className="text-xs tracking-[0.2em] text-primary uppercase">How it works</p>
            <h2 className="mt-3 max-w-xl font-heading text-4xl tracking-tight">
              Three steps. One credit. A finished ad.
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <Reveal key={step.title} delay={index * 90}>
                <div className="relative h-full overflow-hidden rounded-2xl border border-white/8 bg-card/70 p-6">
                  <div className="absolute -top-10 right-0 size-28 rounded-full bg-primary/10 blur-2xl" />
                  <div className="flex size-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
                    <step.icon className="size-5" />
                  </div>
                  <p className="mt-5 text-xs tracking-[0.2em] text-muted-foreground">
                    0{index + 1}
                  </p>
                  <h3 className="mt-2 font-heading text-2xl">{step.title}</h3>
                  <p className="mt-3 text-sm text-muted-foreground text-pretty">{step.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="border-t border-white/5 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <Reveal>
            <p className="text-xs tracking-[0.2em] text-primary uppercase">Pricing</p>
            <h2 className="mt-3 font-heading text-4xl tracking-tight">
              Pay per video. Nothing on a loop.
            </h2>
            <p className="mt-3 max-w-lg text-muted-foreground">
              One credit makes one finished ad. Buy a pack when you need more cuts.
            </p>
          </Reveal>
          <Reveal delay={70} className="mt-8">
            <div className="rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/15 via-primary/5 to-transparent px-5 py-4 text-center sm:text-left">
              <p className="font-heading text-xl text-primary">3 free videos on signup</p>
              <p className="mt-1 text-sm text-muted-foreground">
                New studios start with 3 credits. No card. No trial that turns into a plan.
              </p>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <PricingCards signedIn={signedIn} />
          </Reveal>
        </div>
      </section>

      <LandingFaq />

      <section className="border-t border-white/5 py-20">
        <Reveal>
          <div className="relative mx-auto max-w-4xl overflow-hidden rounded-3xl border border-white/8 px-6 py-14 text-center">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_oklch(0.7_0.12_82_/_0.18),_transparent_65%)]" />
            <p className="relative font-heading text-4xl tracking-tight text-balance">
              Your next ad is a still away.
            </p>
            <p className="relative mx-auto mt-3 max-w-md text-muted-foreground">
              Upload a photo. Approve the script. Post a vertical MP4.
            </p>
            <Link
              href={ctaHref}
              className={cn(buttonVariants({ size: "lg" }), "relative mt-8 h-11 px-6")}
            >
              {ctaLabel}
            </Link>
          </div>
        </Reveal>
      </section>
    </>
  )
}

function HeroStill() {
  return (
    <figure className="mx-auto w-full max-w-[280px]">
      <p className="mb-3 text-center text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
        Your photo
      </p>
      <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-card shadow-[0_30px_80px_oklch(0.1_0.02_55_/_0.55)]">
        <div className="flex items-center justify-between px-4 py-3 text-[11px] text-white/40">
          <span>STILL</span>
          <span>PNG</span>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/samples/serum.png"
          alt="Product still of a serum bottle"
          className="aspect-[9/16] w-full object-cover"
        />
      </div>
    </figure>
  )
}

function HeroVideo() {
  return (
    <figure className="mx-auto w-full max-w-[280px]">
      <p className="mb-3 text-center text-[11px] tracking-[0.22em] text-primary uppercase">
        Your ad
      </p>
      <div className="hero-float relative overflow-hidden rounded-[1.75rem] border border-primary/25 bg-card shadow-[0_30px_90px_oklch(0.55_0.12_82_/_0.28)]">
        <div className="flex items-center justify-between px-4 py-3 text-[11px] text-white/50">
          <span>LUMINA · 9:16</span>
          <span>00:15</span>
        </div>
        <div className="relative">
          <video
            className="aspect-[9/16] w-full object-cover"
            src="/samples/hero-ad.mp4"
            poster="/samples/serum.png"
            autoPlay
            muted
            loop
            playsInline
          />
          <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/50 to-transparent px-4 pt-4 pb-10">
            <p className="text-center text-sm font-medium text-white">Look closer.</p>
          </div>
          <div className="pointer-events-none absolute inset-x-4 bottom-5 rounded-lg bg-black/45 px-3 py-2 text-center text-xs text-white backdrop-blur-sm">
            See it in motion.
          </div>
        </div>
      </div>
    </figure>
  )
}

"use client"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Reveal } from "@/components/features/reveal"

const FAQS = [
  {
    q: "What video formats do you support?",
    a: "Every ad ships as a vertical 9:16 MP4, ready for Reels, TikTok, and Shorts. 16:9 landscape is coming soon.",
  },
  {
    q: "How long are the videos?",
    a: "You choose 15 or 30 seconds when you write the brief. The voiceover and picture are cut to that length.",
  },
  {
    q: "Can I edit the script?",
    a: "Yes. Claude drafts the hook, body, and CTA. You review and edit before a credit is spent on generation.",
  },
  {
    q: "What if I don't like the result?",
    a: "Regenerate for free within 24 hours. After that, each new finished video uses one credit.",
  },
  {
    q: "Do I need a subscription?",
    a: "No. Buy credits when you need them — one credit, one video. Nothing renews.",
  },
] as const

export function LandingFaq() {
  return (
    <section id="faq" className="border-t border-white/5 py-20">
      <div className="mx-auto max-w-3xl px-4">
        <Reveal>
          <p className="text-xs tracking-[0.2em] text-primary uppercase">FAQ</p>
          <h2 className="mt-3 font-heading text-4xl tracking-tight">
            Before you upload.
          </h2>
        </Reveal>
        <Reveal delay={80} className="mt-8">
          <Accordion className="rounded-2xl border border-white/8 bg-card/70 px-4">
            {FAQS.map((item) => (
              <AccordionItem key={item.q} value={item.q}>
                <AccordionTrigger className="py-4 text-base hover:no-underline">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </section>
  )
}

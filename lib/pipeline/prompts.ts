import type { AdStyle } from "@/types";

export function buildScriptPrompt(input: {
  productName: string;
  productDescription: string;
  audience: string;
  style: AdStyle;
}): string {
  return `You write 15–30 second video ad scripts for social (Reels, TikTok, Shorts).

Product: ${input.productName}
What it is: ${input.productDescription}
Audience: ${input.audience}
Style: ${input.style}

Return ONLY valid JSON with this shape:
{
  "hook": "first 2 seconds, spoken",
  "body": "proof / benefit, spoken",
  "cta": "closing line, spoken",
  "fullText": "the complete voiceover as one paragraph the actor will read",
  "visualPrompt": "a detailed image-to-video prompt for Runway, describing camera, lighting, product motion, 9:16 vertical, no on-screen text",
  "onScreenText": ["3-6 short captions"],
  "durationSeconds": 18
}

Rules:
- durationSeconds between 15 and 30
- fullText is 45–75 words, speakable, no stage directions
- hook must earn the stop in under 2 seconds
- no hashtags, no emoji, no trademarked slogans
- visualPrompt must keep the uploaded product recognizable`;
}

export function mockScript(input: {
  productName: string;
  productDescription: string;
  audience: string;
  style: AdStyle;
}) {
  const name = input.productName;
  const audience = input.audience;
  const benefit = firstSentence(input.productDescription);

  const byStyle: Record<
    AdStyle,
    { hook: string; body: string; cta: string; visual: string }
  > = {
    showcase: {
      hook: `Look closer. This is ${name}.`,
      body: `${benefit} Built for ${audience.toLowerCase()} who notice the details.`,
      cta: `${name}. See it in motion.`,
      visual: `Showcase 9:16 studio commercial of ${name}, slow camera orbit, crisp rim light, seamless backdrop, product hero, commercial grade`,
    },
    lifestyle: {
      hook: `This is what the morning looks like now.`,
      body: `${name}. ${benefit} For ${audience.toLowerCase()} who want it in the real world, not a lightbox.`,
      cta: `Bring ${name} home.`,
      visual: `Lifestyle 9:16 of ${name} in a lived-in apartment, natural window light, hands using the product, warm documentary commercial`,
    },
    before_after: {
      hook: `You already know the before.`,
      body: `After ${name}: ${benefit} That's the difference ${audience.toLowerCase()} feel.`,
      cta: `Start the after. Get ${name}.`,
      visual: `Before-and-after 9:16 commercial of ${name}, split energy from dull to radiant, then hold on the product, clean social ad`,
    },
  };

  const copy = byStyle[input.style];
  const fullText = `${copy.hook} ${copy.body} ${copy.cta}`;

  return {
    hook: copy.hook,
    body: copy.body,
    cta: copy.cta,
    fullText,
    visualPrompt: copy.visual,
    onScreenText: [copy.hook, name, copy.cta],
    durationSeconds: 18,
  };
}

function firstSentence(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^[^.?!]+[.?!]?/);
  const sentence = match?.[0] ?? trimmed;
  return sentence.endsWith(".") ? sentence : `${sentence}.`;
}

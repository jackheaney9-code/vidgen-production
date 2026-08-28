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
    cinematic: {
      hook: `You already know what ${audience.toLowerCase()} want. They just haven't seen it like this.`,
      body: `${name}. ${benefit} One frame. One feeling. Then they tap through.`,
      cta: `Meet ${name}. The version they replay.`,
      visual: `Cinematic 9:16 commercial of ${name}, slow camera push-in, volumetric light, shallow depth of field, film grain, luxury tabletop, the product slowly rotating, dark moody atmosphere`,
    },
    ugc: {
      hook: `Okay wait — I actually use this.`,
      body: `${name} is ${benefit} If you're ${audience.toLowerCase()}, this is the one I'd send you.`,
      cta: `Grab ${name} before I gatekeep it.`,
      visual: `Handheld UGC 9:16 of ${name} on a real desk, natural window light, creator hands showing the product, slight camera sway, authentic social video`,
    },
    luxury: {
      hook: `Quiet things tend to last.`,
      body: `${name}. ${benefit} Made for ${audience.toLowerCase()} who don't need to announce it.`,
      cta: `${name}. Yours, if you want it.`,
      visual: `Editorial luxury 9:16 still-life of ${name}, black marble, gold rim light, slow crane down, museum lighting, ultra sharp product photography in motion`,
    },
    energetic: {
      hook: `Stop scrolling. This is the product.`,
      body: `${name} — ${benefit} Built for ${audience.toLowerCase()} who move fast.`,
      cta: `Get ${name}. Don't overthink it.`,
      visual: `High-energy 9:16 product hero of ${name}, snap zooms, bold lighting, dynamic camera orbit, commercial sports energy, crisp highlights`,
    },
    minimal: {
      hook: `One product. One job.`,
      body: `${name}. ${benefit}`,
      cta: `${name}. That's it.`,
      visual: `Minimal 9:16 studio shot of ${name} on a seamless backdrop, slow dolly, soft shadow, lots of negative space, quiet premium commercial`,
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

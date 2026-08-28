import type { AdStyle } from "@/types";
import type { ScriptInput } from "@/types/pipeline";
import { formatScriptText, visualPromptFor } from "@/lib/pipeline/script-format";

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

export function mockScriptText(input: ScriptInput): string {
  const copy = mockCopy(input);
  return formatScriptText(copy);
}

export function mockScript(input: {
  productName: string;
  productDescription: string;
  audience: string;
  style: AdStyle;
  duration?: 15 | 30;
}) {
  const duration = input.duration === 30 ? 30 : 15;
  const copy = mockCopy({
    productName: input.productName,
    productDescription: input.productDescription,
    targetAudience: input.audience,
    style: input.style,
    duration,
  });
  const fullText = `${copy.hook} ${copy.body} ${copy.cta}`;
  return {
    hook: copy.hook,
    body: copy.body,
    cta: copy.cta,
    fullText,
    visualPrompt: visualPromptFor(input.productName, input.style),
    onScreenText: [copy.hook, input.productName, copy.cta],
    durationSeconds: duration,
  };
}

function mockCopy(input: ScriptInput) {
  const name = input.productName;
  const audience = input.targetAudience;
  const benefit = firstSentence(input.productDescription);
  const extra =
    input.duration === 30
      ? ` Give it a week. You'll feel the difference ${audience.toLowerCase()} talk about.`
      : "";

  const byStyle: Record<
    AdStyle,
    { hook: string; body: string; cta: string }
  > = {
    showcase: {
      hook: `Look closer. This is ${name}.`,
      body: `${benefit} Built for ${audience.toLowerCase()} who notice the details.${extra}`,
      cta: `${name}. See it in motion.`,
    },
    lifestyle: {
      hook: `This is what the morning looks like now.`,
      body: `${name}. ${benefit} For ${audience.toLowerCase()} who want it in the real world, not a lightbox.${extra}`,
      cta: `Bring ${name} home.`,
    },
    before_after: {
      hook: `You already know the before.`,
      body: `After ${name}: ${benefit} That's the difference ${audience.toLowerCase()} feel.${extra}`,
      cta: `Start the after. Get ${name}.`,
    },
  };

  return byStyle[input.style];
}

function firstSentence(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^[^.?!]+[.?!]?/);
  const sentence = match?.[0] ?? trimmed;
  return sentence.endsWith(".") ? sentence : `${sentence}.`;
}

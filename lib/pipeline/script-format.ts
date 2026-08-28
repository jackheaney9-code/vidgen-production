import type { AdScript, AdStyle } from "@/types";
import type { ScriptInput } from "@/types/pipeline";

export function formatScriptText(script: Pick<AdScript, "hook" | "body" | "cta">): string {
  return [
    `HOOK (first 3 seconds): ${script.hook.trim()}`,
    "",
    `BODY (middle): ${script.body.trim()}`,
    "",
    `CTA (last 3 seconds): ${script.cta.trim()}`,
  ].join("\n");
}

export function parseGeneratedScript(
  text: string,
  input: Pick<ScriptInput, "productName" | "style" | "duration">,
): AdScript {
  const hook = matchSection(text, "HOOK") ?? firstLine(text);
  const body = matchSection(text, "BODY") ?? remainderAfter(text, hook);
  const cta = matchSection(text, "CTA") ?? "Get it now.";
  const fullText = [hook, body, cta].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();

  return {
    hook,
    body,
    cta,
    fullText,
    visualPrompt: visualPromptFor(input.productName, input.style),
    onScreenText: [truncate(hook, 42), input.productName, truncate(cta, 42)],
    durationSeconds: input.duration,
  };
}

export function visualPromptFor(productName: string, style: AdStyle): string {
  if (style === "lifestyle") {
    return `Lifestyle 9:16 of ${productName} in a lived-in apartment, natural window light, hands using the product, warm documentary commercial, no on-screen text`;
  }
  if (style === "before_after") {
    return `Before-and-after 9:16 commercial of ${productName}, split energy from dull to radiant, then hold on the product, clean social ad, no on-screen text`;
  }
  return `Product showcase 9:16 studio commercial of ${productName}, slow camera orbit, crisp rim light, seamless backdrop, product hero, commercial grade, no on-screen text`;
}

function matchSection(text: string, label: "HOOK" | "BODY" | "CTA"): string | null {
  const pattern =
    label === "HOOK"
      ? /HOOK[^\n]*:\s*([\s\S]*?)(?=\n\s*BODY|\n\s*CTA|$)/i
      : label === "BODY"
        ? /BODY[^\n]*:\s*([\s\S]*?)(?=\n\s*CTA|$)/i
        : /CTA[^\n]*:\s*([\s\S]*)$/i;
  const match = text.match(pattern);
  const value = match?.[1]?.trim();
  return value && value.length > 0 ? collapse(value) : null;
}

function firstLine(text: string): string {
  const line = text.split("\n").map((item) => item.trim()).find((item) => item.length > 0);
  return collapse(line ?? text).slice(0, 160);
}

function remainderAfter(text: string, hook: string): string {
  const index = text.indexOf(hook);
  const rest = index >= 0 ? text.slice(index + hook.length) : text;
  return collapse(rest) || hook;
}

function collapse(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function truncate(value: string, max: number): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max - 1)}…`;
}

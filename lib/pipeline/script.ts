import Anthropic from "@anthropic-ai/sdk";

import { getAnthropicModel, getEnv, hasAnthropic } from "@/lib/env";
import {
  formatScriptText,
  parseGeneratedScript,
} from "@/lib/pipeline/script-format";
import { mockScriptText } from "@/lib/pipeline/prompts";
import type { AdScript, AdStyle } from "@/types";
import type { ScriptInput } from "@/types/pipeline";

export type { ScriptInput };

export async function generateScript(input: ScriptInput): Promise<string> {
  if (!hasAnthropic()) {
    return mockScriptText(input);
  }

  const apiKey = getEnv("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return mockScriptText(input);
  }

  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: getAnthropicModel(),
    max_tokens: 800,
    system: buildSystemPrompt(input),
    messages: [
      {
        role: "user",
        content: buildUserPrompt(input),
      },
    ],
  });

  const text = message.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("\n")
    .trim();

  if (!text) {
    throw new Error("Claude returned an empty script.");
  }
  return text;
}

export async function generateAdScript(input: {
  productName: string;
  productDescription: string;
  audience: string;
  style: AdStyle;
  duration?: 15 | 30;
}): Promise<AdScript> {
  const scriptInput: ScriptInput = {
    productName: input.productName,
    productDescription: input.productDescription,
    targetAudience: input.audience,
    style: input.style,
    duration: input.duration === 30 ? 30 : 15,
  };
  const text = await generateScript(scriptInput);
  return parseGeneratedScript(text, scriptInput);
}

export function scriptFromGeneratedText(
  text: string,
  input: ScriptInput,
): AdScript {
  return parseGeneratedScript(text, input);
}

export function formattedScript(script: AdScript): string {
  return formatScriptText(script);
}

function buildSystemPrompt(input: ScriptInput): string {
  return `You are an expert direct-response copywriter for video ads. Write a ${input.duration}-second video ad script for the product below. Format:

HOOK (first 3 seconds): A pattern-interrupt opening line that stops the scroll.
BODY (middle): 1-2 key benefits, spoken naturally like a real person.
CTA (last 3 seconds): Clear call to action.

Rules: Use short sentences. Conversational tone. No corporate speak. Write for ${input.targetAudience}. Style: ${input.style}.`;
}

function buildUserPrompt(input: ScriptInput): string {
  return `Product name: ${input.productName}
Product description: ${input.productDescription}
Target audience: ${input.targetAudience}
Style: ${input.style}
Duration: ${input.duration} seconds

Write the script now. Output only HOOK, BODY, and CTA in the format specified. No preamble.`;
}

import Anthropic from "@anthropic-ai/sdk";

import { getAnthropicModel, getEnv, hasAnthropic } from "@/lib/env";
import { adScriptSchema } from "@/lib/db/schema";
import { buildScriptPrompt, mockScript } from "@/lib/pipeline/prompts";
import type { AdScript, AdStyle } from "@/types";

const claudeJsonSchema = adScriptSchema;

export async function generateAdScript(input: {
  productName: string;
  productDescription: string;
  audience: string;
  style: AdStyle;
}): Promise<AdScript> {
  if (!hasAnthropic()) {
    return mockScript(input);
  }

  const apiKey = getEnv("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return mockScript(input);
  }

  const client = new Anthropic({ apiKey });
  const prompt = buildScriptPrompt(input);
  const message = await client.messages.create({
    model: getAnthropicModel(),
    max_tokens: 1200,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("\n")
    .trim();

  const jsonText = extractJson(text);
  const parsed: unknown = JSON.parse(jsonText);
  const result = claudeJsonSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error("Claude returned a script we could not parse.");
  }
  return result.data;
}

function extractJson(text: string): string {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return text.slice(start, end + 1);
  }
  throw new Error("No JSON object in model response");
}

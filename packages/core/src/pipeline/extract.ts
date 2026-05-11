import { generateText } from "ai";
import { z } from "zod";
import { getModel } from "../lib/llm";
import type { PipelineState } from "./types";

const ExtractSchema = z.object({
  present: z.array(z.string()),
  gaps: z.array(z.string()),
});

function stripFences(text: string): string {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return match ? match[1]!.trim() : text.trim();
}

export async function extract(
  idea: string,
): Promise<PipelineState["extracted"]> {
  const { text } = await generateText({
    model: getModel(),
    maxOutputTokens: 1024,
    system: `Analyse project ideas and identify what information is present and what is missing.
Return JSON: { "present": string[], "gaps": string[] }
"gaps" must only include things that genuinely affect the generated workspace — stack choices, auth requirements, deployment target, scaling needs. Omit anything that can be inferred or defaulted.`,
    messages: [{ role: "user", content: idea }],
  });

  return ExtractSchema.parse(JSON.parse(stripFences(text)));
}

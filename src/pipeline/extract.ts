import { generateText } from "ai";
import { getModel } from "../lib/llm";
import type { PipelineState } from "./types";

export async function extract(
  idea: string,
): Promise<PipelineState["extracted"]> {
  const { text } = await generateText({
    model: getModel(),
    maxOutputTokens: 1024,
    prompt: `Analyse this project idea and identify what information is present and what is missing.

Idea: ${idea}

Respond with JSON in this exact shape:
{
  "present": ["things we already know from the idea"],
  "gaps": ["things we need to ask about before generating a workspace"]
}

Be specific. "gaps" should only include things that genuinely affect the generated workspace — stack choices, auth requirements, deployment target, etc. Don't ask about things that can be inferred or defaulted.`,
  });

  return JSON.parse(text);
}

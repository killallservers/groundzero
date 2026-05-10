import { generateText } from "ai";
import { getModel } from "../lib/llm";
import type { PipelineState } from "./types";

export async function generate(
  state: PipelineState,
): Promise<Record<string, string>> {
  const { text } = await generateText({
    model: getModel(),
    maxOutputTokens: 8192,
    prompt: `Generate a Claude Code workspace for this project based on the spec below.

Spec:
${state.spec}

Produce a JSON object where keys are file paths and values are file contents. Include at minimum:
- docs/llm.md (filled in, not placeholder)
- docs/architecture.md
- docs/constraints.md
- docs/decisions.md
- docs/context.md
- docs/testing.md
- docs/deployment.md

Return only the JSON object, no other text.`,
  });

  return JSON.parse(text);
}

import { generateText } from "ai";
import { getModel } from "../lib/llm";
import type { PipelineState } from "./types";

export async function draft(state: PipelineState): Promise<string> {
  const docsContext = state.resolved?.packages
    .filter((p) => p.llmsTxt)
    .map((p) => `## ${p.name} (${p.version})\n${p.llmsTxt}`)
    .join("\n\n");

  const { text } = await generateText({
    model: getModel(),
    maxOutputTokens: 4096,
    system: docsContext
      ? `You have access to current documentation for the packages in this project:\n\n${docsContext}`
      : undefined,
    prompt: `Write a project spec (docs/spec.md) for this project.

Idea: ${state.idea}

What we know:
${state.extracted?.present.map((p) => `- ${p}`).join("\n")}

Decisions made:
${Object.entries(state.answers ?? {})
  .map(([q, a]) => `- ${q}: ${a}`)
  .join("\n")}

The spec should cover: problem statement, goals, non-goals, technical design, and acceptance criteria. Write it in markdown.`,
  });

  return text;
}

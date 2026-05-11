import { generateText } from "ai";
import { getModel } from "../lib/llm";
import type { PipelineState } from "./types";

export async function draft(state: PipelineState): Promise<string> {
  const packageDocs = state.resolved?.packages
    .filter((p) => p.llmsTxt)
    .map((p) => `## ${p.name} (${p.version})\n${p.llmsTxt}`)
    .join("\n\n");

  const customDocs = state.customDocs
    ?.map((d) => `## ${d.url}\n${d.content}`)
    .join("\n\n");

  const docsContext = [packageDocs, customDocs].filter(Boolean).join("\n\n") || undefined;

  const decisions = Object.entries(state.answers ?? {})
    .map(([q, a]) => `- ${q}: ${a}`)
    .join("\n");

  const known = state.extracted?.present.map((p) => `- ${p}`).join("\n") ?? "";

  const { text } = await generateText({
    model: getModel(),
    maxOutputTokens: 4096,
    system: docsContext
      ? `You are writing project specs for software projects. You have access to current documentation for the packages in this project:\n\n${docsContext}`
      : "You are writing project specs for software projects.",
    messages: [
      {
        role: "user",
        content: `Write a project spec (docs/spec.md) for this project.

Project idea:
${state.idea}

What we know:
${known}

Decisions made:
${decisions}

The spec should cover: problem statement, goals, non-goals, technical design, and acceptance criteria. Write it in markdown.`,
      },
    ],
  });

  return text;
}

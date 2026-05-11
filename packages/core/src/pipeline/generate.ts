import { generateText } from "ai";
import { getModel } from "../lib/llm";
import type { PipelineState } from "./types";

const WORKSPACE_FILES = [
  "docs/llm.md",
  "docs/architecture.md",
  "docs/constraints.md",
  "docs/decisions.md",
  "docs/context.md",
  "docs/testing.md",
  "docs/deployment.md",
];

function stripFences(text: string): string {
  const match = text.match(/^```(?:\w+)?\s*([\s\S]*?)```\s*$/m);
  return match ? match[1]!.trim() : text.trim();
}

export async function generate(
  state: PipelineState,
): Promise<Record<string, string>> {
  const files: Record<string, string> = {};

  const customDocsContext = state.customDocs
    ?.map((d) => `## ${d.url}\n${d.content}`)
    .join("\n\n");

  await Promise.all(
    WORKSPACE_FILES.map(async (filename) => {
      const { text } = await generateText({
        model: getModel(),
        maxOutputTokens: 16384,
        system: [
          "You are generating documentation files for a new software project workspace.",
          "Write clear, factual, project-specific content — no placeholder text.",
          "Return only the file content with no preamble.",
          customDocsContext
            ? `\nAdditional reference docs provided by the user:\n\n${customDocsContext}`
            : "",
        ]
          .filter(Boolean)
          .join("\n"),
        messages: [
          {
            role: "user",
            content: `Write ${filename} for this project.\n\nSpec:\n${state.spec}`,
          },
        ],
      });
      files[filename] = stripFences(text);
    }),
  );

  files["CLAUDE.md"] = "→ docs/llm.md";

  return files;
}

import Anthropic from "@anthropic-ai/sdk";
import type { PipelineState } from "./types";

const client = new Anthropic();

export async function draft(state: PipelineState): Promise<string> {
	const docsContext = state.resolved?.packages
		.filter((p) => p.llmsTxt)
		.map((p) => `## ${p.name} (${p.version})\n${p.llmsTxt}`)
		.join("\n\n");

	const message = await client.messages.create({
		model: "claude-opus-4-5",
		max_tokens: 4096,
		system: docsContext
			? `You have access to current documentation for the packages in this project:\n\n${docsContext}`
			: undefined,
		messages: [
			{
				role: "user",
				content: `Write a project spec (docs/spec.md) for this project.

Idea: ${state.idea}

What we know:
${state.extracted?.present.map((p) => `- ${p}`).join("\n")}

Decisions made:
${Object.entries(state.answers ?? {})
	.map(([q, a]) => `- ${q}: ${a}`)
	.join("\n")}

The spec should cover: problem statement, goals, non-goals, technical design, and acceptance criteria. Write it in markdown.`,
			},
		],
	});

	return message.content[0].type === "text" ? message.content[0].text : "";
}

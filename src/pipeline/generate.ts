import Anthropic from "@anthropic-ai/sdk";
import type { PipelineState } from "./types";

const client = new Anthropic();

export async function generate(
	state: PipelineState,
): Promise<Record<string, string>> {
	const message = await client.messages.create({
		model: "claude-opus-4-5",
		max_tokens: 8192,
		messages: [
			{
				role: "user",
				content: `Generate a Claude Code workspace for this project based on the spec below.

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
			},
		],
	});

	const text =
		message.content[0].type === "text" ? message.content[0].text : "{}";
	return JSON.parse(text);
}

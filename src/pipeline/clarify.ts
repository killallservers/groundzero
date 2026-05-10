import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function clarify(idea: string, gaps: string[]): Promise<string[]> {
	const message = await client.messages.create({
		model: "claude-opus-4-5",
		max_tokens: 1024,
		messages: [
			{
				role: "user",
				content: `You need to ask the minimum number of questions to fill these gaps before generating a project workspace.

Project idea: ${idea}

Gaps identified:
${gaps.map((g) => `- ${g}`).join("\n")}

Write the questions the user needs to answer. Be concise. One question per gap. Return a JSON array of question strings.`,
			},
		],
	});

	const text =
		message.content[0].type === "text" ? message.content[0].text : "[]";
	return JSON.parse(text);
}

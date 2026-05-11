import { generateText } from "ai";
import { getModel } from "../lib/llm";

export async function clarify(
	idea: string,
	gaps: string[],
	history: Record<string, string> = {},
): Promise<string | null> {
	const historyLines = Object.entries(history)
		.map(([q, a]) => `Q: ${q}\nA: ${a}`)
		.join("\n\n");

	const { text } = await generateText({
		model: getModel(),
		maxOutputTokens: 256,
		system: [
			"You are gathering information to fill gaps in a project idea before generating a workspace.",
			"Given the project idea, its gaps, and any previous Q&A, decide what single question to ask next.",
			'Return the question as plain text, or return exactly "DONE" if you have enough information.',
			"Ask at most 5 questions total. Never repeat a question already asked.",
		].join("\n"),
		messages: [
			{
				role: "user",
				content: [
					`Project: ${idea}`,
					`\nGaps:\n${gaps.map((g) => `- ${g}`).join("\n")}`,
					historyLines ? `\nPrevious Q&A:\n${historyLines}` : "",
				]
					.filter(Boolean)
					.join("\n"),
			},
		],
	});

	const trimmed = text.trim();
	return trimmed === "DONE" ? null : trimmed;
}

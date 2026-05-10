import { generateText } from "ai";
import { getModel } from "../lib/llm";

export async function clarify(idea: string, gaps: string[]): Promise<string[]> {
  const { text } = await generateText({
    model: getModel(),
    maxOutputTokens: 1024,
    prompt: `You need to ask the minimum number of questions to fill these gaps before generating a project workspace.

Project idea: ${idea}

Gaps identified:
${gaps.map((g) => `- ${g}`).join("\n")}

Write the questions the user needs to answer. Be concise. One question per gap. Return a JSON array of question strings.`,
  });

  return JSON.parse(text);
}

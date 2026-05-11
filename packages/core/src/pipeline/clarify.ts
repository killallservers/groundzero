import { generateText } from "ai";
import { z } from "zod";
import { getModel } from "../lib/llm";

const ClarifySchema = z.array(z.string());

function stripFences(text: string): string {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return match ? match[1]!.trim() : text.trim();
}

export async function clarify(idea: string, gaps: string[]): Promise<string[]> {
  const { text } = await generateText({
    model: getModel(),
    maxOutputTokens: 1024,
    system: `Generate the minimum set of questions needed to fill identified gaps before generating a project workspace.
One question per gap. Questions should be concise and specific.
Return a JSON array of question strings.`,
    messages: [
      {
        role: "user",
        content: `Project idea: ${idea}\n\nGaps to fill:\n${gaps.map((g) => `- ${g}`).join("\n")}`,
      },
    ],
  });

  return ClarifySchema.parse(JSON.parse(stripFences(text)));
}

import { beforeEach, describe, expect, mock, test } from "bun:test";

const mockGenerateText = mock(async (_opts: unknown) => ({
  text: "# Spec\n\n## Problem\n\nA todo app.",
}));

mock.module("ai", () => ({ generateText: mockGenerateText }));

const { draft } = await import("./draft.ts");

type DraftOpts = {
  system?: string;
  messages?: Array<{ role: string; content: string }>;
  maxOutputTokens?: number;
};

function getOpts(): DraftOpts {
  return mockGenerateText.mock.calls[0]?.[0] as DraftOpts;
}

describe("draft", () => {
  beforeEach(() => mockGenerateText.mockClear());

  test("returns spec text from the LLM", async () => {
    const result = await draft({ idea: "a todo app" });
    expect(result).toBe("# Spec\n\n## Problem\n\nA todo app.");
  });

  test("includes idea in the user message", async () => {
    await draft({ idea: "a blog platform with RSS" });
    expect(getOpts().messages?.[0]?.content).toContain(
      "a blog platform with RSS",
    );
  });

  test("includes present items from extracted in the user message", async () => {
    await draft({
      idea: "app",
      extracted: { present: ["React frontend", "Postgres DB"], gaps: [] },
    });
    const content = getOpts().messages?.[0]?.content ?? "";
    expect(content).toContain("React frontend");
    expect(content).toContain("Postgres DB");
  });

  test("includes Q&A answers in the user message", async () => {
    await draft({
      idea: "app",
      answers: { "Which auth provider?": "Better Auth" },
    });
    const content = getOpts().messages?.[0]?.content ?? "";
    expect(content).toContain("Which auth provider?");
    expect(content).toContain("Better Auth");
  });

  test("sets llmsTxt packages as system context", async () => {
    await draft({
      idea: "app",
      resolved: {
        packages: [{ name: "hono", version: "4.0.0", llmsTxt: "# Hono docs" }],
      },
    });
    expect(getOpts().system).toContain("# Hono docs");
    expect(getOpts().system).toContain("hono");
  });

  test("always sets a system prompt", async () => {
    await draft({ idea: "app" });
    expect(getOpts().system).toBeDefined();
  });

  test("limits output to 4096 tokens", async () => {
    await draft({ idea: "app" });
    expect(getOpts().maxOutputTokens).toBe(4096);
  });
});

import { beforeEach, describe, expect, mock, test } from "bun:test";

const mockGenerateText = mock(async (_opts: unknown) => ({
  text: "# Spec\n\n## Problem\n\nA todo app.",
}));

mock.module("ai", () => ({ generateText: mockGenerateText }));

const { draft } = await import("./draft.ts");

describe("draft", () => {
  beforeEach(() => mockGenerateText.mockClear());

  test("returns spec text from the LLM", async () => {
    const result = await draft({ idea: "a todo app" });
    expect(result).toBe("# Spec\n\n## Problem\n\nA todo app.");
  });

  test("includes idea in the prompt", async () => {
    await draft({ idea: "a blog platform with RSS" });
    const opts = mockGenerateText.mock.calls[0]?.[0] as { prompt: string };
    expect(opts.prompt).toContain("a blog platform with RSS");
  });

  test("includes present items from extracted in the prompt", async () => {
    await draft({
      idea: "app",
      extracted: { present: ["React frontend", "Postgres DB"], gaps: [] },
    });
    const opts = mockGenerateText.mock.calls[0]?.[0] as { prompt: string };
    expect(opts.prompt).toContain("React frontend");
    expect(opts.prompt).toContain("Postgres DB");
  });

  test("includes Q&A answers in the prompt", async () => {
    await draft({
      idea: "app",
      answers: { "Which auth provider?": "Better Auth" },
    });
    const opts = mockGenerateText.mock.calls[0]?.[0] as { prompt: string };
    expect(opts.prompt).toContain("Which auth provider?");
    expect(opts.prompt).toContain("Better Auth");
  });

  test("sets llmsTxt packages as system context", async () => {
    await draft({
      idea: "app",
      resolved: {
        packages: [{ name: "hono", version: "4.0.0", llmsTxt: "# Hono docs" }],
      },
    });
    const opts = mockGenerateText.mock.calls[0]?.[0] as { system?: string };
    expect(opts.system).toContain("# Hono docs");
    expect(opts.system).toContain("hono");
  });

  test("omits system context when no resolved packages", async () => {
    await draft({ idea: "app" });
    const opts = mockGenerateText.mock.calls[0]?.[0] as { system?: string };
    expect(opts.system).toBeUndefined();
  });

  test("limits output to 4096 tokens", async () => {
    await draft({ idea: "app" });
    const opts = mockGenerateText.mock.calls[0]?.[0] as {
      maxOutputTokens: number;
    };
    expect(opts.maxOutputTokens).toBe(4096);
  });
});

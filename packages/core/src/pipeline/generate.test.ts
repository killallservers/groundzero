import { beforeEach, describe, expect, mock, test } from "bun:test";

// generate() calls generateText once per file in parallel — return file-specific content
const mockGenerateText = mock(async (opts: unknown) => {
  const { messages } = opts as { messages: Array<{ content: string }> };
  const filename =
    messages?.[0]?.content?.match(/Write ([\w/.]+)/)?.[1] ?? "unknown";
  return { text: `# Content for ${filename}` };
});

mock.module("ai", () => ({ generateText: mockGenerateText }));

const { generate } = await import("./generate.ts");

describe("generate", () => {
  beforeEach(() => mockGenerateText.mockClear());

  test("returns a file tree with all 7 workspace docs plus CLAUDE.md", async () => {
    const result = await generate({ idea: "app", spec: "# Spec" });
    expect(Object.keys(result)).toContain("docs/llm.md");
    expect(Object.keys(result)).toContain("docs/architecture.md");
    expect(Object.keys(result)).toContain("docs/constraints.md");
    expect(Object.keys(result)).toContain("docs/decisions.md");
    expect(Object.keys(result)).toContain("docs/context.md");
    expect(Object.keys(result)).toContain("docs/testing.md");
    expect(Object.keys(result)).toContain("docs/deployment.md");
    expect(result["CLAUDE.md"]).toBe("→ docs/llm.md");
  });

  test("calls generateText once per file (7 parallel calls)", async () => {
    await generate({ idea: "app", spec: "# Spec" });
    expect(mockGenerateText).toHaveBeenCalledTimes(7);
  });

  test("includes spec in each file's user message", async () => {
    await generate({ idea: "app", spec: "# My Spec\n\nProject details" });
    const allContent = mockGenerateText.mock.calls
      .map((call) => {
        const opts = call[0] as { messages?: Array<{ content: string }> };
        return opts.messages?.[0]?.content ?? "";
      })
      .join(" ");
    expect(allContent).toContain("# My Spec");
  });

  test("limits output to 8192 tokens per file", async () => {
    await generate({ idea: "app", spec: "# Spec" });
    for (const call of mockGenerateText.mock.calls) {
      const opts = call[0] as { maxOutputTokens: number };
      expect(opts.maxOutputTokens).toBe(8192);
    }
  });

  test("strips markdown fences from file content", async () => {
    mockGenerateText.mockImplementation(async () => ({
      text: "```markdown\n# Actual content\n```",
    }));
    const result = await generate({ idea: "app", spec: "# Spec" });
    for (const [key, value] of Object.entries(result)) {
      if (key !== "CLAUDE.md") {
        expect(value).toBe("# Actual content");
      }
    }
  });
});

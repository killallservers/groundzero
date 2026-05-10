import { beforeEach, describe, expect, mock, test } from "bun:test";

const mockFiles = {
  "docs/llm.md": "# Project",
  "docs/architecture.md": "# Architecture",
  "docs/constraints.md": "# Constraints",
};

const mockGenerateText = mock(async (_opts: unknown) => ({
  text: JSON.stringify(mockFiles),
}));

mock.module("ai", () => ({ generateText: mockGenerateText }));

const { generate } = await import("./generate.ts");

describe("generate", () => {
  beforeEach(() => mockGenerateText.mockClear());

  test("returns parsed file tree from LLM response", async () => {
    const result = await generate({ idea: "app", spec: "# Spec" });
    expect(result).toEqual(mockFiles);
  });

  test("includes spec in the prompt", async () => {
    await generate({ idea: "app", spec: "# My Spec\n\nProject details" });
    const opts = mockGenerateText.mock.calls[0]?.[0] as { prompt: string };
    expect(opts.prompt).toContain("# My Spec");
    expect(opts.prompt).toContain("Project details");
  });

  test("throws when LLM returns invalid JSON", async () => {
    mockGenerateText.mockImplementationOnce(async () => ({
      text: "here are the files: ...",
    }));
    expect(generate({ idea: "app", spec: "spec" })).rejects.toThrow();
  });

  test("limits output to 8192 tokens", async () => {
    await generate({ idea: "app", spec: "# Spec" });
    const opts = mockGenerateText.mock.calls[0]?.[0] as {
      maxOutputTokens: number;
    };
    expect(opts.maxOutputTokens).toBe(8192);
  });

  test("returns empty object when LLM returns {}", async () => {
    mockGenerateText.mockImplementationOnce(async () => ({ text: "{}" }));
    const result = await generate({ idea: "app", spec: "spec" });
    expect(result).toEqual({});
  });
});

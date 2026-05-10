import { beforeEach, describe, expect, mock, test } from "bun:test";

const mockGenerateText = mock(async (_opts: unknown) => ({
  text: JSON.stringify({
    present: ["React frontend"],
    gaps: ["auth provider"],
  }),
}));

mock.module("ai", () => ({ generateText: mockGenerateText }));

const { extract } = await import("./extract.ts");

describe("extract", () => {
  beforeEach(() => mockGenerateText.mockClear());

  test("returns parsed present and gaps arrays", async () => {
    const result = await extract("a web app for todo lists");
    expect(result).toEqual({
      present: ["React frontend"],
      gaps: ["auth provider"],
    });
  });

  test("calls generateText with idea in the prompt", async () => {
    await extract("a CLI tool for git");
    expect(mockGenerateText).toHaveBeenCalledTimes(1);
    const opts = mockGenerateText.mock.calls[0]?.[0] as { prompt: string };
    expect(opts.prompt).toContain("a CLI tool for git");
  });

  test("limits output tokens to 1024", async () => {
    await extract("any idea");
    const opts = mockGenerateText.mock.calls[0]?.[0] as {
      maxOutputTokens: number;
    };
    expect(opts.maxOutputTokens).toBe(1024);
  });

  test("throws when LLM returns invalid JSON", async () => {
    mockGenerateText.mockImplementationOnce(async () => ({ text: "not json" }));
    expect(extract("broken")).rejects.toThrow();
  });

  test("returns empty arrays for minimal valid response", async () => {
    mockGenerateText.mockImplementationOnce(async () => ({
      text: JSON.stringify({ present: [], gaps: [] }),
    }));
    const result = await extract("very complete idea");
    expect(result).toEqual({ present: [], gaps: [] });
  });
});

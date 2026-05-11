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

  test("uses system/user message split — idea is in messages, not system", async () => {
    await extract("a CLI tool for git");
    expect(mockGenerateText).toHaveBeenCalledTimes(1);
    const opts = mockGenerateText.mock.calls[0]?.[0] as {
      system?: string;
      messages?: Array<{ role: string; content: string }>;
    };
    expect(opts.system).toBeDefined();
    expect(opts.messages?.[0]?.content).toContain("a CLI tool for git");
    expect(opts.system).not.toContain("a CLI tool for git");
  });

  test("strips markdown fences from LLM output", async () => {
    mockGenerateText.mockImplementationOnce(async () => ({
      text: '```json\n{"present":["Node"],"gaps":[]}\n```',
    }));
    const result = await extract("a node app");
    expect(result).toEqual({ present: ["Node"], gaps: [] });
  });

  test("throws when output fails Zod validation", async () => {
    mockGenerateText.mockImplementationOnce(async () => ({
      text: JSON.stringify({ present: "not an array", gaps: [] }),
    }));
    expect(extract("bad output")).rejects.toThrow();
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

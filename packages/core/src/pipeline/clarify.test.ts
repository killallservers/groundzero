import { beforeEach, describe, expect, mock, test } from "bun:test";

const mockGenerateText = mock(async (_opts: unknown) => ({
  text: JSON.stringify([
    "Which auth provider?",
    "What is the deployment target?",
  ]),
}));

mock.module("ai", () => ({ generateText: mockGenerateText }));

const { clarify } = await import("./clarify.ts");

describe("clarify", () => {
  beforeEach(() => mockGenerateText.mockClear());

  test("returns parsed array of questions", async () => {
    const result = await clarify("a todo app", ["auth", "deployment"]);
    expect(result).toEqual([
      "Which auth provider?",
      "What is the deployment target?",
    ]);
  });

  test("includes idea in the user message content", async () => {
    await clarify("a blog platform", ["database"]);
    const opts = mockGenerateText.mock.calls[0]?.[0] as {
      messages?: Array<{ role: string; content: string }>;
    };
    expect(opts.messages?.[0]?.content).toContain("a blog platform");
  });

  test("includes all gaps in the user message content", async () => {
    await clarify("app", ["auth strategy", "hosting target", "payment system"]);
    const opts = mockGenerateText.mock.calls[0]?.[0] as {
      messages?: Array<{ role: string; content: string }>;
    };
    expect(opts.messages?.[0]?.content).toContain("auth strategy");
    expect(opts.messages?.[0]?.content).toContain("hosting target");
    expect(opts.messages?.[0]?.content).toContain("payment system");
  });

  test("returns empty array when LLM returns []", async () => {
    mockGenerateText.mockImplementationOnce(async () => ({ text: "[]" }));
    const result = await clarify("simple script", []);
    expect(result).toEqual([]);
  });

  test("throws when LLM returns invalid JSON", async () => {
    mockGenerateText.mockImplementationOnce(async () => ({ text: "oops" }));
    expect(clarify("app", ["gap"])).rejects.toThrow();
  });

  test("limits output tokens to 1024", async () => {
    await clarify("app", ["gap"]);
    const opts = mockGenerateText.mock.calls[0]?.[0] as {
      maxOutputTokens: number;
    };
    expect(opts.maxOutputTokens).toBe(1024);
  });
});

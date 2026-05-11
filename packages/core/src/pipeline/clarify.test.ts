import { beforeEach, describe, expect, mock, test } from "bun:test";

const mockGenerateText = mock(async (_opts: unknown) => ({
	text: "Which auth provider do you plan to use?",
}));

mock.module("ai", () => ({ generateText: mockGenerateText }));

const { clarify } = await import("./clarify.ts");

describe("clarify", () => {
	beforeEach(() => mockGenerateText.mockClear());

	test("returns a question string when LLM asks a question", async () => {
		const result = await clarify("a todo app", ["auth", "deployment"]);
		expect(result).toBe("Which auth provider do you plan to use?");
	});

	test("returns null when LLM returns DONE", async () => {
		mockGenerateText.mockImplementationOnce(async () => ({ text: "DONE" }));
		const result = await clarify("a todo app", []);
		expect(result).toBeNull();
	});

	test("trims whitespace before checking DONE", async () => {
		mockGenerateText.mockImplementationOnce(async () => ({
			text: "  DONE  ",
		}));
		const result = await clarify("a todo app", []);
		expect(result).toBeNull();
	});

	test("includes idea in the user message", async () => {
		await clarify("a blog platform", ["database"]);
		const opts = mockGenerateText.mock.calls[0]?.[0] as {
			messages?: Array<{ role: string; content: string }>;
		};
		expect(opts.messages?.[0]?.content).toContain("a blog platform");
	});

	test("includes gaps in the user message", async () => {
		await clarify("app", ["auth strategy", "hosting target"]);
		const opts = mockGenerateText.mock.calls[0]?.[0] as {
			messages?: Array<{ role: string; content: string }>;
		};
		const content = opts.messages?.[0]?.content ?? "";
		expect(content).toContain("auth strategy");
		expect(content).toContain("hosting target");
	});

	test("includes previous Q&A history in the user message", async () => {
		await clarify("app", ["auth"], { "Which auth?": "OAuth via GitHub" });
		const opts = mockGenerateText.mock.calls[0]?.[0] as {
			messages?: Array<{ role: string; content: string }>;
		};
		const content = opts.messages?.[0]?.content ?? "";
		expect(content).toContain("Which auth?");
		expect(content).toContain("OAuth via GitHub");
	});

	test("omits history section when history is empty", async () => {
		await clarify("app", ["auth"], {});
		const opts = mockGenerateText.mock.calls[0]?.[0] as {
			messages?: Array<{ role: string; content: string }>;
		};
		const content = opts.messages?.[0]?.content ?? "";
		expect(content).not.toContain("Previous Q&A");
	});

	test("limits output tokens to 256", async () => {
		await clarify("app", ["gap"]);
		const opts = mockGenerateText.mock.calls[0]?.[0] as {
			maxOutputTokens: number;
		};
		expect(opts.maxOutputTokens).toBe(256);
	});
});

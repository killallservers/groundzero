import { expect, test } from "@playwright/test";

const SESSION_ID = "test-session-id";

function sse(...events: object[]): string {
	return events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("");
}

test.beforeEach(async ({ page }) => {
	await page.route("/api/sessions", async (route) => {
		if (route.request().method() === "POST") {
			await route.fulfill({ json: { sessionId: SESSION_ID } });
		} else {
			await route.continue();
		}
	});
});

// ─── No questions → straight to review ───────────────────────────────────────

test("no questions — goes straight from idea to review", async ({ page }) => {
	await page.route(`/api/sessions/${SESSION_ID}/stream`, async (route) => {
		await route.fulfill({
			status: 200,
			headers: { "Content-Type": "text/event-stream" },
			body: sse(
				{ type: "stage", stage: "extract" },
				{ type: "extract:done", present: ["React"], gaps: [] },
				{ type: "stage", stage: "clarify" },
				{ type: "clarify:done" },
			),
		});
	});

	await page.route(`/api/sessions/${SESSION_ID}/run`, async (route) => {
		await route.fulfill({
			status: 200,
			headers: { "Content-Type": "text/event-stream" },
			body: sse(
				{ type: "stage", stage: "resolve" },
				{ type: "resolve:done", packages: [] },
				{ type: "stage", stage: "draft" },
				{ type: "draft:done", spec: "# Spec\n\nA simple todo app." },
				{ type: "review:ready" },
			),
		});
	});

	await page.goto("/");
	await page.getByRole("textbox").pressSequentially("A simple todo app");
	await page.getByRole("button", { name: "Generate workspace" }).click();

	await expect(page.getByText("Review spec")).toBeVisible();
	await expect(page.getByRole("textbox")).toHaveValue(/A simple todo app/);
});

// ─── Adaptive Q&A → review ───────────────────────────────────────────────────

test("one question — shows question, accepts answer, proceeds to review", async ({
	page,
}) => {
	await page.route(`/api/sessions/${SESSION_ID}/stream`, async (route) => {
		await route.fulfill({
			status: 200,
			headers: { "Content-Type": "text/event-stream" },
			body: sse(
				{ type: "extract:done", present: [], gaps: ["auth provider"] },
				{ type: "clarify:question", question: "Which auth provider?" },
			),
		});
	});

	await page.route(`/api/sessions/${SESSION_ID}/answer`, async (route) => {
		await route.fulfill({ json: { nextQuestion: null } });
	});

	await page.route(`/api/sessions/${SESSION_ID}/run`, async (route) => {
		await route.fulfill({
			status: 200,
			headers: { "Content-Type": "text/event-stream" },
			body: sse(
				{ type: "draft:done", spec: "# Spec\n\nWith auth." },
				{ type: "review:ready" },
			),
		});
	});

	await page.goto("/");
	await page.getByRole("textbox").pressSequentially("An app with auth");
	await page.getByRole("button", { name: "Generate workspace" }).click();

	await expect(page.getByText("Which auth provider?")).toBeVisible();
	await page.getByRole("textbox").pressSequentially("Better Auth");
	await page.getByRole("button", { name: "Continue" }).click();

	await expect(page.getByText("Review spec")).toBeVisible();
});

test("two questions — shows each in sequence, then review", async ({ page }) => {
	await page.route(`/api/sessions/${SESSION_ID}/stream`, async (route) => {
		await route.fulfill({
			status: 200,
			headers: { "Content-Type": "text/event-stream" },
			body: sse(
				{ type: "extract:done", present: [], gaps: ["auth", "database"] },
				{ type: "clarify:question", question: "Which auth provider?" },
			),
		});
	});

	let answerCount = 0;
	await page.route(`/api/sessions/${SESSION_ID}/answer`, async (route) => {
		answerCount++;
		await route.fulfill({
			json: { nextQuestion: answerCount === 1 ? "Which database?" : null },
		});
	});

	await page.route(`/api/sessions/${SESSION_ID}/run`, async (route) => {
		await route.fulfill({
			status: 200,
			headers: { "Content-Type": "text/event-stream" },
			body: sse(
				{ type: "draft:done", spec: "# Spec\n\nFull spec." },
				{ type: "review:ready" },
			),
		});
	});

	await page.goto("/");
	await page.getByRole("textbox").pressSequentially("An app");
	await page.getByRole("button", { name: "Generate workspace" }).click();

	await expect(page.getByText("Which auth provider?")).toBeVisible();
	await page.getByRole("textbox").pressSequentially("Better Auth");
	await page.getByRole("button", { name: "Continue" }).click();

	await expect(page.getByText("Which database?")).toBeVisible();
	await page.getByRole("textbox").pressSequentially("SQLite");
	await page.getByRole("button", { name: "Continue" }).click();

	await expect(page.getByText("Review spec")).toBeVisible();
	await expect(page.getByText("2 questions answered")).toBeVisible();
});

// ─── Review → generate → download ────────────────────────────────────────────

test("confirm review → shows download button", async ({ page }) => {
	await page.route(`/api/sessions/${SESSION_ID}/stream`, async (route) => {
		await route.fulfill({
			status: 200,
			headers: { "Content-Type": "text/event-stream" },
			body: sse({ type: "clarify:done" }),
		});
	});

	await page.route(`/api/sessions/${SESSION_ID}/run`, async (route) => {
		await route.fulfill({
			status: 200,
			headers: { "Content-Type": "text/event-stream" },
			body: sse(
				{ type: "draft:done", spec: "# Spec" },
				{ type: "review:ready" },
			),
		});
	});

	await page.route(`/api/sessions/${SESSION_ID}/review`, async (route) => {
		await route.fulfill({ json: { ok: true } });
	});

	await page.route(`/api/sessions/${SESSION_ID}/generate`, async (route) => {
		await route.fulfill({
			status: 200,
			headers: { "Content-Type": "text/event-stream" },
			body: sse(
				{
					type: "generate:done",
					files: {
						"docs/llm.md": "# Project",
						"docs/architecture.md": "# Arch",
						"CLAUDE.md": "→ docs/llm.md",
					},
				},
				{ type: "zip:ready", sessionId: SESSION_ID },
			),
		});
	});

	await page.goto("/");
	await page.getByRole("textbox").pressSequentially("A project");
	await page.getByRole("button", { name: "Generate workspace" }).click();

	await expect(page.getByText("Review spec")).toBeVisible();
	await page.getByRole("button", { name: "Generate workspace" }).click();

	await expect(page.getByText("3 files generated", { exact: true })).toBeVisible();
	await expect(page.getByRole("link", { name: "Download ZIP" })).toBeVisible();
});

test("edited spec is used when confirmed", async ({ page }) => {
	await page.route(`/api/sessions/${SESSION_ID}/stream`, async (route) => {
		await route.fulfill({
			status: 200,
			headers: { "Content-Type": "text/event-stream" },
			body: sse({ type: "clarify:done" }),
		});
	});

	await page.route(`/api/sessions/${SESSION_ID}/run`, async (route) => {
		await route.fulfill({
			status: 200,
			headers: { "Content-Type": "text/event-stream" },
			body: sse(
				{ type: "draft:done", spec: "# Original Spec" },
				{ type: "review:ready" },
			),
		});
	});

	let capturedSpec = "";
	await page.route(`/api/sessions/${SESSION_ID}/review`, async (route) => {
		const body = await route.request().postDataJSON();
		capturedSpec = body.spec;
		await route.fulfill({ json: { ok: true } });
	});

	await page.route(`/api/sessions/${SESSION_ID}/generate`, async (route) => {
		await route.fulfill({
			status: 200,
			headers: { "Content-Type": "text/event-stream" },
			body: sse(
				{ type: "generate:done", files: { "CLAUDE.md": "→ docs/llm.md" } },
				{ type: "zip:ready", sessionId: SESSION_ID },
			),
		});
	});

	await page.goto("/");
	await page.getByRole("textbox").pressSequentially("A project");
	await page.getByRole("button", { name: "Generate workspace" }).click();

	await expect(page.getByText("Review spec")).toBeVisible();
	const specEditor = page.getByRole("textbox");
	await specEditor.selectText();
	await specEditor.pressSequentially("# Edited Spec");

	await page.getByRole("button", { name: "Generate workspace" }).click();
	await expect(page.getByText("1 files generated", { exact: true })).toBeVisible();
	expect(capturedSpec).toBe("# Edited Spec");
});

// ─── Error handling ───────────────────────────────────────────────────────────

test("stream error — shows message and start over button", async ({ page }) => {
	await page.route(`/api/sessions/${SESSION_ID}/stream`, async (route) => {
		await route.fulfill({
			status: 200,
			headers: { "Content-Type": "text/event-stream" },
			body: sse({ type: "error", message: "LLM timeout" }),
		});
	});

	await page.goto("/");
	await page.getByRole("textbox").pressSequentially("A project");
	await page.getByRole("button", { name: "Generate workspace" }).click();

	await expect(page.getByText("LLM timeout")).toBeVisible();
	await expect(page.getByRole("button", { name: "Start over" })).toBeVisible();
});

test("start over resets to idle state", async ({ page }) => {
	await page.route(`/api/sessions/${SESSION_ID}/stream`, async (route) => {
		await route.fulfill({
			status: 200,
			headers: { "Content-Type": "text/event-stream" },
			body: sse({ type: "error", message: "oops" }),
		});
	});

	await page.goto("/");
	await page.getByRole("textbox").pressSequentially("A failing project");
	await page.getByRole("button", { name: "Generate workspace" }).click();

	await expect(page.getByText("oops")).toBeVisible();
	await page.getByRole("button", { name: "Start over" }).click();

	await expect(page.getByText("What are you building?")).toBeVisible();
	await expect(page.getByRole("textbox")).toHaveValue("");
});

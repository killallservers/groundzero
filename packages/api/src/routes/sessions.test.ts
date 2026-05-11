import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, mock, test } from "bun:test";
import { sessions } from "@groundzero/core/db/schema";
import { drizzle } from "drizzle-orm/bun-sqlite";

// In-memory DB with sessions table matching the migration SQL exactly
const sqlite = new Database(":memory:");
sqlite.run(`
  CREATE TABLE IF NOT EXISTS \`sessions\` (
    \`id\` text PRIMARY KEY NOT NULL,
    \`user_id\` text,
    \`stage\` text DEFAULT 'extract' NOT NULL,
    \`idea\` text NOT NULL,
    \`state\` text NOT NULL,
    \`created_at\` integer NOT NULL,
    \`updated_at\` integer NOT NULL
  )
`);
const testDb = drizzle(sqlite, { schema: { sessions } });

// Pipeline mocks — captured so tests can assert on calls
const mockExtract = mock(async (_idea: string) => ({
	present: ["React frontend"],
	gaps: ["auth provider"],
}));
// Default: no questions (DONE) — most tests don't need clarify Q&A
const mockClarify = mock(async () => null as string | null);
const mockResolve = mock(async (_answers: Record<string, string>) => ({
	packages: [{ name: "hono", version: "latest", llmsTxt: "hono docs" }],
}));
const mockDraft = mock(async () => "# Spec\n\nProject details.");
const mockGenerate = mock(async () => ({
	"docs/llm.md": "# Project",
	"docs/architecture.md": "# Architecture",
}));
const mockBuildZip = mock(async () => new Uint8Array([0x50, 0x4b, 0x03, 0x04]));

mock.module("@groundzero/core/db", () => ({ db: testDb }));
mock.module("@groundzero/core/pipeline/extract", () => ({
	extract: mockExtract,
}));
mock.module("@groundzero/core/pipeline/clarify", () => ({
	clarify: mockClarify,
}));
mock.module("@groundzero/core/pipeline/resolve", () => ({
	resolve: mockResolve,
}));
mock.module("@groundzero/core/pipeline/draft", () => ({ draft: mockDraft }));
mock.module("@groundzero/core/pipeline/generate", () => ({
	generate: mockGenerate,
}));
mock.module("@groundzero/core/pipeline/zip", () => ({
	buildZip: mockBuildZip,
}));

const { sessionsRouter } = await import("./sessions.ts");
const { Hono } = await import("hono");

// Inject a test user so auth guards in route handlers pass
type TestUser = {
	id: string;
	name: string;
	email: string;
	emailVerified: boolean;
	createdAt: Date;
	updatedAt: Date;
};
const testUser: TestUser = {
	id: "test-user-id",
	name: "Test User",
	email: "test@example.com",
	emailVerified: false,
	createdAt: new Date(),
	updatedAt: new Date(),
};
const app = new Hono<{ Variables: { user: TestUser | null; session: null } }>()
	.use("*", (c, next) => {
		c.set("user", testUser);
		c.set("session", null);
		return next();
	})
	.route("/", sessionsRouter);

function parseSSE(text: string): unknown[] {
	return text
		.split("\n\n")
		.flatMap((chunk) =>
			chunk
				.split("\n")
				.filter((line) => line.startsWith("data:"))
				.map((line) => {
					try {
						return JSON.parse(line.slice(5).trim());
					} catch {
						return null;
					}
				}),
		)
		.filter(Boolean);
}

async function json<T>(res: Response): Promise<T> {
	return res.json() as Promise<T>;
}

// Clean sessions table between tests
beforeEach(() => {
	sqlite.run("DELETE FROM sessions");
	mockClarify.mockReset();
	mockClarify.mockImplementation(async () => null);
});

// ─── POST / ───────────────────────────────────────────────────────────────────

describe("POST /", () => {
	test("creates session and returns 201 with sessionId", async () => {
		const res = await app.request("/", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ idea: "a todo app" }),
		});
		expect(res.status).toBe(201);
		const body = await json<{ sessionId: string }>(res);
		expect(typeof body.sessionId).toBe("string");
		expect(body.sessionId).toHaveLength(36); // UUID v4
	});

	test("returns 400 when idea is missing", async () => {
		const res = await app.request("/", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({}),
		});
		expect(res.status).toBe(400);
	});

	test("returns 400 when idea is blank", async () => {
		const res = await app.request("/", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ idea: "   " }),
		});
		expect(res.status).toBe(400);
	});

	test("persists session to database at extract stage", async () => {
		const res = await app.request("/", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ idea: "a blog" }),
		});
		const { sessionId } = await json<{ sessionId: string }>(res);
		const session = await testDb.query.sessions.findFirst({
			where: (s, { eq }) => eq(s.id, sessionId),
		});
		expect(session?.stage).toBe("extract");
		expect(session?.idea).toBe("a blog");
	});
});

// ─── GET /:id/stream ──────────────────────────────────────────────────────────

describe("GET /:id/stream", () => {
	test("emits stage and extract:done events", async () => {
		const createRes = await app.request("/", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ idea: "an e-commerce site" }),
		});
		const { sessionId } = await json<{ sessionId: string }>(createRes);

		const streamRes = await app.request(`/${sessionId}/stream`);
		const events = parseSSE(await streamRes.text()) as Array<{ type: string }>;

		expect(events.some((e) => e.type === "stage")).toBe(true);
		expect(events.some((e) => e.type === "extract:done")).toBe(true);
	});

	test("emits clarify:question when LLM returns a question", async () => {
		mockClarify.mockImplementationOnce(async () => "Which auth provider?");

		const createRes = await app.request("/", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ idea: "an app" }),
		});
		const { sessionId } = await json<{ sessionId: string }>(createRes);

		const events = parseSSE(
			await (await app.request(`/${sessionId}/stream`)).text(),
		) as Array<{ type: string; question?: string }>;

		const clarifyEvent = events.find((e) => e.type === "clarify:question");
		expect(clarifyEvent).toBeTruthy();
		expect(clarifyEvent?.question).toBe("Which auth provider?");
	});

	test("emits clarify:done when no questions are needed", async () => {
		const createRes = await app.request("/", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ idea: "a simple script" }),
		});
		const { sessionId } = await json<{ sessionId: string }>(createRes);

		const events = parseSSE(
			await (await app.request(`/${sessionId}/stream`)).text(),
		) as Array<{ type: string }>;

		expect(events.some((e) => e.type === "clarify:done")).toBe(true);
	});

	test("advances session stage to clarify when question returned", async () => {
		mockClarify.mockImplementationOnce(async () => "Which auth?");

		const createRes = await app.request("/", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ idea: "a mobile app" }),
		});
		const { sessionId } = await json<{ sessionId: string }>(createRes);
		await (await app.request(`/${sessionId}/stream`)).text();

		const session = await testDb.query.sessions.findFirst({
			where: (s, { eq }) => eq(s.id, sessionId),
		});
		expect(session?.stage).toBe("clarify");
	});

	test("advances session stage to resolve when no questions needed", async () => {
		const createRes = await app.request("/", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ idea: "a simple app" }),
		});
		const { sessionId } = await json<{ sessionId: string }>(createRes);
		await (await app.request(`/${sessionId}/stream`)).text();

		const session = await testDb.query.sessions.findFirst({
			where: (s, { eq }) => eq(s.id, sessionId),
		});
		expect(session?.stage).toBe("resolve");
	});

	test("emits error event for unknown session id", async () => {
		const res = await app.request("/nonexistent-id/stream");
		const events = parseSSE(await res.text()) as Array<{
			type: string;
			message: string;
		}>;
		const errorEvent = events.find((e) => e.type === "error");
		expect(errorEvent).toBeTruthy();
		expect(errorEvent?.message).toContain("not found");
	});
});

// ─── POST /:id/answer ─────────────────────────────────────────────────────────

describe("POST /:id/answer", () => {
	async function sessionAtClarify() {
		const createRes = await app.request("/", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ idea: "a webapp" }),
		});
		const { sessionId } = await json<{ sessionId: string }>(createRes);
		// Stream: clarify returns question → stage = clarify
		mockClarify.mockImplementationOnce(async () => "Which auth provider?");
		await (await app.request(`/${sessionId}/stream`)).text();
		return sessionId;
	}

	test("returns nextQuestion when LLM has another question", async () => {
		const sessionId = await sessionAtClarify();
		mockClarify.mockImplementationOnce(async () => "Which database?");

		const res = await app.request(`/${sessionId}/answer`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				question: "Which auth provider?",
				answer: "Better Auth",
			}),
		});
		expect(res.status).toBe(200);
		const body = await json<{ nextQuestion: string | null }>(res);
		expect(body.nextQuestion).toBe("Which database?");
	});

	test("returns null and advances to resolve when done", async () => {
		const sessionId = await sessionAtClarify();
		// default mock returns null

		const res = await app.request(`/${sessionId}/answer`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				question: "Which auth provider?",
				answer: "Better Auth",
			}),
		});
		expect(res.status).toBe(200);
		const body = await json<{ nextQuestion: string | null }>(res);
		expect(body.nextQuestion).toBeNull();

		const session = await testDb.query.sessions.findFirst({
			where: (s, { eq }) => eq(s.id, sessionId),
		});
		expect(session?.stage).toBe("resolve");
	});

	test("persists answer to session state", async () => {
		const sessionId = await sessionAtClarify();

		await app.request(`/${sessionId}/answer`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ question: "Which auth?", answer: "JWT" }),
		});

		const session = await testDb.query.sessions.findFirst({
			where: (s, { eq }) => eq(s.id, sessionId),
		});
		const state = session?.state as { answers?: Record<string, string> };
		expect(state?.answers?.["Which auth?"]).toBe("JWT");
	});

	test("returns 404 for unknown session", async () => {
		const res = await app.request("/unknown/answer", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ question: "Q?", answer: "A" }),
		});
		expect(res.status).toBe(404);
	});
});

// ─── GET /:id/run ─────────────────────────────────────────────────────────────

describe("GET /:id/run", () => {
	// Default mock returns null → stream advances to resolve directly
	async function sessionAtResolve(idea = "a project") {
		const createRes = await app.request("/", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ idea }),
		});
		const { sessionId } = await json<{ sessionId: string }>(createRes);
		await (await app.request(`/${sessionId}/stream`)).text();
		return sessionId;
	}

	test("emits resolve:done, draft:done, review:ready events", async () => {
		const sessionId = await sessionAtResolve();
		const res = await app.request(`/${sessionId}/run`);
		const events = parseSSE(await res.text()) as Array<{ type: string }>;

		expect(events.some((e) => e.type === "resolve:done")).toBe(true);
		expect(events.some((e) => e.type === "draft:done")).toBe(true);
		expect(events.some((e) => e.type === "review:ready")).toBe(true);
	});

	test("advances session stage to review", async () => {
		const sessionId = await sessionAtResolve();
		await (await app.request(`/${sessionId}/run`)).text();

		const session = await testDb.query.sessions.findFirst({
			where: (s, { eq }) => eq(s.id, sessionId),
		});
		expect(session?.stage).toBe("review");
	});

	test("emits error if session is not at resolve stage", async () => {
		const createRes = await app.request("/", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ idea: "app" }),
		});
		const { sessionId } = await json<{ sessionId: string }>(createRes);
		// Stream with a question → stays at clarify stage
		mockClarify.mockImplementationOnce(async () => "Which auth?");
		await app.request(`/${sessionId}/stream`);

		const res = await app.request(`/${sessionId}/run`);
		const events = parseSSE(await res.text()) as Array<{ type: string }>;
		expect(events.some((e) => e.type === "error")).toBe(true);
	});
});

// ─── POST /:id/review ─────────────────────────────────────────────────────────

describe("POST /:id/review", () => {
	async function sessionAtReview(idea = "a project") {
		const createRes = await app.request("/", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ idea }),
		});
		const { sessionId } = await json<{ sessionId: string }>(createRes);
		await (await app.request(`/${sessionId}/stream`)).text();
		await (await app.request(`/${sessionId}/run`)).text();
		return sessionId;
	}

	test("confirm action advances stage to generate", async () => {
		const sessionId = await sessionAtReview();
		const res = await app.request(`/${sessionId}/review`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ action: "confirm" }),
		});
		expect(res.status).toBe(200);

		const session = await testDb.query.sessions.findFirst({
			where: (s, { eq }) => eq(s.id, sessionId),
		});
		expect(session?.stage).toBe("generate");
	});

	test("edit action sends stage back to draft", async () => {
		const sessionId = await sessionAtReview();
		await app.request(`/${sessionId}/review`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ action: "edit" }),
		});

		const session = await testDb.query.sessions.findFirst({
			where: (s, { eq }) => eq(s.id, sessionId),
		});
		expect(session?.stage).toBe("draft");
	});

	test("confirm with edited spec persists the new spec text", async () => {
		const sessionId = await sessionAtReview();
		await app.request(`/${sessionId}/review`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ action: "confirm", spec: "# Edited Spec" }),
		});

		const session = await testDb.query.sessions.findFirst({
			where: (s, { eq }) => eq(s.id, sessionId),
		});
		const state = session?.state as { spec?: string };
		expect(state?.spec).toBe("# Edited Spec");
	});

	test("returns 404 for unknown session", async () => {
		const res = await app.request("/unknown/review", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ action: "confirm" }),
		});
		expect(res.status).toBe(404);
	});
});

// ─── GET /:id/generate ────────────────────────────────────────────────────────

describe("GET /:id/generate", () => {
	async function sessionAtGenerate(idea = "a project") {
		const createRes = await app.request("/", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ idea }),
		});
		const { sessionId } = await json<{ sessionId: string }>(createRes);
		await (await app.request(`/${sessionId}/stream`)).text();
		await (await app.request(`/${sessionId}/run`)).text();
		await app.request(`/${sessionId}/review`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ action: "confirm" }),
		});
		return sessionId;
	}

	test("emits generate:done and zip:ready events", async () => {
		const sessionId = await sessionAtGenerate();
		const res = await app.request(`/${sessionId}/generate`);
		const events = parseSSE(await res.text()) as Array<{ type: string }>;

		expect(events.some((e) => e.type === "generate:done")).toBe(true);
		expect(events.some((e) => e.type === "zip:ready")).toBe(true);
	});

	test("advances session to done stage", async () => {
		const sessionId = await sessionAtGenerate();
		await (await app.request(`/${sessionId}/generate`)).text();

		const session = await testDb.query.sessions.findFirst({
			where: (s, { eq }) => eq(s.id, sessionId),
		});
		expect(session?.stage).toBe("done");
	});

	test("emits error when session is not at generate stage", async () => {
		const createRes = await app.request("/", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ idea: "app" }),
		});
		const { sessionId } = await json<{ sessionId: string }>(createRes);

		const res = await app.request(`/${sessionId}/generate`);
		const events = parseSSE(await res.text()) as Array<{ type: string }>;
		expect(events.some((e) => e.type === "error")).toBe(true);
	});
});

// ─── GET /:id/download ────────────────────────────────────────────────────────

describe("GET /:id/download", () => {
	async function sessionAtDone(idea = "a project") {
		const createRes = await app.request("/", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ idea }),
		});
		const { sessionId } = await json<{ sessionId: string }>(createRes);
		await (await app.request(`/${sessionId}/stream`)).text();
		await (await app.request(`/${sessionId}/run`)).text();
		await app.request(`/${sessionId}/review`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ action: "confirm" }),
		});
		await (await app.request(`/${sessionId}/generate`)).text();
		return sessionId;
	}

	test("returns 200 with application/zip content type", async () => {
		const sessionId = await sessionAtDone();
		const res = await app.request(`/${sessionId}/download`);
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toBe("application/zip");
	});

	test("response has content-disposition attachment header", async () => {
		const sessionId = await sessionAtDone();
		const res = await app.request(`/${sessionId}/download`);
		const disposition = res.headers.get("content-disposition");
		expect(disposition).toContain("attachment");
		expect(disposition).toContain(".zip");
	});

	test("returns 404 for unknown session", async () => {
		const res = await app.request("/unknown-id/download");
		expect(res.status).toBe(404);
	});

	test("returns 409 when session is not done yet", async () => {
		const createRes = await app.request("/", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ idea: "app" }),
		});
		const { sessionId } = await json<{ sessionId: string }>(createRes);
		const res = await app.request(`/${sessionId}/download`);
		expect(res.status).toBe(409);
	});
});

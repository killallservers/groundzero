import { Database } from "bun:sqlite";
import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { sessions } from "@groundzero/core/db/schema";
import { drizzle } from "drizzle-orm/bun-sqlite";

// Shared in-memory DB for e2e tests
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

mock.module("@groundzero/core/db", () => ({ db: testDb }));
mock.module("@groundzero/core/pipeline/extract", () => ({
  extract: mock(async () => ({
    present: ["React frontend", "Better Auth"],
    gaps: ["database choice"],
  })),
}));
mock.module("@groundzero/core/pipeline/clarify", () => ({
  clarify: mock(async () => ["Which database should we use?"]),
}));
mock.module("@groundzero/core/pipeline/resolve", () => ({
  resolve: mock(async () => ({
    packages: [
      { name: "hono", version: "4.7.0", llmsTxt: "# Hono" },
      { name: "drizzle", version: "0.45.2", llmsTxt: "# Drizzle" },
    ],
  })),
}));
mock.module("@groundzero/core/pipeline/draft", () => ({
  draft: mock(
    async () =>
      "# Spec\n\n## Problem\nBuild a todo app.\n\n## Goals\n- CRUD todos\n- Auth",
  ),
}));
mock.module("@groundzero/core/pipeline/generate", () => ({
  generate: mock(async () => ({
    "docs/llm.md": "# Project\n\nA todo app.",
    "docs/architecture.md": "# Architecture\n\nHono + Drizzle + Better Auth.",
    "docs/constraints.md": "# Constraints\n\nBun only.",
    "CLAUDE.md": "→ docs/llm.md",
  })),
}));
mock.module("@groundzero/core/pipeline/zip", () => ({
  buildZip: mock(async (files: Record<string, string>) => {
    const count = Object.keys(files).length;
    return new Uint8Array([0x50, 0x4b, 0x05, 0x06, count]);
  }),
}));

// Provide a test user so auth guards pass without a real auth DB
const e2eUser = {
  id: "e2e-user-id",
  name: "E2E User",
  email: "e2e@example.com",
  emailVerified: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};
mock.module("./middleware/session", () => ({
  sessionMiddleware: async (
    c: { set: (k: string, v: unknown) => void },
    next: () => Promise<void>,
  ) => {
    c.set("user", e2eUser);
    c.set("session", { id: "e2e-session", userId: e2eUser.id });
    await next();
  },
}));

const { default: serverConfig } = await import("./index.ts");

const PORT = 3099;
let server: ReturnType<typeof Bun.serve>;

beforeAll(() => {
  server = Bun.serve({ port: PORT, fetch: serverConfig.fetch });
});

afterAll(() => {
  server.stop();
  sqlite.close();
});

async function apiRequest(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`http://localhost:${PORT}${path}`, init);
}

async function json<T>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}

async function collectSSE(res: Response): Promise<unknown[]> {
  const text = await res.text();
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

describe("health check", () => {
  test("GET /health returns ok", async () => {
    const res = await apiRequest("/health");
    expect(res.status).toBe(200);
    const body = await json<{ status: string }>(res);
    expect(body.status).toBe("ok");
  });
});

describe("full pipeline lifecycle", () => {
  test("idea → clarify → answers → run → confirm → generate → download", async () => {
    // 1. Create session
    const createRes = await apiRequest("/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idea: "a todo web app with auth and sqlite" }),
    });
    expect(createRes.status).toBe(201);
    const { sessionId } = await json<{ sessionId: string }>(createRes);
    expect(typeof sessionId).toBe("string");

    // 2. Stream extract → clarify
    const streamRes = await apiRequest(`/sessions/${sessionId}/stream`);
    expect(streamRes.status).toBe(200);
    const streamEvents = await collectSSE(streamRes);

    const clarifyEvent = streamEvents.find(
      (e) => (e as { type: string }).type === "clarify:questions",
    ) as { type: string; questions: string[] } | undefined;
    expect(clarifyEvent).toBeTruthy();
    expect(clarifyEvent?.questions).toContain("Which database should we use?");

    // 3. Submit answers
    const answersRes = await apiRequest(`/sessions/${sessionId}/answers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        answers: { "Which database should we use?": "SQLite via Drizzle" },
      }),
    });
    expect(answersRes.status).toBe(200);

    // 4. Run resolve → draft
    const runRes = await apiRequest(`/sessions/${sessionId}/run`);
    expect(runRes.status).toBe(200);
    const runEvents = await collectSSE(runRes);

    expect(
      runEvents.some((e) => (e as { type: string }).type === "resolve:done"),
    ).toBe(true);
    const draftEvent = runEvents.find(
      (e) => (e as { type: string }).type === "draft:done",
    ) as { type: string; spec: string } | undefined;
    expect(draftEvent?.spec).toContain("# Spec");
    expect(
      runEvents.some((e) => (e as { type: string }).type === "review:ready"),
    ).toBe(true);

    // 5. Confirm review
    const reviewRes = await apiRequest(`/sessions/${sessionId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "confirm" }),
    });
    expect(reviewRes.status).toBe(200);

    // 6. Generate workspace
    const genRes = await apiRequest(`/sessions/${sessionId}/generate`);
    expect(genRes.status).toBe(200);
    const genEvents = await collectSSE(genRes);

    const genDoneEvent = genEvents.find(
      (e) => (e as { type: string }).type === "generate:done",
    ) as { type: string; files: Record<string, string> } | undefined;
    expect(Object.keys(genDoneEvent?.files ?? {})).toContain("docs/llm.md");
    expect(
      genEvents.some((e) => (e as { type: string }).type === "zip:ready"),
    ).toBe(true);

    // 7. Download ZIP
    const downloadRes = await apiRequest(`/sessions/${sessionId}/download`);
    expect(downloadRes.status).toBe(200);
    expect(downloadRes.headers.get("content-type")).toBe("application/zip");

    const zipBytes = new Uint8Array(await downloadRes.arrayBuffer());
    expect(zipBytes[0]).toBe(0x50); // P
    expect(zipBytes[1]).toBe(0x4b); // K
  });

  test("edit review loops spec back to draft stage", async () => {
    const createRes = await apiRequest("/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idea: "a metrics dashboard" }),
    });
    const { sessionId } = await json<{ sessionId: string }>(createRes);

    await apiRequest(`/sessions/${sessionId}/stream`);
    await apiRequest(`/sessions/${sessionId}/answers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers: {} }),
    });
    await apiRequest(`/sessions/${sessionId}/run`);

    const editRes = await apiRequest(`/sessions/${sessionId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "edit",
        spec: "# Revised Spec\n\nUpdated.",
      }),
    });
    expect(editRes.status).toBe(200);

    // Download must still be blocked — not done yet
    const downloadRes = await apiRequest(`/sessions/${sessionId}/download`);
    expect(downloadRes.status).toBe(409);
  });
});

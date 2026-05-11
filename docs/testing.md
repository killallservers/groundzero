# Testing

## Strategy

Four layers:

**Unit** (`packages/core`) — each pipeline stage (extract, clarify, resolve, draft, generate, zip) and the LLM factory tested in isolation with mocked dependencies. Uses Bun's built-in test runner.

**Integration** (`packages/api/src/routes/sessions.test.ts`) — full session router under Hono using an in-memory SQLite DB. All pipeline functions mocked. Uses Bun's built-in test runner.

**API E2E** (`packages/api/src/e2e.test.ts`) — real `Bun.serve` started in `beforeAll`. All pipeline functions mocked. Tests the full HTTP lifecycle: create session → stream → answers → run → review → generate → download ZIP. Uses Bun's built-in test runner.

**Web E2E** (`packages/web/tests/app.test.ts`) — Playwright (Chromium). Starts the web dev server at port 5000 via `playwright.config.ts`. All `/api/*` routes intercepted with `page.route()` — no real API or pipeline needed. 7 tests covering: no-questions path, one adaptive question, two adaptive questions, confirm→download, edited spec sent to review, stream error, start over.

**MCP** (`packages/mcp/src/mcp.test.ts`) — tool registration and handler behavior via a mock `McpServer` that captures registered tools. Uses Bun's built-in test runner.

---

## Running Tests

```sh
# all Bun tests (from root) — runs each package in a separate process
bun run test

# single package
bun test packages/core
bun test packages/api
bun test packages/mcp

# single file
bun test packages/core/src/pipeline/extract.test.ts

# Playwright web E2E (from packages/web)
cd packages/web && bunx playwright test
```

> **Why `bun run test` not `bun test` at root?** `bun test` without a path discovers every `.test.ts` file in the repo and runs them in a single process. Bun 1.3+ shares the module cache within a single invocation, so `mock.module()` in one file bleeds into others. The `bun run test` script (`bun test packages/mcp && bun test packages/core && bun test packages/api`) runs each package in a separate process for true isolation.

---

## Mock Pattern

All tests that rely on mocked dependencies must use dynamic import **after** calling `mock.module()`:

```ts
// ✅ correct
mock.module("ai", () => ({ generateText: mockGenerateText }));
const { extract } = await import("./extract.ts");

// ❌ wrong — static import resolves before mock.module runs
import { extract } from "./extract.ts";
mock.module("ai", () => ({ generateText: mockGenerateText }));
```

---

## Integration Test DB Setup

Use `new Database(":memory:")` with an inline `CREATE TABLE` that mirrors the migration SQL exactly (backtick-quoted column names). Inject via `mock.module`. Use `sqlite.run()` not `sqlite.exec()` (the multi-arg overload of `exec` is deprecated):

```ts
const sqlite = new Database(":memory:");
sqlite.run(`CREATE TABLE IF NOT EXISTS \`sessions\` (...)`);
const testDb = drizzle(sqlite, { schema: { sessions } });
mock.module("@groundzero/core/db", () => ({ db: testDb }));
```

---

## SSE Streams in Tests

SSE handlers update the DB **after** writing to the stream. To assert DB state, consume the full response body before querying:

```ts
await (await app.request(`/${id}/stream`)).text(); // wait for stream to finish
const row = await db.query.sessions.findFirst(...); // now DB is updated
```

---

## Gotchas

- **`toHaveProperty` with file path keys**: Bun interprets `.` in the key as a nested-path separator. Use `Object.keys(obj).toContain("docs/llm.md")` instead.
- **`Response.json()` generics**: `res.json()` doesn't accept a type parameter. Use a typed helper: `async function json<T>(res: Response): Promise<T> { return res.json() as Promise<T>; }`
- **MCP `gz_zip` test writes to `/tmp`**: The test uses a mock that returns `new Uint8Array([0x50, 0x4b, 0x03, 0x04])` and writes it to `/tmp/gz-test-*.zip` and `/tmp/groundzero-*.zip`. These 4-byte files are test artifacts — not corrupt production archives. The real `buildZip` (tested in `zip.test.ts`) produces valid ZIP output.
- **Playwright `pressSequentially` vs `fill`**: React controlled inputs (`value` + `onChange`) require `pressSequentially()` in Playwright tests — `fill()` bypasses React's synthetic event system and leaves state unchanged, keeping buttons disabled.
- **Playwright strict mode**: `getByText("N files generated")` can match multiple elements if the same string appears in both a progress indicator and a heading. Use `{ exact: true }` to pin to the element whose full text is exactly that string.
- **Playwright port conflicts**: The web dev server runs on port 5000. `reuseExistingServer: true` (non-CI default) will silently pick up any process already listening on that port. If tests behave unexpectedly, check `ss -tlnp 'sport = :5000'`.

---

## Coverage

97 Bun tests + 7 Playwright tests across 12 files:

| Package | Runner | Tests | Files |
|---------|--------|-------|-------|
| `packages/mcp` | Bun | 21 | 1 (mcp.test.ts) |
| `packages/core` | Bun | 49 | 8 (schema, llm, extract, clarify, resolve, draft, generate, zip) |
| `packages/api` | Bun | 27 | 2 (sessions.test.ts, e2e.test.ts) |
| `packages/web` | Playwright | 7 | 1 (app.test.ts) |

---

## Conventions

- Test files co-located with source: `foo.ts` → `foo.test.ts`
- Use `beforeEach` to reset mutable state (mock call counts, in-memory DB rows)
- Never import from outside the package under test — use `mock.module()` for cross-package deps

---

*Last updated: 2026-05-11*

# Testing

## Strategy

Three layers, all using Bun's built-in test runner:

**Unit** (`packages/core`) — each pipeline stage (extract, clarify, resolve, draft, generate, zip) and the LLM factory tested in isolation with mocked dependencies.

**Integration** (`packages/api/src/routes/sessions.test.ts`) — full session router under Hono using an in-memory SQLite DB. All pipeline functions mocked.

**E2E** (`packages/api/src/e2e.test.ts`) — real `Bun.serve` started in `beforeAll`. All pipeline functions mocked. Tests the full HTTP lifecycle: create session → stream → answers → run → review → generate → download ZIP.

**MCP** (`packages/mcp/src/mcp.test.ts`) — tool registration and handler behavior via a mock `McpServer` that captures registered tools.

---

## Running Tests

```sh
# all tests (from root) — runs each package in a separate process
bun run test

# single package
bun test packages/core
bun test packages/api
bun test packages/mcp

# single file
bun test packages/core/src/pipeline/extract.test.ts
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

---

## Coverage

97 tests across 11 files:

| Package | Tests | Files |
|---------|-------|-------|
| `packages/mcp` | 21 | 1 (mcp.test.ts) |
| `packages/core` | 49 | 8 (schema, llm, extract, clarify, resolve, draft, generate, zip) |
| `packages/api` | 27 | 2 (sessions.test.ts, e2e.test.ts) |

---

## Conventions

- Test files co-located with source: `foo.ts` → `foo.test.ts`
- Use `beforeEach` to reset mutable state (mock call counts, in-memory DB rows)
- Never import from outside the package under test — use `mock.module()` for cross-package deps

---

*Last updated: 2026-05-12*

# Testing

## Strategy

Two testing layers:

**Pipeline logic** (`packages/core`) — unit tests for each stage (extract, clarify, resolve, draft, generate) in isolation. Integration tests for the full pipeline with real filesystem output. No mocking the filesystem — use temp dirs.

**Behavioral snapshots** — capture workspace ZIP output for a given spec + stack. On any pipeline change, diff new output against snapshots before shipping. This is the primary regression guard for generated content.

No E2E until Phase 3 (web UI) is live.

## Tools

| Layer | Tool | Notes |
|-------|------|-------|
| Unit / Integration | Bun test runner | Built-in; no Jest needed |
| Coverage | Bun coverage | 80% threshold configured in `bunfig.toml` |
| Behavioral snapshots | Custom snapshot fixtures | Input spec + expected output ZIP manifest |

## Test Setup

`test-setup.ts` is loaded via `bunfig.toml` preload. It runs migrations against a test DB and truncates the sessions table between tests. The test DB path is set via `DATABASE_PATH` env var — must point to a separate file from the development DB.

The migration uses the same bun-native migrator as production (`drizzle-orm/bun-sqlite/migrator`). No separate test infrastructure needed — SQLite is zero-config.

## Running Tests

```sh
# all tests (from root)
bun test

# watch mode
bun test --watch

# single package
bun --filter @groundzero/core run test

# single file
bun test packages/core/src/pipeline/extract.test.ts

# run db migrations before first test run
bun db:migrate
```

## Conventions

- Test files co-located with source: `foo.ts` → `foo.test.ts`
- Use domain language from `docs/context.md` in test descriptions
- No mocking the database — tests hit the real SQLite test instance
- No mocking the filesystem — integration tests use real temp dirs via `import.meta.dir`
- Behavioral snapshots named by stack hash + spec ID

## What Must Always Be Tested

- Every pipeline stage in isolation (extract, clarify, resolve, draft, generate)
- Full pipeline end-to-end: idea in → ZIP out
- ZIP output structure matches expected workspace layout
- Resolution handles network failures gracefully (timeout, 404, missing `llms.txt`)
- Spec preservation: Intent must equal original user input verbatim
- Behavioral snapshots: regenerating from the same spec produces matching output

---

*Last updated: 2026-05-10*

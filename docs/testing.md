# Testing

## Strategy

Two testing layers:

**Pipeline logic** (Phase 2) — unit tests for each stage (extract, clarify, resolve, draft, generate) in isolation. Integration tests for the full pipeline with real filesystem output. No mocking the filesystem — use temp dirs.

**Behavioral snapshots** — capture workspace ZIP output for a given spec + stack. On any pipeline change, diff new output against snapshots before shipping. This is the primary regression guard for generated content.

No E2E until Phase 3 (web UI) is live.

## Tools

| Layer | Tool | Notes |
|-------|------|-------|
| Unit / Integration | Bun test runner | Built-in; no Jest needed |
| Coverage | Bun coverage | 80% threshold configured in `bunfig.toml` |
| Behavioral snapshots | Custom snapshot fixtures | Input spec + expected output ZIP manifest |

## test-setup.ts

Loaded via `bunfig.toml` preload. Runs migrations against the test DB and truncates between tests.

**Critical:** `DATABASE_URL` must contain `"test"` — `test-setup.ts` throws otherwise. Separate `postgres-test` service in `compose.yml` on port 5433.

## Running Tests

```sh
# all tests
bun test

# watch mode
bun test --watch

# single package
bun test src/pipeline/extract

# apply migrations to test DB first (required on first run)
bunx drizzle-kit migrate
```

## Conventions

- Test files co-located with source: `foo.ts` → `foo.test.ts`
- Use domain language from `docs/context.md` in test descriptions
- No mocking the database — tests hit the real test Postgres instance
- No mocking the filesystem — integration tests use real temp dirs
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

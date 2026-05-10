# Constraints

Hard constraints for this codebase. Must be respected unconditionally.

---

## Never Do

### Architecture
- Do not write auth logic in route handlers — `sessionMiddleware` handles it
- Do not add Docker or managed cloud services
- Do not reach into `packages/` directly from root scripts — use `bun --filter @groundzero/<pkg> run <script>`
- Do not add nested `CLAUDE.md` files inside packages — one navigation guide at the root

### Database
- Do not modify Drizzle-generated migration files, snapshots, or journal (`packages/core/drizzle/`)
- Do not use `bunx @better-auth/cli generate` — it uses jiti internally, which cannot resolve `bun:sqlite`; maintain `packages/core/src/db/auth.schema.ts` manually
- Do not run `bunx drizzle-kit push` directly — `better-sqlite3` is incompatible with Bun; use `cd packages/core && bun run db:push` (generate + bun-native migrate)
- Do not use Postgres or any remote database — `drizzle-orm/bun-sqlite` with `bun:sqlite` only
- Do not use a CWD-relative path for the DB file — use `import.meta.url`; from `src/db/` two `../` levels up reaches `packages/core/`

### Code
- Do not use `node` for anything — Bun only, always (`bun -e` for one-liners, `bun run` for scripts, `bunx` for CLIs)
- Do not use Node.js built-ins or polyfills — Bun-native APIs only (`Bun.env`, `bun:sqlite`, `import.meta.url`)
- Do not use `process.env` — use `Bun.env`
- Do not write package versions in `package.json` by hand — `bun add <pkg>@latest` on the CLI
- Do not commit secrets, tokens, or credentials of any kind

### Templates
- Do not embed specific package versions in templates — resolution happens live at generation time
- Do not leave project-specific values in generic templates — every fill-in must be `[TODO]` or `[SCREAMING_SNAKE]`

---

## Always Do

- Fetch `llms.txt` and versions live at generation time — never use hardcoded or cached values
- Preserve the user's raw idea verbatim as Intent in every generated spec
- Keep `docs/llm.md` (= CLAUDE.md) factual and concise — procedures go in `.claude/skills/`
- Test `install.sh` changes on both GNU sed (Linux) and BSD sed (macOS)
- Use `useCallback` for functions passed into `useEffect` dependency arrays
- Run `bun run check:fix && bun run typecheck` before committing
- Use `bun -e` for inline scripting or path verification — never `node -e`

---

## Testing

### Test Isolation
- Run each package as a separate `bun test` invocation — never combine into one. Bun shares the module cache within a single invocation; `mock.module()` in one file bleeds into others.
- Root test script: `bun test packages/mcp && bun test packages/core && bun test packages/api`

### Mock Patterns
- Always call `mock.module("path", factory)` before `await import("./module.ts")` — static imports resolve before mocks apply.
- For integration tests, inject a real in-memory SQLite DB via `mock.module("@groundzero/core/db", () => ({ db: testDb }))`.

### Assertions
- Do not use `expect(obj).toHaveProperty("docs/llm.md")` — Bun interprets `.` in the key as a nested-path separator. Use `Object.keys(obj).toContain("docs/llm.md")` instead.
- Consume SSE response bodies with `await res.text()` before asserting DB state — the stream handler updates the DB async after headers are sent.

---

## External API / Rate Limit Notes

| Service | Limit | Notes |
|---------|-------|-------|
| LLM provider APIs | Varies per provider | Respect `maxOutputTokens`; handle rate limit errors per provider |
| Package CDNs (`llms.txt`) | Varies per host | Implement retry + timeout in resolution |
| raw.githubusercontent.com | GitHub rate limits | Public repo; generous for anonymous fetches |

---

## Regulatory / Legal

- Generated workspaces must never embed user secrets — `.env.example` only
- MIT license; attribute origin where templates are substantially derived from upstream

---

*Last updated: 2026-05-10*

# Ground Zero — AI Navigation Guide

> This file is the project constitution. It loads in every Claude Code session.
> Procedures belong in `.claude/skills/`, not here.

---

## Project Overview

**What:** AI workspace generator — paste a project idea, receive a fully specced Claude Code workspace ZIP, ready to build.
**Why:** Eliminates the hours of setup (versions, conventions, docs, AI context) between having an idea and being able to code.
**Status:** Phase 1 complete (`install.sh` + templates). Phase 2 pipeline built (extract → clarify → resolve → draft → generate → zip). Phase 3 web UI built (idea → clarify → review → generate → download ZIP). Auth wired (`packages/api/src/lib/auth.ts`) — middleware + route mounting pending.
**Repo:** github.com/killallservers/groundzero

---

## Tech Stack

| Layer      | Technology                              | Notes                                                        |
|------------|-----------------------------------------|--------------------------------------------------------------|
| Language   | TypeScript 7                            | `@typescript/native-preview` (`tsgo`); no CommonJS           |
| Runtime    | Bun                                     | Bun only — never `node`; `Bun.env` not `process.env`         |
| Framework  | Hono                                    | HTTP layer; runs on Bun and CF Workers                       |
| CLI        | Ink                                     | React for CLIs; state machine pattern; compiles to binary    |
| Database   | SQLite (`bun:sqlite`)                   | Drizzle ORM via `drizzle-orm/bun-sqlite`; Bun-native         |
| LLM        | Vercel AI SDK (`ai`)                    | Multi-provider; factory in `packages/core/src/lib/llm.ts`    |
| Auth       | Better Auth                             | Organization plugin; schema maintained manually (jiti incompatible with `bun:sqlite`) |
| Infra      | Hetzner VPS                             | Pulumi provisioning; Caddy TLS; no Docker                    |
| Formatting | Biome 2                                 | Replaces ESLint + Prettier; `bun run check:fix` to auto-fix  |

---

## Repository Structure

```
install.sh                      — Phase 1: POSIX sh installer (curl | sh)
templates/docs/                 — doc templates copied into generated workspaces
.claude/skills/                 — workflow guides distributed with install.sh
docs/                           — documentation for this repo itself
packages/
  core/                         — pipeline logic, DB, LLM factory (@groundzero/core)
    src/db/
      schema.ts                 — pipeline sessions table + PipelineState/PipelineStage types
      auth.schema.ts            — Better Auth tables (user, session, account, verification,
                                   organization, member, invitation) — maintained manually
      index.ts                  — bun:sqlite + drizzle; DB path via import.meta.url
      migrate.ts                — applies drizzle migrations; migrations path via import.meta.url
    src/lib/llm.ts              — multi-provider LLM factory (Vercel AI SDK)
    src/pipeline/               — extract, clarify, resolve, draft, generate, zip
    drizzle/                    — generated SQL migrations (never hand-edit)
    drizzle.config.ts           — drizzle-kit config; schema array includes both schema files
    groundzero.db               — SQLite file (gitignored; default path via import.meta.url)
  api/                          — Hono HTTP server (@groundzero/api)
    src/index.ts                — Bun.serve on port 3000
    src/lib/auth.ts             — Better Auth instance (drizzle adapter + organization plugin)
    src/routes/sessions.ts      — pipeline session CRUD + triggers
  cli/                          — Ink terminal UI (@groundzero/cli)
    src/index.tsx               — React state machine; compiles to standalone binary (gz)
  web/                          — Bun fullstack frontend (@groundzero/web)
    src/index.ts                — Bun.serve on port 5173; proxies /api/* → api
    src/App.tsx                 — React + shadcn/ui; full pipeline UI (idea → ZIP download)
  mcp/                          — MCP server (@groundzero/mcp)
    src/index.ts                — 6 granular tools: gz_extract, gz_clarify, gz_resolve,
                                   gz_draft, gz_generate, gz_zip
```

---

## Coding Conventions

- TypeScript 7 — `tsgo` for type-checking; per-package tsconfig; `bun run typecheck` at root
- Biome 2 for all formatting and linting — no ESLint, no Prettier
- ESM imports everywhere; `.ts` extension in import paths; no CommonJS
- **Bun only** — never invoke `node` for any purpose (scripting, debugging, one-liners); use `bun -e` instead
- `Bun.env` instead of `process.env` — idiomatic Bun and shows intent clearly
- `import.meta.url` for file-relative paths — from `src/db/` two `../` levels up reaches `packages/core/`; verify depth before writing
- `bun add <pkg>@latest` on the CLI — never write versions in `package.json` by hand
- Schema changes: `cd packages/core && bun run db:push` (runs `drizzle-kit generate` + bun-native migrate)
- kebab-case filenames; PascalCase types and React components
- React hooks: always `useCallback` for stable function references passed into `useEffect` deps

---

## Architecture Principles

- Pipeline is stateful and patchable — any stage can loop back without restarting from the top
- Resolution at generation time — live `llms.txt` + package versions; never cached in templates
- Single compiled Bun binary output; no Docker, no managed services
- Auth at middleware — route handlers never contain auth logic
- Specs are permanent — code is regenerable, intent is not
- All database artifacts live in `packages/core` — schema, migrations, config, and `.db` files

---

## Testing

- **Run:** `bun run test` at root — executes `bun test packages/mcp && bun test packages/core && bun test packages/api` (each as a separate process)
- **Isolation:** Each package runs in its own `bun test` invocation. Bun 1.3+ shares the module cache within a single invocation, so `mock.module()` in one file bleeds into others if they run together. Separate processes eliminate this.
- **Mock pattern:** Always call `mock.module("module-path", factory)` _before_ `await import("./module.ts")`. Static imports resolve before the module body runs; dynamic import is required for modules that use mocked dependencies.
- **Integration tests** (`sessions.test.ts`): Use `new Database(":memory:")` with `sqlite.exec(CREATE TABLE ...)` matching the migration SQL exactly (backtick-quoted column names). Inject via `mock.module("@groundzero/core/db", () => ({ db: testDb }))`.
- **E2E tests** (`e2e.test.ts`): Start a real `Bun.serve` in `beforeAll`, stop in `afterAll`. Consume SSE streams with `await res.text()` before reading DB state.
- **Gotcha — `toHaveProperty` with file paths:** Bun's matcher interprets `.` as a nested-path separator. Use `Object.keys(obj).toContain("docs/llm.md")` instead of `expect(obj).toHaveProperty("docs/llm.md")`.
- **Coverage:** 93 tests across 11 files — mcp (21), core (45), api (27).

---

## Hard Constraints

- Never modify Drizzle-generated migration files, snapshots, or journal (`packages/core/drizzle/`)
- Never add runtime dependencies without explicit approval
- Never commit secrets, tokens, or credentials
- Never use `node` for anything — Bun only, always (`bun -e`, `bun run`, `bunx`)
- Use `cd packages/core && bun run db:push` for schema changes — never `bunx drizzle-kit push` directly (`better-sqlite3` is incompatible with Bun)
- The Better Auth CLI (`bunx @better-auth/cli generate`) cannot be used — it uses jiti internally which cannot resolve `bun:sqlite`; maintain `auth.schema.ts` manually
- No Node.js built-ins or polyfills — Bun-native APIs only (`Bun.env`, `bun:sqlite`, `import.meta.url`)
- Template placeholders must remain `[TODO]` — never leave a project-specific value in a generic template
- No nested `CLAUDE.md` files inside packages — one navigation guide at the root

---

## LLM Provider Configuration

| Env var         | Default      | Values                                                                    |
|-----------------|--------------|---------------------------------------------------------------------------|
| `LLM_PROVIDER`  | `anthropic`  | `anthropic` \| `openai` \| `google` \| `mistral` \| `cohere` \| `bedrock` \| `azure` \| `custom` |
| `LLM_MODEL`     | provider default | overrides the model ID for the selected provider                      |
| `LLM_API_KEY`   | —            | API key for the selected provider                                         |
| `LLM_BASE_URL`  | —            | Base URL for `custom` (default: `http://localhost:11434/v1` for Ollama)   |

`custom` uses the OpenAI-compatible endpoint — works with Ollama and any local LLM.

---

## Key References

- Decisions log: `docs/decisions.md`
- Open specs: `.claude/specs/`
- Architecture doc: `docs/architecture.md`
- Constraints: `docs/constraints.md`

---

## Skills Available

| Skill          | When to invoke                          |
|----------------|-----------------------------------------|
| `/align`       | Before any non-trivial work             |
| `/spec-create` | Starting a formal feature spec          |
| `/spec-review` | Before implementing a spec              |
| `/tdd`         | Building or fixing with tests as driver |
| `/diagnose`    | Stuck on a bug or unexpected behaviour  |
| `/zoom-out`    | Losing the big picture; pre-refactor    |
| `/decision`    | Logging an architectural decision       |
| `/commit`      | Creating a well-formed commit           |

---

*Last updated: 2026-05-10*

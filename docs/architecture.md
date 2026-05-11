# Architecture

## System Overview

Ground Zero is a three-part product sharing one repository:

1. **Phase 1 — Installer** (`install.sh`): a POSIX shell script that bootstraps any project directory with docs, skills, and AI config. Live.
2. **Phase 2 — Agent Pipeline** (`packages/core`, `packages/api`, `packages/cli`): a stateful pipeline that takes a raw idea through Extract → Clarify → Resolve → Draft → Review → Generate → ZIP. Complete.
3. **Phase 3 — Web UI** (`packages/web`): a React frontend served by a Bun fullstack server. Complete — full pipeline UI from idea to ZIP download.
4. **MCP Server** (`packages/mcp`): 6 granular MCP tools for LLM-orchestrated pipeline execution. Complete.

---

## Monorepo Layout

```
packages/
  core/         @groundzero/core   — pipeline logic, DB, LLM factory; no server code
  api/          @groundzero/api    — Hono HTTP server; consumes core
  cli/          @groundzero/cli    — Ink terminal UI; consumes core; compiles to binary
  web/          @groundzero/web    — Bun fullstack frontend; proxies API calls to api
  mcp/          @groundzero/mcp    — MCP server; 6 granular pipeline tools
```

Bun workspaces (`"workspaces": ["packages/*"]`). Cross-package imports use `@groundzero/core/*` sub-paths. Run all commands from root using `bun --filter <package> run <script>`.

---

## Component Map

```
Phase 1 — Installer (live)
    install.sh
        ├── fetches templates/docs/*.md     → docs/ in target project
        ├── fetches .claude/skills/         → .claude/skills/ in target project
        ├── fetches .mcp.json               → .mcp.json in target project
        ├── creates symlinks                → CLAUDE.md, AGENTS.md, .cursorrules
        └── substitutes placeholders        → PROJECT_NAME, github.com/org/repo

Phase 2 — Core Pipeline (complete)
    packages/core/src/pipeline/
        extract.ts      — parse idea → present info + gaps (PipelineState.extracted)
        clarify.ts      — generate minimum Q&A from gaps
        resolve.ts      — fetch live package versions + llms.txt per dependency
        draft.ts        — write spec.md from resolved state
        generate.ts     — produce workspace file tree from confirmed spec
        zip.ts          — bundle output into a downloadable ZIP

    packages/core/src/lib/llm.ts
        — Vercel AI SDK factory; reads LLM_PROVIDER env var
        — Supports: anthropic (default), openai, google, mistral, cohere, bedrock, azure, custom

    packages/core/src/db/
        schema.ts       — sessions table; PipelineState JSON column; PipelineStage enum
        auth.schema.ts  — Better Auth tables (user, session, account, verification,
                           organization, member, invitation) — maintained manually
        index.ts        — bun:sqlite connection + drizzle; DB path via import.meta.url
        migrate.ts      — bun-native migrator (drizzle-orm/bun-sqlite/migrator)

Phase 2 — API (complete)
    packages/api/src/index.ts
        — Hono app; port 5001 (Bun.env.PORT)
        — Routes: GET /health, GET+POST /auth/**, /sessions/*

    packages/api/src/lib/auth.ts
        — Better Auth instance; drizzle adapter + organization plugin
        — emailAndPassword enabled; trusts web origin (BETTER_AUTH_URL, WEB_URL)

    packages/api/src/middleware/session.ts
        — sessionMiddleware: calls auth.api.getSession, attaches user + session to Hono context
        — Applied to /sessions/* — route handlers access c.var.user, c.var.session

    packages/api/src/routes/sessions.ts
        — Pipeline session CRUD + stage triggers (SSE streaming)
        — POST /sessions, GET /sessions/:id/stream, POST /sessions/:id/answers,
          GET /sessions/:id/run, POST /sessions/:id/review, GET /sessions/:id/generate,
          GET /sessions/:id/download

Phase 2 — CLI (complete)
    packages/cli/src/index.tsx
        — Ink (React for CLIs) state machine; clack-inspired visual design
        — Symbols: ◆ active, ◇ done; colors: cyan (active), green (done), dim (secondary)
        — Components: Step, Busy, Prompt (│ spacer + └ input line), NoteBox (spec preview)
        — Stages: idea → extracting → clarifying → resolving → reviewing → generating → done
        — On completion writes all generated files (docs/, CLAUDE.md) to process.cwd()
        — Ink chosen over @clack/prompts for ratatat upgrade path (Ink-compatible API)
        — Compiles to standalone binary: bun build --compile --bytecode

Phase 3 — Web UI (complete)
    packages/web/src/index.ts
        — Bun.serve with route map; port 5000 (Bun.env.PORT)
        — "/" → serves React SPA via Bun fullstack bundler (import from "./index.html")
        — "/api/*" → proxies to packages/api (Bun.env.API_PORT, default 5001)

    packages/web/src/App.tsx
        — React + shadcn/ui
        — Full pipeline UI: idea → clarify → review → generate → ZIP download

MCP Server (complete)
    packages/mcp/src/index.ts
        — McpServer via @modelcontextprotocol/sdk; StdioServerTransport
        — 6 tools: gz_extract, gz_clarify, gz_resolve, gz_draft, gz_generate, gz_zip
        — Each tool wraps the corresponding core pipeline function
        — gz_zip: writes ZIP to outputPath (defaults to /tmp/groundzero-<ts>.zip)
```

---

## Pipeline Flow

```
Browser / CLI / MCP
    ↓ idea (freeform text)
Extract      — parse idea → present info + gaps
    ↓
Clarify      — minimum Q&A to fill gaps (skipped if gaps = 0)
    ↓
Resolve      — fetch live versions + llms.txt per package
    ↓
Draft        — write spec.md
    ↓
Review       — user confirms, edits, or loops back
    ↓
Generate     — produce workspace file tree
    ↓
ZIP          → user downloads and opens in Claude Code
```

Any stage can loop back. State is carried — not restarted. The `PipelineState` type in `packages/core/src/db/schema.ts` is the canonical shape throughout.

---

## Auth Flow

```
Request
    ↓
sessionMiddleware (packages/api/src/middleware/session.ts)
    → auth.api.getSession(headers)
    → c.set("user", ...) / c.set("session", ...)
    ↓
Route handler
    → reads c.var.user / c.var.session (null if unauthenticated)
```

Better Auth handles sign-up/sign-in/sign-out/session refresh at `GET+POST /auth/**`. The session cookie is set by Better Auth; `sessionMiddleware` reads it on every protected request.

---

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Runtime | Bun | Single binary, TypeScript-native, fast startup, native SQLite |
| TypeScript | TypeScript 7 (`@typescript/native-preview` / `tsgo`) | Native TS compilation; 10× faster than tsc |
| Monorepo | Bun workspaces | `packages/{api,cli,core,web,mcp}`; `bun --filter` for root scripts |
| HTTP | Hono | Runs on Bun and CF Workers; SSE via `streamSSE`; typed RPC |
| CLI | Ink | React for CLIs; 38k stars; used by Prisma/GitHub Copilot; state machine pattern |
| Database | `bun:sqlite` via `drizzle-orm/bun-sqlite` | Bun-native; no extra dependencies; zero infrastructure |
| DB migrate | `drizzle-kit generate` + bun-native migrator | `drizzle-kit push` requires `better-sqlite3` which is incompatible with Bun |
| DB location | `packages/core/` | Schema, migrations, config, and `.db` files all co-located |
| LLM | Vercel AI SDK (Apache 2.0) | Unified `generateText()` across all providers; env var driven |
| Auth | Better Auth | Local, in-process; organization plugin for multi-tenancy |
| Auth schema | Hand-written | Better Auth CLI uses jiti internally, which cannot resolve `bun:sqlite` |
| Infra | Hetzner VPS + Pulumi + Caddy | Full control; data residency; no managed lock-in |
| Doc resolution | Live `llms.txt` fetch | Generated workspaces stay current; templates never go stale |

Full decision records: `docs/decisions.md`

---

## External Integrations

| Service | Purpose | Auth method |
|---------|---------|-------------|
| raw.githubusercontent.com | Template + skill delivery via `install.sh` | None (public) |
| LLM provider APIs | Pipeline generation at each stage | `LLM_API_KEY` env var |
| Package CDNs (`llms.txt`) | Live version + doc resolution at generation time | None (public) |

---

## Known Limitations

**CLI bypasses the API.** `packages/cli/src/index.tsx` imports directly from `@groundzero/core/pipeline/*` and runs pipeline functions in-process. CLI sessions are not persisted to the DB and are not tied to a user account. This is intentional — the CLI is a local dev convenience, not a production path.

**Organization plugin is wired but not enforced.** Better Auth's org plugin is installed, the schema has `organization`, `member`, and `invitation` tables, and `session.activeOrganizationId` is populated. No route currently enforces org-scoped session access. The infrastructure is ready when multi-tenancy becomes a requirement.

---

## Security Considerations

- Auth at middleware boundary — `sessionMiddleware` sets context; route handlers never touch auth
- Generated ZIPs contain only `.env.example` — never real secrets
- No user data persisted in Phase 1 (`install.sh` is stateless)
- LLM API keys via env vars only — never hardcoded or logged

---

*Last updated: 2026-05-11*

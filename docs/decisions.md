# Decision Log

Architectural Decision Records (ADRs) — listed newest first.

Run `/decision` to add an entry.

---

## ADR-013: Ink over @clack/prompts for the CLI

**Date:** 2026-05-11
**Status:** Accepted

**Context:**
The CLI UX was sparse. Two options were evaluated to improve it: `@clack/prompts` (linear wizard API with a polished built-in design system) and continuing with Ink (React for CLIs, reactive state machine).

**Options Considered:**
- `@clack/prompts`: sequential async API, beautiful out-of-the-box design (vertical guide bar, state symbols), zero React overhead. Dead end architecturally — no upgrade path.
- Ink: React component model, reactive rendering, more code for simple cases. Upgrade path: `@ratatat/react` is an Ink-compatible drop-in backed by a Rust diff engine (30× faster renders, 700 FPS, full TUI capability).

**Decision:**
Ink. The pipeline has a natural live-streaming use case (watching the spec generate token by token) that requires Ink's reactive model. More importantly, `@ratatat/react` provides an Ink-compatible API — code written against Ink today can migrate to ratatat with an import swap and no logic changes.

The CLI visual design adopts clack's language (◆/◇ symbols, │/└ guide bar, cyan/green/dim palette) implemented as Ink components, so the aesthetics match without taking the architectural dependency.

**Consequences:**
- ✅ Reactive model enables future LLM streaming directly in the terminal
- ✅ Drop-in ratatat upgrade when the library stabilises
- ✅ Clack-inspired visuals without the clack dependency
- ⚠️ More verbose than clack for purely sequential flows

---

## ADR-012: Drizzle artifacts co-located in packages/core

**Date:** 2026-05-10
**Status:** Accepted

**Context:**
After moving to a monorepo, `drizzle.config.ts` lived at the root because it predated the restructure. The root was reaching into `packages/core` for schema paths and placing migration output at the repo root — confusing and inconsistent with the principle of co-locating concerns.

**Decision:**
Move `drizzle.config.ts`, `drizzle/` (migrations), and `*.db` files all into `packages/core/`. DB file path uses `import.meta.url` to resolve relative to the source file, not the CWD.

**Consequences:**
- ✅ All database concerns live in one place alongside the schema
- ✅ `drizzle.config.ts` paths are local (`./src/db/schema.ts`, `./drizzle`)
- ✅ Root has no DB-specific files
- ⚠️ DB path must use `import.meta.url` — a CWD-relative path would break when invoked from root via `bun --filter`

---

## ADR-011: bun-native migrator instead of drizzle-kit push

**Date:** 2026-05-10
**Status:** Accepted

**Context:**
`drizzle-kit push` (the live-sync approach) requires `better-sqlite3` under the hood, which is a native Node.js addon incompatible with Bun. Attempting to use it crashes at runtime.

**Decision:**
Two-step schema update: `drizzle-kit generate` produces SQL migration files, then `drizzle-orm/bun-sqlite/migrator` applies them. Wrapped in `bun db:push` at root so the interface is unchanged.

**Consequences:**
- ✅ Fully Bun-native — no incompatible native addons
- ✅ Migration files are explicit and reviewable (committed to `packages/core/drizzle/`)
- ✅ `bun db:push` is the single user-facing command
- ⚠️ Migration files are generated artifacts — never hand-edit them

---

## ADR-010: Vercel AI SDK for multi-provider LLM support

**Date:** 2026-05-10
**Status:** Accepted

**Context:**
The pipeline originally hardcoded Anthropic. Users running local LLMs (Ollama) or on different cloud providers (OpenAI, Google, Mistral) would be locked out. The provider abstraction needs to be clean and not spread across pipeline files.

**Options Considered:**
- Individual provider SDKs: requires per-provider code paths throughout the pipeline
- Vercel AI SDK (`ai`): Apache 2.0, unified `generateText()` interface, provider factories for all major platforms

**Decision:**
Vercel AI SDK. A single factory function in `packages/core/src/lib/llm.ts` reads `LLM_PROVIDER` and returns a `LanguageModel`. All pipeline code calls `getModel()` — no provider awareness outside the factory.

**Supported providers:** `anthropic` (default), `openai`, `google`, `mistral`, `cohere`, `bedrock`, `azure`, `custom` (OpenAI-compatible endpoint — works with Ollama).

**Consequences:**
- ✅ Provider switch requires only env var change — no code change
- ✅ Open source (Apache 2.0); no vendor dependency
- ✅ Unified interface — pipeline files are provider-agnostic
- ⚠️ Vercel AI SDK v6 uses `maxOutputTokens` (not `maxTokens`) — note for future callers

---

## ADR-009: Ink for CLI terminal UI

**Date:** 2026-05-10
**Status:** Accepted

**Context:**
Phase 2 needs a terminal-based interface for the pipeline (idea entry → clarification Q&A → spec review → confirm generate). Evaluated `@clack/prompts` and Ink.

**Options Considered:**
- `@clack/prompts`: lightweight, imperative, limited layout control
- Ink: React for CLIs, 38k GitHub stars, used by Prisma and GitHub Copilot, supports complex reactive layouts via React state machine

**Decision:**
Ink. The pipeline's stage model maps cleanly to React state — each stage is a discriminated union variant, each transition is a `setStage()` call. `useEffect` per stage drives async pipeline functions. `useCallback` for stable `done`/`fail` helpers prevents stale closure bugs.

**Consequences:**
- ✅ Rich, reactive terminal UI with the same mental model as the web frontend
- ✅ Compiles to a standalone binary via `bun build --compile --bytecode`
- ✅ State machine is explicit and auditable
- ⚠️ JSX requires `.tsx` extension and `"jsx": "react-jsx"` in tsconfig

---

## ADR-008: Bun workspaces monorepo (packages/{api,cli,core,web})

**Date:** 2026-05-10
**Status:** Accepted

**Context:**
Phase 2 adds an API server, a CLI, and Phase 3 adds a web frontend. Keeping everything in a flat `src/` would mix server code, terminal code, browser code, and shared logic — incompatible build targets and conflicting runtime assumptions.

**Decision:**
Bun workspaces monorepo. Four packages:
- `@groundzero/core` — shared pipeline logic, DB, LLM factory; no runtime-specific code
- `@groundzero/api` — Hono HTTP server; depends on core
- `@groundzero/cli` — Ink terminal UI; depends on core; compiles to binary
- `@groundzero/web` — Bun fullstack frontend; proxies API calls; depends on nothing from core directly

**Key implementation details:**
- Each package scaffolded with `bun init` (or `bun init --react=shadcn` for web) from `packages/`
- Each package has its own `tsconfig.json` — root tsconfig removed entirely
- All root scripts use `bun --filter @groundzero/<pkg> run <script>` — no direct `packages/` path references in root scripts
- `drizzle-kit` stays in root `devDependencies` (it's a dev tool, not a runtime dep of any package)

**Consequences:**
- ✅ Clean separation of build targets (browser vs Bun server vs binary)
- ✅ TypeScript configs can differ per package (web needs `"lib": ["DOM"]`)
- ✅ `bun --filter` enables running per-package scripts from root without `cd`
- ⚠️ Bun places workspace symlinks in `packages/<consumer>/node_modules/@groundzero/core`, not root

---

## ADR-007: SQLite (bun:sqlite) over Postgres

**Date:** 2026-05-10
**Status:** Accepted

**Context:**
Phase 2 needs to persist pipeline session state between stages. Postgres requires a running server; for a tool that developers run locally, that's unnecessary friction.

**Decision:**
Use `bun:sqlite` via `drizzle-orm/bun-sqlite`. Bun-native, zero extra dependencies, consistent with using `bun-sql` for Postgres on the same stack.

**Consequences:**
- ✅ Zero infrastructure to run — just a file
- ✅ Works identically in development and CI
- ✅ Drizzle supports bun-sqlite natively
- ⚠️ Not suitable for multi-instance production deployments — acceptable until Phase 3 requires it

---

## ADR-006: Live doc resolution via llms.txt

**Date:** 2026-05-10
**Status:** Accepted

**Context:**
Every scaffold tool with static templates goes stale. Package APIs change, conventions evolve, training data ages.

**Decision:**
Fetch `llms.txt` from each resolved package's domain at generation time (e.g. `bun.sh/llms.txt`, `hono.dev/llms.txt`). Never use cached or hardcoded docs.

**Consequences:**
- ✅ Generated workspaces grounded in current docs, not training data
- ✅ Still useful six months after launch without maintenance
- ⚠️ Requires network access at generation time; must handle fetch failures gracefully

---

## ADR-005: Hetzner VPS + Pulumi + Caddy for infra

**Date:** 2026-05-10
**Status:** Accepted

**Context:**
Need hosting for Phase 3 (web platform). Evaluating managed platforms vs. self-hosted.

**Options Considered:**
- Managed platforms (Railway, Fly, Render): simpler ops, higher cost, vendor lock-in
- Hetzner VPS: bare metal control, cheap, full data residency

**Decision:**
Hetzner VPS. Pulumi for provisioning. Caddy for TLS + reverse proxy. No Docker.

**Consequences:**
- ✅ Low cost; full control; no managed service lock-in
- ✅ Single compiled Bun binary deploys trivially
- ✅ Caddy handles TLS automatically
- ⚠️ More ops responsibility (backups, monitoring, updates)

---

## ADR-004: Better Auth for authentication

**Date:** 2026-05-10
**Status:** Accepted

**Context:**
Phase 3 needs user accounts for workspace history and ZIP delivery.

**Options Considered:**
- Auth0 / Clerk: managed, fast to integrate, expensive at scale, external dependency
- Better Auth: local, open source, runs in-process, organization plugin for multi-tenancy

**Decision:**
Better Auth. Keeps auth in-process. Organization plugin maps cleanly to multi-tenant workspace history.

**Consequences:**
- ✅ No external auth service; simpler architecture
- ✅ Full control over user data
- ⚠️ More implementation work than managed auth
- ⚠️ Better Auth CLI must manage its own tables — do not hand-edit them

---

## ADR-003: TypeScript 7 (`@typescript/native-preview`)

**Date:** 2026-05-10
**Status:** Accepted

**Context:**
TypeScript 7 introduces a native Go-based compiler (`tsgo`) that runs 10× faster and integrates directly with Bun without a separate `tsc` step.

**Decision:**
Use `@typescript/native-preview` as the TypeScript compiler. Typecheck per package: `tsgo -p packages/<name>`. Root tsconfig removed — each package has its own.

**Consequences:**
- ✅ Dramatically faster type-checking
- ✅ Native Bun integration — no build step during development
- ✅ Per-package tsconfig allows DOM lib for web, Bun types for server packages
- ⚠️ Preview; some type-level edge cases may differ from tsc — acceptable given the performance gain
- ⚠️ `bun init`-generated tsconfigs include `noUncheckedIndexedAccess: true` — stricter array indexing; guard computed property access

---

## ADR-002: Hono for HTTP

**Date:** 2026-05-10
**Status:** Accepted

**Context:**
Needed an HTTP framework that works on Bun locally and Cloudflare Workers at edge without code divergence.

**Options Considered:**
- Express: battle-tested but Node-centric, not type-safe by default
- Elysia: Bun-native but Bun-only; would prevent any CF Workers deployment
- Hono: built for edge + Bun, TypeScript-first, SSE support, typed RPC

**Decision:**
Hono. Native SSE via `streamSSE` is required for Phase 3 pipeline streaming.

**Consequences:**
- ✅ Runs identically on Bun and CF Workers
- ✅ Typed RPC via `hc<AppType>`
- ✅ Native SSE — no third-party streaming lib needed
- ✅ Clean middleware composition

---

## ADR-001: Bun as runtime

**Date:** 2026-05-10
**Status:** Accepted

**Context:**
Need a runtime that compiles to a standalone executable, runs TypeScript natively, and avoids Node.js as a dependency.

**Options Considered:**
- Node.js: ubiquitous, large ecosystem, requires separate install
- Bun: TypeScript-native, single binary compilation, native SQLite bindings, fast startup

**Decision:**
Bun. Compile to a single binary for Hetzner deployment.

**Consequences:**
- ✅ No Node.js dependency on the server
- ✅ Native TypeScript + native SQLite bindings
- ✅ Single binary simplifies deploy
- ⚠️ Some Node ecosystem packages not fully compatible — verify per dependency (e.g. `better-sqlite3` is incompatible; use `bun:sqlite`)

# Decision Log

Architectural Decision Records (ADRs) — listed newest first.

Run `/decision` to add an entry.

---

## ADR-007: drizzle-orm/bun-sql over node-postgres

**Date:** 2026-05-10
**Status:** Accepted

**Context:**
Needed a Postgres client. node-postgres (`pg`) is the standard but adds a dependency and routes through Node.js compatibility shims.

**Decision:**
Use `drizzle-orm/bun-sql` — Drizzle's adapter for Bun's built-in `Bun.sql` PostgreSQL bindings.

**Consequences:**
- ✅ Zero extra dependencies — no `pg` package
- ✅ Faster than node-postgres; native Bun bindings
- ✅ Drizzle supports it natively
- ⚠️ Bun-specific — acceptable given the stack commitment

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
TypeScript 7 introduces a native Go-based compiler that runs 10x faster and integrates directly with Bun without a separate `tsc` step.

**Decision:**
Use `@typescript/native-preview` as the TypeScript compiler.

**Consequences:**
- ✅ Dramatically faster type-checking
- ✅ Native Bun integration — no build step during development
- ⚠️ Preview; some type-level edge cases may differ from tsc — acceptable given the performance gain

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
- Bun: TypeScript-native, single binary compilation, native Postgres bindings, fast startup

**Decision:**
Bun. Compile to a single binary for Hetzner deployment.

**Consequences:**
- ✅ No Node.js dependency on the server
- ✅ Native TypeScript + native SQL bindings
- ✅ Single binary simplifies deploy
- ⚠️ Some Node ecosystem packages not fully compatible — verify per dependency

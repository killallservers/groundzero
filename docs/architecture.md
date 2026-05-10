# Architecture

## System Overview

Ground Zero is a two-part product: a POSIX shell installer that bootstraps new projects (Phase 1), and a web-based workspace generator that takes a raw idea through a structured pipeline and produces a ready-to-build Claude Code workspace ZIP (Phase 2+3). Both share the same repo; the installer is `install.sh`, the server is `src/`.

## Component Map

```
Phase 1 — Installer (live)
    install.sh
        ├── fetches templates/docs/*.md     → docs/ in target project
        ├── fetches .claude/skills/         → .claude/skills/ in target project
        ├── fetches .mcp.json               → .mcp.json in target project
        ├── creates symlinks                → CLAUDE.md, AGENTS.md, .cursorrules
        └── substitutes placeholders        → PROJECT_NAME, github.com/org/repo

Phase 2+3 — Web Platform (building)
    Browser
        ↓ idea (freeform text or wizard)
    POST /generate (SSE stream)
        ↓
    Extract      — parse idea → present info + gaps
        ↓
    Clarify      — minimum Q&A to fill gaps
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

Any pipeline stage can loop back. State is carried — not restarted.

## Input Modes (Phase 2)

**Freeform** — paste any text. Extract identifies present info and gaps; Clarify asks the minimum questions.

**Wizard** — guided Q&A, one question at a time. Adaptive: answers prune subsequent questions.

Both feed the same pipeline.

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Runtime | Bun | Single binary, TypeScript-native, fast startup |
| TypeScript | TypeScript 7 (`@typescript/native-preview`) | Native TS compilation; no tsc step |
| HTTP | Hono | Runs on Bun and CF Workers; SSE via `streamSSE`; typed RPC |
| Postgres driver | `drizzle-orm/bun-sql` | Native Bun SQL bindings — no `pg` package |
| Auth | Better Auth | Org plugin for multi-tenancy; Drizzle adapter |
| Infra | Hetzner VPS + Pulumi + Caddy | Full control; data residency; no managed lock-in |
| Doc resolution | Live `llms.txt` fetch | Generated workspaces stay current; templates never go stale |
| Installer language | POSIX sh | Works everywhere; no runtime prerequisite |

Full decision records: `docs/decisions.md`

## External Integrations

| Service | Purpose | Auth method |
|---------|---------|-------------|
| raw.githubusercontent.com | Template + skill delivery via `install.sh` | None (public) |
| Package CDNs (`llms.txt`) | Live version + doc resolution at generation time | None (public) |

## Security Considerations

- Auth at middleware boundary — `sessionMiddleware` sets context; route handlers never touch auth
- Generated ZIPs contain only `.env.example` — never real secrets
- No user data persisted in Phase 1 (install.sh is stateless)

---

*Last updated: 2026-05-10*

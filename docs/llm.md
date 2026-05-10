# Ground Zero — AI Navigation Guide

> This file is the project constitution. It loads in every Claude Code session.
> Procedures belong in `.claude/skills/`, not here.

---

## Project Overview

**What:** AI workspace generator — paste a project idea, receive a fully specced Claude Code workspace ZIP, ready to build.
**Why:** Eliminates the hours of setup (versions, conventions, docs, AI context) between having an idea and being able to code.
**Status:** Phase 1 complete (`install.sh` + templates). Phase 2 (agent pipeline) and Phase 3 (web UI) building next.
**Repo:** github.com/killallservers/groundzero

---

## Tech Stack

| Layer      | Technology                          | Notes                                      |
|------------|-------------------------------------|--------------------------------------------|
| Language   | TypeScript 7                        | `@typescript/native-preview`; no CommonJS  |
| Runtime    | Bun                                 | No Node; single compiled binary output     |
| Framework  | Hono                                | HTTP layer; runs on Bun and CF Workers     |
| Database   | SQLite (`bun:sqlite`)               | Drizzle ORM via `drizzle-orm/bun-sqlite`; Bun-native     |
| Auth       | Better Auth                         | Organization plugin for multi-tenancy      |
| Infra      | Hetzner VPS                         | Pulumi provisioning; Caddy TLS; no Docker  |
| Formatting | Biome                               | Replaces ESLint + Prettier                 |

---

## Repository Structure

```
install.sh              — Phase 1: POSIX sh installer (curl | sh)
templates/docs/         — doc templates copied into generated workspaces
.claude/skills/         — workflow guides distributed with install.sh
docs/                   — documentation for this repo itself
src/                    — Phase 2+3 server code (Bun + Hono)
```

---

## Coding Conventions

- TypeScript 7 native — `@typescript/native-preview` as the TS compiler
- Biome for all formatting and linting — no ESLint, no Prettier
- ESM imports everywhere; no CommonJS
- `drizzle-orm/bun-sqlite` for the database — Bun-native, no extra dependencies
- `bun add <pkg>@latest` on the CLI — never write versions in `package.json` by hand
- Drizzle schema changes via `bun db:push` only — never hand-edit migration files
- kebab-case filenames; PascalCase types
- No `process.env` in packages — typed build constants or injected config

---

## Architecture Principles

- Pipeline is stateful and patchable: any stage can loop back without restarting
- Resolution at generation time — live `llms.txt` + package versions, never cached in templates
- Single compiled Bun binary; no Docker, no managed services
- Auth at middleware — route handlers never contain auth logic
- Specs are permanent — code is regenerable, intent is not

---

## Hard Constraints

- Never modify Drizzle-generated migration files, snapshots, or journal
- Never add runtime dependencies without explicit approval
- Never commit secrets, tokens, or credentials
- Use `bun db:push` not `generate` + `migrate`
- No `pg` package — use `drizzle-orm/bun-sql`
- No Node.js built-ins or polyfills — Bun-native APIs only
- Template placeholders must remain `[TODO]` — never leave a project-specific value in a generic template

---

## Key Contacts & Decisions

- Decisions log: `docs/decisions.md`
- Open specs: `.claude/specs/`
- Architecture doc: `docs/architecture.md`

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

# [PROJECT NAME] — AI Navigation Guide

> This file is the project constitution. It loads in every Claude Code session.
> Procedures belong in `.claude/skills/`, not here.

---

## Project Overview

**What:** [One-sentence description]
**Why:** [The problem it solves]
**Status:** [Current phase or state]
**Repo:** [github.com/org/repo]

---

## Tech Stack

| Layer      | Technology                          | Notes                                     |
|------------|-------------------------------------|-------------------------------------------|
| Language   | TypeScript 7                        | `@typescript/native-preview`; no CommonJS |
| Runtime    | Bun                                 | No Node; single compiled binary output    |
| Framework  | Hono                                | HTTP layer; runs on Bun and CF Workers    |
| Database   | Postgres                            | Drizzle ORM via `drizzle-orm/bun-sql`     |
| Auth       | Better Auth                         | [TODO: org plugin if multi-tenant]        |
| Infra      | Hetzner VPS                         | Pulumi provisioning; Caddy TLS; no Docker |
| Formatting | Biome                               | Replaces ESLint + Prettier                |

---

## Repository Structure

```
[TODO: fill in as the project takes shape]
```

---

## Coding Conventions

- TypeScript 7 native — `@typescript/native-preview` as the TS compiler
- Biome for all formatting and linting — no ESLint, no Prettier
- ESM imports everywhere; no CommonJS
- `drizzle-orm/bun-sql` for Postgres — no `pg` package
- `bun add <pkg>@latest` on the CLI — never write versions in `package.json` by hand
- Drizzle schema changes via `bun db:push` only — never hand-edit migration files
- kebab-case filenames; PascalCase types
- No `process.env` in packages — typed build constants or injected config

---

## Architecture Principles

[TODO: key architectural decisions and patterns]

---

## Hard Constraints

- Never modify Drizzle-generated migration files, snapshots, or journal
- Never add runtime dependencies without explicit approval
- Never commit secrets, tokens, or credentials
- Use `bun db:push` not `generate` + `migrate`
- No `pg` package — use `drizzle-orm/bun-sql`
- No Node.js built-ins or polyfills — Bun-native APIs only

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

*Last updated: [DATE]*

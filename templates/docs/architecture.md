# Architecture

## System Overview

[TODO: One paragraph describing what this system is and how it's structured at a high level]

## Component Map

```
[TODO: ASCII diagram of main components and how they connect]
```

## Data Flow

[TODO: Walk through how a request or event moves through the system end-to-end]

1. [Step 1]
2. [Step 2]
3. [Step 3]

## Package Responsibilities

| Package | Responsibility |
|---------|---------------|
| [TODO]  | [TODO]        |

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Runtime | Bun | Single binary, TypeScript-native, native SQL bindings |
| HTTP | Hono | Runs on Bun and CF Workers; typed RPC; native SSE |
| Postgres driver | `drizzle-orm/bun-sql` | Native Bun bindings — no `pg` package |
| Auth | Better Auth | Framework-agnostic; org plugin for multi-tenancy |
| Infra | Hetzner VPS + Pulumi + Caddy | Full control; data residency; no managed lock-in |
| [TODO] | [TODO] | [TODO] |

Full decision records: `docs/decisions.md`

## External Integrations

| Service | Purpose | Auth method |
|---------|---------|-------------|
| [TODO]  | [TODO]  | [TODO]      |

## Security Considerations

- Auth at middleware boundary — route handlers never contain auth logic
- [TODO: tenancy, token scoping, data isolation]

---

*Last updated: [DATE]*

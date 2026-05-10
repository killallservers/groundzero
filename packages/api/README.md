# @groundzero/api

Hono HTTP server. Exposes the Ground Zero pipeline over REST. Runs on Bun.

## Routes

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check → `{ "status": "ok" }` |
| `GET` | `/sessions` | List all pipeline sessions |
| `POST` | `/sessions` | Create session + run pipeline |
| `GET` | `/sessions/:id` | Get session by ID |
| `PATCH` | `/sessions/:id` | Advance session to next stage |

## Dev

```sh
# from repo root
bun dev                          # runs packages/api dev with --watch

# or directly
bun --filter @groundzero/api run dev
```

Default port: `3000`. Override with `PORT` env var.

## Build

```sh
bun --filter @groundzero/api run build
# → dist/groundzero-server  (standalone binary, Bun runtime embedded)
```

## Environment Variables

| Key | Default | Description |
|-----|---------|-------------|
| `PORT` | `3000` | HTTP port |
| `DATABASE_PATH` | `packages/core/groundzero.db` | SQLite file path |
| `LLM_PROVIDER` | `anthropic` | LLM provider (see `@groundzero/core`) |
| `LLM_API_KEY` | — | API key for selected provider |
| `BETTER_AUTH_SECRET` | — | Required for auth (Phase 3) |

# Deployment

## Platform

Hybrid: Bun HTTP server on Hetzner VPS + Cloudflare Workers at edge.
Pulumi manages infrastructure. Caddy handles TLS + reverse proxy. No Docker.

## Environments

| Environment | URL / Host | Branch | Deploy trigger |
|-------------|------------|--------|----------------|
| Production | killallservers.com/groundzero | `main` | GitHub Actions on push |

## Prerequisites

- Pulumi CLI installed
- Bun installed locally
- VPS SSH key (Ed25519)
- GitHub repo with Actions enabled

## Provision VPS

```bash
cd infra/pulumi
bun install
pulumi stack init prod
pulumi config set --secret sshPublicKey "$(cat ~/.ssh/id_ed25519.pub)"
pulumi config set sshPort 2222
pulumi up
```

## DNS

Point `killallservers.com` at the floating IP.

```bash
pulumi stack output serverIp
```

## First Deploy

Push to `main` — GitHub Actions handles it.

Required secrets: `VPS_HOST`, `VPS_USER` (deploy), `VPS_SSH_KEY`, `VPS_SSH_PORT` (2222).

## Connect to Server

```bash
pulumi stack output sshCommand
# → ssh deploy@<ip> -p 2222
```

## Build

```bash
# API server binary
bun --filter @groundzero/api run build
# → dist/groundzero-server

# CLI binary
bun --filter @groundzero/cli run build
# → dist/groundzero

# Web production bundle
bun --filter @groundzero/web run build
# → packages/web/dist/
```

## Phase 1 — Install Script

`install.sh` is served directly from `raw.githubusercontent.com`. No server required. Deployment = merging to `main`.

## Environment Variables

> Never commit values. Document keys here.

### API (`packages/api`)

| Key | Required | Default | Description |
|-----|----------|---------|-------------|
| `PORT` | No | `3000` | API HTTP port |
| `DATABASE_PATH` | No | `packages/core/groundzero.db` | SQLite file path (resolved via `import.meta.url`) |
| `BETTER_AUTH_SECRET` | Yes | — | Secret for signing sessions |
| `GOOGLE_CLIENT_ID` | No | — | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | No | — | Google OAuth client secret |

### LLM (`packages/core`)

| Key | Required | Default | Description |
|-----|----------|---------|-------------|
| `LLM_PROVIDER` | No | `anthropic` | `anthropic` \| `openai` \| `google` \| `mistral` \| `cohere` \| `bedrock` \| `azure` \| `custom` |
| `LLM_MODEL` | No | provider default | Override the model ID (e.g. `claude-opus-4-7`, `gpt-4o`) |
| `LLM_API_KEY` | Depends | — | API key for the selected provider (not needed for `bedrock` or `custom`) |
| `LLM_BASE_URL` | No | `http://localhost:11434/v1` | Base URL for `custom` provider (Ollama or any OpenAI-compatible endpoint) |

### Web (`packages/web`)

| Key | Required | Default | Description |
|-----|----------|---------|-------------|
| `PORT` | No | `5173` | Web server port |
| `API_PORT` | No | `3000` | Port of the API server to proxy to |
| `NODE_ENV` | No | — | Set to `production` to disable HMR |

## Health Check

`GET /api/health` → `{ "status": "ok" }` (via web → api proxy)
`GET /health` → `{ "status": "ok" }` (api directly on port 3000)

---

*Last updated: 2026-05-10*

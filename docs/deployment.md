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

## Deploy Process

```bash
# build binary
bun build --compile --target=bun src/index.ts --outfile=groundzero

# deploy via GitHub Actions on push to main
# manual: push to main or re-run the workflow
```

## Phase 1 — Install Script

`install.sh` is served directly from `raw.githubusercontent.com`. No server required. Deployment = merging to `main`.

## Environment Variables

> Never commit values. Document keys here.

| Key | Required | Description |
|-----|----------|-------------|
| `DATABASE_PATH` | No | SQLite file path (default `./groundzero.db`) |
| `BETTER_AUTH_SECRET` | Yes | Secret for signing sessions |
| `GOOGLE_CLIENT_ID` | No | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth client secret |
| `PORT` | No | HTTP port (default 3000) |

## Health Check

`GET /health` → `{ status: "ok" }`

---

*Last updated: 2026-05-10*

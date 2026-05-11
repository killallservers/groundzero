# @groundzero/web

Bun fullstack server + React frontend. Serves the Ground Zero web UI and proxies API calls to `@groundzero/api`.

Full pipeline UI: idea → clarifying questions → spec review → workspace generation → ZIP download.

## Dev

```sh
# from repo root (starts API on :3000 + web on :5173)
bun dev
```

Web: `http://localhost:5173`
API: `http://localhost:3000`

## How it works

`src/index.ts` uses the Bun fullstack bundler:

```ts
import index from "./index.html";   // Bun bundles + serves the React app

Bun.serve({
  routes: {
    "/": index,                      // SPA
    "/api/*": async (req) => { ... } // proxy → packages/api
  }
});
```

HMR is active in development. Production build (`bun run build`) compiles to `dist/`.

## Build

```sh
bun --filter @groundzero/web run build
# → packages/web/dist/
```

## Environment Variables

| Key | Default | Description |
|-----|---------|-------------|
| `PORT` | `5173` | Web server port |
| `API_PORT` | `3000` | API server port to proxy to |
| `NODE_ENV` | — | Set to `production` to disable HMR |

## Stack

- React 19 + TypeScript
- Tailwind CSS v4 (via `bun-plugin-tailwind`)
- shadcn/ui components (Radix UI primitives)
- Bun fullstack bundler (`import from "./index.html"`)
- Path alias: `@/` → `src/`

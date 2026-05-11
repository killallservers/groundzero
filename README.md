# Ground Zero

[Kill All Servers](https://killallservers.com)

---

You know the feeling. The idea is good. The notes app entry is there. The repo has one commit. But starting — actually starting — means hours of setup before you write a single line of code. Picking versions. Writing conventions. Explaining the project to your AI assistant. Again.

Ground Zero kills that.

## What it is

Two things:

**A `curl | sh` installer** that drops AI context docs, Claude Code skills, and MCP config into any project in thirty seconds.

**A workspace generator** — paste a project idea, answer a few questions, get a ready-to-build Claude Code workspace with every doc your AI needs, wired up and accurate.

## Quick start

### Step 1 — Install into your project

```sh
mkdir my-project && cd my-project
git init
curl -fsSL https://raw.githubusercontent.com/killallservers/groundzero/main/install.sh | sh
```

You'll be asked for a project name and GitHub repo. Takes thirty seconds.

**What you get:**

```
my-project/
├── CLAUDE.md → docs/llm.md      # Claude Code
├── AGENTS.md → docs/llm.md      # OpenCode, others
├── .cursorrules → docs/llm.md   # Cursor
├── .mcp.json                    # MCP servers (GitHub, Plane, Ground Zero)
│
├── docs/
│   ├── llm.md                   # Stack, conventions, constraints
│   ├── architecture.md          # How it's built and why
│   ├── constraints.md           # Hard limits
│   ├── decisions.md             # ADR log
│   ├── context.md               # Domain language glossary
│   ├── spec.md                  # Feature spec template
│   ├── testing.md               # Test strategy
│   └── deployment.md            # Deploy process
│
└── .claude/
    └── skills/                  # Workflow guides (TDD, spec, ADR, diagnose…)
```

The docs are stubs. Step 2 fills them in.

### Step 2 — Generate your workspace

Run the generator from inside your project. It asks for your idea, asks a few questions, then writes out all your docs filled in and accurate.

**Option A — CLI (quickest, terminal only):**

```sh
cd my-project
LLM_API_KEY=sk-ant-... bun /path/to/groundzero/packages/cli/src/index.tsx
```

Or if you built the binary:

```sh
LLM_API_KEY=sk-ant-... gz
```

The CLI runs interactively:

```
groundzero — AI workspace generator

Project idea: a SaaS todo app with teams and Stripe billing

  Analysing…

Question 1 / 3: What database should we use?
> SQLite via Drizzle

Question 2 / 3: Does this need a mobile app?
> No, web only

Question 3 / 3: Should the API be public or internal only?
> Internal only for now

  Resolving packages and drafting spec…

┌─────────────────────────────────┐
│ Spec preview                    │
│                                 │
│ # SaaS Todo App                 │
│                                 │
│ ## Problem                      │
│ …                               │
└─────────────────────────────────┘

Generate workspace? [y/n] y

  Generating workspace files…

✓ Done! 8 files written to /path/to/my-project
  · docs/llm.md
  · docs/architecture.md
  · docs/constraints.md
  · docs/decisions.md
  · docs/context.md
  · docs/testing.md
  · docs/deployment.md
  · CLAUDE.md
```

Your `docs/` directory is now filled in. Open the project in Claude Code and start building.

**Option B — MCP (from inside Claude Code):**

Open `.mcp.json` and replace `YOUR_API_KEY`:

```json
"groundzero": {
  "command": "bunx",
  "args": ["@groundzero/mcp"],
  "env": {
    "LLM_PROVIDER": "anthropic",
    "LLM_API_KEY": "sk-ant-..."
  }
}
```

Open the project in Claude Code. The `groundzero` MCP server starts automatically. Ask Claude:

> "Use ground zero to generate a workspace for this project"

Claude will call `gz_extract` → `gz_clarify` → `gz_resolve` → `gz_draft` → `gz_generate` → `gz_zip`, asking you questions along the way. At the end you get a ZIP with fully filled-in docs.

**Option C — Web UI:**

```sh
# from the groundzero repo
LLM_API_KEY=sk-ant-... bun dev   # API on :3000, web on :5173
```

Open `http://localhost:5173`.

## Workspace generator

### CLI

```sh
# run directly from the groundzero repo
LLM_API_KEY=sk-ant-... bun /path/to/groundzero/packages/cli/src/index.tsx

# or build a standalone binary
bun run build:cli        # → dist/gz
mv dist/gz /usr/local/bin/gz
LLM_API_KEY=sk-ant-... gz
```

The CLI runs entirely locally — no server, no account. Run it from inside any project and it writes docs directly to your current directory.

### MCP

The installed `.mcp.json` wires up six tools. Claude orchestrates the flow:

| Tool | Does |
|------|------|
| `gz_extract` | Parse idea → knowns + gaps |
| `gz_clarify` | Generate clarifying questions |
| `gz_resolve` | Fetch live package versions + llms.txt |
| `gz_draft` | Write spec.md |
| `gz_generate` | Generate workspace file tree |
| `gz_zip` | Bundle to ZIP |

## LLM providers

Switch providers with `LLM_PROVIDER`. Defaults to Anthropic.

```sh
LLM_PROVIDER=openai LLM_API_KEY=sk-... gz
LLM_PROVIDER=custom LLM_BASE_URL=http://localhost:11434/v1 gz   # Ollama
```

Supported: `anthropic`, `openai`, `google`, `mistral`, `cohere`, `bedrock`, `azure`, `custom`.

## Development

```sh
git clone https://github.com/killallservers/groundzero
cd groundzero
bun install

bun dev           # API server (port 3000)
bun run check     # Biome lint + format check
bun run typecheck # tsgo across all packages
bun test          # 97 tests across mcp, core, api
bun db:push       # Generate + apply DB migrations (from packages/core)
```

### Local MCP dev

To test the MCP server against a local groundzero checkout, update `.mcp.json` in your test project:

```json
"groundzero": {
  "command": "bun",
  "args": ["/path/to/groundzero/packages/mcp/src/index.ts"],
  "env": {
    "LLM_PROVIDER": "anthropic",
    "LLM_API_KEY": "sk-ant-..."
  }
}
```

### Packages

| Package | Role |
|---------|------|
| `@groundzero/core` | Pipeline logic, DB, LLM factory |
| `@groundzero/api` | Hono HTTP server |
| `@groundzero/cli` | Ink terminal UI |
| `@groundzero/web` | Bun fullstack frontend |
| `@groundzero/mcp` | MCP server (6 granular tools) |

---

**[killallservers.com](https://killallservers.com)** · **[@killallservers](https://github.com/killallservers)**

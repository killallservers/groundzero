# Ground Zero

[Kill All Servers](https://killallservers.com)

---

You know the feeling. The idea is good. The notes app entry is there. The repo has one commit. But starting — actually starting — means hours of setup before you write a single line of code. Picking versions. Writing conventions. Explaining the project to your AI assistant. Again.

Ground Zero kills that.

## What it is

Two things:

**A `curl | sh` installer** that drops AI context docs, Claude Code skills, and MCP config into any project in thirty seconds.

**A workspace generator** — paste a project idea, answer a few questions, get a ready-to-build Claude Code workspace ZIP with every doc your AI needs, wired up and accurate.

## Quick start (installer)

```sh
curl -fsSL https://raw.githubusercontent.com/killallservers/groundzero/main/install.sh | sh
```

Drops into any project directory. Takes thirty seconds. Then run `/init` in Claude Code to fill in your project details.

## What you get

```
your-project/
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

## Workspace generator

### CLI

```sh
gz
```

Runs the full pipeline interactively in the terminal: idea → clarification → spec review → ZIP.

### Web UI

```sh
bun dev   # API on :3000, web on :5173
```

Open `http://localhost:5173` — same pipeline, browser UI.

### MCP server

Add `@groundzero/mcp` to your `.mcp.json` and call the pipeline tools directly from any Claude Code conversation:

| Tool | Does |
|------|------|
| `gz_extract` | Parse idea → knowns + gaps |
| `gz_clarify` | Generate clarifying questions |
| `gz_resolve` | Fetch live package versions + llms.txt |
| `gz_draft` | Write spec.md |
| `gz_generate` | Generate workspace file tree |
| `gz_zip` | Bundle to ZIP |

The LLM orchestrates the flow — it decides when to skip, loop back, or ask the user for confirmation.

## LLM providers

Switch providers with `LLM_PROVIDER`. Defaults to Anthropic.

```sh
LLM_PROVIDER=openai LLM_API_KEY=sk-... gz
LLM_PROVIDER=custom LLM_BASE_URL=http://localhost:11434/v1 gz   # Ollama
```

Supported: `anthropic`, `openai`, `google`, `mistral`, `cohere`, `bedrock`, `azure`, `custom`.

## Development

```sh
bun install

bun dev           # API server (port 3000)
bun run check     # Biome lint + format check
bun run typecheck # tsgo across all packages
bun test          # Bun test runner
bun db:push       # Generate + apply DB migrations
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

# @groundzero/core

Shared pipeline logic, database, and LLM factory. No server or browser code — consumed by `@groundzero/api` and `@groundzero/cli`.

## Structure

```
src/
  db/
    schema.ts       — sessions table; PipelineState JSON column
    index.ts        — bun:sqlite connection via drizzle-orm/bun-sqlite
    migrate.ts      — bun-native migrator (run via bun db:migrate from root)
  lib/
    llm.ts          — multi-provider LLM factory (Vercel AI SDK)
  pipeline/
    extract.ts      — parse idea → present info + gaps
    clarify.ts      — generate minimum Q&A from gaps
    resolve.ts      — fetch live package versions + llms.txt
    draft.ts        — write spec.md from resolved state
    generate.ts     — produce workspace file tree
    zip.ts          — bundle output into ZIP
drizzle/            — generated SQL migrations (never hand-edit)
drizzle.config.ts   — drizzle-kit config
groundzero.db       — SQLite database file (gitignored)
```

## Database

```sh
# from repo root — generates SQL + applies via bun-native migrator
bun db:push

# or separately
bun db:generate   # drizzle-kit generate → drizzle/*.sql
bun db:migrate    # apply pending migrations
```

## LLM Configuration

Set `LLM_PROVIDER` to switch providers. All others default to `anthropic`.

| `LLM_PROVIDER` | Default model | Needs `LLM_API_KEY` |
|---------------|---------------|----------------------|
| `anthropic` | `claude-opus-4-7` | yes |
| `openai` | `gpt-4o` | yes |
| `google` | `gemini-2.5-pro` | yes |
| `mistral` | `mistral-large-latest` | yes |
| `cohere` | `command-r-plus` | yes |
| `bedrock` | `anthropic.claude-opus-4-7-v1:0` | no (uses AWS credentials) |
| `azure` | `gpt-4o` | yes |
| `custom` | `llama3` | no (set `LLM_BASE_URL`) |

`custom` uses the OpenAI-compatible endpoint. Default base URL: `http://localhost:11434/v1` (Ollama).

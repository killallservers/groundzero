# @groundzero/mcp

MCP server exposing the Ground Zero pipeline as granular tools. Any MCP-compatible LLM client (Claude Code, Cursor, etc.) can call these tools to orchestrate workspace generation from within a conversation.

## Tools

| Tool | Input | Output | Description |
|------|-------|--------|-------------|
| `gz_extract` | `idea` | `{ present, gaps }` | Parse idea → identify knowns and gaps |
| `gz_clarify` | `idea, gaps` | `string[]` | Generate minimum clarifying questions |
| `gz_resolve` | `answers` | `{ packages }` | Fetch live versions + llms.txt docs |
| `gz_draft` | full state | spec (markdown) | Write structured spec.md |
| `gz_generate` | full state + spec | file tree | Generate all workspace files |
| `gz_zip` | files, outputPath? | `{ path, size }` | Bundle files into a ZIP |

## Pipeline Flow

The LLM calls these tools in order, passing state forward between calls:

```
gz_extract(idea)
    → gaps? → gz_clarify(idea, gaps) → collect answers from user
gz_resolve(answers)
gz_draft(idea, extracted, questions, answers, resolved)
    → show spec to user, get confirmation
gz_generate(idea, extracted, questions, answers, resolved, spec)
gz_zip(files)
    → return path to user
```

`gz_clarify` can be skipped if `gaps` is empty. The LLM decides when to loop back.

## Usage in Claude Code

Add to `.mcp.json` in your project root (local dev, points at source):

```json
{
  "mcpServers": {
    "groundzero": {
      "command": "bun",
      "args": ["run", "/path/to/groundzero/packages/mcp/src/index.ts"],
      "env": {
        "LLM_PROVIDER": "anthropic",
        "LLM_API_KEY": "sk-ant-..."
      }
    }
  }
}
```

## Environment Variables

Inherits all LLM configuration from `@groundzero/core`:

| Key | Default | Description |
|-----|---------|-------------|
| `LLM_PROVIDER` | `anthropic` | Provider: `anthropic` \| `openai` \| `google` \| `mistral` \| `cohere` \| `bedrock` \| `azure` \| `custom` |
| `LLM_MODEL` | provider default | Override model ID |
| `LLM_API_KEY` | — | API key for selected provider |
| `LLM_BASE_URL` | `http://localhost:11434/v1` | Base URL for `custom` provider |

## Build

```sh
bun --filter @groundzero/mcp run build
# → dist/groundzero-mcp  (standalone binary)
```

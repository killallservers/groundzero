# @groundzero/cli

Ink (React for CLIs) terminal UI for the Ground Zero pipeline. Runs the full Extract → Clarify → Resolve → Draft → Review → Generate flow interactively in the terminal. Compiles to a standalone binary.

## Run

```sh
# from repo root (dev mode)
bun --filter @groundzero/cli run src/index.tsx

# compiled binary
./dist/groundzero
```

## Build

```sh
bun --filter @groundzero/cli run build
# → dist/groundzero  (standalone binary, Bun runtime embedded)
```

## UI Flow

```
┌─ groundzero — AI workspace generator
│
│  Project idea: _
│
│  ✓ Idea analysed
│  ✓ Questions generated
│
│  Question 1 / 3
│  What is the primary user of this tool?
│  > _
│
│  ✓ Resolved 8 packages
│  ✓ Spec drafted
│
│  ╭─ Spec preview ──────────────╮
│  │  # My Project               │
│  │  ...                        │
│  ╰─────────────────────────────╯
│
│  Generate workspace? [y/n] _
│
│  ✓ Generated 12 files.
```

## Architecture

State machine with discriminated union stages: `idea → extracting → clarifying → resolving → reviewing → generating → done`. Each stage transition is a `setStage()` call; each async stage runs in a `useEffect`. `done` and `fail` helpers are `useCallback`-wrapped to satisfy exhaustive dependency rules.

## Environment Variables

Same as `@groundzero/api` — `LLM_PROVIDER`, `LLM_API_KEY`, `DATABASE_PATH`.

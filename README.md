# Ground Zero

[Kill All Servers](https://killallservers.com)

---

You know the feeling. The idea is good. The notes app entry is there. The repo has one commit. But starting — actually starting — means hours of setup before you write a single line of code. Picking versions. Writing conventions. Explaining the project to your AI assistant. Again.

Ground Zero kills that.

One command. Every doc your AI assistant needs, wired up and ready.

## Quick start

```sh
curl -fsSL https://raw.githubusercontent.com/killallservers/groundzero/main/install.sh | sh
```

Drops into any project directory. Takes thirty seconds.

## What you get

```
your-project/
├── CLAUDE.md → docs/llm.md      # Claude Code
├── AGENTS.md → docs/llm.md      # OpenCode, others
├── .cursorrules → docs/llm.md   # Cursor
│
├── docs/
│   ├── llm.md                   # Stack, conventions, constraints
│   ├── architecture.md          # How it's built and why
│   ├── constraints.md           # Hard limits
│   ├── decisions.md             # The why behind every choice
│   ├── context.md               # Domain language glossary
│   ├── spec.md                  # Feature spec template
│   ├── testing.md               # Test strategy
│   └── deployment.md            # Deploy process
│
└── .claude/
    └── skills/                  # Workflow guides (TDD, spec, ADR, diagnose…)
```

Then run `/init` in Claude Code to fill in your project details.

## Why it works

Every doc is a template, not a scaffold. Your AI assistant reads `docs/llm.md` at the start of every session and knows your stack, your conventions, your constraints — without you re-explaining them.

The skills in `.claude/skills/` give it repeatable workflows: spec a feature, run a TDD loop, log a decision, diagnose a bug. Same process every time.

## Development

This repo uses spec-driven development with Claude Code.

```
/init                    # Fill in your project details across all docs
/spec-create <feature>   # Interview → spec → .claude/specs/<feature>.md
/spec-review <feature>   # Review spec before implementing
/decision <title>        # Log an architectural decision
/commit                  # Conventional commit with spec linkage
```

---

**[killallservers.com](https://killallservers.com)** · **[@killallservers](https://github.com/killallservers)**

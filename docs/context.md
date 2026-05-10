# Ground Zero — Domain Language

> Shared vocabulary for the AI agent and the team.
> One term = one definition. Update whenever a new concept gets a name.

---

## Core Concepts

| Term | Definition |
|------|------------|
| Ground Zero | The product — workspace generator and bootstrap installer |
| Workspace | The generated project deliverable — a ZIP containing `CLAUDE.md`, `docs/`, skills, and config, ready to open in Claude Code |
| Idea | The user's raw project description; preserved verbatim as the Intent in the spec |
| Intent | The raw idea, exactly as submitted — never mutated or summarised |
| Scaffold | The act of generating a workspace from a resolved spec |
| Resolution | Live fetching of current package versions and `llms.txt` docs at generation time — not from training data or cached templates |
| Spec | The structured `docs/spec.md` written during pipeline execution; source of truth for all generated files |

## Pipeline Stages

| Term | Definition |
|------|------------|
| Extract | Parse the user's idea to identify present information and gaps |
| Clarify | Minimum-questions Q&A phase to fill extracted gaps before generation |
| Resolve | Fetch live package versions and `llms.txt` per dependency |
| Draft | Write `spec.md` |
| Review | User confirmation step — approve, edit, or loop back to any prior stage |
| Generate | Produce the actual workspace files from the confirmed spec |

## Domain Objects

| Term | Definition |
|------|------------|
| Stack | The complete technology choices for a given workspace (language, runtime, framework, DB, auth, infra) |
| Skill | A structured `SKILL.md` workflow guide loaded by the AI on demand |
| Registry | The indexed set of available skills, keyed by technology |
| `llms.txt` | Machine-readable documentation file fetched from a package's own domain at resolution time (e.g. `bun.sh/llms.txt`) |

## States

| Term | Definition |
|------|------------|
| Inert | An idea not yet scaffolded — sitting in a notes app or a one-commit repo |
| Primed | A workspace that has been generated and is ready to build |
| Confirmed | A spec the user has approved; treated as append-only from this point |
| Stale | A template, version, or doc that was accurate at generation time but has since drifted |

## Abbreviations

| Abbrev | Expands to |
|--------|------------|
| GZ | Ground Zero |
| WS | Workspace |
| ADR | Architectural Decision Record |
| SSE | Server-Sent Events (Phase 3 pipeline streaming) |

---

*Last updated: 2026-05-10*

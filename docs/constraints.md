# Constraints

Hard constraints for this codebase. Must be respected unconditionally.

---

## Never Do

### Architecture
- Do not write auth logic in route handlers — `sessionMiddleware` handles it
- Do not add Docker or managed cloud services
- Do not add feature flags for business logic — infra capabilities only

### Database
- Do not modify Drizzle-generated migration files, snapshots, or journal
- Do not modify Better Auth tables manually — let `bunx auth@latest generate` manage them
- Do not use `bun db:generate` + `migrate` — use `bun db:push` only
- Do not use the `pg` package — use `drizzle-orm/bun-sql`

### Code
- Do not use Node.js built-ins or polyfills — Bun-native APIs only
- Do not write package versions in `package.json` by hand — `bun add <pkg>@latest` on the CLI
- Do not use `process.env` directly in packages — typed build constants or injected config
- Do not commit secrets, tokens, or credentials of any kind

### Templates
- Do not embed specific package versions in templates — resolution happens live at generation time
- Do not leave project-specific values in generic templates — every fill-in must be `[TODO]` or `[SCREAMING_SNAKE]`

## Always Do

- Fetch `llms.txt` and versions live at generation time — never use hardcoded or cached values
- Preserve the user's raw idea verbatim as Intent in every generated spec
- Keep `docs/llm.md` (CLAUDE.md) factual and concise — procedures go in `.claude/skills/`
- Test `install.sh` changes on both GNU sed (Linux) and BSD sed (macOS)

## External API / Rate Limit Notes

| Service | Limit | Notes |
|---------|-------|-------|
| Package CDNs (`llms.txt`) | Varies per host | Implement retry + timeout in resolution |
| raw.githubusercontent.com | GitHub rate limits | Public repo; generous for anonymous fetches |

## Regulatory / Legal

- Generated workspaces must never embed user secrets — `.env.example` only
- MIT license; attribute origin where templates are substantially derived from upstream

---

*Last updated: 2026-05-10*

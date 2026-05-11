#!/usr/bin/env sh
set -e

REPO="killallservers/groundzero"
BASE="https://raw.githubusercontent.com/${REPO}/main"

printf "\nGround Zero — AI workspace bootstrap\n"
printf "https://github.com/%s\n\n" "$REPO"

if ! command -v curl >/dev/null 2>&1; then
  printf "Error: curl is required.\n"
  exit 1
fi

# Prompt for project info
printf "Project name: "
read -r PROJECT_NAME < /dev/tty
printf "GitHub repo (org/repo, leave blank to fill in later): "
read -r PROJECT_REPO < /dev/tty
printf "\n"

# Create directories
mkdir -p docs .claude/specs
for skill in init align commit decision diagnose spec-create spec-review tdd zoom-out; do
  mkdir -p ".claude/skills/${skill}"
done

# Download docs
printf "Downloading docs...\n"
for doc in llm architecture constraints decisions testing deployment context; do
  target="docs/${doc}.md"
  if [ -f "$target" ]; then
    printf "  skip  %s (already exists)\n" "$target"
  else
    curl -fsSL "${BASE}/templates/docs/${doc}.md" -o "$target"
    printf "  ✓  %s\n" "$target"
  fi
done

# Download spec template
if [ ! -f docs/spec.md ]; then
  curl -fsSL "${BASE}/docs/spec.md" -o docs/spec.md
  printf "  ✓  docs/spec.md\n"
fi

# Download skills
printf "\nDownloading skills...\n"
for skill in init align commit decision diagnose spec-create spec-review tdd zoom-out; do
  target=".claude/skills/${skill}/SKILL.md"
  curl -fsSL "${BASE}/.claude/skills/${skill}/SKILL.md" -o "$target"
  printf "  ✓  %s\n" "$target"
done

# Download MCP config
printf "\nDownloading config...\n"
if [ ! -f .mcp.json ]; then
  curl -fsSL "${BASE}/.mcp.json" -o .mcp.json
  printf "  ✓  .mcp.json\n"
fi

# Create CHANGELOG if missing
if [ ! -f CHANGELOG.md ]; then
  printf "# Changelog\n\n## [Unreleased]\n" > CHANGELOG.md
  printf "  ✓  CHANGELOG.md\n"
fi

# Symlinks for AI tools
ln -sf docs/llm.md CLAUDE.md
printf "  ✓  CLAUDE.md → docs/llm.md\n"
ln -sf docs/llm.md AGENTS.md
printf "  ✓  AGENTS.md → docs/llm.md\n"
ln -sf docs/llm.md .cursorrules
printf "  ✓  .cursorrules → docs/llm.md\n"
mkdir -p .cursor
ln -sf ../docs/llm.md .cursor/rules
printf "  ✓  .cursor/rules → docs/llm.md\n"
ln -sf ../.mcp.json .cursor/mcp.json
printf "  ✓  .cursor/mcp.json → .mcp.json\n"

# Fill in placeholders (cross-platform sed: GNU vs BSD/macOS)
sedi() { sed --version 2>/dev/null | grep -q GNU && sed -i "$@" || sed -i '' "$@"; }
if [ -n "$PROJECT_NAME" ]; then
  sedi "s/\[PROJECT NAME\]/${PROJECT_NAME}/g" docs/llm.md docs/context.md 2>/dev/null || true
fi
if [ -n "$PROJECT_REPO" ]; then
  sedi "s|\[github.com/org/repo\]|github.com/${PROJECT_REPO}|g" docs/llm.md 2>/dev/null || true
fi

printf "\nDone.\n\n"
printf "Next steps — generate your workspace:\n\n"
printf "  Option A (CLI, quickest):\n"
printf "    LLM_API_KEY=sk-ant-... bun /path/to/groundzero/packages/cli/src/index.tsx\n"
printf "    or: LLM_API_KEY=sk-ant-... gz   (if you built the binary)\n\n"
printf "  Option B (MCP, from Claude Code):\n"
printf "    1. Open .mcp.json and set LLM_API_KEY\n"
printf "    2. Open this project in Claude Code\n"
printf "    3. Ask: \"use ground zero to generate a workspace for this project\"\n\n"
printf "  Option C (manual): fill in docs/ and run /init in Claude Code.\n\n"
printf "See https://github.com/%s for full docs.\n\n" "$REPO"

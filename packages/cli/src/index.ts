#!/usr/bin/env bun
import * as p from "@clack/prompts";
import { clarify } from "@groundzero/core/pipeline/clarify";
import { draft } from "@groundzero/core/pipeline/draft";
import { extract } from "@groundzero/core/pipeline/extract";
import { generate } from "@groundzero/core/pipeline/generate";
import { resolve } from "@groundzero/core/pipeline/resolve";

async function main() {
  p.intro("groundzero — AI workspace generator");

  const idea = await p.text({
    message: "Describe your project idea:",
    placeholder: "A REST API for tracking reading lists with auth...",
    validate: (v: string | undefined) =>
      !v?.trim() ? "Idea cannot be empty" : undefined,
  });
  if (p.isCancel(idea)) {
    p.cancel("Cancelled.");
    process.exit(0);
  }

  const s = p.spinner();

  s.start("Analysing idea…");
  const extracted = await extract(idea);
  if (!extracted) throw new Error("extract returned no result");
  s.stop("Analysis complete.");

  s.start("Generating clarifying questions…");
  const questions = await clarify(idea, extracted.gaps);
  s.stop("Questions ready.");

  const answers: Record<string, string> = {};
  for (const question of questions) {
    const answer = await p.text({ message: question });
    if (p.isCancel(answer)) {
      p.cancel("Cancelled.");
      process.exit(0);
    }
    answers[question] = answer;
  }

  s.start("Resolving packages…");
  const resolved = await resolve(answers);
  s.stop(`Resolved ${resolved.packages.length} packages.`);

  s.start("Drafting spec…");
  const state = { idea, extracted, questions, answers, resolved };
  const spec = await draft(state);
  s.stop("Spec drafted.");

  p.note(spec.slice(0, 500) + (spec.length > 500 ? "\n…" : ""), "Spec preview");

  const confirmed = await p.confirm({ message: "Generate workspace files?" });
  if (!confirmed || p.isCancel(confirmed)) {
    p.cancel("Aborted.");
    process.exit(0);
  }

  s.start("Generating files…");
  const files = await generate({ ...state, spec });
  s.stop(`Generated ${Object.keys(files).length} files.`);

  p.outro(`Done! Run \`bun db:push\` then \`bun dev\` to get started.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

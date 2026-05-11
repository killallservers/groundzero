#!/usr/bin/env bun
import * as p from "@clack/prompts";
import type { PipelineState } from "@groundzero/core/db/schema";
import { clarify } from "@groundzero/core/pipeline/clarify";
import { draft } from "@groundzero/core/pipeline/draft";
import { extract } from "@groundzero/core/pipeline/extract";
import { generate } from "@groundzero/core/pipeline/generate";
import { resolve } from "@groundzero/core/pipeline/resolve";

function cancelled(): never {
	p.cancel("Cancelled.");
	process.exit(0);
}

async function main() {
	p.intro("groundzero — AI workspace generator");

	const ideaResult = await p.text({
		message: "What are you building?",
		placeholder: "a SaaS todo app with teams and Stripe billing",
		validate(value) {
			if (!value?.trim()) return "Describe your project idea.";
		},
	});
	const idea = p.isCancel(ideaResult) ? cancelled() : ideaResult;

	const spin = p.spinner();

	spin.start("Analysing your idea…");
	const extracted = await extract(idea);
	const questions = await clarify(idea, extracted.gaps);
	spin.stop("Idea analysed");

	const answers: Record<string, string> = {};
	for (let i = 0; i < questions.length; i++) {
		const question = questions[i]!;
		const answerResult = await p.text({
			message: question,
			placeholder: "Your answer…",
		});
		const answer = p.isCancel(answerResult) ? cancelled() : answerResult;
		answers[question] = answer;
	}

	spin.start("Resolving packages and drafting spec…");
	const resolved = await resolve(answers);
	const state: PipelineState = {
		idea,
		extracted,
		questions: Object.keys(answers),
		answers,
		resolved,
	};
	const spec = await draft(state);
	spin.stop(`Resolved ${resolved.packages.length} packages, spec drafted`);

	const preview = spec.length > 1200 ? `${spec.slice(0, 1200)}\n…` : spec;
	p.note(preview, "Spec preview");

	const confirmedResult = await p.confirm({
		message: "Generate workspace from this spec?",
	});
	if (p.isCancel(confirmedResult) || !confirmedResult) cancelled();

	const cwd = process.cwd();
	let files: Record<string, string> = {};

	await p.tasks([
		{
			title: "Generating workspace files",
			task: async (msg) => {
				files = await generate({ ...state, spec });
				msg("Writing files…");
				await Promise.all(
					Object.entries(files).map(async ([rel, content]) => {
						const abs = `${cwd}/${rel}`;
						const dir = abs.substring(0, abs.lastIndexOf("/"));
						await Bun.spawn(["mkdir", "-p", dir]).exited;
						await Bun.write(abs, content);
					}),
				);
				return `${Object.keys(files).length} files written`;
			},
		},
	]);

	p.note(Object.keys(files).join("\n"), `Files written to ${cwd}`);
	p.outro("Done. Open this project in Claude Code and start building.");
}

main().catch((err: unknown) => {
	p.cancel(err instanceof Error ? err.message : String(err));
	process.exit(1);
});

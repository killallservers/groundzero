#!/usr/bin/env bun
import type { PipelineState } from "@groundzero/core/db/schema";
import { clarify } from "@groundzero/core/pipeline/clarify";
import { draft } from "@groundzero/core/pipeline/draft";
import { extract } from "@groundzero/core/pipeline/extract";
import { generate } from "@groundzero/core/pipeline/generate";
import { resolve } from "@groundzero/core/pipeline/resolve";
import { Box, render, Text, useApp } from "ink";
import Spinner from "ink-spinner";
import TextInput from "ink-text-input";
import { useCallback, useEffect, useState } from "react";

// ── Symbols ──────────────────────────────────────────────────────────────────

const S = {
	active: "◆",
	done: "◇",
	error: "✘",
	bar: "│",
	barEnd: "└",
	bullet: "·",
};

// ── Shared components ─────────────────────────────────────────────────────────

function Step({ label, value }: { label: string; value?: string }) {
	return (
		<Box gap={1}>
			<Text color="green">{S.done}</Text>
			<Text dimColor>{label}</Text>
			{value !== undefined && <Text color="green">{value}</Text>}
		</Box>
	);
}

function Busy({ label }: { label: string }) {
	return (
		<Box gap={1}>
			<Text color="cyan">{S.active}</Text>
			<Text>{label}</Text>
			<Text color="cyan">
				<Spinner type="dots" />
			</Text>
		</Box>
	);
}

function Prompt({
	label,
	hint,
	value,
	onChange,
	onSubmit,
}: {
	label: string;
	hint?: string;
	value: string;
	onChange: (v: string) => void;
	onSubmit: (v: string) => void;
}) {
	return (
		<Box flexDirection="column">
			<Box gap={1}>
				<Text color="cyan">{S.active}</Text>
				<Text bold>{label}</Text>
				{hint !== undefined && <Text dimColor>{hint}</Text>}
			</Box>
			<Text color="cyan">{S.bar}</Text>
			<Box gap={1}>
				<Text color="cyan">{S.barEnd}</Text>
				<TextInput value={value} onChange={onChange} onSubmit={onSubmit} />
			</Box>
		</Box>
	);
}

function NoteBox({ title, body }: { title: string; body: string }) {
	return (
		<Box
			flexDirection="column"
			borderStyle="round"
			borderColor="cyan"
			paddingX={2}
			paddingY={1}
		>
			<Text bold color="cyan">
				{title}
			</Text>
			<Box height={1} />
			<Text>{body}</Text>
		</Box>
	);
}

// ── Stage types ───────────────────────────────────────────────────────────────

type Stage =
	| { name: "idea" }
	| { name: "extracting"; idea: string }
	| {
			name: "clarifying";
			idea: string;
			extracted: NonNullable<PipelineState["extracted"]>;
			question: string;
			answers: Record<string, string>;
	  }
	| {
			name: "clarifying-next";
			idea: string;
			extracted: NonNullable<PipelineState["extracted"]>;
			answers: Record<string, string>;
	  }
	| { name: "links"; state: PipelineState; urls: string[] }
	| { name: "fetching-docs"; state: PipelineState; urls: string[] }
	| { name: "resolving"; state: PipelineState }
	| { name: "reviewing"; state: PipelineState; spec: string }
	| { name: "generating"; state: PipelineState }
	| { name: "done"; files: string[] }
	| { name: "error"; message: string };

// ── App ───────────────────────────────────────────────────────────────────────

function App() {
	const { exit } = useApp();
	const [stage, setStage] = useState<Stage>({ name: "idea" });
	const [input, setInput] = useState("");
	const [completed, setCompleted] = useState<
		{ label: string; value?: string }[]
	>([]);

	const done = useCallback(
		(label: string, value?: string) =>
			setCompleted((p) => [...p, { label, value }]),
		[],
	);
	const fail = useCallback(
		(err: unknown) =>
			setStage({
				name: "error",
				message: err instanceof Error ? err.message : String(err),
			}),
		[],
	);

	// Extract + first clarify question
	useEffect(() => {
		if (stage.name !== "extracting") return;
		const { idea } = stage;
		(async () => {
			try {
				const extracted = await extract(idea);
				done("Idea analysed");
				const question = await clarify(idea, extracted.gaps);
				if (!question) {
					setStage({
						name: "links",
						state: { idea, extracted, questions: [], answers: {} },
						urls: [],
					});
				} else {
					setStage({ name: "clarifying", idea, extracted, question, answers: {} });
				}
			} catch (err) {
				fail(err);
			}
		})();
	}, [stage, done, fail]);

	// Adaptive clarify — fetch next question after each answer
	useEffect(() => {
		if (stage.name !== "clarifying-next") return;
		const { idea, extracted, answers } = stage;
		(async () => {
			try {
				const question = await clarify(idea, extracted.gaps, answers);
				if (!question) {
					setStage({
						name: "links",
						state: {
							idea,
							extracted,
							questions: Object.keys(answers),
							answers,
						},
						urls: [],
					});
				} else {
					setStage({ name: "clarifying", idea, extracted, question, answers });
				}
			} catch (err) {
				fail(err);
			}
		})();
	}, [stage, done, fail]);

	// Fetch custom docs then resolve
	useEffect(() => {
		if (stage.name !== "fetching-docs") return;
		const { state, urls } = stage;
		(async () => {
			try {
				const results = await Promise.all(
					urls.map(async (url) => {
						try {
							const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
							const text = await res.text();
							return { url, content: text.slice(0, 3000) };
						} catch {
							return null;
						}
					}),
				);
				const customDocs = results.filter(
					(r): r is { url: string; content: string } => r !== null,
				);
				const fetched = customDocs.length;
				const skipped = urls.length - fetched;
				done(
					`${fetched} doc${fetched === 1 ? "" : "s"} fetched${skipped > 0 ? `, ${skipped} skipped` : ""}`,
				);
				setStage({ name: "resolving", state: { ...state, customDocs } });
			} catch (err) {
				fail(err);
			}
		})();
	}, [stage, done, fail]);

	// Resolve + draft
	useEffect(() => {
		if (stage.name !== "resolving") return;
		const { state } = stage;
		(async () => {
			try {
				const resolved = await resolve(state.answers ?? {});
				done(`${resolved.packages.length} packages resolved`);
				const spec = await draft({ ...state, resolved });
				done("Spec drafted");
				setStage({ name: "reviewing", state: { ...state, resolved }, spec });
			} catch (err) {
				fail(err);
			}
		})();
	}, [stage, done, fail]);

	// Generate + write to disk
	useEffect(() => {
		if (stage.name !== "generating") return;
		const { state } = stage;
		(async () => {
			try {
				const files = await generate(state);
				const cwd = process.cwd();
				await Promise.all(
					Object.entries(files).map(async ([rel, content]) => {
						const abs = `${cwd}/${rel}`;
						const dir = abs.substring(0, abs.lastIndexOf("/"));
						await Bun.spawn(["mkdir", "-p", dir]).exited;
						await Bun.write(abs, content);
					}),
				);
				done(`${Object.keys(files).length} files written to ${cwd}`);
				setStage({ name: "done", files: Object.keys(files) });
			} catch (err) {
				fail(err);
			}
		})();
	}, [stage, done, fail]);

	useEffect(() => {
		if (stage.name === "done" || stage.name === "error") exit();
	}, [stage.name, exit]);

	return (
		<Box flexDirection="column" paddingY={1} gap={1}>
			{/* Header */}
			<Box flexDirection="column">
				<Text bold color="cyan">
					groundzero
				</Text>
				<Text dimColor>AI workspace generator</Text>
			</Box>

			{/* Completed steps */}
			{completed.map(({ label, value }, i) => (
				<Step key={i} label={label} value={value} />
			))}

			{stage.name === "idea" && (
				<Prompt
					label="What are you building?"
					hint="(describe your project idea)"
					value={input}
					onChange={setInput}
					onSubmit={(value) => {
						if (!value.trim()) return;
						setInput("");
						setStage({ name: "extracting", idea: value });
					}}
				/>
			)}

			{stage.name === "extracting" && (
				<Busy label="Analysing idea and generating questions…" />
			)}

			{stage.name === "clarifying" && (
				<Prompt
					label={stage.question}
					value={input}
					onChange={setInput}
					onSubmit={(value) => {
						if (!value.trim()) return;
						const { idea, extracted, question, answers } = stage;
						setInput("");
						setStage({
							name: "clarifying-next",
							idea,
							extracted,
							answers: { ...answers, [question]: value },
						});
					}}
				/>
			)}

			{stage.name === "clarifying-next" && (
				<Busy label="Thinking of the next question…" />
			)}

			{stage.name === "links" && (
				<Box flexDirection="column" gap={1}>
					{stage.urls.map((url) => (
						<Step key={url} label={url} />
					))}
					<Prompt
						label={
							stage.urls.length === 0
								? "Any relevant docs? (paste a URL, or press Enter to continue)"
								: "Another link? (or press Enter to continue)"
						}
						value={input}
						onChange={setInput}
						onSubmit={(value) => {
							const url = value.trim();
							setInput("");
							if (!url) {
								if (stage.urls.length === 0) {
									setStage({ name: "resolving", state: stage.state });
								} else {
									setStage({
										name: "fetching-docs",
										state: stage.state,
										urls: stage.urls,
									});
								}
							} else {
								setStage({ ...stage, urls: [...stage.urls, url] });
							}
						}}
					/>
				</Box>
			)}

			{stage.name === "fetching-docs" && (
				<Busy label={`Fetching ${stage.urls.length} doc${stage.urls.length === 1 ? "" : "s"}…`} />
			)}

			{stage.name === "resolving" && (
				<Busy label="Resolving packages and drafting spec…" />
			)}

			{stage.name === "reviewing" && (
				<Box flexDirection="column" gap={1}>
					<NoteBox
						title="Spec preview"
						body={
							stage.spec.length > 800
								? `${stage.spec.slice(0, 800)}\n…`
								: stage.spec
						}
					/>
					<Prompt
						label="Generate workspace from this spec?"
						hint="[y/n]"
						value={input}
						onChange={setInput}
						onSubmit={(value) => {
							const v = value.trim().toLowerCase();
							if (v === "y") {
								setInput("");
								setStage({
									name: "generating",
									state: { ...stage.state, spec: stage.spec },
								});
							} else if (v === "n") {
								exit();
							}
						}}
					/>
				</Box>
			)}

			{stage.name === "generating" && (
				<Busy label="Generating workspace files…" />
			)}

			{stage.name === "done" && (
				<Box flexDirection="column" gap={1}>
					<Box gap={1}>
						<Text color="green">{S.done}</Text>
						<Text bold color="green">
							Done.
						</Text>
						<Text dimColor>
							Open this project in Claude Code and start building.
						</Text>
					</Box>
					<Box flexDirection="column" paddingLeft={2}>
						{stage.files.map((f) => (
							<Box key={f} gap={1}>
								<Text dimColor>{S.bullet}</Text>
								<Text dimColor>{f}</Text>
							</Box>
						))}
					</Box>
				</Box>
			)}

			{stage.name === "error" && (
				<Box gap={1}>
					<Text color="red">{S.error}</Text>
					<Text color="red">{stage.message}</Text>
				</Box>
			)}
		</Box>
	);
}

render(<App />);

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

type Stage =
  | { name: "idea" }
  | { name: "extracting"; idea: string }
  | {
      name: "clarifying";
      idea: string;
      extracted: NonNullable<PipelineState["extracted"]>;
      questions: string[];
      current: number;
      answers: Record<string, string>;
    }
  | { name: "resolving"; state: PipelineState }
  | { name: "reviewing"; state: PipelineState; spec: string }
  | { name: "generating"; state: PipelineState }
  | { name: "done"; files: string[] }
  | { name: "error"; message: string };

function Check({ label }: { label: string }) {
  return (
    <Box gap={1}>
      <Text color="green">✓</Text>
      <Text dimColor>{label}</Text>
    </Box>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <Box gap={1}>
      <Text color="cyan">
        <Spinner type="dots" />
      </Text>
      <Text>{label}</Text>
    </Box>
  );
}

function App() {
  const { exit } = useApp();
  const [stage, setStage] = useState<Stage>({ name: "idea" });
  const [input, setInput] = useState("");
  const [completed, setCompleted] = useState<string[]>([]);

  const done = useCallback(
    (label: string) => setCompleted((p) => [...p, label]),
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

  useEffect(() => {
    if (stage.name !== "extracting") return;
    const { idea } = stage;
    (async () => {
      try {
        const extracted = await extract(idea);
        if (!extracted) throw new Error("extract returned no result");
        done("Idea analysed");
        const questions = await clarify(idea, extracted.gaps);
        done("Questions generated");
        if (questions.length === 0) {
          setStage({
            name: "resolving",
            state: { idea, extracted, questions: [], answers: {} },
          });
        } else {
          setStage({
            name: "clarifying",
            idea,
            extracted,
            questions,
            current: 0,
            answers: {},
          });
        }
      } catch (err) {
        fail(err);
      }
    })();
  }, [stage, done, fail]);

  useEffect(() => {
    if (stage.name !== "resolving") return;
    const { state } = stage;
    (async () => {
      try {
        const resolved = await resolve(state.answers ?? {});
        done(`Resolved ${resolved.packages.length} packages`);
        const spec = await draft({ ...state, resolved });
        done("Spec drafted");
        setStage({ name: "reviewing", state: { ...state, resolved }, spec });
      } catch (err) {
        fail(err);
      }
    })();
  }, [stage, done, fail]);

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
        done(`Generated ${Object.keys(files).length} files`);
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
      <Text bold color="cyan">
        groundzero — AI workspace generator
      </Text>

      {completed.map((label) => (
        <Check key={label} label={label} />
      ))}

      {stage.name === "idea" && (
        <Box gap={1}>
          <Text>Project idea: </Text>
          <TextInput
            value={input}
            onChange={setInput}
            onSubmit={(value) => {
              if (!value.trim()) return;
              setInput("");
              setStage({ name: "extracting", idea: value });
            }}
          />
        </Box>
      )}

      {stage.name === "extracting" && (
        <Loading label="Analysing idea and generating questions…" />
      )}

      {stage.name === "clarifying" && (
        <Box flexDirection="column" gap={1}>
          <Text dimColor>
            Question {stage.current + 1} / {stage.questions.length}
          </Text>
          <Text>{stage.questions[stage.current]}</Text>
          <TextInput
            value={input}
            onChange={setInput}
            onSubmit={(value) => {
              if (!value.trim()) return;
              const { idea, extracted, questions, current, answers } = stage;
              const question = questions[current];
              if (!question) return;
              const updated = { ...answers, [question]: value };
              setInput("");
              if (current + 1 < questions.length) {
                setStage({
                  name: "clarifying",
                  idea,
                  extracted,
                  questions,
                  current: current + 1,
                  answers: updated,
                });
              } else {
                setStage({
                  name: "resolving",
                  state: {
                    idea,
                    extracted,
                    questions: Object.keys(updated),
                    answers: updated,
                  },
                });
              }
            }}
          />
        </Box>
      )}

      {stage.name === "resolving" && (
        <Loading label="Resolving packages and drafting spec…" />
      )}

      {stage.name === "reviewing" && (
        <Box flexDirection="column" gap={1}>
          <Box
            borderStyle="round"
            paddingX={2}
            paddingY={1}
            flexDirection="column"
          >
            <Text bold>Spec preview</Text>
            <Text>
              {stage.spec.slice(0, 800)}
              {stage.spec.length > 800 ? "\n…" : ""}
            </Text>
          </Box>
          <Box gap={1}>
            <Text>Generate workspace? [y/n] </Text>
            <TextInput
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
        </Box>
      )}

      {stage.name === "generating" && (
        <Loading label="Generating workspace files…" />
      )}

      {stage.name === "done" && (
        <Box flexDirection="column" gap={1}>
          <Box gap={1}>
            <Text color="green">✓</Text>
            <Text bold>
              Done! {stage.files.length} files written to {process.cwd()}
            </Text>
          </Box>
          {stage.files.map((f) => (
            <Box key={f} gap={1} paddingLeft={2}>
              <Text dimColor>·</Text>
              <Text dimColor>{f}</Text>
            </Box>
          ))}
        </Box>
      )}

      {stage.name === "error" && (
        <Box gap={1}>
          <Text color="red">✗</Text>
          <Text color="red">{stage.message}</Text>
        </Box>
      )}
    </Box>
  );
}

render(<App />);

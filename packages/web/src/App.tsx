import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import "./index.css";

type PipelineEvent =
  | { type: "stage"; stage: string }
  | { type: "extract:done"; present: string[]; gaps: string[] }
  | { type: "clarify:questions"; questions: string[] }
  | { type: "resolve:done"; packages: unknown }
  | { type: "draft:done"; spec: string }
  | { type: "review:ready" }
  | { type: "generate:done"; files: Record<string, string> }
  | { type: "zip:ready"; sessionId: string }
  | { type: "error"; message: string };

type UIStage =
  | { name: "idle" }
  | { name: "busy"; label: string }
  | {
      name: "clarifying";
      sessionId: string;
      questions: string[];
      current: number;
      answers: Record<string, string>;
    }
  | { name: "reviewing"; sessionId: string; spec: string; draft: string }
  | { name: "done"; sessionId: string; fileCount: number }
  | { name: "error"; message: string };

// Collects SSE events until a terminal event type arrives.
function collectSSE(
  url: string,
  onEvent?: (e: PipelineEvent) => void,
): Promise<PipelineEvent[]> {
  return new Promise((resolve, reject) => {
    const collected: PipelineEvent[] = [];
    const es = new EventSource(url);

    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as PipelineEvent;
        if (event.type === "error") {
          es.close();
          reject(new Error(event.message));
          return;
        }
        collected.push(event);
        onEvent?.(event);
        if (
          event.type === "clarify:questions" ||
          event.type === "review:ready" ||
          event.type === "zip:ready"
        ) {
          es.close();
          resolve(collected);
        }
      } catch {}
    };

    es.onerror = () => {
      es.close();
      reject(new Error("Stream connection lost"));
    };
  });
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json() as Promise<T>;
}

export function App() {
  const [stage, setStage] = useState<UIStage>({ name: "idle" });
  const [completed, setCompleted] = useState<string[]>([]);
  const [idea, setIdea] = useState("");
  const [answer, setAnswer] = useState("");

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

  const reset = useCallback(() => {
    setStage({ name: "idle" });
    setCompleted([]);
    setIdea("");
    setAnswer("");
  }, []);

  const runToReview = useCallback(
    async (sessionId: string) => {
      setStage({ name: "busy", label: "Resolving packages…" });

      const events = await collectSSE(`/api/sessions/${sessionId}/run`, (e) => {
        if (e.type === "stage" && e.stage === "draft") {
          setStage({ name: "busy", label: "Drafting spec…" });
        }
      });

      done("Packages resolved");
      const draftEvent = events.find((e) => e.type === "draft:done");
      const spec = draftEvent?.type === "draft:done" ? draftEvent.spec : "";
      done("Spec drafted");
      setStage({ name: "reviewing", sessionId, spec, draft: spec });
    },
    [done],
  );

  const handleIdeaSubmit = useCallback(async () => {
    if (!idea.trim()) return;
    try {
      setCompleted([]);
      setStage({ name: "busy", label: "Analysing idea…" });

      const { sessionId } = await post<{ sessionId: string }>("/api/sessions", {
        idea,
      });

      const events = await collectSSE(`/api/sessions/${sessionId}/stream`);
      done("Idea analysed");

      const clarifyEvent = events.find((e) => e.type === "clarify:questions");
      const questions =
        clarifyEvent?.type === "clarify:questions"
          ? clarifyEvent.questions
          : [];

      if (questions.length === 0) {
        await post(`/api/sessions/${sessionId}/answers`, { answers: {} });
        await runToReview(sessionId);
      } else {
        done("Questions generated");
        setAnswer("");
        setStage({
          name: "clarifying",
          sessionId,
          questions,
          current: 0,
          answers: {},
        });
      }
    } catch (err) {
      fail(err);
    }
  }, [idea, done, fail, runToReview]);

  const handleAnswerSubmit = useCallback(async () => {
    if (stage.name !== "clarifying" || !answer.trim()) return;
    const { sessionId, questions, current, answers } = stage;
    const question = questions[current];
    if (!question) return;

    const updated = { ...answers, [question]: answer };
    setAnswer("");

    if (current + 1 < questions.length) {
      setStage({
        name: "clarifying",
        sessionId,
        questions,
        current: current + 1,
        answers: updated,
      });
    } else {
      try {
        done(
          `${questions.length} question${questions.length === 1 ? "" : "s"} answered`,
        );
        setStage({ name: "busy", label: "Submitting answers…" });
        await post(`/api/sessions/${sessionId}/answers`, { answers: updated });
        await runToReview(sessionId);
      } catch (err) {
        fail(err);
      }
    }
  }, [stage, answer, done, fail, runToReview]);

  const handleConfirm = useCallback(async () => {
    if (stage.name !== "reviewing") return;
    const { sessionId, draft } = stage;
    try {
      setStage({ name: "busy", label: "Generating workspace…" });
      await post(`/api/sessions/${sessionId}/review`, {
        action: "confirm",
        spec: draft,
      });
      const events = await collectSSE(`/api/sessions/${sessionId}/generate`);
      const genEvent = events.find((e) => e.type === "generate:done");
      const fileCount =
        genEvent?.type === "generate:done"
          ? Object.keys(genEvent.files).length
          : 0;
      done(`${fileCount} files generated`);
      setStage({ name: "done", sessionId, fileCount });
    } catch (err) {
      fail(err);
    }
  }, [stage, done, fail]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="w-full max-w-2xl flex flex-col gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ground Zero</h1>
          <p className="text-muted-foreground mt-1">
            Paste a project idea. Get a ready-to-build Claude Code workspace.
          </p>
        </div>

        {completed.length > 0 && (
          <div className="flex flex-col gap-1">
            {completed.map((label) => (
              <div
                key={label}
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <span className="text-green-500">✓</span>
                {label}
              </div>
            ))}
          </div>
        )}

        {stage.name === "idle" && (
          <Card>
            <CardHeader>
              <CardTitle>What are you building?</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="A CLI tool that watches my Postgres database and sends Slack alerts when a query takes longer than 5 seconds…"
                className="min-h-[140px] resize-none"
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    handleIdeaSubmit();
                  }
                }}
              />
            </CardContent>
            <CardFooter className="justify-between">
              <span className="text-sm text-muted-foreground">
                ⌘↵ to submit
              </span>
              <Button onClick={handleIdeaSubmit} disabled={!idea.trim()}>
                Generate workspace
              </Button>
            </CardFooter>
          </Card>
        )}

        {stage.name === "busy" && (
          <Card>
            <CardContent className="py-8 flex items-center gap-3">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="text-sm">{stage.label}</span>
            </CardContent>
          </Card>
        )}

        {stage.name === "clarifying" &&
          (() => {
            const question = stage.questions[stage.current];
            if (!question) return null;
            return (
              <Card>
                <CardHeader>
                  <p className="text-xs text-muted-foreground">
                    Question {stage.current + 1} of {stage.questions.length}
                  </p>
                  <CardTitle className="text-base font-medium">
                    {question}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    className="resize-none"
                    placeholder="Your answer…"
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        handleAnswerSubmit();
                      }
                    }}
                    autoFocus
                  />
                </CardContent>
                <CardFooter className="justify-between">
                  <span className="text-sm text-muted-foreground">
                    ⌘↵ to continue
                  </span>
                  <Button
                    onClick={handleAnswerSubmit}
                    disabled={!answer.trim()}
                  >
                    {stage.current + 1 < stage.questions.length
                      ? "Next"
                      : "Done"}
                  </Button>
                </CardFooter>
              </Card>
            );
          })()}

        {stage.name === "reviewing" && (
          <Card>
            <CardHeader>
              <CardTitle>Review spec</CardTitle>
              {stage.draft !== stage.spec && (
                <p className="text-xs text-muted-foreground">
                  Edited — your changes will be used.
                </p>
              )}
            </CardHeader>
            <CardContent>
              <Textarea
                className="min-h-[360px] font-mono text-sm resize-y"
                value={stage.draft}
                onChange={(e) => setStage({ ...stage, draft: e.target.value })}
              />
            </CardContent>
            <CardFooter className="gap-2 justify-end">
              {stage.draft !== stage.spec && (
                <Button
                  variant="ghost"
                  onClick={() => setStage({ ...stage, draft: stage.spec })}
                >
                  Reset
                </Button>
              )}
              <Button onClick={handleConfirm}>Generate workspace</Button>
            </CardFooter>
          </Card>
        )}

        {stage.name === "done" && (
          <Card>
            <CardContent className="py-10 flex flex-col items-center gap-4 text-center">
              <span className="text-5xl">✓</span>
              <p className="font-medium">{stage.fileCount} files generated</p>
              <div className="flex gap-2">
                <Button asChild>
                  <a
                    href={`/api/sessions/${stage.sessionId}/download`}
                    download
                  >
                    Download ZIP
                  </a>
                </Button>
                <Button variant="outline" onClick={reset}>
                  Start over
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {stage.name === "error" && (
          <Card className="border-destructive">
            <CardContent className="py-6 flex flex-col gap-4">
              <p className="text-sm text-destructive">{stage.message}</p>
              <Button variant="outline" onClick={reset} className="self-start">
                Start over
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default App;

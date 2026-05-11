import { describe, expect, test } from "bun:test";
import { getTableName } from "drizzle-orm";
import type { PipelineStage, PipelineState } from "./schema";
import { sessions } from "./schema";

describe("sessions schema", () => {
  test("table name is sessions", () => {
    expect(getTableName(sessions)).toBe("sessions");
  });

  test("has all expected columns", () => {
    const cols = Object.keys(sessions);
    expect(cols).toContain("id");
    expect(cols).toContain("stage");
    expect(cols).toContain("idea");
    expect(cols).toContain("state");
    expect(cols).toContain("createdAt");
    expect(cols).toContain("updatedAt");
  });
});

describe("PipelineState type", () => {
  test("minimal state is valid", () => {
    const state: PipelineState = { idea: "a CLI tool" };
    expect(state.idea).toBe("a CLI tool");
    expect(state.extracted).toBeUndefined();
  });

  test("full state is valid", () => {
    const state: PipelineState = {
      idea: "a web app",
      extracted: { present: ["React frontend"], gaps: ["auth strategy"] },
      questions: ["Which auth provider?"],
      answers: { "Which auth provider?": "Better Auth" },
      resolved: { packages: [{ name: "hono", version: "4.0.0" }] },
      spec: "# Spec",
      files: { "docs/llm.md": "# Project" },
    };
    expect(state.resolved?.packages).toHaveLength(1);
  });
});

describe("PipelineStage type", () => {
  test("all stages are valid string literals", () => {
    const stages: PipelineStage[] = [
      "extract",
      "clarify",
      "resolve",
      "draft",
      "review",
      "generate",
      "zip",
      "done",
    ];
    expect(stages).toHaveLength(8);
  });
});

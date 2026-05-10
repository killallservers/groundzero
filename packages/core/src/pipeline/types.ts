import type { PipelineStage, PipelineState } from "../db/schema";

export type { PipelineStage, PipelineState };

export type PipelineEvent =
  | { type: "stage"; stage: PipelineStage }
  | { type: "extract:done"; present: string[]; gaps: string[] }
  | { type: "clarify:questions"; questions: string[] }
  | { type: "resolve:done"; packages: PipelineState["resolved"] }
  | { type: "draft:done"; spec: string }
  | { type: "review:ready" }
  | { type: "generate:done"; files: Record<string, string> }
  | { type: "zip:ready"; sessionId: string }
  | { type: "error"; message: string };

import { clarify } from "@groundzero/core/pipeline/clarify";
import { draft } from "@groundzero/core/pipeline/draft";
import { extract } from "@groundzero/core/pipeline/extract";
import { generate } from "@groundzero/core/pipeline/generate";
import { resolve } from "@groundzero/core/pipeline/resolve";
import { buildZip } from "@groundzero/core/pipeline/zip";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({ name: "groundzero", version: "0.1.0" });

const packageSchema = z.object({
  name: z.string(),
  version: z.string(),
  llmsTxt: z.string().optional(),
});

const extractedSchema = z.object({
  present: z.array(z.string()),
  gaps: z.array(z.string()),
});

const resolvedSchema = z.object({
  packages: z.array(packageSchema),
});

// Shared pipeline state fields used by draft and generate
const stateSchema = {
  idea: z.string(),
  extracted: extractedSchema.describe("Output from gz_extract"),
  questions: z
    .array(z.string())
    .describe("Questions asked during clarification"),
  answers: z.record(z.string(), z.string()).describe("Question→answer map"),
  resolved: resolvedSchema.describe("Output from gz_resolve"),
};

server.registerTool(
  "gz_extract",
  {
    description:
      "Parse a project idea to identify what information is present and what gaps need clarification. Call this first in the pipeline.",
    inputSchema: {
      idea: z.string().describe("The raw project idea text"),
    },
  },
  async ({ idea }) => {
    try {
      const result = await extract(idea);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      return { content: [{ type: "text", text: String(err) }], isError: true };
    }
  },
);

server.registerTool(
  "gz_clarify",
  {
    description:
      "Generate the minimum clarifying questions needed to fill information gaps. Returns an empty array if gaps are zero — you can skip straight to gz_resolve.",
    inputSchema: {
      idea: z.string().describe("The raw project idea text"),
      gaps: z.array(z.string()).describe("Gaps array from gz_extract"),
    },
  },
  async ({ idea, gaps }) => {
    try {
      const questions = await clarify(idea, gaps);
      return {
        content: [{ type: "text", text: JSON.stringify(questions, null, 2) }],
      };
    } catch (err) {
      return { content: [{ type: "text", text: String(err) }], isError: true };
    }
  },
);

server.registerTool(
  "gz_resolve",
  {
    description:
      "Fetch live package versions and llms.txt documentation for the project's dependencies. Grounds the workspace in real, current docs — not training data.",
    inputSchema: {
      answers: z
        .record(z.string(), z.string())
        .describe("Question→answer map from clarification (may be empty)"),
    },
  },
  async ({ answers }) => {
    try {
      const resolved = await resolve(answers);
      return {
        content: [{ type: "text", text: JSON.stringify(resolved, null, 2) }],
      };
    } catch (err) {
      return { content: [{ type: "text", text: String(err) }], isError: true };
    }
  },
);

server.registerTool(
  "gz_draft",
  {
    description:
      "Write a structured spec.md for the project from the full resolved state. Returns the spec as markdown. Show it to the user before proceeding to gz_generate.",
    inputSchema: stateSchema,
  },
  async ({ idea, extracted, questions, answers, resolved }) => {
    try {
      const spec = await draft({
        idea,
        extracted,
        questions,
        answers,
        resolved,
      });
      return { content: [{ type: "text", text: spec }] };
    } catch (err) {
      return { content: [{ type: "text", text: String(err) }], isError: true };
    }
  },
);

server.registerTool(
  "gz_generate",
  {
    description:
      "Generate all workspace files from a confirmed spec. Returns a JSON object mapping file paths to contents. Only call after the user has confirmed the spec from gz_draft.",
    inputSchema: {
      ...stateSchema,
      spec: z.string().describe("The confirmed spec from gz_draft"),
    },
  },
  async (state) => {
    try {
      const files = await generate(state);
      return {
        content: [{ type: "text", text: JSON.stringify(files, null, 2) }],
      };
    } catch (err) {
      return { content: [{ type: "text", text: String(err) }], isError: true };
    }
  },
);

server.registerTool(
  "gz_zip",
  {
    description:
      "Bundle generated workspace files into a ZIP archive and write it to disk. Returns the output path and file size in bytes.",
    inputSchema: {
      files: z
        .record(z.string(), z.string())
        .describe("File tree from gz_generate (path → content)"),
      outputPath: z
        .string()
        .optional()
        .describe(
          "Where to write the ZIP — defaults to /tmp/groundzero-<timestamp>.zip",
        ),
    },
  },
  async ({ files, outputPath }) => {
    try {
      const bytes = await buildZip(files);
      const path =
        outputPath ??
        `${Bun.env.TMPDIR ?? "/tmp"}/groundzero-${Date.now()}.zip`;
      await Bun.write(path, bytes);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ path, size: bytes.byteLength }, null, 2),
          },
        ],
      };
    } catch (err) {
      return { content: [{ type: "text", text: String(err) }], isError: true };
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);

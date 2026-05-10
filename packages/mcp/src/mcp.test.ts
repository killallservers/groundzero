import { describe, expect, mock, test } from "bun:test";

// Capture registered tools so we can inspect and invoke them
type ToolHandler = (input: Record<string, unknown>) => Promise<{
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}>;

const registeredTools = new Map<
  string,
  { description: string; handler: ToolHandler }
>();

class MockMcpServer {
  constructor(_info: { name: string; version: string }) {}
  registerTool(
    name: string,
    config: { description: string; inputSchema: unknown },
    handler: ToolHandler,
  ) {
    registeredTools.set(name, { description: config.description, handler });
  }
  async connect(_transport: unknown) {}
}

mock.module("@modelcontextprotocol/sdk/server/mcp.js", () => ({
  McpServer: MockMcpServer,
}));
mock.module("@modelcontextprotocol/sdk/server/stdio.js", () => ({
  StdioServerTransport: class {
    constructor() {}
  },
}));

// Mock pipeline functions
const mockExtract = mock(async (_idea: string) => ({
  present: ["React"],
  gaps: ["auth"],
}));
const mockClarify = mock(async (_idea: string, _gaps: string[]) => [
  "Which auth?",
]);
const mockResolve = mock(async () => ({
  packages: [{ name: "hono", version: "latest" }],
}));
const mockDraft = mock(async () => "# Spec");
const mockGenerate = mock(async () => ({ "docs/llm.md": "# Project" }));
const mockBuildZip = mock(async () => new Uint8Array([0x50, 0x4b, 0x03, 0x04]));

mock.module("@groundzero/core/pipeline/extract", () => ({
  extract: mockExtract,
}));
mock.module("@groundzero/core/pipeline/clarify", () => ({
  clarify: mockClarify,
}));
mock.module("@groundzero/core/pipeline/resolve", () => ({
  resolve: mockResolve,
}));
mock.module("@groundzero/core/pipeline/draft", () => ({ draft: mockDraft }));
mock.module("@groundzero/core/pipeline/generate", () => ({
  generate: mockGenerate,
}));
mock.module("@groundzero/core/pipeline/zip", () => ({
  buildZip: mockBuildZip,
}));

// Load the server — mock transport means connect() is a no-op
await import("./index.ts");

// ─── Tool registration ─────────────────────────────────────────────────────

describe("MCP tool registration", () => {
  test("registers all 6 pipeline tools", () => {
    expect(registeredTools.size).toBe(6);
  });

  test("registers gz_extract", () => {
    expect(registeredTools.has("gz_extract")).toBe(true);
  });

  test("registers gz_clarify", () => {
    expect(registeredTools.has("gz_clarify")).toBe(true);
  });

  test("registers gz_resolve", () => {
    expect(registeredTools.has("gz_resolve")).toBe(true);
  });

  test("registers gz_draft", () => {
    expect(registeredTools.has("gz_draft")).toBe(true);
  });

  test("registers gz_generate", () => {
    expect(registeredTools.has("gz_generate")).toBe(true);
  });

  test("registers gz_zip", () => {
    expect(registeredTools.has("gz_zip")).toBe(true);
  });

  test("each tool has a non-empty description", () => {
    for (const [name, tool] of registeredTools) {
      expect(
        tool.description.length,
        `${name} description is empty`,
      ).toBeGreaterThan(0);
    }
  });
});

// ─── Tool: gz_extract ─────────────────────────────────────────────────────────

describe("gz_extract tool handler", () => {
  test("returns present and gaps from pipeline", async () => {
    const handler = registeredTools.get("gz_extract")!.handler;
    const result = await handler({ idea: "a todo app" });
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed).toEqual({ present: ["React"], gaps: ["auth"] });
  });

  test("returns isError on pipeline failure", async () => {
    mockExtract.mockImplementationOnce(async () => {
      throw new Error("LLM timeout");
    });
    const handler = registeredTools.get("gz_extract")!.handler;
    const result = await handler({ idea: "broken" });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("LLM timeout");
  });
});

// ─── Tool: gz_clarify ─────────────────────────────────────────────────────────

describe("gz_clarify tool handler", () => {
  test("returns array of questions", async () => {
    const handler = registeredTools.get("gz_clarify")!.handler;
    const result = await handler({ idea: "app", gaps: ["auth"] });
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed).toEqual(["Which auth?"]);
  });

  test("returns isError on failure", async () => {
    mockClarify.mockImplementationOnce(async () => {
      throw new Error("clarify error");
    });
    const handler = registeredTools.get("gz_clarify")!.handler;
    const result = await handler({ idea: "app", gaps: [] });
    expect(result.isError).toBe(true);
  });
});

// ─── Tool: gz_resolve ─────────────────────────────────────────────────────────

describe("gz_resolve tool handler", () => {
  test("returns resolved packages", async () => {
    const handler = registeredTools.get("gz_resolve")!.handler;
    const result = await handler({ answers: {} });
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.packages).toHaveLength(1);
    expect(parsed.packages[0].name).toBe("hono");
  });

  test("returns isError on failure", async () => {
    mockResolve.mockImplementationOnce(async () => {
      throw new Error("fetch failed");
    });
    const handler = registeredTools.get("gz_resolve")!.handler;
    const result = await handler({ answers: {} });
    expect(result.isError).toBe(true);
  });
});

// ─── Tool: gz_draft ───────────────────────────────────────────────────────────

describe("gz_draft tool handler", () => {
  test("returns spec markdown text", async () => {
    const handler = registeredTools.get("gz_draft")!.handler;
    const result = await handler({
      idea: "app",
      extracted: { present: [], gaps: [] },
      questions: [],
      answers: {},
      resolved: { packages: [] },
    });
    expect(result.isError).toBeUndefined();
    expect(result.content[0]!.text).toBe("# Spec");
  });

  test("returns isError on failure", async () => {
    mockDraft.mockImplementationOnce(async () => {
      throw new Error("draft error");
    });
    const handler = registeredTools.get("gz_draft")!.handler;
    const result = await handler({
      idea: "app",
      extracted: { present: [], gaps: [] },
      questions: [],
      answers: {},
      resolved: { packages: [] },
    });
    expect(result.isError).toBe(true);
  });
});

// ─── Tool: gz_generate ────────────────────────────────────────────────────────

describe("gz_generate tool handler", () => {
  test("returns JSON file tree", async () => {
    const handler = registeredTools.get("gz_generate")!.handler;
    const result = await handler({
      idea: "app",
      extracted: { present: [], gaps: [] },
      questions: [],
      answers: {},
      resolved: { packages: [] },
      spec: "# Spec",
    });
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0]!.text) as Record<
      string,
      string
    >;
    expect(Object.keys(parsed)).toContain("docs/llm.md");
  });

  test("returns isError on failure", async () => {
    mockGenerate.mockImplementationOnce(async () => {
      throw new Error("generate error");
    });
    const handler = registeredTools.get("gz_generate")!.handler;
    const result = await handler({
      idea: "app",
      extracted: { present: [], gaps: [] },
      questions: [],
      answers: {},
      resolved: { packages: [] },
      spec: "# Spec",
    });
    expect(result.isError).toBe(true);
  });
});

// ─── Tool: gz_zip ─────────────────────────────────────────────────────────────

describe("gz_zip tool handler", () => {
  test("writes ZIP to the specified output path", async () => {
    const handler = registeredTools.get("gz_zip")!.handler;
    const outPath = `/tmp/gz-test-${Date.now()}.zip`;
    const result = await handler({
      files: { "README.md": "# Hello" },
      outputPath: outPath,
    });
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.path).toBe(outPath);
    expect(parsed.size).toBeGreaterThan(0);

    // Verify file was actually written
    const written = await Bun.file(outPath).bytes();
    expect(written[0]).toBe(0x50); // P
    expect(written[1]).toBe(0x4b); // K
  });

  test("defaults output path to /tmp when not specified", async () => {
    const handler = registeredTools.get("gz_zip")!.handler;
    const result = await handler({ files: { "a.md": "content" } });
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.path).toMatch(/\/tmp\//);
    expect(parsed.path).toMatch(/groundzero-\d+\.zip/);
  });

  test("returns isError when buildZip throws", async () => {
    mockBuildZip.mockImplementationOnce(async () => {
      throw new Error("zip error");
    });
    const handler = registeredTools.get("gz_zip")!.handler;
    const result = await handler({ files: {} });
    expect(result.isError).toBe(true);
  });
});

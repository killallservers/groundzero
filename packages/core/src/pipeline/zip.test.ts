import { describe, expect, test } from "bun:test";
import { buildZip } from "./zip";

describe("buildZip", () => {
  test("returns a non-empty Uint8Array", async () => {
    const result = await buildZip({ "README.md": "# Hello" });
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.byteLength).toBeGreaterThan(0);
  });

  test("includes all provided files", async () => {
    const files = {
      "docs/llm.md": "# Project",
      "CLAUDE.md": "# Guide",
      ".env.example": "API_KEY=",
    };
    const result = await buildZip(files);
    // ZIP local file header magic bytes: PK\x03\x04
    expect(result[0]).toBe(0x50);
    expect(result[1]).toBe(0x4b);
    expect(result.byteLength).toBeGreaterThan(100);
  });

  test("handles empty file tree", async () => {
    const result = await buildZip({});
    expect(result).toBeInstanceOf(Uint8Array);
  });
});

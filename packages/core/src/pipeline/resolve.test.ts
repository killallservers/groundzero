import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { resolve } from "./resolve.ts";

const originalFetch = globalThis.fetch;

describe("resolve", () => {
  beforeEach(() => {
    globalThis.fetch = mock(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes("hono.dev"))
        return new Response("hono docs", { status: 200 });
      if (urlStr.includes("bun.sh"))
        return new Response("bun docs", { status: 200 });
      if (urlStr.includes("drizzle"))
        return new Response("drizzle docs", { status: 200 });
      if (urlStr.includes("better-auth"))
        return new Response("better-auth docs", { status: 200 });
      return new Response(null, { status: 404 });
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("returns packages with llmsTxt for all known hosts", async () => {
    const result = await resolve({});
    expect(result.packages).toHaveLength(4);
    expect(result.packages.every((p) => p.llmsTxt !== undefined)).toBe(true);
  });

  test("filters out packages where fetch returns non-ok status", async () => {
    globalThis.fetch = mock(async (url: string | URL | Request) => {
      if (url.toString().includes("hono.dev"))
        return new Response("hono docs", { status: 200 });
      return new Response(null, { status: 404 });
    });
    const result = await resolve({});
    expect(result.packages).toHaveLength(1);
    expect(result.packages[0]!.name).toBe("hono");
  });

  test("handles network errors gracefully — returns empty packages", async () => {
    globalThis.fetch = mock(async () => {
      throw new Error("network error");
    });
    const result = await resolve({});
    expect(result.packages).toHaveLength(0);
  });

  test("each package has name, version, llmsTxt fields", async () => {
    const result = await resolve({});
    for (const pkg of result.packages) {
      expect(typeof pkg.name).toBe("string");
      expect(typeof pkg.version).toBe("string");
      expect(typeof pkg.llmsTxt).toBe("string");
    }
  });

  test("answers param is accepted but does not filter packages (always resolves all known)", async () => {
    const withAnswers = await resolve({ "Which framework?": "hono" });
    const withoutAnswers = await resolve({});
    expect(withAnswers.packages).toHaveLength(withoutAnswers.packages.length);
  });
});

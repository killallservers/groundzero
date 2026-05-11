import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { resolve } from "./resolve.ts";

const originalFetch = globalThis.fetch;

function makeFetchMock(
  responses: Record<string, string | null> = {},
  npmDefault = "1.0.0",
) {
  return async (url: string | URL | Request) => {
    const urlStr = url.toString();
    // npm registry calls
    if (urlStr.includes("registry.npmjs.org")) {
      return new Response(JSON.stringify({ version: npmDefault }), {
        status: 200,
      });
    }
    // llms.txt calls — match by hostname keyword
    for (const [key, body] of Object.entries(responses)) {
      if (urlStr.includes(key)) {
        return body !== null
          ? new Response(body, { status: 200 })
          : new Response(null, { status: 404 });
      }
    }
    return new Response(null, { status: 404 });
  };
}

describe("resolve", () => {
  beforeEach(() => {
    globalThis.fetch = makeFetchMock({
      "hono.dev": "hono docs",
      "bun.sh": "bun docs",
      drizzle: "drizzle docs",
      "better-auth": "better-auth docs",
      "react.dev": "react docs",
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("always resolves bun, hono, drizzle regardless of answers", async () => {
    const result = await resolve({});
    const names = result.packages.map((p) => p.name);
    expect(names).toContain("bun");
    expect(names).toContain("hono");
    expect(names).toContain("drizzle");
  });

  test("infers additional packages from answers text", async () => {
    const result = await resolve({ "Which frontend?": "react" });
    const names = result.packages.map((p) => p.name);
    expect(names).toContain("react");
  });

  test("fetches real npm version for each package", async () => {
    const result = await resolve({});
    for (const pkg of result.packages) {
      expect(pkg.version).toBe("1.0.0");
    }
  });

  test("falls back to 'latest' when npm registry is unavailable", async () => {
    const base = makeFetchMock(
      {
        "hono.dev": "hono docs",
        "bun.sh": "bun docs",
        drizzle: "drizzle docs",
      },
      undefined,
    );
    globalThis.fetch = (async (url: string | URL | Request) => {
      if (url.toString().includes("registry.npmjs.org"))
        throw new Error("offline");
      return base(url);
    }) as unknown as typeof fetch;
    const result = await resolve({});
    for (const pkg of result.packages) {
      expect(pkg.version).toBe("latest");
    }
  });

  test("filters out packages where llmsTxt fetch fails", async () => {
    globalThis.fetch = makeFetchMock({
      "hono.dev": "hono docs",
      "bun.sh": null,
      drizzle: null,
    }) as unknown as typeof fetch;
    const result = await resolve({});
    const names = result.packages.map((p) => p.name);
    expect(names).toContain("hono");
    expect(names).not.toContain("bun");
    expect(names).not.toContain("drizzle");
  });

  test("handles network errors gracefully — returns empty packages", async () => {
    globalThis.fetch = (async () => {
      throw new Error("network error");
    }) as unknown as typeof fetch;
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
});

import { afterEach, describe, expect, test } from "bun:test";
import { getModel } from "./llm";

describe("getModel", () => {
  afterEach(() => {
    delete Bun.env.LLM_PROVIDER;
    delete Bun.env.LLM_MODEL;
    delete Bun.env.LLM_API_KEY;
    delete Bun.env.LLM_BASE_URL;
  });

  const modelId = (m: ReturnType<typeof getModel>) =>
    (m as unknown as { modelId: string }).modelId;

  test("defaults to anthropic claude-opus-4-7", () => {
    expect(modelId(getModel())).toBe("claude-opus-4-7");
  });

  test("openai provider uses gpt-4o default", () => {
    Bun.env.LLM_PROVIDER = "openai";
    expect(modelId(getModel())).toBe("gpt-4o");
  });

  test("google provider uses gemini-2.5-pro default", () => {
    Bun.env.LLM_PROVIDER = "google";
    expect(modelId(getModel())).toBe("gemini-2.5-pro");
  });

  test("mistral provider uses mistral-large-latest default", () => {
    Bun.env.LLM_PROVIDER = "mistral";
    expect(modelId(getModel())).toBe("mistral-large-latest");
  });

  test("custom provider uses llama3 default", () => {
    Bun.env.LLM_PROVIDER = "custom";
    expect(modelId(getModel())).toBe("llama3");
  });

  test("LLM_MODEL overrides provider default", () => {
    Bun.env.LLM_PROVIDER = "openai";
    Bun.env.LLM_MODEL = "gpt-4-turbo";
    expect(modelId(getModel())).toBe("gpt-4-turbo");
  });

  test("LLM_MODEL overrides anthropic default", () => {
    Bun.env.LLM_MODEL = "claude-haiku-4-5-20251001";
    expect(modelId(getModel())).toBe("claude-haiku-4-5-20251001");
  });

  test("unknown provider uses anthropic client with llama3 model fallback", () => {
    Bun.env.LLM_PROVIDER = "nonexistent";
    // DEFAULTS["nonexistent"] is undefined → falls back to "llama3" final fallback
    // The switch default branch uses createAnthropic, but modelId is "llama3"
    expect(modelId(getModel())).toBe("llama3");
  });

  test("getModel returns an object with doGenerate", () => {
    const model = getModel() as unknown as { doGenerate: unknown };
    expect(typeof model.doGenerate).toBe("function");
  });
});

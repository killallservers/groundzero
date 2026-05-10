import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createAzure } from "@ai-sdk/azure";
import { createCohere } from "@ai-sdk/cohere";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createMistral } from "@ai-sdk/mistral";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

const DEFAULTS: Record<string, string> = {
  anthropic: "claude-opus-4-7",
  openai: "gpt-4o",
  google: "gemini-2.5-pro",
  mistral: "mistral-large-latest",
  cohere: "command-r-plus",
  bedrock: "anthropic.claude-opus-4-7-v1:0",
  azure: "gpt-4o",
  custom: "llama3",
};

export function getModel(): LanguageModel {
  const provider = Bun.env.LLM_PROVIDER ?? "anthropic";
  const modelId = Bun.env.LLM_MODEL ?? DEFAULTS[provider] ?? "llama3";
  const apiKey = Bun.env.LLM_API_KEY;
  const baseUrl = Bun.env.LLM_BASE_URL;

  switch (provider) {
    case "openai":
      return createOpenAI({ apiKey })(modelId);
    case "google":
      return createGoogleGenerativeAI({ apiKey })(modelId);
    case "mistral":
      return createMistral({ apiKey })(modelId);
    case "cohere":
      return createCohere({ apiKey })(modelId);
    case "bedrock":
      return createAmazonBedrock()(modelId);
    case "azure":
      return createAzure({ apiKey })(modelId);
    case "custom":
      return createOpenAI({
        apiKey: apiKey ?? "local",
        baseURL: baseUrl ?? "http://localhost:11434/v1",
      })(modelId);
    default:
      return createAnthropic({ apiKey })(modelId);
  }
}

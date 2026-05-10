import type { PipelineState } from "./types";

const LLMS_TXT_HOSTS: Record<string, string> = {
  hono: "https://hono.dev/llms.txt",
  bun: "https://bun.sh/llms.txt",
  drizzle: "https://orm.drizzle.team/llms.txt",
  "better-auth": "https://www.better-auth.com/llms.txt",
};

async function fetchLlmsTxt(pkg: string): Promise<string | undefined> {
  const url = LLMS_TXT_HOSTS[pkg];
  if (!url) return undefined;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    return res.ok ? await res.text() : undefined;
  } catch {
    return undefined;
  }
}

export async function resolve(
  _answers: Record<string, string>,
): Promise<NonNullable<PipelineState["resolved"]>> {
  const packageNames = Object.keys(LLMS_TXT_HOSTS);
  const packages = await Promise.all(
    packageNames.map(async (name) => ({
      name,
      version: "latest",
      llmsTxt: await fetchLlmsTxt(name),
    })),
  );

  return { packages: packages.filter((p) => p.llmsTxt) };
}

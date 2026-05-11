import type { PipelineState } from "./types";

const LLMS_TXT_HOSTS: Record<string, string> = {
  hono: "https://hono.dev/llms.txt",
  bun: "https://bun.sh/llms.txt",
  drizzle: "https://orm.drizzle.team/llms.txt",
  "better-auth": "https://www.better-auth.com/llms.txt",
  react: "https://react.dev/llms.txt",
  nextjs: "https://nextjs.org/llms.txt",
  tailwind: "https://tailwindcss.com/llms.txt",
  vite: "https://vite.dev/llms.txt",
};

const ALWAYS_RESOLVE = ["bun", "hono", "drizzle"];

async function fetchNpmVersion(pkg: string): Promise<string> {
  try {
    const res = await fetch(`https://registry.npmjs.org/${pkg}/latest`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return "latest";
    const data = (await res.json()) as { version?: string };
    return data.version ?? "latest";
  } catch {
    return "latest";
  }
}

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

function inferPackages(answers: Record<string, string>): string[] {
  const text = Object.values(answers).join(" ").toLowerCase();
  const mentioned = Object.keys(LLMS_TXT_HOSTS).filter((pkg) =>
    text.includes(pkg.replace("-", " ").toLowerCase()),
  );
  return [...new Set([...ALWAYS_RESOLVE, ...mentioned])];
}

export async function resolve(
  answers: Record<string, string>,
): Promise<NonNullable<PipelineState["resolved"]>> {
  const packageNames = inferPackages(answers);

  const packages = await Promise.all(
    packageNames.map(async (name) => ({
      name,
      version: await fetchNpmVersion(name),
      llmsTxt: await fetchLlmsTxt(name),
    })),
  );

  return { packages: packages.filter((p) => p.llmsTxt) };
}

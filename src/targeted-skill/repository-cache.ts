import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, extname, join, resolve } from "node:path";
import { spawn } from "node:child_process";

type Json = Record<string, any>;

export interface ValidatedRepositoryScripts {
  repository_key: string;
  repository_url: string;
  recipe_path: string;
  script_path: string;
  utility_path?: string;
  source_commit?: string;
  validation_run_id: string;
  validated_at: string;
}

export interface RepositoryCandidateFile {
  path: string;
  local_path: string;
  summary: string;
}

export interface MaterializedRepository {
  ok: boolean;
  repository_key: string;
  repository_url: string;
  repository_dir?: string;
  source_commit?: string;
  candidate_files: RepositoryCandidateFile[];
  reused: boolean;
  error?: string;
}

export interface RepositoryCacheOptions {
  cacheRoot?: string;
  registryPath?: string;
  runGit?: (args: string[], cwd: string | undefined, signal?: AbortSignal) => Promise<string>;
}

const SOURCE_SUFFIXES = new Set([".py", ".r", ".ipynb", ".m", ".jl", ".js", ".ts", ".sh", ".md", ".txt"]);
const EXCLUDED_SEGMENTS = new Set([".git", "node_modules", "data", "datasets", "results", "figures", "checkpoints", "weights", "dist", "build", "vendor"]);
const activeMaterializations = new Map<string, Promise<MaterializedRepository>>();

export function normalizeRepositoryIdentity(raw: unknown): string {
  const value = String(raw || "").trim().replace(/\/$/, "").replace(/\.git$/i, "");
  const ssh = /^git@([^:]+):(.+)$/i.exec(value);
  if (ssh) return `${ssh[1].toLowerCase()}/${ssh[2].replace(/^\/+|\/+$/g, "").toLowerCase()}`;
  try {
    const url = new URL(value);
    const segments = url.pathname.split("/").filter(Boolean);
    const path = url.hostname.toLowerCase() === "gitlab.com"
      ? segments.slice(0, Math.max(2, segments.indexOf("-") > 1 ? segments.indexOf("-") : segments.length))
      : segments.slice(0, 2);
    return `${url.hostname.toLowerCase()}/${path.join("/").replace(/\.git$/i, "")}`.toLowerCase();
  } catch {
    return resolve(value).replace(/\\/g, "/").toLowerCase();
  }
}

function repositoryUrl(raw: unknown): string {
  const value = String(raw || "").trim().replace(/\/$/, "").replace(/\.git$/i, "");
  const ssh = /^git@([^:]+):(.+)$/i.exec(value);
  return ssh ? `https://${ssh[1]}/${ssh[2]}` : value;
}

function cacheKey(identity: string): string {
  const label = basename(identity).replace(/[^a-z0-9._-]+/gi, "-").slice(0, 48) || "repository";
  return `${label}-${createHash("sha256").update(identity).digest("hex").slice(0, 12)}`;
}

function defaultPaths(options: RepositoryCacheOptions) {
  const root = resolve(options.cacheRoot || join(homedir(), ".seekbrain", "repositories"));
  return { root, registry: resolve(options.registryPath || join(root, "validated-scripts.json")) };
}

async function readJson(path: string, fallback: Json): Promise<Json> {
  try { return JSON.parse(await readFile(path, "utf8")); } catch { return fallback; }
}

async function writeJsonAtomic(path: string, value: Json): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, path);
}

async function defaultRunGit(args: string[], cwd?: string, signal?: AbortSignal): Promise<string> {
  return await new Promise<string>((done, reject) => {
    const child = spawn("git", args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      signal,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += String(chunk); });
    child.stderr.on("data", (chunk) => { stderr = (stderr + String(chunk)).slice(-4000); });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? done(stdout) : reject(new Error(`git ${args[0]} failed (${code}): ${stderr.trim()}`)));
  });
}

export async function lookupValidatedRepositoryScripts(rawRepository: unknown, options: RepositoryCacheOptions = {}): Promise<ValidatedRepositoryScripts | undefined> {
  const identity = normalizeRepositoryIdentity(rawRepository);
  if (!identity) return undefined;
  const { registry } = defaultPaths(options);
  const document = await readJson(registry, { repositories: {} });
  const entry = document.repositories?.[identity] as ValidatedRepositoryScripts | undefined;
  if (!entry || !existsSync(String(entry.recipe_path || "")) || !existsSync(String(entry.script_path || ""))) return undefined;
  return entry;
}

export async function registerValidatedRepositoryScripts(input: {
  repositoryUrl: string;
  recipePath: string;
  scriptPath: string;
  utilityPath?: string;
  sourceCommit?: string;
  validationRunId: string;
}, options: RepositoryCacheOptions = {}): Promise<ValidatedRepositoryScripts> {
  const identity = normalizeRepositoryIdentity(input.repositoryUrl);
  const { registry } = defaultPaths(options);
  const document = await readJson(registry, { schema_version: 1, repositories: {} });
  const entry: ValidatedRepositoryScripts = {
    repository_key: identity,
    repository_url: repositoryUrl(input.repositoryUrl),
    recipe_path: resolve(input.recipePath),
    script_path: resolve(input.scriptPath),
    ...(input.utilityPath && existsSync(input.utilityPath) ? { utility_path: resolve(input.utilityPath) } : {}),
    ...(input.sourceCommit ? { source_commit: input.sourceCommit } : {}),
    validation_run_id: input.validationRunId,
    validated_at: new Date().toISOString(),
  };
  document.schema_version = 1;
  document.repositories = { ...(document.repositories || {}), [identity]: entry };
  await writeJsonAtomic(registry, document);
  return entry;
}

function tokens(value: string): Set<string> {
  return new Set(value.toLowerCase().replace(/[_-]+/g, " ").match(/[\p{L}\p{N}]+/gu)?.filter((token) => token.length > 1) || []);
}

function rankPath(path: string, query: Set<string>): number {
  const lower = path.toLowerCase();
  const segments = lower.split("/");
  if (segments.some((segment) => EXCLUDED_SEGMENTS.has(segment))) return -1;
  if (!SOURCE_SUFFIXES.has(extname(lower))) return -1;
  let score = /readme|example|analysis|pipeline|model|stat|method|main|run/.test(lower) ? 3 : 0;
  for (const token of query) if (lower.includes(token)) score += 2;
  if (/test|docs?|license|changelog/.test(lower)) score -= 1;
  return score;
}

function summarizeSource(path: string, content: string): string {
  const signatures = content.match(/^\s*(?:def|class|function)\s+[^\n{]+/gm)?.slice(0, 4) || [];
  const imports = content.match(/^\s*(?:from\s+\S+\s+import|import\s+\S+|library\([^\n]+\))/gm)?.slice(0, 4) || [];
  return [...signatures, ...imports].join("; ") || `${extname(path).slice(1) || "text"} implementation reference`;
}

async function materialize(rawRepository: string, question: string, title: string, options: RepositoryCacheOptions, signal?: AbortSignal): Promise<MaterializedRepository> {
  const identity = normalizeRepositoryIdentity(rawRepository);
  const url = repositoryUrl(rawRepository);
  const { root } = defaultPaths(options);
  const repositoryDir = join(root, cacheKey(identity));
  const gitDir = join(repositoryDir, "repo.git");
  const materializedDir = join(repositoryDir, "files");
  const metadataPath = join(repositoryDir, "repository.json");
  const runGit = options.runGit || defaultRunGit;
  await mkdir(repositoryDir, { recursive: true });
  let reused = existsSync(metadataPath) && existsSync(gitDir);
  try {
    if (!existsSync(gitDir)) {
      await runGit(["clone", "--depth", "1", "--filter=blob:none", "--no-checkout", "--bare", url, gitDir], undefined, signal);
      reused = false;
    }
    const sourceCommit = (await runGit(["rev-parse", "HEAD"], gitDir, signal)).trim();
    const paths = (await runGit(["ls-tree", "-r", "--name-only", "HEAD"], gitDir, signal)).split("\n").map((item) => item.trim()).filter(Boolean);
    const query = tokens(`${question} ${title}`);
    const ranked = paths.map((path) => ({ path, score: rankPath(path, query) })).filter((item) => item.score >= 0).sort((a, b) => b.score - a.score || a.path.localeCompare(b.path)).slice(0, 5);
    const candidateFiles: RepositoryCandidateFile[] = [];
    await mkdir(materializedDir, { recursive: true });
    for (const item of ranked) {
      const content = (await runGit(["show", `HEAD:${item.path}`], gitDir, signal)).slice(0, 60_000);
      const localPath = join(materializedDir, item.path);
      await mkdir(dirname(localPath), { recursive: true });
      await writeFile(localPath, content, "utf8");
      candidateFiles.push({ path: item.path, local_path: localPath, summary: summarizeSource(item.path, content) });
    }
    await writeJsonAtomic(metadataPath, { schema_version: 1, repository_key: identity, repository_url: url, source_commit: sourceCommit, candidate_files: candidateFiles, updated_at: new Date().toISOString() });
    return { ok: true, repository_key: identity, repository_url: url, repository_dir: repositoryDir, source_commit: sourceCommit, candidate_files: candidateFiles, reused };
  } catch (error) {
    return { ok: false, repository_key: identity, repository_url: url, repository_dir: repositoryDir, candidate_files: [], reused, error: String(error) };
  }
}

export async function materializeRepository(rawRepository: string, question: string, title: string, options: RepositoryCacheOptions = {}, signal?: AbortSignal): Promise<MaterializedRepository> {
  const identity = normalizeRepositoryIdentity(rawRepository);
  const existing = activeMaterializations.get(identity);
  if (existing) return await existing;
  const running = materialize(rawRepository, question, title, options, signal);
  activeMaterializations.set(identity, running);
  try { return await running; } finally { activeMaterializations.delete(identity); }
}

export function repositoryGuidance(input: {
  question: string;
  title: string;
  paperText: string;
  materialized?: MaterializedRepository;
  validated?: ValidatedRepositoryScripts;
}): string {
  if (input.validated) {
    return [
      "# Validated repository Recipe", "",
      "## Preconditions", "",
      `- Repository: ${input.validated.repository_url}`,
      input.validated.source_commit ? `- Validated source commit: ${input.validated.source_commit}` : "",
      `- Recipe: ${input.validated.recipe_path}`,
      `- Validated script: ${input.validated.script_path}`,
      input.validated.utility_path ? `- Validated utility: ${input.validated.utility_path}` : "",
      "- Reuse these validated scripts directly as the implementation base. Adapt current paths, dimensions, parameters, and outputs, then run normal Validation.", "",
      "## Inputs and outputs", "",
      `- Current task: ${input.question}`, "",
      "## Procedure", "",
      `1. Read ${input.validated.script_path}.`,
      input.validated.utility_path ? `2. Read ${input.validated.utility_path} when imported by the main script.` : "",
      "3. Adapt the validated implementation to the approved Plan; do not rerun repository discovery.",
    ].filter(Boolean).join("\n");
  }
  const materialized = input.materialized;
  return [
    "# Repository-backed method guidance", "",
    "## Preconditions", "",
    `- Paper: ${input.title}`,
    materialized ? `- Repository: ${materialized.repository_url}` : "- Repository was not materialized; use paper evidence only.",
    materialized?.source_commit ? `- Commit: ${materialized.source_commit}` : "",
    materialized?.repository_dir ? `- Local repository cache: ${materialized.repository_dir}` : "",
    "- Repository code is implementation evidence. The approved Plan remains authoritative.", "",
    "## Inputs and outputs", "",
    `- Current task: ${input.question}`,
    `- Paper method evidence: ${String(input.paperText || "").replace(/\s+/g, " ").slice(0, 1800) || "No usable paper text was returned."}`, "",
    "## Procedure", "",
    ...(materialized?.candidate_files?.length ? materialized.candidate_files.map((file, index) => `${index + 1}. Reference ${file.local_path} (${file.path}): ${file.summary}`) : ["1. Formulate the method from the paper evidence without claiming repository-backed implementation details."]),
    "",
    "## Pitfalls", "",
    "- Do not inherit repository-specific dataset paths, unrequested analyses, or unrelated plotting code.",
  ].filter(Boolean).join("\n");
}

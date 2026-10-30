import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { extname, join, relative, resolve, sep } from "node:path";
import { spawn } from "node:child_process";
import { nonInteractiveGitEnv } from "../core/non-interactive-git.ts";
import { stringify as stringifyYaml } from "yaml";
import { regenerateSkillIndex } from "./indexer.ts";
import { buildEvidenceManifest, buildRagRecipeCard, evaluateRecipeDraft, hasExecutablePython } from "./recipe-forge.ts";

type Json = Record<string, any>;

export type RagSkillEvidenceLevel = "repository_backed" | "paper_only";

export interface RagSkillAuthorInput {
  question: string;
  title: string;
  paperText: string;
  repoLink?: string;
  evidenceLevel: RagSkillEvidenceLevel;
  provider?: "ailab_rag" | "semantic_scholar" | "pubmed";
  doi?: string;
  pmid?: string;
  pmcid?: string;
  repoOverview: string;
  matchedFiles: Array<{ path: string; content: string }>;
  matchedPaperContext: string;
  matchedRepoContext: string;
  connectionAnalysis: string;
  reproductionPlan: string;
  signal?: AbortSignal;
}

export type RagSkillAuthor = (input: RagSkillAuthorInput) => Promise<Json>;

export interface RagSkillContextInput {
  question: string;
  title: string;
  paperText: string;
  repoLink: string;
  repoDir: string;
  repositoryFiles: Array<{ path: string; extension: string; size: number; excerpt?: string }>;
  signal?: AbortSignal;
}

export interface RagSkillContext {
  repo_overview: string;
  selected_files: string[];
  matched_paper_context: string;
  matched_repo_context: string;
  connection_analysis: string;
  reproduction_plan: string;
}

export type RagSkillContextBuilder = (input: RagSkillContextInput) => Promise<RagSkillContext>;

const SOURCE_SUFFIXES = new Set([".py", ".ipynb", ".r", ".md", ".txt", ".sh", ".js", ".ts", ".yaml", ".yml", ".toml", ".cfg"]);

function safeName(value: unknown, limit = 80): string {
  return String(value || "skill").trim().replace(/[^A-Za-z0-9._-]+/g, "_").replace(/_+/g, "_").replace(/^[_-]|[_-]$/g, "").slice(0, limit) || "skill";
}

export function normalizeRepoLink(raw: unknown): string {
  return String(raw || "").trim().replace(/\/$/, "").replace(/\.git$/i, "").toLowerCase();
}

export function repoIdentifier(raw: unknown): string {
  const normalized = normalizeRepoLink(raw);
  try {
    const url = new URL(normalized);
    return safeName(url.pathname.replace(/^\//, "").replace(/\//g, "_"));
  } catch {
    return safeName(normalized);
  }
}

export function ragSkillTitleCacheKey(title: string): string {
  return `${safeName(title, 80)}_${createHash("sha256").update(title).digest("hex").slice(0, 12)}`;
}

function questionCacheKey(question: string): string {
  return `${safeName(question, 60)}_${createHash("sha256").update(question).digest("hex").slice(0, 12)}`;
}

async function cloneRepository(repoLink: string, cloneDir: string, signal?: AbortSignal): Promise<void> {
  if (existsSync(join(cloneDir, ".clone_done"))) return;
  await mkdir(resolve(cloneDir, ".."), { recursive: true });
  await new Promise<void>((done, reject) => {
    const child = spawn("git", ["clone", "--depth", "1", repoLink, cloneDir], {
      stdio: ["ignore", "ignore", "pipe"],
      signal,
      env: nonInteractiveGitEnv(),
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr = (stderr + String(chunk)).slice(-4000); });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? done() : reject(new Error(`git clone failed (${code}): ${stderr.trim()}`)));
  });
  await writeFile(join(cloneDir, ".clone_done"), `${repoLink}\n`, "utf8");
}

async function repositoryCommit(repositoryDir: string, signal?: AbortSignal): Promise<string | undefined> {
  return await new Promise((done) => {
    const child = spawn("git", ["-C", repositoryDir, "rev-parse", "HEAD"], {
      stdio: ["ignore", "pipe", "ignore"],
      signal,
      env: nonInteractiveGitEnv(),
    });
    let stdout = "";
    child.stdout.on("data", (chunk) => { stdout = (stdout + String(chunk)).slice(-200); });
    child.on("error", () => done(undefined));
    child.on("close", (code) => done(code === 0 && /^[a-f0-9]{40}$/i.test(stdout.trim()) ? stdout.trim() : undefined));
  });
}

function tokens(value: string): Set<string> {
  return new Set(value.toLowerCase().replace(/[_-]+/g, " ").match(/[\p{L}\p{N}]+/gu)?.filter((token) => token.length > 1) || []);
}

function scoreText(query: Set<string>, value: string): number {
  const candidate = tokens(value);
  let score = 0;
  for (const token of query) if (candidate.has(token)) score += 1;
  return score;
}

function notebookText(raw: string): string {
  try {
    const notebook = JSON.parse(raw);
    const cells = Array.isArray(notebook.cells) ? notebook.cells : [];
    return cells.map((cell: Json, index: number) => {
      const source = Array.isArray(cell.source) ? cell.source.join("") : String(cell.source || "");
      return source.trim() ? `# Cell ${index + 1} [${cell.cell_type || "unknown"}]\n${source.trim()}` : "";
    }).filter(Boolean).join("\n\n");
  } catch {
    return raw;
  }
}

async function collectSourceFiles(root: string, question: string): Promise<Array<{ path: string; content: string; extension: string; size: number; score: number }>> {
  const query = tokens(question);
  const candidates: Array<{ path: string; content: string; extension: string; size: number; score: number }> = [];
  async function visit(directory: string, depth: number): Promise<void> {
    if (depth > 8 || candidates.length > 400) return;
    let entries;
    try { entries = await readdir(directory, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if ([".git", "node_modules", "dist", "build", "vendor", "data"].includes(entry.name)) continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) { await visit(path, depth + 1); continue; }
      if (!entry.isFile() || !SOURCE_SUFFIXES.has(extname(entry.name).toLowerCase())) continue;
      try {
        const raw = await readFile(path, "utf8");
        const extension = extname(entry.name).toLowerCase();
        const content = (extension === ".ipynb" ? notebookText(raw) : raw).slice(0, 60_000);
        const rel = relative(root, path);
        candidates.push({ path: rel, content, extension, size: content.length, score: scoreText(query, `${rel} ${content.slice(0, 5000)}`) });
      } catch { /* ignore binary/unreadable files */ }
    }
  }
  await visit(root, 0);
  return candidates.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
}

function fallbackContext(input: RagSkillContextInput, files: Array<{ path: string; content: string; score: number }>): RagSkillContext {
  const selected = files.slice(0, 5).map((file) => file.path);
  const overview = input.repositoryFiles.map((file) => `${file.path} (${file.extension}, ${file.size} chars)`).join("\n");
  return {
    repo_overview: overview,
    selected_files: selected,
    matched_paper_context: input.paperText.slice(0, 30_000),
    matched_repo_context: selected.length ? `Relevant repository files:\n${selected.map((path) => `- ${path}`).join("\n")}` : "No repository files were available.",
    connection_analysis: "Use the selected repository implementation as evidence and explicitly identify any gap between the paper method and available code.",
    reproduction_plan: "1. Verify inputs and dependencies.\n2. Adapt the selected implementation.\n3. Execute the analysis.\n4. Validate every declared output against the paper method.",
  };
}

function selectMatchedFiles(root: string, files: Array<{ path: string; content: string; score: number }>, selected: unknown): Array<{ path: string; content: string }> {
  const requested = Array.isArray(selected) ? selected.map(String) : [];
  const byPath = new Map(files.map((file) => [file.path, file]));
  const result: Array<{ path: string; content: string }> = [];
  for (const requestedPath of requested) {
    const normalized = requestedPath.replace(/^\.\//, "");
    const absolute = resolve(root, normalized);
    if (absolute !== root && !absolute.startsWith(`${root}${sep}`)) continue;
    const exact = byPath.get(normalized);
    const fuzzy = exact || files.find((file) => file.path.endsWith(normalized) || normalized.endsWith(file.path));
    if (fuzzy && !result.some((file) => file.path === fuzzy.path)) result.push({ path: fuzzy.path, content: fuzzy.content });
    if (result.length >= 10) break;
  }
  if (!result.length) return files.slice(0, 5).map(({ path, content }) => ({ path, content }));
  return result;
}

function fallbackAuthor(input: RagSkillAuthorInput): Json {
  if (input.evidenceLevel === "paper_only") {
    const description = `Paper-grounded methodological guidance for ${input.question}`;
    return {
      name: safeName(input.question, 60).replace(/_/g, "-"),
      description,
      triggers: [input.question],
      tags: ["seekbrain", "paper-only"],
      skill_body: [
        `# ${input.question}`, "", "## Description", "", description, "",
        "## Evidence level", "", "This analysis recipe is derived from paper evidence only. No associated implementation repository was verified, and no executable analysis code is supplied.", "",
        "## Paper context", "", input.paperText.slice(0, 12_000), "",
        "## Adaptation workflow", "", "1. Confirm that the paper method fits the current scientific question and dataset.",
        "2. Translate only explicitly documented procedures into a methodological schema.",
        "3. Implement the schema for the current dataset without assuming undocumented parameters or code.",
        "4. Validate outputs against the paper's stated method and report all deviations.", "",
      ].join("\n"),
      analysis_script: "",
      utility_script: "",
    };
  }
  const description = `Repository-backed analysis guidance for ${input.question}`;
  return {
    name: safeName(input.question, 60).replace(/_/g, "-"),
    description,
    triggers: [input.question],
    tags: ["seekbrain", "repository-backed"],
    skill_body: [
      `# ${input.question}`, "", "## Description", "", description, "", "## Paper context", "", input.paperText.slice(0, 6000), "",
      "## Repository implementation", "", input.matchedFiles.map((file) => `- \`${file.path}\``).join("\n") || "No readable repository files were selected.", "",
      "## Paper-to-code mapping", "", input.connectionAnalysis, "", "## Workflow", "", input.reproductionPlan, "",
    ].join("\n"),
    analysis_script: "# Adapt the repository implementation referenced by this analysis recipe to the current dataset.\n",
    utility_script: "",
  };
}

function skillDocument(authored: Json, input: RagSkillAuthorInput): string {
  const paperOnly = input.evidenceLevel === "paper_only";
  const metadata = stringifyYaml({
    name: safeName(authored.name || input.question, 64).replace(/_/g, "-").toLowerCase(),
    description: String(authored.description || `${paperOnly ? "Paper-grounded" : "Repository-backed"} analysis recipe for ${input.question}`),
    triggers: Array.isArray(authored.triggers) ? authored.triggers : [input.question],
    tags: Array.isArray(authored.tags) ? authored.tags : ["seekbrain", paperOnly ? "paper-only" : "repository-backed"],
  }).trim();
  let body = String(authored.skill_body || fallbackAuthor(input).skill_body).replace(/^---[\s\S]*?---\s*/m, "").trim();
  if (paperOnly && !body.includes("No associated implementation repository was verified")) {
    body = `${body}\n\n## Evidence boundary\n\nNo associated implementation repository was verified. This analysis recipe provides paper-grounded guidance only and does not claim that the described procedures have already been implemented.`;
  }
  return `---\n${metadata}\n---\n\n${body}\n`;
}

export class RagSkillGenerator {
  constructor(readonly author?: RagSkillAuthor, readonly contextBuilder?: RagSkillContextBuilder) {}

  async generate(input: {
    question: string;
    title: string;
    paperText: string;
    repoLink?: string;
    evidenceLevel?: RagSkillEvidenceLevel;
    provider?: "ailab_rag" | "semantic_scholar" | "pubmed";
    doi?: string;
    pmid?: string;
    pmcid?: string;
    outputDir: string;
    signal?: AbortSignal;
  }): Promise<Json> {
    const outputDir = resolve(input.outputDir);
    const evidenceLevel = input.evidenceLevel ?? "repository_backed";
    if (evidenceLevel === "paper_only") return await this.generatePaperOnly({ ...input, evidenceLevel, outputDir });
    if (!input.repoLink) return { ok: false, error: "repository-backed Recipe Crystallization requires repoLink" };
    // Repository-backed crystallization is repository-scoped. Once RAG finds
    // the same GitHub repository again, reuse no longer depends on question wording.
    const folderName = repoIdentifier(input.repoLink);
    const skillDir = join(outputDir, folderName);
    if (existsSync(join(skillDir, "SKILL.md"))) {
      let metadata: Json = {};
      try { metadata = JSON.parse(await readFile(join(skillDir, "metadata.json"), "utf8")); } catch { /* legacy generated Recipe */ }
      return { ok: true, skill_path: skillDir, reused: true, repo_link: input.repoLink, recipe_status: metadata.lifecycle?.status || "candidate", quality_gate: metadata.quality_gate };
    }

    const cacheDir = join(outputDir, ".cache", ragSkillTitleCacheKey(input.title));
    const cloneDir = join(cacheDir, "repo_clone");
    let repositoryFiles: Array<{ path: string; content: string; extension: string; size: number; score: number }> = [];
    let sourceCommit: string | undefined;
    const warnings: string[] = [];
    try {
      await cloneRepository(input.repoLink, cloneDir, input.signal);
      repositoryFiles = await collectSourceFiles(cloneDir, `${input.question} ${input.title}`);
      sourceCommit = await repositoryCommit(cloneDir, input.signal);
    } catch (error) {
      warnings.push(`repository parsing failed; generated from paper context only: ${String(error)}`);
    }
    const contextInput: RagSkillContextInput = {
      question: input.question,
      title: input.title,
      paperText: input.paperText,
      repoLink: input.repoLink,
      repoDir: cloneDir,
      repositoryFiles: repositoryFiles.map(({ path, extension, size, content }) => ({ path, extension, size, excerpt: content.slice(0, 4000) })),
      signal: input.signal,
    };
    let context = fallbackContext(contextInput, repositoryFiles);
    const contextCache = join(cacheDir, `context_${questionCacheKey(input.question)}.json`);
    try {
      if (existsSync(contextCache)) context = JSON.parse(await readFile(contextCache, "utf8"));
      else if (this.contextBuilder && repositoryFiles.length) {
        context = await this.contextBuilder(contextInput);
        await writeFile(contextCache, `${JSON.stringify(context, null, 2)}\n`, "utf8");
      }
    } catch (error) {
      warnings.push(`structured paper/repository context fallback used: ${String(error)}`);
      context = fallbackContext(contextInput, repositoryFiles);
    }
    const matchedFiles = selectMatchedFiles(cloneDir, repositoryFiles, context.selected_files);
    const repoOverview = String(context.repo_overview || contextInput.repositoryFiles.map((file) => file.path).join("\n"));
    const authorInput = {
      question: input.question,
      title: input.title,
      paperText: input.paperText,
      repoLink: input.repoLink,
      evidenceLevel,
      provider: input.provider,
      doi: input.doi,
      pmid: input.pmid,
      pmcid: input.pmcid,
      repoOverview,
      matchedFiles,
      matchedPaperContext: String(context.matched_paper_context || input.paperText),
      matchedRepoContext: String(context.matched_repo_context || ""),
      connectionAnalysis: String(context.connection_analysis || ""),
      reproductionPlan: String(context.reproduction_plan || ""),
      signal: input.signal,
    };
    let authored: Json;
    try { authored = this.author ? await this.author(authorInput) : fallbackAuthor(authorInput); }
    catch (error) { warnings.push(`recipe author fallback used: ${String(error)}`); authored = fallbackAuthor(authorInput); }

    const skillText = skillDocument(authored, authorInput);
    const analysisScript = String(authored.analysis_script || "");
    const utilityScript = String(authored.utility_script || "");
    const card = buildRagRecipeCard({ authored, question: input.question, evidenceLevel, repositoryUrl: input.repoLink, sourceCommit });
    const qualityGate = await evaluateRecipeDraft({ card, skillBody: skillText, analysisScript, utilityScript, evidenceLevel, paperText: input.paperText, matchedFiles });
    warnings.push(...qualityGate.warnings);
    if (!qualityGate.passed) {
      return { ok: false, error: `Recipe candidate failed static quality gate: ${qualityGate.blocking_issues.join("; ")}`, warnings, quality_gate: qualityGate, recipe_status: "candidate" };
    }
    const evidenceManifest = buildEvidenceManifest({
      question: input.question,
      title: input.title,
      paperText: input.paperText,
      provider: input.provider,
      doi: input.doi,
      pmid: input.pmid,
      pmcid: input.pmcid,
      evidenceLevel,
      repositoryUrl: input.repoLink,
      sourceCommit,
      matchedFiles,
      matchedPaperContext: authorInput.matchedPaperContext,
      matchedRepoContext: authorInput.matchedRepoContext,
      connectionAnalysis: authorInput.connectionAnalysis,
      reproductionPlan: authorInput.reproductionPlan,
    });

    const scriptsDir = join(skillDir, "scripts");
    const referencesDir = join(skillDir, "references");
    const matchedDir = join(referencesDir, "matched_files");
    await Promise.all([mkdir(scriptsDir, { recursive: true }), mkdir(matchedDir, { recursive: true })]);
    await writeFile(join(skillDir, "SKILL.md"), skillText, "utf8");
    await writeFile(join(skillDir, "recipe-card.json"), `${JSON.stringify(card, null, 2)}\n`, "utf8");
    if (hasExecutablePython(analysisScript)) await writeFile(join(scriptsDir, "run_analysis.py"), analysisScript, "utf8");
    if (hasExecutablePython(utilityScript)) await writeFile(join(scriptsDir, "utils.py"), utilityScript, "utf8");
    await writeFile(join(referencesDir, "question.md"), `# Question\n\n${input.question}\n`, "utf8");
    await writeFile(join(referencesDir, "paper_context.md"), `# Paper context\n\n## ${input.title}\n\n${input.paperText}\n`, "utf8");
    await writeFile(join(referencesDir, "repo_context.md"), `# Repository context\n\n${input.repoLink}\n\n${repoOverview}\n`, "utf8");
    await writeFile(join(referencesDir, "matched_paper_context.md"), `# Matched paper context\n\n${authorInput.matchedPaperContext}\n`, "utf8");
    await writeFile(join(referencesDir, "matched_repo_context.md"), `# Matched repository context\n\n${authorInput.matchedRepoContext}\n`, "utf8");
    await writeFile(join(referencesDir, "connection_analysis.md"), `# Paper-to-code connection\n\n${authorInput.connectionAnalysis}\n`, "utf8");
    await writeFile(join(referencesDir, "reproduction_plan.md"), `# Reproduction plan\n\n${authorInput.reproductionPlan}\n`, "utf8");
    await writeFile(join(referencesDir, "evidence_manifest.json"), `${JSON.stringify(evidenceManifest, null, 2)}\n`, "utf8");
    for (const file of matchedFiles) await writeFile(join(matchedDir, safeName(file.path, 180)), `# Source: ${file.path}\n\n${file.content}`, "utf8");
    const metadata = {
      schema_version: 3,
      question: input.question,
      title: input.title,
      ...(input.provider === "semantic_scholar" || input.provider === "pubmed" ? {
        evidence_level: "repository_backed",
        provider: input.provider,
        doi: input.doi || null,
        pmid: input.pmid || null,
        pmcid: input.pmcid || null,
        repository_url: input.repoLink,
        scripts_available: hasExecutablePython(analysisScript),
      } : {}),
      repo_link: input.repoLink,
      repo_key: normalizeRepoLink(input.repoLink),
      repository_file_count: repositoryFiles.length,
      matched_repo_files: matchedFiles.map((file) => file.path),
      source_commit: sourceCommit || null,
      lifecycle: { status: "candidate", eligible_for_repertoire_retrieval: false },
      quality: { passed_runs: 0, recipe_attributed_failures: 0 },
      quality_gate: qualityGate,
      generated_at: new Date().toISOString(),
    };
    await writeFile(join(skillDir, "metadata.json"), `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
    await regenerateSkillIndex(outputDir);
    return { ok: true, skill_path: skillDir, reused: false, repo_link: input.repoLink, source_commit: sourceCommit, warnings, quality_gate: qualityGate, recipe_status: "candidate" };
  }

  private async generatePaperOnly(input: {
    question: string;
    title: string;
    paperText: string;
    evidenceLevel: "paper_only";
    provider?: "ailab_rag" | "semantic_scholar" | "pubmed";
    doi?: string;
    pmid?: string;
    pmcid?: string;
    outputDir: string;
    signal?: AbortSignal;
  }): Promise<Json> {
    const identity = [input.provider, input.doi, input.pmid, input.pmcid, input.title].filter(Boolean).join(":");
    const folderName = `${safeName(input.question, 60)}__paper_${createHash("sha256").update(identity).digest("hex").slice(0, 12)}`;
    const skillDir = join(input.outputDir, folderName);
    if (existsSync(join(skillDir, "SKILL.md"))) return { ok: true, skill_path: skillDir, reused: true, evidence_level: "paper_only" };
    const authorInput: RagSkillAuthorInput = {
      question: input.question,
      title: input.title,
      paperText: input.paperText,
      evidenceLevel: "paper_only",
      provider: input.provider,
      doi: input.doi,
      pmid: input.pmid,
      pmcid: input.pmcid,
      repoOverview: "",
      matchedFiles: [],
      matchedPaperContext: input.paperText,
      matchedRepoContext: "",
      connectionAnalysis: "No repository was verified; do not claim a paper-to-code mapping.",
      reproductionPlan: "Adapt only the procedures explicitly supported by the paper evidence.",
      signal: input.signal,
    };
    let authored: Json;
    const warnings: string[] = [];
    try { authored = this.author ? await this.author(authorInput) : fallbackAuthor(authorInput); }
    catch (error) { warnings.push(`recipe author fallback used: ${String(error)}`); authored = fallbackAuthor(authorInput); }
    const skillText = skillDocument(authored, authorInput);
    const card = buildRagRecipeCard({ authored, question: input.question, evidenceLevel: "paper_only" });
    const qualityGate = await evaluateRecipeDraft({ card, skillBody: skillText, analysisScript: "", evidenceLevel: "paper_only", paperText: input.paperText, matchedFiles: [] });
    warnings.push(...qualityGate.warnings);
    if (!qualityGate.passed) return { ok: false, error: `Paper-only Recipe candidate failed static quality gate: ${qualityGate.blocking_issues.join("; ")}`, warnings, quality_gate: qualityGate, recipe_status: "candidate" };
    const evidenceManifest = buildEvidenceManifest({
      question: input.question,
      title: input.title,
      paperText: input.paperText,
      provider: input.provider,
      doi: input.doi,
      pmid: input.pmid,
      pmcid: input.pmcid,
      evidenceLevel: "paper_only",
      matchedFiles: [],
      matchedPaperContext: input.paperText,
      matchedRepoContext: "",
      connectionAnalysis: authorInput.connectionAnalysis,
      reproductionPlan: authorInput.reproductionPlan,
    });
    const referencesDir = join(skillDir, "references");
    await mkdir(referencesDir, { recursive: true });
    await writeFile(join(skillDir, "SKILL.md"), skillText, "utf8");
    await writeFile(join(skillDir, "recipe-card.json"), `${JSON.stringify(card, null, 2)}\n`, "utf8");
    await writeFile(join(referencesDir, "paper_context.md"), `# Paper context\n\n## ${input.title}\n\n${input.paperText}\n`, "utf8");
    await writeFile(join(referencesDir, "evidence_manifest.json"), `${JSON.stringify(evidenceManifest, null, 2)}\n`, "utf8");
    await writeFile(join(skillDir, "metadata.json"), `${JSON.stringify({
      schema_version: 3,
      question: input.question,
      title: input.title,
      evidence_level: "paper_only",
      provider: input.provider || null,
      doi: input.doi || null,
      pmid: input.pmid || null,
      pmcid: input.pmcid || null,
      repository_url: null,
      scripts_available: false,
      lifecycle: { status: "candidate", eligible_for_repertoire_retrieval: false },
      quality: { passed_runs: 0, recipe_attributed_failures: 0 },
      quality_gate: qualityGate,
      generated_at: new Date().toISOString(),
    }, null, 2)}\n`, "utf8");
    await regenerateSkillIndex(input.outputDir);
    return { ok: true, skill_path: skillDir, reused: false, evidence_level: "paper_only", warnings, quality_gate: qualityGate, recipe_status: "candidate" };
  }
}

import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import { atomicWriteJson } from "../core/index.ts";
import { nonInteractiveGitEnv } from "../core/non-interactive-git.ts";
import { buildEvidenceManifest, buildRagRecipeCard, evaluateRecipeDraft } from "../targeted-skill/recipe-forge.ts";
import type { ExistingRepositoryAdaptationSummary, RagRecipeCandidate } from "./rag-recipe-search.ts";
import { RagRecipeSearchStore } from "./rag-recipe-search.ts";

type Json = Record<string, any>;

export interface RepositoryAdaptation {
  adaptation_id: string;
  objective: string;
  query_scope: string;
  required_inputs: string[];
  selected_repository_paths: string[];
  operations: string[];
  expected_outputs: string[];
  validation_criteria: string[];
  adaptation_gaps: string[];
}

export interface RepositorySkeleton {
  repository_key: string;
  repository_url: string;
  source_commit: string;
  tree_paths: string[];
  readme_path: string;
  readme: string;
  cache_dir: string;
}

export interface AdaptationRecord {
  metadata: Json;
  adaptation: RepositoryAdaptation;
  directory: string;
}

export interface RagRecipeGenerationModels {
  selectExisting(input: {
    query: string;
    candidate: RagRecipeCandidate;
    adaptations: Array<{ adaptation_id: string; query: string; objective: string; required_inputs: string[]; selected_repository_paths: string[]; operations: string[]; expected_outputs: string[]; validation_criteria: string[] }>;
    signal?: AbortSignal;
  }): Promise<{ matched_adaptation_id: string | null; reason: string }>;
  createAdaptation(input: { query: string; candidate: RagRecipeCandidate; skeleton: RepositorySkeleton; signal?: AbortSignal }): Promise<RepositoryAdaptation>;
  generateSkill(input: {
    query: string;
    candidate: RagRecipeCandidate;
    skeleton: RepositorySkeleton;
    adaptation: RepositoryAdaptation;
    selectedFiles: Array<{ path: string; content: string }>;
    signal?: AbortSignal;
  }): Promise<Json>;
}

export interface RagRecipeGenerationOptions {
  runDir: string;
  fromRagRoot: string;
  models: RagRecipeGenerationModels;
  repositoryCacheRoot?: string;
  maxCalls?: number;
  maxCandidatesPerCall?: number;
  runGit?: (args: string[], cwd?: string, signal?: AbortSignal) => Promise<string>;
}

function sha(value: string): string { return createHash("sha256").update(value).digest("hex"); }
function compact(value: unknown): string { return String(value ?? "").trim().replace(/\s+/g, " "); }
function strings(value: unknown): string[] { return Array.isArray(value) ? [...new Set(value.map(compact).filter(Boolean))] : []; }
function safeSegment(value: string): string { return value.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64) || "recipe"; }

async function git(args: string[], cwd?: string, signal?: AbortSignal): Promise<string> {
  return await new Promise((resolve, reject) => {
    const child = spawn("git", args, { cwd, signal, env: nonInteractiveGitEnv(), stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += String(chunk); });
    child.stderr.on("data", (chunk) => { stderr = (stderr + String(chunk)).slice(-4000); });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve(stdout) : reject(new Error(`git ${args[0]} failed (${code}): ${stderr.trim()}`)));
  });
}

function sourceText(path: string, content: string): string {
  const suffix = extname(path).toLowerCase();
  if (suffix === ".ipynb") {
    try {
      const notebook = JSON.parse(content) as Json;
      return (Array.isArray(notebook.cells) ? notebook.cells : []).flatMap((cell: Json, index: number) => {
        if (cell?.cell_type !== "code") return [];
        const body = Array.isArray(cell.source) ? cell.source.join("") : String(cell.source || "");
        return body.trim() ? [`# Notebook cell ${index + 1}\n${body.trim()}`] : [];
      }).join("\n\n");
    } catch { return ""; }
  }
  if (suffix === ".rmd" || suffix === ".qmd") {
    return [...content.matchAll(/```\s*\{r[^}]*\}\s*\n([\s\S]*?)```/gi)].map((match) => match[1].trim()).filter(Boolean).join("\n\n");
  }
  return content;
}

export class RepositorySkeletonCache {
  readonly root: string;
  constructor(readonly options: RagRecipeGenerationOptions) {
    this.root = options.repositoryCacheRoot || join(options.fromRagRoot, ".repository-cache");
  }

  async load(candidate: RagRecipeCandidate, signal?: AbortSignal): Promise<RepositorySkeleton> {
    const key = `${safeSegment(basename(candidate.repository.repository_key))}-${sha(candidate.repository.repository_key).slice(0, 12)}`;
    const cacheDir = join(this.root, key);
    const bareDir = join(cacheDir, "repository.git");
    const metadataPath = join(cacheDir, "skeleton.json");
    if (existsSync(metadataPath) && existsSync(bareDir)) return JSON.parse(await readFile(metadataPath, "utf8")) as RepositorySkeleton;
    await mkdir(cacheDir, { recursive: true });
    const runGit = this.options.runGit || git;
    if (!existsSync(bareDir)) await runGit(["clone", "--depth", "1", "--filter=blob:none", "--no-checkout", "--bare", candidate.repository.url, bareDir], undefined, signal);
    const sourceCommit = (await runGit(["rev-parse", "HEAD"], bareDir, signal)).trim();
    const treePaths = (await runGit(["ls-tree", "-r", "--name-only", "HEAD"], bareDir, signal)).split("\n").map((item) => item.trim()).filter(Boolean);
    const readmes = treePaths.filter((path) => /^readme(?:\.[^/]+)?$/i.test(basename(path))).sort((a, b) => a.split("/").length - b.split("/").length || a.length - b.length);
    if (!readmes.length) throw new Error("repository has no readable README");
    const readmePath = readmes[0];
    const readme = await runGit(["show", `HEAD:${readmePath}`], bareDir, signal);
    if (!readme.trim()) throw new Error("repository README is empty or unreadable");
    const skeleton: RepositorySkeleton = {
      repository_key: candidate.repository.repository_key,
      repository_url: candidate.repository.url,
      source_commit: sourceCommit,
      tree_paths: treePaths,
      readme_path: readmePath,
      readme,
      cache_dir: cacheDir,
    };
    await atomicWriteJson(metadataPath, skeleton);
    await writeFile(join(cacheDir, "README.md"), readme, "utf8");
    await writeFile(join(cacheDir, "repository-tree.txt"), `${treePaths.join("\n")}\n`, "utf8");
    return skeleton;
  }

  async readSelected(skeleton: RepositorySkeleton, requested: string[], signal?: AbortSignal): Promise<{ files: Array<{ path: string; content: string }>; missing: string[] }> {
    const tree = new Set(skeleton.tree_paths);
    const paths = [...new Set(requested.map((path) => path.trim()).filter(Boolean))];
    const safe = (path: string) => !path.startsWith("/") && !path.split("/").includes("..");
    const valid = paths.filter((path) => safe(path) && tree.has(path));
    const missing = paths.filter((path) => !safe(path) || !tree.has(path));
    const runGit = this.options.runGit || git;
    const bareDir = join(skeleton.cache_dir, "repository.git");
    const settled = await Promise.allSettled(valid.map(async (path) => ({ path, content: sourceText(path, await runGit(["show", `HEAD:${path}`], bareDir, signal)).slice(0, 80_000) })));
    const files: Array<{ path: string; content: string }> = [];
    settled.forEach((item, index) => item.status === "fulfilled" ? files.push(item.value) : missing.push(valid[index]));
    return { files, missing };
  }
}

export class FromRagAdaptationStore {
  constructor(readonly root: string) {}

  async list(repositoryKey: string): Promise<AdaptationRecord[]> {
    const found: AdaptationRecord[] = [];
    let repositories;
    try { repositories = await readdir(this.root, { withFileTypes: true }); } catch { return found; }
    for (const repository of repositories) {
      if (!repository.isDirectory() || repository.name.startsWith(".")) continue;
      let adaptations;
      try { adaptations = await readdir(join(this.root, repository.name), { withFileTypes: true }); } catch { continue; }
      for (const entry of adaptations) {
        if (!entry.isDirectory()) continue;
        const directory = join(this.root, repository.name, entry.name);
        try {
          const metadata = JSON.parse(await readFile(join(directory, "metadata.json"), "utf8")) as Json;
          if (metadata.repository_key !== repositoryKey) continue;
          const adaptation = JSON.parse(await readFile(join(directory, "repository-adaptation.json"), "utf8")) as RepositoryAdaptation;
          found.push({ metadata, adaptation, directory });
        } catch { /* Ignore incomplete candidate directories. */ }
      }
    }
    return found;
  }

  async summaries(repositoryKey: string): Promise<ExistingRepositoryAdaptationSummary[]> {
    return (await this.list(repositoryKey)).map(({ metadata, adaptation, directory }) => ({
      adaptation_id: adaptation.adaptation_id,
      recipe_path: join(directory, "SKILL.md"),
      status: metadata.lifecycle?.status || "candidate",
      adaptation_code_available: Boolean(metadata.implementation?.adaptation_code_path && existsSync(metadata.implementation.adaptation_code_path)),
      generated_code_available: Array.isArray(metadata.implementation?.generated_codes) && metadata.implementation.generated_codes.length > 0,
      ...(metadata.source_commit ? { source_commit: metadata.source_commit } : {}),
    }));
  }
}

export class RagRecipeGenerationService {
  readonly searchStore: RagRecipeSearchStore;
  readonly adaptations: FromRagAdaptationStore;
  readonly repositories: RepositorySkeletonCache;
  readonly budgetPath: string;

  constructor(readonly options: RagRecipeGenerationOptions) {
    this.searchStore = new RagRecipeSearchStore(options.runDir);
    this.adaptations = new FromRagAdaptationStore(options.fromRagRoot);
    this.repositories = new RepositorySkeletonCache(options);
    this.budgetPath = join(options.runDir, "recipe_rag_generation_budget.json");
  }

  async consumeBudget(): Promise<{ allowed: boolean; used: number; allowedCalls: number }> {
    const allowedCalls = this.options.maxCalls ?? 2;
    let used = 0;
    try { used = Number((JSON.parse(await readFile(this.budgetPath, "utf8")) as Json).used_calls || 0); } catch { /* first call */ }
    if (used >= allowedCalls) return { allowed: false, used, allowedCalls };
    used += 1;
    await atomicWriteJson(this.budgetPath, { schema_version: 1, used_calls: used, allowed_calls: allowedCalls, updated_at: new Date().toISOString() });
    return { allowed: true, used, allowedCalls };
  }

  async generate(candidateIds: string[], signal?: AbortSignal) {
    const budget = await this.consumeBudget();
    if (!budget.allowed) return { limitExceeded: true as const, budget, recipes: [], failures: [] };
    const settled = await Promise.allSettled(candidateIds.map((candidateId) => this.generateOne(candidateId, signal)));
    return {
      limitExceeded: false as const,
      budget,
      recipes: settled.flatMap((item) => item.status === "fulfilled" ? [item.value] : []),
      failures: settled.flatMap((item, index) => item.status === "rejected" ? [{ candidate_id: candidateIds[index], error: item.reason instanceof Error ? item.reason.message : String(item.reason) }] : []),
    };
  }

  async generateOne(candidateId: string, signal?: AbortSignal) {
    const context = await this.searchStore.findCandidateContext(candidateId);
    if (!context) throw new Error(`Unknown candidate_id '${candidateId}'. Search for repository-backed Skills first.`);
    const { candidate, query } = context;
    const skeleton = await this.repositories.load(candidate, signal);
    const existing = await this.adaptations.list(candidate.repository.repository_key);
    if (existing.length) {
      const decision = await this.options.models.selectExisting({
        query,
        candidate,
        adaptations: existing.map(({ metadata, adaptation }) => ({
          adaptation_id: adaptation.adaptation_id,
          query: String(metadata.query || ""),
          objective: adaptation.objective,
          required_inputs: adaptation.required_inputs,
          selected_repository_paths: adaptation.selected_repository_paths,
          operations: adaptation.operations,
          expected_outputs: adaptation.expected_outputs,
          validation_criteria: adaptation.validation_criteria,
        })),
        signal,
      });
      const matched = existing.find((item) => item.adaptation.adaptation_id === decision.matched_adaptation_id);
      if (matched) return this.output(candidateId, candidate, matched, true, decision.reason);
    }
    const rawAdaptation = await this.options.models.createAdaptation({ query, candidate, skeleton, signal });
    const adaptation = this.normalizeAdaptation(rawAdaptation, query, candidate);
    const selected = await this.repositories.readSelected(skeleton, adaptation.selected_repository_paths, signal);
    if (!selected.files.length) throw new Error("repository adaptation selected no readable repository source files");
    if (selected.missing.length) adaptation.adaptation_gaps = [...new Set([...adaptation.adaptation_gaps, ...selected.missing.map((path) => `Selected repository path was unavailable: ${path}`)])];
    const authored = await this.options.models.generateSkill({ query, candidate, skeleton, adaptation, selectedFiles: selected.files, signal });
    return await this.persist(candidate, query, skeleton, adaptation, selected.files, authored);
  }

  normalizeAdaptation(value: RepositoryAdaptation, query: string, candidate: RagRecipeCandidate): RepositoryAdaptation {
    const objective = compact(value.objective || query);
    return {
      adaptation_id: safeSegment(value.adaptation_id || `${objective}-${sha(`${candidate.repository.repository_key}\n${query}`).slice(0, 8)}`),
      objective,
      query_scope: compact(value.query_scope || query),
      required_inputs: strings(value.required_inputs),
      selected_repository_paths: strings(value.selected_repository_paths),
      operations: strings(value.operations),
      expected_outputs: strings(value.expected_outputs),
      validation_criteria: strings(value.validation_criteria),
      adaptation_gaps: strings(value.adaptation_gaps),
    };
  }

  async persist(candidate: RagRecipeCandidate, query: string, skeleton: RepositorySkeleton, adaptation: RepositoryAdaptation, selectedFiles: Array<{ path: string; content: string }>, authored: Json) {
    const repositoryDirectory = join(this.options.fromRagRoot, `${safeSegment(basename(candidate.repository.repository_key))}-${sha(candidate.repository.repository_key).slice(0, 10)}`);
    const directory = join(repositoryDirectory, adaptation.adaptation_id);
    await mkdir(join(directory, "references", "repository"), { recursive: true });
    await mkdir(join(directory, "generated_code"), { recursive: true });
    const skillBody = String(authored.skill_body || "").trim();
    const script = String(authored.analysis_script || "").trim();
    if (!script) throw new Error("generated Skill did not provide adaptation code");
    const extension = /^\.?[A-Za-z0-9]+$/.test(String(authored.script_extension || "")) ? `.${String(authored.script_extension).replace(/^\./, "")}` : ".py";
    const adaptationCodePath = join(directory, `adaptation_code${extension}`);
    const card = buildRagRecipeCard({ authored, question: query, evidenceLevel: "repository_backed", repositoryUrl: candidate.repository.url, sourceCommit: skeleton.source_commit });
    const quality = await evaluateRecipeDraft({
      card,
      skillBody,
      analysisScript: extension.toLowerCase() === ".py" ? script : "",
      evidenceLevel: "repository_backed",
      paperText: candidate.paper.methods.content,
      matchedFiles: selectedFiles,
    });
    if (!quality.passed) throw new Error(`generated Skill failed static validation: ${quality.blocking_issues.join("; ")}`);
    const manifest = buildEvidenceManifest({
      question: query,
      title: candidate.paper.title,
      paperText: candidate.paper.methods.content,
      doi: candidate.paper.doi,
      pmid: candidate.paper.pmid,
      pmcid: candidate.paper.pmcid,
      evidenceLevel: "repository_backed",
      repositoryUrl: candidate.repository.url,
      sourceCommit: skeleton.source_commit,
      matchedFiles: selectedFiles,
      matchedPaperContext: candidate.paper.methods.content,
      matchedRepoContext: selectedFiles.map((file) => `${file.path}\n${file.content}`).join("\n\n"),
      connectionAnalysis: adaptation.objective,
      reproductionPlan: JSON.stringify(adaptation),
    });
    const metadata = {
      schema_version: 3,
      adaptation_id: adaptation.adaptation_id,
      recipe_id: card.recipe_id,
      repository_key: candidate.repository.repository_key,
      repository_url: candidate.repository.url,
      source_commit: skeleton.source_commit,
      paper_id: candidate.paper_id,
      query,
      lifecycle: { status: "candidate", eligible_for_trajectory_retrieval: false },
      implementation: { adaptation_code_path: adaptationCodePath, generated_codes: [] },
    };
    await writeFile(join(directory, "SKILL.md"), `${skillBody}\n`, "utf8");
    await atomicWriteJson(join(directory, "recipe-card.json"), card);
    await atomicWriteJson(join(directory, "metadata.json"), metadata);
    await atomicWriteJson(join(directory, "repository-adaptation.json"), adaptation);
    await atomicWriteJson(join(directory, "quality-gate.json"), quality);
    await atomicWriteJson(join(directory, "references", "evidence_manifest.json"), manifest);
    await writeFile(join(directory, "references", "methods.md"), candidate.paper.methods.content, "utf8");
    await writeFile(join(directory, "references", "README.md"), skeleton.readme, "utf8");
    await writeFile(join(directory, "references", "repository-tree.txt"), `${skeleton.tree_paths.join("\n")}\n`, "utf8");
    for (const file of selectedFiles) {
      const target = join(directory, "references", "repository", file.path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, file.content, "utf8");
    }
    await writeFile(adaptationCodePath, `${script}\n`, "utf8");
    return this.output(candidate.candidate_id, candidate, { metadata, adaptation, directory }, false);
  }

  output(candidateId: string, candidate: RagRecipeCandidate, record: AdaptationRecord, reused: boolean, reuseReason?: string) {
    const generated = Array.isArray(record.metadata.implementation?.generated_codes) ? record.metadata.implementation.generated_codes : [];
    return {
      candidate_id: candidateId,
      recipe_id: record.metadata.recipe_id || record.adaptation.adaptation_id,
      repository_url: candidate.repository.url,
      recipe_path: join(record.directory, "SKILL.md"),
      reused,
      status: record.metadata.lifecycle?.status || "candidate",
      repository_adaptation: {
        adaptation_id: record.adaptation.adaptation_id,
        adaptation_path: join(record.directory, "repository-adaptation.json"),
        reused,
        ...(reuseReason ? { reuse_reason: reuseReason } : {}),
        adaptation_code_path: record.metadata.implementation?.adaptation_code_path,
        generated_code_paths: generated.map((entry: Json) => String(entry.code_path || "")).filter(Boolean),
      },
      method_contract: {
        objective: record.adaptation.objective,
        inputs: record.adaptation.required_inputs,
        procedure: record.adaptation.operations,
        outputs: record.adaptation.expected_outputs,
        validation_criteria: record.adaptation.validation_criteria,
        adaptation_notes: record.adaptation.adaptation_gaps,
        boundaries: record.adaptation.adaptation_gaps,
      },
    };
  }
}

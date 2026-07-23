import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import type { Dirent } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import type { LiteratureQueryClient, PaperRecord, RepositoryCandidate } from "../literature-compat/contracts.ts";
import { RepositoryValidator, type RepositoryValidationResult } from "../literature-compat/shared/repository-validator.ts";
import { RagSkillGenerator } from "./rag-skill-generator.ts";

type Json = Record<string, any>;

export interface SkillCandidate {
  name: string;
  path: string;
  description: string;
  text: string;
  score: number;
}

export interface SkillSelectorInput {
  question: string;
  candidates: Array<Pick<SkillCandidate, "name" | "path" | "description">>;
  topK: number;
  threshold: number;
  traceDir?: string;
  signal?: AbortSignal;
}

export interface TargetedSkillResolverOptions {
  packageTrajectoryDir?: string;
  ensureTrajectoryDir?: () => Promise<string>;
  userSkillsRoot?: string;
  generatedSkillDir?: string;
  selectSkills?: (input: SkillSelectorInput) => Promise<Array<{ path?: string; name?: string; score: number }>>;
  ragSkillGenerator?: RagSkillGenerator;
  validateRepository?: (candidate: RepositoryCandidate, signal?: AbortSignal) => Promise<RepositoryValidationResult>;
}

function bool(value: unknown, fallback: boolean): boolean {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "string") return !["0", "false", "no", "off"].includes(value.toLowerCase());
  return Boolean(value);
}

function externalProvider(input: Json): "semantic_scholar" | "pubmed" | undefined {
  const provider = String(input.literature_provider || input.paper_source || "");
  return provider === "semantic_scholar" || provider === "pubmed" ? provider : undefined;
}

function externalPaperRecords(rag: Json, provider: "semantic_scholar" | "pubmed"): PaperRecord[] {
  const raw = Array.isArray(rag.papers) ? rag.papers : [];
  if (raw.length) return raw.filter((paper: Json) => paper && paper.title && (paper.abstract || paper.fullText)) as PaperRecord[];
  return (Array.isArray(rag.sources) ? rag.sources : []).flatMap((source: Json, index: number) => {
    const title = String(source.title || "").trim();
    const paperText = String(source.text || "").trim();
    if (!title || !paperText) return [];
    return [{
      provider,
      providerId: String(source.provider_id || source.source_id || `${provider}-${index + 1}`),
      title,
      abstract: paperText,
      authors: [],
      doi: source.doi,
      pmid: source.pmid,
      pmcid: source.pmcid,
      openAccessPdf: source.open_access_pdf,
      repositoryCandidates: Array.isArray(source.repository_candidates) ? source.repository_candidates : [],
    } satisfies PaperRecord];
  });
}

function tokens(value: string): Set<string> {
  return new Set(value.toLowerCase().replace(/[_-]+/g, " ").match(/[\p{L}\p{N}]+/gu)?.filter((token) => token.length > 1) ?? []);
}

function relevance(question: string, document: string): number {
  const query = tokens(question);
  const candidate = tokens(document);
  if (!query.size || !candidate.size) return 0;
  let overlap = 0;
  for (const token of query) if (candidate.has(token)) overlap += 1;
  return overlap / query.size;
}

function description(text: string): string {
  if (text.startsWith("---")) {
    const end = text.indexOf("\n---", 3);
    if (end >= 0) {
      try {
        const metadata = parseYaml(text.slice(3, end));
        if (typeof metadata?.description === "string") return metadata.description;
      } catch { /* body fallback */ }
    }
  }
  const section = /^##\s+Description\s*$\n([\s\S]*?)(?=^#{1,6}\s|$)/mi.exec(text)?.[1];
  return (section || text.split(/\n\s*\n/).find((part) => part.trim() && !part.trim().startsWith("#")) || "").trim().replace(/\s+/g, " ").slice(0, 800);
}

async function candidates(skillsDir: string, question: string): Promise<SkillCandidate[]> {
  let entries;
  try { entries = await readdir(skillsDir, { withFileTypes: true }); } catch { return []; }
  const found: SkillCandidate[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === ".cache") continue;
    const path = join(skillsDir, entry.name);
    try {
      const text = await readFile(join(path, "SKILL.md"), "utf8");
      const summary = description(text);
      found.push({ name: entry.name, path, description: summary, text, score: relevance(question, `${entry.name} ${summary} ${text.slice(0, 4000)}`) });
    } catch { /* not a skill folder */ }
  }
  return found;
}

function uniquePaths(values: unknown[], root: string): string[] {
  return [...new Set(values.filter(Boolean).map(String).map((value) => isAbsolute(value) ? resolve(value) : resolve(root, value)))];
}

async function referencePaths(skillPaths: string[]): Promise<string[]> {
  const result: string[] = [];
  for (const skillPath of skillPaths) {
    for (const path of [join(skillPath, "references"), join(skillPath, "references", "matched_files")]) if (existsSync(path)) result.push(path);
  }
  return [...new Set(result)];
}

async function loadExistingSkill(candidate: SkillCandidate, resourceFilter: Json): Promise<string> {
  const suffixes = new Set((Array.isArray(resourceFilter.suffixes) ? resourceFilter.suffixes : [".md", ".py"]).map(String));
  const maxFiles = Math.max(0, Number(resourceFilter.max_files ?? 5));
  const resources: Array<{ path: string; content: string }> = [];
  const scriptsDir = join(candidate.path, "scripts");
  async function collect(directory: string, prefix: string): Promise<void> {
    let entries: Dirent[];
    try { entries = await readdir(directory, { withFileTypes: true }); } catch { return; }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (resources.length >= maxFiles) return;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await collect(path, join(prefix, entry.name));
      else if (entry.isFile() && suffixes.has(entry.name.slice(entry.name.lastIndexOf(".")))) {
        try { resources.push({ path: join(prefix, entry.name), content: await readFile(path, "utf8") }); } catch { /* unreadable */ }
      }
    }
  }
  await collect(scriptsDir, "scripts");
  if (suffixes.has(".md") && resources.length < maxFiles) {
    let entries: Dirent[];
    try { entries = await readdir(candidate.path, { withFileTypes: true }); } catch { entries = []; }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (resources.length >= maxFiles) break;
      if (entry.isFile() && entry.name.endsWith(".md") && entry.name !== "SKILL.md") {
        try { resources.push({ path: entry.name, content: await readFile(join(candidate.path, entry.name), "utf8") }); } catch { /* unreadable */ }
      }
    }
  }
  const header = `${"=".repeat(60)}\n  SKILL : ${candidate.name}  (relevance: ${candidate.score.toFixed(4)})\n${"=".repeat(60)}`;
  return [header, `[SKILL.md]\n${candidate.text}`, ...resources.map((item) => `[${item.path}]\n${item.content}`)].join("\n\n");
}

async function loadGeneratedSkill(path: string): Promise<string> {
  return `=== File: SKILL.md ===\n${await readFile(join(path, "SKILL.md"), "utf8")}`;
}

async function traceArtifacts(traceDir: string | undefined, trace: Json, targetedSkill: string): Promise<Json> {
  if (!traceDir) return {};
  const directory = resolve(traceDir);
  await mkdir(directory, { recursive: true });
  const targetedSkillPath = join(directory, "targeted_skill.md");
  const tracePath = join(directory, "trace.json");
  await writeFile(targetedSkillPath, targetedSkill, "utf8");
  await writeFile(tracePath, `${JSON.stringify(trace, null, 2)}\n`, "utf8");
  return { targeted_skill_md: targetedSkillPath, trace_json: tracePath };
}

export class TargetedSkillResolver {
  readonly generator: RagSkillGenerator;
  readonly validateRepository: NonNullable<TargetedSkillResolverOptions["validateRepository"]>;
  constructor(readonly ragClient: LiteratureQueryClient, readonly options: TargetedSkillResolverOptions = {}) {
    this.generator = options.ragSkillGenerator ?? new RagSkillGenerator();
    const validator = new RepositoryValidator();
    this.validateRepository = options.validateRepository ?? ((candidate, signal) => validator.validate(candidate, signal));
  }

  async resolve(input: Json, cwd = process.cwd(), signal?: AbortSignal): Promise<Json> {
    const traceId = String(input.trace_id || randomUUID());
    const question = String(input.question || "").trim();
    const warnings: string[] = [];
    const base = { matched: false, source: "none", targeted_skill: "", skill_paths: [], reference_paths: [], generated: false, warnings, trace_id: traceId };
    if (!question) return { ok: false, ...base, warnings: ["question is required"], error: "question is required" };
    if (!bool(input.skill_enable, true)) return { ok: true, ...base, warnings: ["skill module disabled"], artifacts: await traceArtifacts(input.trace_dir, { trace_id: traceId, question, skill_enable: false }, "") };

    const projectRoot = resolve(input.root_dir || cwd);
    const managedTrajectory = !input.skill_dir && this.options.ensureTrajectoryDir ? await this.options.ensureTrajectoryDir() : undefined;
    const primary = input.skill_dir || managedTrajectory || this.options.packageTrajectoryDir || join(projectRoot, "library", "skills", "trajectory");
    const userSkillsRoot = this.options.userSkillsRoot || join(homedir(), ".seekbrain", "skills");
    const extras = Array.isArray(input.extra_skill_dirs) ? input.extra_skill_dirs : [join(projectRoot, ".seekbrain", "skills", "from_expert"), join(userSkillsRoot, "from_expert")];
    const directories = uniquePaths([primary, ...extras], projectRoot);
    const matchEnabled = bool(input.match_skill_enable, true);
    const generateEnabled = bool(input.generate_skill_enable, true);
    if (!matchEnabled) warnings.push("existing targeted skill matching disabled by workflow.seekbrain.targeted_skill_match");

    if (matchEnabled) {
      const all = (await Promise.all(directories.map((directory) => candidates(directory, question)))).flat();
      const threshold = Number(input.relevance_threshold ?? 0.3);
      const topK = Math.max(1, Number(input.top_k ?? 1));
      let matched: SkillCandidate[] = [];
      let selectorSucceeded = false;
      if (this.options.selectSkills && all.length) {
        try {
          const selected = await this.options.selectSkills({ question, candidates: all.map(({ name, path, description }) => ({ name, path, description })), topK, threshold, traceDir: input.trace_dir, signal });
          selectorSucceeded = true;
          matched = selected.map((selection) => {
            const candidate = all.find((item) => selection.path === item.path || selection.name === item.name);
            return candidate ? { ...candidate, score: Number(selection.score) } : undefined;
          }).filter((item): item is SkillCandidate => item !== undefined && item.score >= threshold).slice(0, topK);
        } catch (error) { warnings.push(`model skill matching failed; deterministic fallback used: ${String(error)}`); }
      }
      if (!this.options.selectSkills || !selectorSucceeded) matched = all.filter((item) => item.score >= threshold).sort((a, b) => b.score - a.score || a.path.localeCompare(b.path)).slice(0, topK);
      if (matched.length) {
        const resourceFilter = input.resource_filter || { suffixes: [".md", ".py"], max_files: 5 };
        const targetedSkill = (await Promise.all(matched.map((item) => loadExistingSkill(item, resourceFilter)))).join("\n\n");
        const skillPaths = matched.map((item) => item.path);
        const references = await referencePaths(skillPaths);
        const trace = { trace_id: traceId, question, source: "existing_skill", skills_dir: directories[0], skill_paths: skillPaths, reference_paths: references, scores: matched.map(({ path, score }) => ({ path, score })), warnings };
        return { ok: true, matched: true, source: "existing_skill", targeted_skill: targetedSkill, skill_paths: skillPaths, reference_paths: references, generated: false, warnings, trace_id: traceId, artifacts: await traceArtifacts(input.trace_dir, trace, targetedSkill) };
      }
    }

    if (!generateEnabled) return { ok: true, ...base, warnings, artifacts: await traceArtifacts(input.trace_dir, { trace_id: traceId, question, source: "none", generate_skill_enable: false, warnings }, "") };
    const provider = externalProvider(input);
    const compatibility = input.compatibility && typeof input.compatibility === "object" ? input.compatibility : {};
    const requestedPoolSize = Number(input.candidate_pool_size ?? compatibility.candidate_pool_size ?? 10);
    const candidatePoolSize = Number.isFinite(requestedPoolSize) ? Math.max(1, Math.min(100, Math.floor(requestedPoolSize))) : 10;
    const retrievalTopK = provider ? candidatePoolSize : Number(input.rag_top_k ?? input.top_k ?? 2);
    const rag = await this.ragClient.query({ ...input, question, top_k: retrievalTopK, candidate_pool_size: candidatePoolSize, require_github: true }, cwd, signal);
    const generatedDir = input.generated_skill_output_dir
      ? (isAbsolute(input.generated_skill_output_dir) ? resolve(input.generated_skill_output_dir) : resolve(projectRoot, input.generated_skill_output_dir))
      : this.options.generatedSkillDir || join(userSkillsRoot, "from_rag");
    const loaded: string[] = [];
    const generatedPaths: string[] = [];
    const reusedSkillPaths: string[] = [];
    let compatibilityMetrics: Json | undefined;
    if (!provider) {
      const usable = (Array.isArray(rag.sources) ? rag.sources : []).filter((source: Json) => Array.isArray(source.github_links) && source.github_links.length);
      for (const source of usable) {
        const repoLink = String(source.github_links[0]);
        const result = await this.generator.generate({ question, title: String(source.title || ""), paperText: String(source.text || ""), repoLink, outputDir: generatedDir, signal });
        if (!result.ok || !result.skill_path) { warnings.push(result.error || `failed to generate skill for ${repoLink}`); continue; }
        warnings.push(...(result.warnings || []));
        generatedPaths.push(result.skill_path);
        loaded.push(`### Skill from: ${source.title} (${repoLink})\n\n${await loadGeneratedSkill(result.skill_path)}`);
        if (result.reused) reusedSkillPaths.push(result.skill_path);
      }
    } else {
      const papers = externalPaperRecords(rag, provider);
      const requestedSkillTopK = Number(input.skill_top_k ?? compatibility.skill_top_k ?? 2);
      const skillTopK = Number.isFinite(requestedSkillTopK) ? Math.max(1, Math.min(candidatePoolSize, Math.floor(requestedSkillTopK))) : 2;
      const preferRepository = bool(input.prefer_repository ?? compatibility.prefer_repository, true);
      const paperOnlyFallback = bool(input.paper_only_fallback ?? compatibility.paper_only_fallback, true);
      const selected: Array<{ paper: PaperRecord; repoLink?: string; evidenceLevel: "repository_backed" | "paper_only" }> = [];
      const selectedRepositories = new Set<string>();
      if (preferRepository) {
        for (const paper of papers) {
          if (selected.length >= skillTopK) break;
          for (const candidate of paper.repositoryCandidates || []) {
            const validation = await this.validateRepository(candidate, signal);
            if (!validation.ok || !validation.url) {
              if (validation.reason) warnings.push(`${paper.title}: ${validation.reason}`);
              continue;
            }
            if (selectedRepositories.has(validation.url)) continue;
            selectedRepositories.add(validation.url);
            selected.push({ paper, repoLink: validation.url, evidenceLevel: "repository_backed" });
            break;
          }
        }
      }
      if (paperOnlyFallback && selected.length < skillTopK) {
        const used = new Set(selected.map(({ paper }) => paper.providerId));
        for (const paper of papers) {
          if (selected.length >= skillTopK) break;
          if (used.has(paper.providerId)) continue;
          used.add(paper.providerId);
          selected.push({ paper, evidenceLevel: "paper_only" });
        }
      }
      if (!papers.length) warnings.push("No usable paper was retrieved; no Skill was generated");
      let repositorySkillCount = 0;
      let paperOnlySkillCount = 0;
      for (const item of selected) {
        const paperText = [item.paper.abstract, item.paper.fullText].filter(Boolean).join("\n\n");
        const result = await this.generator.generate({
          question,
          title: item.paper.title,
          paperText,
          repoLink: item.repoLink,
          evidenceLevel: item.evidenceLevel,
          provider,
          doi: item.paper.doi,
          pmid: item.paper.pmid,
          pmcid: item.paper.pmcid,
          outputDir: generatedDir,
          signal,
        });
        const label = item.repoLink || "paper-only";
        if (!result.ok || !result.skill_path) { warnings.push(result.error || `failed to generate skill for ${label}`); continue; }
        warnings.push(...(result.warnings || []));
        generatedPaths.push(result.skill_path);
        if (item.evidenceLevel === "repository_backed") repositorySkillCount += 1;
        else paperOnlySkillCount += 1;
        loaded.push(`### Skill from: ${item.paper.title} (${label})\n\n${await loadGeneratedSkill(result.skill_path)}`);
        if (result.reused) reusedSkillPaths.push(result.skill_path);
      }
      if (papers.length === 1 && generatedPaths.length === 1) warnings.push("Only one usable paper was retrieved; one Skill was generated without duplication");
      compatibilityMetrics = {
        paper_source: provider,
        retrieved_count: papers.length,
        repository_candidate_count: papers.reduce((count, paper) => count + (paper.repositoryCandidates?.length || 0), 0),
        repository_skill_count: repositorySkillCount,
        paper_only_skill_count: paperOnlySkillCount,
      };
    }
    const targetedSkill = loaded.join("\n\n---\n\n");
    const references = await referencePaths(generatedPaths);
    const source = targetedSkill ? "generated_from_rag" : "none";
    const trace = { trace_id: traceId, question, source, skills_dir: directories[0], generated_skill_output_dir: generatedDir, generated_paths: generatedPaths, reference_paths: references, ...(compatibilityMetrics ? { compatibility_metrics: compatibilityMetrics } : {}), warnings };
    const artifacts = await traceArtifacts(input.trace_dir, trace, targetedSkill);
    if (targetedSkill) return { ok: true, matched: true, source, targeted_skill: targetedSkill, skill_paths: generatedPaths, reference_paths: references, generated: true, warnings, trace_id: traceId, artifacts, details: { generated_skill_output_dir: generatedDir, reused_skill_paths: reusedSkillPaths, ...(compatibilityMetrics || {}) } };
    warnings.push(...(rag.warnings || []), "SkillLoader missed and RAG did not produce usable generated skills");
    return { ok: true, ...base, warnings: [...new Set(warnings)], artifacts, ...(compatibilityMetrics ? { details: compatibilityMetrics } : {}), ...(rag.error ? { error: rag.error } : {}) };
  }
}

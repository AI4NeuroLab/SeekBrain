import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import type { Dirent } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import type { LiteratureQueryClient, PaperRecord, RepositoryCandidate } from "../literature-compat/contracts.ts";
import { RepositoryValidator, type RepositoryValidationResult } from "../literature-compat/shared/repository-validator.ts";
import {
  lookupValidatedRepositoryScripts,
  materializeRepository,
  repositoryGuidance,
  type MaterializedRepository,
  type ValidatedRepositoryScripts,
} from "./repository-cache.ts";
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
  ragSkillGenerator?: RagSkillGenerator;
  selectSkills?: (input: SkillSelectorInput) => Promise<Array<{ path?: string; name?: string; score: number }>>;
  validateRepository?: (candidate: RepositoryCandidate, signal?: AbortSignal) => Promise<RepositoryValidationResult>;
  lookupValidatedRepositoryScripts?: (repositoryUrl: string) => Promise<ValidatedRepositoryScripts | undefined>;
  materializeRepository?: (repositoryUrl: string, question: string, title: string, signal?: AbortSignal) => Promise<MaterializedRepository>;
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

function confidentDeterministicMatch(candidates: SkillCandidate[], threshold: number): SkillCandidate[] {
  const ranked = [...candidates].sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
  const first = ranked[0];
  const second = ranked[1];
  if (!first || first.score < Math.max(0.5, threshold + 0.15)) return [];
  if (second && first.score - second.score < 0.05) return [];
  return [first];
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
  const header = `${"=".repeat(60)}\n  RECIPE : ${candidate.name}  (relevance: ${candidate.score.toFixed(4)})\n${"=".repeat(60)}`;
  return [header, `[SKILL.md]\n${candidate.text}`, ...resources.map((item) => `[${item.path}]\n${item.content}`)].join("\n\n");
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
  readonly lookupValidatedRepositoryScripts: NonNullable<TargetedSkillResolverOptions["lookupValidatedRepositoryScripts"]>;
  readonly materializeRepository: NonNullable<TargetedSkillResolverOptions["materializeRepository"]>;
  constructor(readonly ragClient: LiteratureQueryClient, readonly options: TargetedSkillResolverOptions = {}) {
    this.generator = options.ragSkillGenerator ?? new RagSkillGenerator();
    const validator = new RepositoryValidator();
    this.validateRepository = options.validateRepository ?? ((candidate, signal) => validator.validate(candidate, signal));
    this.lookupValidatedRepositoryScripts = options.lookupValidatedRepositoryScripts ?? ((url) => lookupValidatedRepositoryScripts(url));
    this.materializeRepository = options.materializeRepository ?? ((url, question, title, signal) => materializeRepository(url, question, title, {}, signal));
  }

  async resolve(input: Json, cwd = process.cwd(), signal?: AbortSignal): Promise<Json> {
    const traceId = String(input.trace_id || randomUUID());
    const question = String(input.question || "").trim();
    const warnings: string[] = [];
    const base = { matched: false, source: "none", targeted_skill: "", skill_paths: [], reference_paths: [], generated: false, warnings, trace_id: traceId };
    if (!question) return { ok: false, ...base, warnings: ["question is required"], error: "question is required" };
    if (!bool(input.skill_enable, true)) return { ok: true, ...base, warnings: ["analysis recipe module disabled"], artifacts: await traceArtifacts(input.trace_dir, { trace_id: traceId, question, skill_enable: false }, "") };

    const projectRoot = resolve(input.root_dir || cwd);
    // The bundled repertoire is always part of recipe retrieval. A legacy or
    // explicitly supplied skill_dir may take precedence, but it must not bypass
    // materialization and searching of the managed trajectory cache.
    const managedTrajectory = this.options.ensureTrajectoryDir ? await this.options.ensureTrajectoryDir() : undefined;
    const primary = input.skill_dir || managedTrajectory || this.options.packageTrajectoryDir || join(projectRoot, "recipes");
    const userSkillsRoot = this.options.userSkillsRoot || join(homedir(), ".seekbrain", "skills");
    const extras = Array.isArray(input.extra_skill_dirs) ? input.extra_skill_dirs : [join(projectRoot, ".seekbrain", "skills", "from_expert"), join(userSkillsRoot, "from_expert")];
    const directories = uniquePaths([primary, managedTrajectory, ...extras], projectRoot);
    const matchEnabled = bool(input.match_skill_enable, true);
    const generateEnabled = bool(input.generate_skill_enable, true);
    if (!matchEnabled) warnings.push("existing analysis recipe matching disabled by workflow.seekbrain.targeted_skill_match");

    if (matchEnabled) {
      const all = (await Promise.all(directories.map((directory) => candidates(directory, question)))).flat();
      const threshold = Number(input.relevance_threshold ?? 0.3);
      const topK = Math.max(1, Number(input.top_k ?? 1));
      let matched: SkillCandidate[] = confidentDeterministicMatch(all, threshold);
      let selectorSucceeded = false;
      const deterministicMatch = matched.length > 0;
      if (!deterministicMatch && this.options.selectSkills && all.length) {
        try {
          const selected = await this.options.selectSkills({ question, candidates: all.map(({ name, path, description }) => ({ name, path, description })), topK, threshold, traceDir: input.trace_dir, signal });
          selectorSucceeded = true;
          matched = selected.map((selection) => {
            const candidate = all.find((item) => selection.path === item.path || selection.name === item.name);
            return candidate ? { ...candidate, score: Number(selection.score) } : undefined;
          }).filter((item): item is SkillCandidate => item !== undefined && item.score >= threshold).slice(0, topK);
        } catch (error) { warnings.push(`model recipe matching failed; deterministic fallback used: ${String(error)}`); }
      }
      if (!deterministicMatch && (!this.options.selectSkills || !selectorSucceeded)) matched = all.filter((item) => item.score >= threshold).sort((a, b) => b.score - a.score || a.path.localeCompare(b.path)).slice(0, topK);
      if (matched.length) {
        const resourceFilter = input.resource_filter || { suffixes: [".md", ".py"], max_files: 5 };
        const targetedSkill = (await Promise.all(matched.map((item) => loadExistingSkill(item, resourceFilter)))).join("\n\n");
        const skillPaths = matched.map((item) => item.path);
        const references = await referencePaths(skillPaths);
        const trace = { trace_id: traceId, question, source: "existing_skill", match_strategy: deterministicMatch ? "deterministic_high_confidence" : "model_or_fallback", skills_dir: directories[0], skill_paths: skillPaths, reference_paths: references, scores: matched.map(({ path, score }) => ({ path, score })), warnings };
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
    let title = "";
    let paperText = "";
    let repoLink = "";
    if (!provider) {
      const source = (Array.isArray(rag.sources) ? rag.sources : []).find((item: Json) => Array.isArray(item.github_links) && item.github_links.length);
      if (source) {
        title = String(source.title || "");
        paperText = String(source.text || "");
        repoLink = String(source.github_links[0] || "");
      }
    } else {
      const papers = externalPaperRecords(rag, provider);
      for (const paper of papers) {
        for (const candidate of paper.repositoryCandidates || []) {
          const validation = await this.validateRepository(candidate, signal);
          if (!validation.ok || !validation.url) {
            if (validation.reason) warnings.push(`${paper.title}: ${validation.reason}`);
            continue;
          }
          title = paper.title;
          paperText = [paper.abstract, paper.fullText].filter(Boolean).join("\n\n");
          repoLink = validation.url;
          break;
        }
        if (repoLink) break;
      }
      if (!repoLink && papers[0] && bool(input.paper_only_fallback ?? compatibility.paper_only_fallback, true)) {
        title = papers[0].title;
        paperText = [papers[0].abstract, papers[0].fullText].filter(Boolean).join("\n\n");
      }
    }

    if (!title && !paperText && !repoLink) {
      warnings.push(...(rag.warnings || []), "No repertoire recipe or usable RAG source was found");
      const artifacts = await traceArtifacts(input.trace_dir, { trace_id: traceId, question, source: "none", warnings }, "");
      return { ok: true, ...base, warnings: [...new Set(warnings)], artifacts, ...(rag.error ? { error: rag.error } : {}) };
    }

    let validated: ValidatedRepositoryScripts | undefined;
    if (repoLink) validated = await this.lookupValidatedRepositoryScripts(repoLink);

    if (repoLink && !validated && bool(input.repository_recipe_crystallization_enabled, false)) {
      const generatedDir = input.generated_skill_output_dir
        ? (isAbsolute(input.generated_skill_output_dir) ? resolve(input.generated_skill_output_dir) : resolve(projectRoot, input.generated_skill_output_dir))
        : this.options.generatedSkillDir || join(userSkillsRoot, "from_rag");
      const crystallized = await this.generator.generate({
        question,
        title: title || "Retrieved repository method",
        paperText,
        repoLink,
        evidenceLevel: "repository_backed",
        provider,
        outputDir: generatedDir,
        signal,
      });
      if (crystallized.ok && crystallized.skill_path) {
        const skillPath = String(crystallized.skill_path);
        const skillText = await readFile(join(skillPath, "SKILL.md"), "utf8");
        const candidate: SkillCandidate = {
          name: skillPath.split(/[\\/]/).pop() || "repository_recipe",
          path: skillPath,
          description: description(skillText),
          text: skillText,
          score: 1,
        };
        const targetedSkill = await loadExistingSkill(candidate, input.resource_filter || { suffixes: [".md", ".py"], max_files: 5 });
        const references = await referencePaths([skillPath]);
        const repositoryReference = {
          repository_url: repoLink,
          crystallized_recipe_path: join(skillPath, "SKILL.md"),
          reference_files: references,
          reused_crystallized_recipe: crystallized.reused === true,
        };
        const crystallizationWarnings = [...new Set([...warnings, ...(crystallized.warnings || [])])];
        const reusedSkillPaths = crystallized.reused === true ? [skillPath] : [];
        const trace = {
          trace_id: traceId,
          question,
          source: "generated_from_rag",
          generated_skill_output_dir: generatedDir,
          skill_paths: [skillPath],
          reference_paths: references,
          repository_reference: repositoryReference,
          reused_skill_paths: reusedSkillPaths,
          warnings: crystallizationWarnings,
        };
        return {
          ok: true,
          matched: true,
          source: "generated_from_rag",
          targeted_skill: targetedSkill,
          skill_paths: [skillPath],
          reference_paths: references,
          generated: crystallized.reused !== true,
          warnings: crystallizationWarnings,
          trace_id: traceId,
          artifacts: await traceArtifacts(input.trace_dir, trace, targetedSkill),
          repository_reference: repositoryReference,
          details: {
            generated_skill_output_dir: generatedDir,
            reused_skill_paths: reusedSkillPaths,
            repository_recipe_crystallization: true,
          },
        };
      }
      warnings.push(crystallized.error || `failed to crystallize analysis recipe for ${repoLink}`);
      warnings.push(...(crystallized.warnings || []));
    }

    let materialized: MaterializedRepository | undefined;
    if (repoLink && !validated) {
      materialized = await this.materializeRepository(repoLink, question, title, signal);
      if (!materialized.ok) warnings.push(`repository materialization failed: ${materialized.error || repoLink}`);
    }
    const targetedSkill = repositoryGuidance({ question, title: title || "Retrieved method evidence", paperText, materialized, validated });
    const repositoryReference = validated ? {
      repository_key: validated.repository_key,
      repository_url: validated.repository_url,
      source_commit: validated.source_commit,
      validated_recipe_path: validated.recipe_path,
      validated_script_path: validated.script_path,
      validated_utility_path: validated.utility_path,
      reference_files: [validated.script_path, validated.utility_path].filter(Boolean),
      reused_validated_scripts: true,
    } : materialized ? {
      repository_key: materialized.repository_key,
      repository_url: materialized.repository_url,
      repository_dir: materialized.repository_dir,
      source_commit: materialized.source_commit,
      reference_files: materialized.candidate_files.map((file) => file.local_path),
      reused_validated_scripts: false,
    } : undefined;
    const source = validated ? "validated_repository_recipe" : repoLink ? "repository_reference" : "paper_reference";
    const skillPaths = validated ? [validated.recipe_path] : [];
    const referenceFiles = repositoryReference?.reference_files || [];
    const trace = { trace_id: traceId, question, source, skills_dir: directories[0], skill_paths: skillPaths, reference_paths: referenceFiles, repository_reference: repositoryReference, warnings };
    const artifacts = await traceArtifacts(input.trace_dir, trace, targetedSkill);
    return {
      ok: true,
      matched: true,
      source,
      targeted_skill: targetedSkill,
      skill_paths: skillPaths,
      reference_paths: referenceFiles,
      generated: false,
      warnings: [...new Set(warnings)],
      trace_id: traceId,
      artifacts,
      repository_reference: repositoryReference,
      details: { reused_validated_scripts: Boolean(validated), repository_materialized: Boolean(materialized?.ok) },
    };
  }
}

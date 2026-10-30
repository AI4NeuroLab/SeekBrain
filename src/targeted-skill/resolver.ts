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
  normalizeRepositoryIdentity,
  repositoryGuidance,
  type MaterializedRepository,
  type ValidatedRepositoryScripts,
} from "./repository-cache.ts";
import { RagSkillGenerator, repoIdentifier } from "./rag-skill-generator.ts";
import {
  buildRecipeQuery,
  inferSemanticTerms,
  isExecutableRecipe,
  loadRecipeCard,
  RECIPE_ROLES,
  type RecipeCard,
  type RecipeQuery,
  type RecipeRequirement,
  type RecipeRole,
  type RecipeSelection,
} from "./recipe-card.ts";
import {
  defaultRole,
  minimalCoverageSelections,
  rankRecipes,
  recipeCompatibility,
  recipeSet,
  type DiscoverableRecipe,
} from "./recipe-discovery.ts";

type Json = Record<string, any>;

type CandidateOrigin = "local" | "repository_memory" | "rag_repository" | "rag_paper";

interface RagCandidateEvidence {
  title: string;
  paperText: string;
  repoLink?: string;
  provider?: "ailab_rag" | "semantic_scholar" | "pubmed";
  repositoryCandidate?: RepositoryCandidate;
  sourceId: string;
}

interface CandidateSeed extends DiscoverableRecipe {
  origin: CandidateOrigin;
  rag?: RagCandidateEvidence;
  repositoryMemoryScope?: boolean;
}

export interface SkillCandidate {
  name: string;
  path: string;
  description: string;
  text: string;
  score: number;
  card: RecipeCard;
  lexical_score: number;
  covers: string[];
  compatibility: "compatible" | "unknown";
  origin: CandidateOrigin;
  rag?: RagCandidateEvidence;
  repositoryMemoryScope?: boolean;
}

export interface SkillSelectorInput {
  question: string;
  query: RecipeQuery;
  candidates: Array<Pick<SkillCandidate, "name" | "path" | "description" | "card" | "covers" | "compatibility">>;
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
  selectSkills?: (input: SkillSelectorInput) => Promise<Array<{ path?: string; name?: string; score: number; role?: RecipeRole; reason?: string; covers?: string[] }>>;
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

function confidentDeterministicMatch(candidates: SkillCandidate[], threshold: number, query: RecipeQuery): RecipeSelection[] {
  const ranked = [...candidates].sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
  const first = ranked[0];
  const second = ranked[1];
  if (!first || first.score < Math.max(0.5, threshold + 0.15)) return [];
  if (second && first.score - second.score < 0.05) return [];
  if (query.requirements.some((requirement) => !first.covers.includes(requirement.id))) return [];
  return [{
    recipe_id: first.card.recipe_id,
    path: first.path,
    role: defaultRole(first.card, first.covers, query),
    score: first.score,
    reason: "single high-confidence compatible recipe covers every requirement",
    covers: first.covers,
  }];
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

async function candidates(skillsDir: string): Promise<CandidateSeed[]> {
  let entries;
  try { entries = await readdir(skillsDir, { withFileTypes: true }); } catch { return []; }
  const found: CandidateSeed[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === ".cache") continue;
    const path = join(skillsDir, entry.name);
    try {
      const text = await readFile(join(path, "SKILL.md"), "utf8");
      const summary = description(text);
      const card = await loadRecipeCard(path, text);
      found.push({ name: entry.name, path, description: summary, text, card, origin: "local" });
    } catch { /* not a skill folder */ }
  }
  return found;
}

function compactCandidateName(value: unknown, fallback: string): string {
  return String(value || fallback).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 72) || fallback;
}

const CONTRAINDICATION_STOPWORDS = new Set(["task", "requires", "require", "input", "data", "analysis", "method", "using", "with", "from", "rather", "than", "does", "not", "support"]);

function meaningfulTokens(value: string): Set<string> {
  return new Set(value.toLowerCase().replace(/[_-]+/g, " ").match(/[\p{L}\p{N}]+/gu)?.filter((token) => token.length > 2 && !CONTRAINDICATION_STOPWORDS.has(token)) || []);
}

function matchedConditions(query: RecipeQuery, conditions: string[]): string[] {
  const queryText = [query.question, query.objective, ...query.biological_scope, ...query.requirements.map((requirement) => requirement.text)].join(" ");
  const queryTokens = meaningfulTokens(queryText);
  const queryTerms = new Set(inferSemanticTerms(queryText).filter((term) => term !== "visualization"));
  return conditions.filter((condition) => {
    const conditionTokens = meaningfulTokens(condition);
    const lexicalOverlap = [...conditionTokens].filter((token) => queryTokens.has(token));
    const semanticOverlap = inferSemanticTerms(condition).filter((term) => term !== "visualization" && queryTerms.has(term));
    return lexicalOverlap.length >= 2 || (lexicalOverlap.length >= 1 && semanticOverlap.length >= 1);
  });
}

function matchedAvoidWhen(query: RecipeQuery, card: RecipeCard): string[] {
  return matchedConditions(query, card.avoid_when);
}

function matchedBoundaryWhen(query: RecipeQuery, card: RecipeCard): string[] {
  return isExecutableRecipe(card) ? [] : matchedConditions(query, card.use_when);
}

function recipeRetrievalQuestion(query: RecipeQuery, priorityRequirements: RecipeRequirement[] = query.requirements): string {
  const priority = new Set(priorityRequirements.map((requirement) => requirement.id));
  const lines = [
    `Scientific objective: ${query.objective}`,
    query.biological_scope.length ? `Biological scope:\n${query.biological_scope.map((item) => `- ${item}`).join("\n")}` : "",
    [query.accepts.species.length ? `species=${query.accepts.species.join(",")}` : "", query.accepts.modalities.length ? `modalities=${query.accepts.modalities.join(",")}` : "", query.accepts.observation_units.length ? `observation_units=${query.accepts.observation_units.join(",")}` : ""].filter(Boolean).length
      ? `Requested data contract: ${[query.accepts.species.length ? `species=${query.accepts.species.join(",")}` : "", query.accepts.modalities.length ? `modalities=${query.accepts.modalities.join(",")}` : "", query.accepts.observation_units.length ? `observation_units=${query.accepts.observation_units.join(",")}` : ""].filter(Boolean).join("; ")}`
      : "",
    priority.size && priority.size < query.requirements.length ? "Prioritize the currently uncovered capabilities marked [priority]." : "Retrieve methods that collectively cover these Recipe capabilities.",
    ...query.requirements.map((requirement) => `- ${requirement.id} [${requirement.kind}]${priority.has(requirement.id) ? " [priority]" : ""}: ${requirement.text}`),
  ];
  return lines.filter(Boolean).join("\n");
}

function rankCandidateSeeds(query: RecipeQuery, seeds: CandidateSeed[], options: { includeCandidates?: boolean; poolSize?: number } = {}): SkillCandidate[] {
  const byPath = new Map(seeds.map((seed) => [seed.path, seed]));
  return rankRecipes(query, seeds, options).map((ranked) => {
    const seed = byPath.get(ranked.path)!;
    return { ...seed, ...ranked, origin: seed.origin, rag: seed.rag, repositoryMemoryScope: seed.repositoryMemoryScope } as SkillCandidate;
  });
}

function ragEvidenceCandidates(
  rag: Json,
  provider: "semantic_scholar" | "pubmed" | undefined,
  includePaperOnly: boolean,
  limit: number,
): RagCandidateEvidence[] {
  const raw: RagCandidateEvidence[] = [];
  if (!provider) {
    for (const [sourceIndex, source] of (Array.isArray(rag.sources) ? rag.sources : []).entries()) {
      const title = String(source?.title || "").trim();
      const paperText = String(source?.text || "").trim();
      const links = Array.isArray(source?.github_links) ? source.github_links.map(String).filter(Boolean) : [];
      for (const [linkIndex, repoLink] of links.entries()) raw.push({
        title: title || "Retrieved repository method",
        paperText,
        repoLink,
        provider: "ailab_rag",
        sourceId: String(source?.source_id || `ailab-${sourceIndex + 1}-${linkIndex + 1}`),
      });
    }
  } else {
    for (const paper of externalPaperRecords(rag, provider)) {
      const paperText = [paper.abstract, paper.fullText].filter(Boolean).join("\n\n");
      for (const [index, repositoryCandidate] of (paper.repositoryCandidates || []).entries()) raw.push({
        title: paper.title,
        paperText,
        repoLink: repositoryCandidate.url,
        provider,
        repositoryCandidate,
        sourceId: `${provider}-${paper.providerId}-repo-${index + 1}`,
      });
      if (!(paper.repositoryCandidates || []).length && includePaperOnly) raw.push({
        title: paper.title,
        paperText,
        provider,
        sourceId: `${provider}-${paper.providerId}-paper`,
      });
    }
  }
  const seen = new Set<string>();
  return raw.filter((candidate) => {
    const key = candidate.repoLink ? `repo:${normalizeRepositoryIdentity(candidate.repoLink)}` : `paper:${candidate.sourceId}`;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, Math.max(1, limit));
}

async function inferredRagCandidate(evidence: RagCandidateEvidence, index: number): Promise<CandidateSeed> {
  const repositoryKey = evidence.repoLink ? normalizeRepositoryIdentity(evidence.repoLink) : "";
  const name = compactCandidateName(evidence.title, `rag-candidate-${index + 1}`);
  const summary = [evidence.title, evidence.paperText.replace(/\s+/g, " ").slice(0, 700)].filter(Boolean).join(". ").slice(0, 800);
  const text = `---\nname: ${name}\ndescription: ${JSON.stringify(summary)}\n---\n\n# ${evidence.title}\n\n${evidence.paperText.slice(0, 12_000)}\n`;
  const virtualPath = join("/tmp", ".seekbrain-rag-candidates", `${name}-${index + 1}`);
  const inferred = await loadRecipeCard(virtualPath, text);
  const origin: CandidateOrigin = evidence.repoLink ? "rag_repository" : "rag_paper";
  const path = evidence.repoLink ? `rag://repository/${repositoryKey}` : `rag://paper/${evidence.sourceId}`;
  const card: RecipeCard = {
    ...inferred,
    recipe_id: `rag-${name}`,
    status: "candidate",
    summary,
    // Abstract text often mentions the output atlas or comparison modality rather
    // than the accepted input contract. Treat raw RAG facets as unknown until the
    // matcher evaluates the evidence; exact repository-memory cards retain their
    // explicit hard compatibility contract.
    accepts: { species: [], modalities: [], observation_units: [], requires: [] },
    source: {
      type: evidence.repoLink ? "repository" : "rag",
      evidence_refs: [],
      ...(evidence.repoLink ? { repository_url: evidence.repoLink } : {}),
    },
  };
  return { name: card.recipe_id, path, description: summary, text, card, origin, rag: evidence };
}

async function exactRepositoryMemory(
  repoLink: string,
  memoryRoots: string[],
  knownCandidates: CandidateSeed[] = [],
): Promise<{ candidates: CandidateSeed[]; checks: Json[]; authoritative: boolean }> {
  const repositoryKey = normalizeRepositoryIdentity(repoLink);
  const result: CandidateSeed[] = [];
  const checks: Json[] = [];
  const seen = new Set<string>();
  let authoritative = false;

  // Reuse RecipeCards already loaded for local matching as an in-memory
  // repository index. A RAG hit can therefore consult known boundaries without
  // a second repertoire scan or a required folder layout.
  for (const candidate of knownCandidates) {
    const repositoryUrl = candidate.card.source.repository_url;
    if (!repositoryUrl || normalizeRepositoryIdentity(repositoryUrl) !== repositoryKey || seen.has(candidate.path)) continue;
    seen.add(candidate.path);
    authoritative = true;
    result.push({ ...candidate, origin: "repository_memory", repositoryMemoryScope: true });
    checks.push({
      repository_key: repositoryKey,
      recipe_id: candidate.card.recipe_id,
      path: candidate.path,
      status: candidate.card.status,
      avoid_when: candidate.card.avoid_when,
      memory_source: "candidate_pool",
    });
  }

  for (const root of memoryRoots) {
    const skillPath = join(root, repoIdentifier(repoLink));
    if (seen.has(skillPath) || !existsSync(join(skillPath, "SKILL.md"))) continue;
    seen.add(skillPath);
    try {
      const text = await readFile(join(skillPath, "SKILL.md"), "utf8");
      const card = await loadRecipeCard(skillPath, text);
      const cardKey = normalizeRepositoryIdentity(card.source.repository_url || repoLink);
      if (cardKey !== repositoryKey) continue;
      authoritative = true;
      result.push({ name: card.recipe_id, path: skillPath, description: description(text), text, card, origin: "repository_memory", repositoryMemoryScope: true });
      checks.push({ repository_key: repositoryKey, recipe_id: card.recipe_id, path: skillPath, status: card.status, avoid_when: card.avoid_when, memory_source: "exact_from_rag_path" });
    } catch (error) {
      checks.push({ repository_key: repositoryKey, path: skillPath, status: "unreadable", error: String(error) });
    }
  }
  return { candidates: result, checks, authoritative };
}

function annotateSelections(selections: RecipeSelection[], all: SkillCandidate[]): RecipeSelection[] {
  const byPath = new Map(all.map((candidate) => [candidate.path, candidate]));
  return selections.map((selection) => {
    const candidate = byPath.get(selection.path);
    return {
      ...selection,
      ...(candidate ? { source: candidate.origin } : {}),
      ...(candidate?.rag?.repoLink || candidate?.card.source.repository_url ? { repository_url: candidate?.rag?.repoLink || candidate?.card.source.repository_url } : {}),
    };
  });
}

function retrievalFallbackSelections(query: RecipeQuery, all: SkillCandidate[], topK: number, threshold: number): RecipeSelection[] {
  const selections = minimalCoverageSelections(query, all, topK, threshold);
  const uncovered = new Set(recipeSet(query, selections).uncovered_requirement_ids);
  if (!uncovered.size || selections.length >= topK) return selections;
  for (const candidate of all) {
    if (selections.length >= topK || selections.some((selection) => selection.path === candidate.path)) continue;
    if (candidate.origin !== "rag_repository" && candidate.origin !== "rag_paper" && candidate.origin !== "repository_memory") continue;
    const demonstrated = candidate.covers.filter((id) => uncovered.has(id));
    const covers = demonstrated.length ? demonstrated : [...uncovered];
    if (!covers.length) continue;
    selections.push({
      recipe_id: candidate.card.recipe_id,
      path: candidate.path,
      role: selections.length ? (candidate.card.kind === "visualization" ? "visualization" : "supporting") : defaultRole(candidate.card, covers, query),
      score: Math.max(threshold, candidate.score),
      reason: demonstrated.length ? `covers ${covers.join(", ")}` : "RAG retrieval fallback; downstream formulation must preserve the evidence boundary",
      covers,
    });
    for (const id of covers) uncovered.delete(id);
    if (!uncovered.size) break;
  }
  return selections;
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

async function loadExistingSkill(candidate: SkillCandidate, resourceFilter: Json, selection?: RecipeSelection): Promise<string> {
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
  const coverage = selection?.covers.length ? `; covers: ${selection.covers.join(", ")}` : "";
  const role = selection?.role ? `; role: ${selection.role}` : "";
  const header = `${"=".repeat(60)}\n  RECIPE : ${candidate.name}  (relevance: ${candidate.score.toFixed(4)}${role}${coverage})\n${"=".repeat(60)}`;
  return [header, `[SKILL.md]\n${candidate.text}`, ...resources.map((item) => `[${item.path}]\n${item.content}`)].join("\n\n");
}

function modelSelections(
  selected: Array<{ path?: string; name?: string; score: number; role?: RecipeRole; reason?: string; covers?: string[] }>,
  candidates: SkillCandidate[],
  query: RecipeQuery,
  topK: number,
  threshold: number,
): RecipeSelection[] {
  const uncovered = new Set(query.requirements.map((requirement) => requirement.id));
  const used = new Set<string>();
  const result: RecipeSelection[] = [];
  for (const selection of selected) {
    if (result.length >= topK || Number(selection.score) < threshold) continue;
    const candidate = candidates.find((item) => selection.path === item.path || selection.name === item.name);
    if (!candidate || used.has(candidate.path)) continue;
    const requestedCoverage = Array.isArray(selection.covers) ? selection.covers.map(String) : [];
    const validCoverage = requestedCoverage.filter((id) => uncovered.has(id) && query.requirements.some((requirement) => requirement.id === id));
    const fallbackCoverage = candidate.covers.filter((id) => uncovered.has(id));
    const covers = validCoverage.length ? validCoverage : fallbackCoverage;
    if (query.requirements.length && !covers.length) continue;
    const role = (RECIPE_ROLES as readonly string[]).includes(String(selection.role))
      ? selection.role as RecipeRole
      : result.length ? (candidate.card.kind === "visualization" ? "visualization" : "supporting") : defaultRole(candidate.card, covers, query);
    result.push({
      recipe_id: candidate.card.recipe_id,
      path: candidate.path,
      role,
      score: Number(selection.score),
      reason: String(selection.reason || `covers ${covers.join(", ")}`),
      covers,
    });
    used.add(candidate.path);
    for (const id of covers) uncovered.delete(id);
  }
  return result;
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
    const query = buildRecipeQuery({ question, task_brief: input.task_brief, data_contract: input.data_contract });
    const warnings: string[] = [];
    const emptyRecipeSet = recipeSet(query, []);
    const base = { matched: false, source: "none", targeted_skill: "", skill_paths: [], reference_paths: [], generated: false, warnings, trace_id: traceId, recipe_query: query, recipe_set: emptyRecipeSet };
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
    const compatibility = input.compatibility && typeof input.compatibility === "object" ? input.compatibility : {};
    const requestedPool = Number(input.recipe_candidate_pool_size ?? compatibility.recipe_candidate_pool_size ?? 8);
    const poolSize = Number.isFinite(requestedPool) ? Math.max(1, Math.min(30, Math.floor(requestedPool))) : 8;
    const threshold = Number(input.relevance_threshold ?? 0.6);
    const topK = Math.max(1, Math.min(3, Number(input.top_k ?? 3)));
    const requestedRagSelections = Number(input.rag_max_selected ?? compatibility.skill_top_k ?? 2);
    const maximumRagSelections = Number.isFinite(requestedRagSelections) ? Math.max(1, Math.min(2, Math.floor(requestedRagSelections))) : 2;
    let discovered: CandidateSeed[] = [];
    let localCandidates: SkillCandidate[] = [];
    if (!matchEnabled) warnings.push("existing analysis recipe matching disabled by workflow.seekbrain.targeted_skill_match");

    if (matchEnabled) {
      discovered = (await Promise.all(directories.map((directory) => candidates(directory)))).flat();
      localCandidates = rankCandidateSeeds(query, discovered, { poolSize, includeCandidates: bool(input.include_candidate_recipes, false) });
    }

    const finishLocal = async (selections: RecipeSelection[], matchStrategy: "deterministic_high_confidence" | "model_or_fallback"): Promise<Json> => {
      const annotated = annotateSelections(selections, localCandidates);
      const matched = annotated.flatMap((selection) => {
        const candidate = localCandidates.find((item) => item.path === selection.path);
        return candidate ? [{ ...candidate, score: selection.score }] : [];
      });
      if (!matched.length) {
        const trace = { trace_id: traceId, question, recipe_query: query, recipe_set: emptyRecipeSet, source: "none", match_strategy: matchStrategy, warnings };
        return { ok: true, ...base, warnings: [...new Set(warnings)], artifacts: await traceArtifacts(input.trace_dir, trace, "") };
      }
      const resourceFilter = input.resource_filter || { suffixes: [".md", ".py"], max_files: 5 };
      const targetedSkill = (await Promise.all(matched.map((item) => loadExistingSkill(item, resourceFilter, annotated.find((selection) => selection.path === item.path))))).join("\n\n");
      const skillPaths = matched.map((item) => item.path);
      const references = await referencePaths(skillPaths);
      const selectedSet = recipeSet(query, annotated);
      const trace = { trace_id: traceId, question, recipe_query: query, recipe_set: selectedSet, source: "existing_skill", match_strategy: matchStrategy, skills_dir: directories[0], skill_paths: skillPaths, reference_paths: references, scores: matched.map(({ path, score, lexical_score, covers }) => ({ path, score, lexical_score, covers })), warnings };
      return { ok: true, matched: true, source: "existing_skill", targeted_skill: targetedSkill, skill_paths: skillPaths, reference_paths: references, generated: false, warnings: [...new Set(warnings)], trace_id: traceId, recipe_query: query, recipe_set: selectedSet, artifacts: await traceArtifacts(input.trace_dir, trace, targetedSkill) };
    };

    const fastLocal = confidentDeterministicMatch(localCandidates, threshold, query);
    if (fastLocal.length) return await finishLocal(fastLocal, "deterministic_high_confidence");

    if (!generateEnabled) {
      let selections: RecipeSelection[] = [];
      let selectorSucceeded = false;
      if (this.options.selectSkills && localCandidates.length) {
        try {
          const selected = await this.options.selectSkills({ question, query, candidates: localCandidates.map(({ name, path, description: summary, card, covers, compatibility: state }) => ({ name, path, description: summary, card, covers, compatibility: state })), topK, threshold, traceDir: input.trace_dir, signal });
          selectorSucceeded = true;
          selections = modelSelections(selected, localCandidates, query, topK, threshold);
        } catch (error) { warnings.push(`model recipe matching failed; deterministic fallback used: ${String(error)}`); }
      }
      if (!this.options.selectSkills || !selectorSucceeded) selections = minimalCoverageSelections(query, localCandidates, topK, threshold);
      return await finishLocal(selections, "model_or_fallback");
    }

    const provisionalLocal = minimalCoverageSelections(query, localCandidates, topK, threshold);
    const provisionalSet = recipeSet(query, provisionalLocal);
    const priorityRequirements = query.requirements.filter((requirement) => provisionalSet.uncovered_requirement_ids.includes(requirement.id));
    const ragQuestion = recipeRetrievalQuestion(query, priorityRequirements.length ? priorityRequirements : query.requirements);
    const provider = externalProvider(input);
    const requestedPoolSize = Number(input.candidate_pool_size ?? compatibility.candidate_pool_size ?? 10);
    const candidatePoolSize = Number.isFinite(requestedPoolSize) ? Math.max(1, Math.min(100, Math.floor(requestedPoolSize))) : 10;
    const requestedRetrievalTopK = Number(input.rag_top_k ?? Math.max(4, topK));
    const retrievalTopK = provider
      ? candidatePoolSize
      : Number.isFinite(requestedRetrievalTopK) ? Math.max(2, Math.min(candidatePoolSize, Math.floor(requestedRetrievalTopK))) : Math.max(4, topK);
    const rag = await this.ragClient.query({ ...input, question: ragQuestion, top_k: retrievalTopK, candidate_pool_size: candidatePoolSize, require_github: true }, cwd, signal);
    if (!rag.ok) warnings.push(...(rag.warnings || []), rag.error || "Recipe RAG query failed");
    const evidenceCandidates = ragEvidenceCandidates(rag, provider, bool(input.paper_only_fallback ?? compatibility.paper_only_fallback, true), candidatePoolSize);
    if (!evidenceCandidates.length) warnings.push(...(rag.warnings || []), "No usable RAG Recipe candidates were found");

    const generatedDir = input.generated_skill_output_dir
      ? (isAbsolute(input.generated_skill_output_dir) ? resolve(input.generated_skill_output_dir) : resolve(projectRoot, input.generated_skill_output_dir))
      : this.options.generatedSkillDir || join(userSkillsRoot, "from_rag");
    const memoryRoots = uniquePaths([generatedDir, this.options.generatedSkillDir, join(userSkillsRoot, "from_rag")], projectRoot);
    const ragSeeds: CandidateSeed[] = [];
    const repositoryIdentityChecks: Json[] = [];
    for (const [index, evidence] of evidenceCandidates.entries()) {
      if (evidence.repoLink) {
        const memory = await exactRepositoryMemory(evidence.repoLink, memoryRoots, discovered);
        if (memory.authoritative) {
          let resolvedByMemory = false;
          for (const item of memory.candidates) {
            const state = recipeCompatibility(query, item.card);
            const avoidWhen = matchedAvoidWhen(query, item.card);
            const boundaryWhen = matchedBoundaryWhen(query, item.card);
            const executable = isExecutableRecipe(item.card);
            const reusable = executable && item.card.status !== "watchlist" && state.compatible && !avoidWhen.length;
            const memoryCheck = memory.checks.find((check) => check.path === item.path);
            const decision = !executable
              ? boundaryWhen.length ? "rejected_known_boundary" : "ignored_non_executable_reference"
              : item.card.status === "watchlist"
                ? "rejected_watchlist"
                : reusable ? "reuse_candidate" : "rejected_known_incompatible";
            repositoryIdentityChecks.push({
              repository_key: normalizeRepositoryIdentity(evidence.repoLink),
              recipe_id: item.card.recipe_id,
              path: item.path,
              ...(memoryCheck?.memory_source ? { memory_source: memoryCheck.memory_source } : {}),
              decision,
              conflicts: state.conflicts,
              matched_avoid_when: avoidWhen,
              matched_boundary_when: boundaryWhen,
              kind: item.card.kind,
              avoid_when: item.card.avoid_when,
              use_when: item.card.use_when,
            });
            if (reusable) {
              ragSeeds.push(item);
              resolvedByMemory = true;
            } else if (executable || boundaryWhen.length) resolvedByMemory = true;
          }
          if (!memory.candidates.length) {
            repositoryIdentityChecks.push(...memory.checks.map((check) => ({ ...check, decision: "known_repository_unreadable" })));
            resolvedByMemory = true;
          }
          if (resolvedByMemory) continue;
        }
      }
      ragSeeds.push(await inferredRagCandidate(evidence, index));
    }

    const ragPoolSize = Math.max(2, Math.min(candidatePoolSize, Math.max(ragSeeds.length, maximumRagSelections)));
    const rankedRag = rankCandidateSeeds(query, ragSeeds, { includeCandidates: true, poolSize: ragPoolSize });
    const combinedSeeds = [...new Map([...localCandidates, ...rankedRag].map((candidate) => [candidate.path, candidate as CandidateSeed])).values()];
    const combinedPoolSize = Math.max(1, Math.min(30, poolSize + ragPoolSize));
    const all = rankCandidateSeeds(query, combinedSeeds, { includeCandidates: true, poolSize: combinedPoolSize });

    let selections = confidentDeterministicMatch(all, threshold, query);
    let selectorSucceeded = false;
    const deterministicMatch = selections.length > 0;
    if (!deterministicMatch && this.options.selectSkills && all.length) {
      try {
        const selected = await this.options.selectSkills({ question, query, candidates: all.map(({ name, path, description: summary, card, covers, compatibility: state }) => ({ name, path, description: summary, card, covers, compatibility: state })), topK, threshold, traceDir: input.trace_dir, signal });
        selectorSucceeded = true;
        selections = modelSelections(selected, all, query, topK, threshold);
      } catch (error) { warnings.push(`model recipe matching failed; deterministic fallback used: ${String(error)}`); }
    }
    if (!deterministicMatch && (!this.options.selectSkills || !selectorSucceeded)) selections = retrievalFallbackSelections(query, all, topK, threshold);
    selections = annotateSelections(selections, all);

    const resourceFilter = input.resource_filter || { suffixes: [".md", ".py"], max_files: 5 };
    const targetedSkillParts: string[] = [];
    const successfulSelections: RecipeSelection[] = [];
    const skillPaths: string[] = [];
    const referenceFiles: string[] = [];
    const repositoryReferences: Json[] = [];
    const componentSources: string[] = [];
    const uncoveredRequirementIds = new Set(query.requirements.map((requirement) => requirement.id));
    let repositoryInspectionCount = 0;
    let generated = false;

    const recordSelection = (selection: RecipeSelection): void => {
      successfulSelections.push(selection);
      for (const requirementId of selection.covers) uncoveredRequirementIds.delete(requirementId);
    };

    // Local Recipes and paper-only guidance retain their existing lightweight
    // path. Repository-memory and new RAG repositories are composed lazily
    // below so a failed repository does not consume one of the accepted slots.
    for (const selection of selections) {
      const candidate = all.find((item) => item.path === selection.path);
      if (!candidate) continue;
      if (candidate.origin === "local") {
        if (!isExecutableRecipe(candidate.card)) continue;
        const confirmedCoverage = selection.covers.filter((requirementId) => uncoveredRequirementIds.has(requirementId));
        if (query.requirements.length && !confirmedCoverage.length) continue;
        const confirmedSelection = { ...selection, covers: confirmedCoverage };
        targetedSkillParts.push(await loadExistingSkill(candidate, resourceFilter, confirmedSelection));
        recordSelection(confirmedSelection);
        skillPaths.push(candidate.path);
        referenceFiles.push(...await referencePaths([candidate.path]));
        componentSources.push("existing_skill");
        continue;
      }
      if (candidate.origin === "rag_paper") {
        const evidence = candidate.rag;
        if (!evidence) continue;
        const confirmedCoverage = selection.covers.filter((requirementId) => uncoveredRequirementIds.has(requirementId));
        if (query.requirements.length && !confirmedCoverage.length) continue;
        const confirmedSelection = { ...selection, covers: confirmedCoverage };
        targetedSkillParts.push(repositoryGuidance({ question: ragQuestion, title: evidence.title || "Retrieved paper method", paperText: evidence.paperText }));
        recordSelection(confirmedSelection);
        componentSources.push("paper_reference");
      }
    }

    const selectedByPath = new Map(selections.map((selection) => [selection.path, selection]));
    const repositoryPoolByPath = new Map<string, SkillCandidate>();
    for (const selection of selections) {
      const candidate = all.find((item) => item.path === selection.path);
      if (candidate && (candidate.origin === "rag_repository" || candidate.origin === "repository_memory")) repositoryPoolByPath.set(candidate.path, candidate);
    }
    for (const candidate of rankedRag) {
      if (candidate.origin === "rag_repository" || candidate.origin === "repository_memory") repositoryPoolByPath.set(candidate.path, candidate);
    }
    const repositoryInspectionPoolSize = Math.max(maximumRagSelections, Math.min(4, retrievalTopK));
    const repositoryPool = [...repositoryPoolByPath.values()].slice(0, repositoryInspectionPoolSize);
    const repositoryCandidatePoolSize = repositoryPool.length;

    while (repositoryPool.length && successfulSelections.length < topK && uncoveredRequirementIds.size) {
      const acceptedRagCount = successfulSelections.filter((selection) => selection.source === "rag_repository" || selection.source === "repository_memory").length;
      if (acceptedRagCount >= maximumRagSelections) break;

      const rankedChoices = repositoryPool.flatMap((candidate) => {
        const selected = selectedByPath.get(candidate.path);
        const expected = new Set([...(selected?.covers || []), ...candidate.covers]);
        const covers = query.requirements.map((requirement) => requirement.id).filter((requirementId) => uncoveredRequirementIds.has(requirementId) && expected.has(requirementId));
        if (!covers.length) return [];
        return [{ candidate, selected, covers, selectedByMatcher: Boolean(selected), score: selected?.score ?? candidate.score }];
      }).sort((left, right) => right.covers.length - left.covers.length
        || Number(right.selectedByMatcher) - Number(left.selectedByMatcher)
        || right.score - left.score
        || left.candidate.path.localeCompare(right.candidate.path));
      const choice = rankedChoices[0];
      if (!choice) break;
      repositoryPool.splice(repositoryPool.findIndex((candidate) => candidate.path === choice.candidate.path), 1);

      const candidate = choice.candidate;
      const selection: RecipeSelection = choice.selected
        ? { ...choice.selected, covers: choice.covers }
        : {
            recipe_id: candidate.card.recipe_id,
            path: candidate.path,
            role: successfulSelections.length ? (candidate.card.kind === "visualization" ? "visualization" : "supporting") : defaultRole(candidate.card, choice.covers, query),
            score: Math.max(threshold, candidate.score),
            reason: `bounded RAG replacement candidate covering ${choice.covers.join(", ")}`,
            covers: choice.covers,
            source: candidate.origin,
            ...(candidate.rag?.repoLink || candidate.card.source.repository_url ? { repository_url: candidate.rag?.repoLink || candidate.card.source.repository_url } : {}),
          };

      if (candidate.origin === "repository_memory") {
        if (!isExecutableRecipe(candidate.card)) continue;
        const confirmedCoverage = candidate.covers.filter((requirementId) => uncoveredRequirementIds.has(requirementId));
        if (!confirmedCoverage.length) continue;
        const confirmedSelection: RecipeSelection = { ...selection, recipe_id: candidate.card.recipe_id, path: candidate.path, covers: confirmedCoverage, source: "repository_memory" };
        try {
          targetedSkillParts.push(await loadExistingSkill(candidate, resourceFilter, confirmedSelection));
          recordSelection(confirmedSelection);
          skillPaths.push(candidate.path);
          referenceFiles.push(...await referencePaths([candidate.path]));
          componentSources.push("existing_skill");
        } catch (error) {
          repositoryIdentityChecks.push({
            repository_key: normalizeRepositoryIdentity(candidate.card.source.repository_url || candidate.path),
            recipe_id: candidate.card.recipe_id,
            path: candidate.path,
            decision: "repository_memory_load_failed",
            error: String(error),
          });
          warnings.push(`repository-memory Recipe ${candidate.card.recipe_id} could not be loaded; trying the next candidate: ${String(error)}`);
        }
        continue;
      }

      const evidence = candidate.rag;
      if (!evidence?.repoLink) continue;
      repositoryInspectionCount += 1;

      try {
        let repoLink = evidence.repoLink;
        if (evidence.repositoryCandidate) {
          const validation = await this.validateRepository(evidence.repositoryCandidate, signal);
          if (!validation.ok || !validation.url) {
            warnings.push(`${evidence.title}: ${validation.reason || "repository validation failed"}`);
            continue;
          }
          repoLink = validation.url;
        }

        let validated: ValidatedRepositoryScripts | undefined = await this.lookupValidatedRepositoryScripts(repoLink);
        const crystallizationEnabled = bool(input.repository_recipe_crystallization_enabled, false);
        if (!validated && crystallizationEnabled) {
          const crystallized = await this.generator.generate({ question: ragQuestion, title: evidence.title || "Retrieved repository method", paperText: evidence.paperText, repoLink, evidenceLevel: "repository_backed", provider: evidence.provider === "ailab_rag" ? undefined : evidence.provider, outputDir: generatedDir, signal });
          if (crystallized.ok && crystallized.skill_path) {
            const skillPath = String(crystallized.skill_path);
            const skillText = await readFile(join(skillPath, "SKILL.md"), "utf8");
            const card = await loadRecipeCard(skillPath, skillText);
            if (!isExecutableRecipe(card)) {
              const boundaryWhen = matchedBoundaryWhen(query, card);
              repositoryIdentityChecks.push({
                repository_key: normalizeRepositoryIdentity(repoLink),
                recipe_id: card.recipe_id,
                path: skillPath,
                decision: "rejected_non_executable_reference",
                kind: card.kind,
                matched_boundary_when: boundaryWhen,
                use_when: card.use_when,
              });
              warnings.push(`crystallized candidate ${card.recipe_id} is a non-executable reference and was not admitted to the Recipe set`);
              warnings.push(...(crystallized.warnings || []));
              continue;
            }
            const rankedGenerated = rankCandidateSeeds(query, [{ name: card.recipe_id, path: skillPath, description: description(skillText), text: skillText, card, origin: "repository_memory", repositoryMemoryScope: true }], { includeCandidates: true, poolSize: 1 })[0];
            const generatedCoverage = (rankedGenerated?.covers || []).filter((requirementId) => uncoveredRequirementIds.has(requirementId));
            if (!rankedGenerated || !generatedCoverage.length) {
              repositoryIdentityChecks.push({
                repository_key: normalizeRepositoryIdentity(repoLink),
                recipe_id: card.recipe_id,
                path: skillPath,
                decision: "rejected_no_confirmed_coverage",
                kind: card.kind,
              });
              warnings.push(`crystallized candidate ${card.recipe_id} did not confirm coverage of any currently uncovered requirement; the RAG candidate was rejected`);
              warnings.push(...(crystallized.warnings || []));
              continue;
            }
            const generatedSelection: RecipeSelection = { ...selection, recipe_id: card.recipe_id, path: skillPath, covers: generatedCoverage, source: "repository_memory", repository_url: repoLink };
            repositoryIdentityChecks.push({
              repository_key: normalizeRepositoryIdentity(repoLink),
              recipe_id: card.recipe_id,
              path: skillPath,
              decision: "accepted_executable_recipe",
              kind: card.kind,
              confirmed_coverage: generatedCoverage,
            });
            targetedSkillParts.push(await loadExistingSkill(rankedGenerated, resourceFilter, generatedSelection));
            recordSelection(generatedSelection);
            skillPaths.push(skillPath);
            const generatedReferences = await referencePaths([skillPath]);
            referenceFiles.push(...generatedReferences);
            repositoryReferences.push({ repository_url: repoLink, crystallized_recipe_path: join(skillPath, "SKILL.md"), reference_files: generatedReferences, reused_crystallized_recipe: crystallized.reused === true });
            componentSources.push("generated_from_rag");
            generated ||= crystallized.reused !== true;
            warnings.push(...(crystallized.warnings || []));
            continue;
          }
          warnings.push(crystallized.error || `failed to crystallize analysis recipe for ${repoLink}`);
          warnings.push(...(crystallized.warnings || []));
          continue;
        }

        let materialized: MaterializedRepository | undefined;
        if (!validated) {
          materialized = await this.materializeRepository(repoLink, ragQuestion, evidence.title, signal);
          if (!materialized.ok) warnings.push(`repository materialization failed: ${materialized.error || repoLink}`);
        }
        if (!validated && !materialized?.ok) continue;
        targetedSkillParts.push(repositoryGuidance({ question: ragQuestion, title: evidence.title || "Retrieved method evidence", paperText: evidence.paperText, materialized, validated }));
        const confirmedSelection = { ...selection, covers: selection.covers.filter((requirementId) => uncoveredRequirementIds.has(requirementId)), repository_url: repoLink };
        if (!confirmedSelection.covers.length) continue;
        recordSelection(confirmedSelection);
        if (validated) {
          skillPaths.push(validated.recipe_path);
          referenceFiles.push(...[validated.script_path, validated.utility_path].filter(Boolean) as string[]);
          repositoryReferences.push({ repository_key: validated.repository_key, repository_url: validated.repository_url, source_commit: validated.source_commit, validated_recipe_path: validated.recipe_path, validated_script_path: validated.script_path, validated_utility_path: validated.utility_path, reference_files: [validated.script_path, validated.utility_path].filter(Boolean), reused_validated_scripts: true });
          componentSources.push("validated_repository_recipe");
        } else if (materialized?.ok) {
          const files = materialized.candidate_files.map((file) => file.local_path);
          referenceFiles.push(...files);
          repositoryReferences.push({ repository_key: materialized.repository_key, repository_url: materialized.repository_url, repository_dir: materialized.repository_dir, source_commit: materialized.source_commit, reference_files: files, reused_validated_scripts: false });
          componentSources.push("repository_reference");
        } else componentSources.push("paper_reference");
      } catch (error) {
        repositoryIdentityChecks.push({
          repository_key: normalizeRepositoryIdentity(evidence.repoLink),
          path: candidate.path,
          decision: "repository_candidate_failed",
          error: String(error),
        });
        warnings.push(`repository candidate ${evidence.repoLink} failed during executable Recipe acceptance; trying the next candidate: ${String(error)}`);
        continue;
      }
    }

    const uniqueWarnings = [...new Set(warnings.filter(Boolean))];
    if (!successfulSelections.length) {
      const trace = { trace_id: traceId, question, rag_question: ragQuestion, source: "none", recipe_query: query, recipe_set: emptyRecipeSet, repository_identity_checks: repositoryIdentityChecks, repository_inspection_count: repositoryInspectionCount, repository_candidate_pool_size: repositoryCandidatePoolSize, rag_candidates: rankedRag.map(({ path, card, score, covers, origin }) => ({ path, recipe_id: card.recipe_id, source: origin, score, covers, repository_url: card.source.repository_url })), warnings: uniqueWarnings };
      return { ok: true, ...base, warnings: uniqueWarnings, artifacts: await traceArtifacts(input.trace_dir, trace, ""), ...(rag.error ? { error: rag.error } : {}) };
    }

    const selectedSet = recipeSet(query, successfulSelections);
    const hasRagSelection = successfulSelections.some((selection) => selection.source === "rag_repository" || selection.source === "rag_paper" || selection.source === "repository_memory");
    const uniqueComponentSources = [...new Set(componentSources)];
    const source = hasRagSelection && successfulSelections.length > 1
      ? "composed_recipe_set"
      : uniqueComponentSources.length === 1 ? uniqueComponentSources[0] : "composed_recipe_set";
    const targetedSkill = targetedSkillParts.join("\n\n");
    const uniqueSkillPaths = [...new Set(skillPaths)];
    const uniqueReferenceFiles = [...new Set(referenceFiles)];
    const trace = {
      trace_id: traceId,
      question,
      rag_question: ragQuestion,
      source,
      skills_dir: directories[0],
      skill_paths: uniqueSkillPaths,
      reference_paths: uniqueReferenceFiles,
      repository_reference: repositoryReferences[0],
      repository_references: repositoryReferences,
      repository_identity_checks: repositoryIdentityChecks,
      repository_inspection_count: repositoryInspectionCount,
      repository_candidate_pool_size: repositoryCandidatePoolSize,
      recipe_query: query,
      recipe_set: selectedSet,
      candidates: all.map(({ path, card, score, lexical_score, covers, origin }) => ({ path, recipe_id: card.recipe_id, source: origin, score, lexical_score, covers, repository_url: card.source.repository_url })),
      warnings: uniqueWarnings,
    };
    return {
      ok: true,
      matched: true,
      source,
      targeted_skill: targetedSkill,
      skill_paths: uniqueSkillPaths,
      reference_paths: uniqueReferenceFiles,
      generated,
      warnings: uniqueWarnings,
      trace_id: traceId,
      recipe_query: query,
      recipe_set: selectedSet,
      artifacts: await traceArtifacts(input.trace_dir, trace, targetedSkill),
      ...(repositoryReferences[0] ? { repository_reference: repositoryReferences[0] } : {}),
      repository_references: repositoryReferences,
      details: {
        rag_candidate_count: rankedRag.length,
        rag_selected_count: successfulSelections.filter((selection) => selection.source !== "local").length,
        repository_inspection_count: repositoryInspectionCount,
        repository_candidate_pool_size: repositoryCandidatePoolSize,
        repository_materialized_count: repositoryReferences.filter((reference) => reference.repository_dir).length,
        repository_materialized: repositoryReferences.some((reference) => Boolean(reference.repository_dir)),
        reused_validated_scripts: repositoryReferences.some((reference) => reference.reused_validated_scripts === true),
        existing_recipe_paths: successfulSelections.filter((selection) => selection.source === "local" || selection.source === "repository_memory").map((selection) => selection.path),
        gap_requirement_ids: selectedSet.uncovered_requirement_ids,
      },
    };
  }
}

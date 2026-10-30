import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import type { LiteratureQueryClient, PaperRecord } from "../literature-compat/contracts.ts";
import { inferSemanticTerms, isExecutableRecipe, loadRecipeCard, type RecipeCard, type RecipeQuery } from "./recipe-card.ts";
import { rankRecipes, recipeCompatibility, type DiscoverableRecipe } from "./recipe-discovery.ts";
import { normalizeRepositoryIdentity } from "./repository-cache.ts";
import type {
  Json,
  ScoutCandidate,
  ScoutMemoryRecord,
  ScoutPaperEvidenceChunk,
  ScoutRepositoryOption,
  ScoutRetrievalQueryKind,
  ScoutScientificQuery,
} from "./scout-types.ts";

export interface LocalRecipeRecord extends DiscoverableRecipe {
  repository_key?: string;
}

export interface LocalRecipeRecall {
  all: LocalRecipeRecord[];
  candidates: ScoutCandidate[];
}

export interface RagRecallInput {
  client: LiteratureQueryClient;
  query: string;
  queryKind?: ScoutRetrievalQueryKind;
  round: 1 | 2;
  topK: number;
  cwd: string;
  providerInput: Json;
  includePaperOnly?: boolean;
  requireGithub?: boolean;
  scientificQuery?: ScoutScientificQuery;
  signal?: AbortSignal;
}

export interface RagRecallResult {
  ok: boolean;
  candidates: ScoutCandidate[];
  warnings: string[];
  error?: string;
  raw?: Json;
}

function compact(value: unknown): string {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(compact).filter(Boolean))];
}

function uniqueStrings(values: unknown[]): string[] {
  return [...new Set(values.map(compact).filter(Boolean))];
}

function bounded(value: string, limit: number): string {
  const text = compact(value);
  if (text.length <= limit) return text;
  const sliced = text.slice(0, limit + 1);
  const boundary = Math.max(sliced.lastIndexOf(". "), sliced.lastIndexOf("; "), sliced.lastIndexOf(", "), sliced.lastIndexOf(" "));
  return `${sliced.slice(0, boundary > limit * 0.65 ? boundary : limit).trim()}…`;
}

export function buildScoutScientificQuery(input: Json, queryCharLimit = 1200): ScoutScientificQuery {
  const rawQuestion = compact(input.question);
  const query = bounded(rawQuestion, Math.max(400, queryCharLimit));
  return {
    schema_version: 1,
    raw_question: rawQuestion,
    objective: bounded(rawQuestion, 520),
    biological_scope: [],
    data_abstraction: [],
    hard_constraints: [],
    output_preferences: [],
    species: [],
    species_evidence: [],
    query_text: query,
    method_query_text: query,
  };
}

export function normalizeScoutScientificQuery(value: Json, question: string, queryCharLimit = 1200): ScoutScientificQuery {
  const fallback = buildScoutScientificQuery({ question }, queryCharLimit);
  const canonical = (items: unknown) => strings(items).map((item) => item.toLowerCase().replace(/\s+/g, "_")).slice(0, 8);
  const speciesEvidence = strings(value.species_evidence).slice(0, 8);
  return {
    schema_version: 1,
    raw_question: fallback.raw_question,
    objective: bounded(compact(value.objective) || fallback.objective, 520),
    biological_scope: strings(value.biological_scope).slice(0, 8),
    data_abstraction: strings(value.data_abstraction).slice(0, 8),
    hard_constraints: strings(value.hard_constraints).slice(0, 12),
    output_preferences: strings(value.output_preferences).slice(0, 8),
    species: speciesEvidence.length ? canonical(value.species) : [],
    species_evidence: speciesEvidence,
    query_text: bounded(compact(value.query_text) || fallback.query_text, Math.max(400, queryCharLimit)),
    method_query_text: bounded(compact(value.method_query_text) || compact(value.query_text) || fallback.method_query_text, Math.max(400, queryCharLimit)),
  };
}

async function recipeDirectories(root: string, maximumDepth = 4): Promise<string[]> {
  const start = resolve(root);
  const queue: Array<{ path: string; depth: number }> = [{ path: start, depth: 0 }];
  const found: string[] = [];
  while (queue.length) {
    const current = queue.shift()!;
    let entries;
    try { entries = await readdir(current.path, { withFileTypes: true }); }
    catch { continue; }
    if (entries.some((entry) => entry.isFile() && entry.name === "SKILL.md")) {
      found.push(current.path);
      continue;
    }
    if (current.depth >= maximumDepth) continue;
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "references" || entry.name === "scripts") continue;
      queue.push({ path: join(current.path, entry.name), depth: current.depth + 1 });
    }
  }
  return found;
}

async function mapLimit<T, R>(values: T[], concurrency: number, mapper: (value: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(values.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(Math.max(1, concurrency), Math.max(1, values.length)) }, async () => {
    while (next < values.length) {
      const index = next++;
      results[index] = await mapper(values[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

function localDescription(text: string, card: RecipeCard): string {
  if (card.summary) return bounded(card.summary, 800);
  const paragraph = text.split(/\n\s*\n/).find((item) => compact(item) && !compact(item).startsWith("#"));
  return bounded(paragraph || text, 800);
}

export async function loadLocalRecipeIndex(directories: string[], query: ScoutScientificQuery, topK = 8): Promise<LocalRecipeRecall> {
  const paths = [...new Set((await Promise.all(directories.map((directory) => recipeDirectories(directory)))).flat())];
  const loaded = await mapLimit(paths, 8, async (path) => {
    try {
      const text = await readFile(join(path, "SKILL.md"), "utf8");
      const card = await loadRecipeCard(path, text);
      return {
        name: card.recipe_id || basename(path),
        path,
        description: localDescription(text, card),
        text,
        card,
        ...(card.source.repository_url ? { repository_key: normalizeRepositoryIdentity(card.source.repository_url) } : {}),
      } satisfies LocalRecipeRecord;
    } catch {
      return undefined;
    }
  });
  const all = loaded.filter((item): item is LocalRecipeRecord => Boolean(item));
  const syntheticQuery: RecipeQuery = {
    schema_version: 1,
    question: `${query.query_text} ${query.method_query_text}`.trim(),
    objective: query.objective,
    biological_scope: query.biological_scope,
    requirements: [],
    accepts: { species: query.species, modalities: [], observation_units: [] },
  };
  const ranked = rankRecipes(syntheticQuery, all, { includeCandidates: false, poolSize: Math.max(1, topK) });
  const candidates = ranked.map((item) => ({
    candidate_id: "",
    origin: "local" as const,
    title: item.card.recipe_id,
    summary: item.description,
    recipe_path: item.path,
    ...(item.card.source.repository_url ? {
      repository_url: item.card.source.repository_url,
      repository_key: normalizeRepositoryIdentity(item.card.source.repository_url),
    } : {}),
    recipe_card: item.card,
    retrieval: [{ round: 1 as const, query: query.query_text, rank: ranked.indexOf(item) + 1, score: item.score }],
    memory_records: [],
  }));
  return { all, candidates };
}

function externalPapers(raw: Json): PaperRecord[] {
  return Array.isArray(raw.papers) ? raw.papers.filter((paper: Json) => paper?.title) as PaperRecord[] : [];
}

function normalizedPaperKey(title: string, sourceId: string, externalId?: string): string {
  const stable = compact(externalId).normalize("NFKD").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  if (stable) return stable;
  const normalizedTitle = compact(title).normalize("NFKD").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  return normalizedTitle || compact(sourceId).toLowerCase();
}

const PAPER_METHOD_HEADING = /\b(?:methods?|materials?\s+and\s+methods?|protocol|analysis|processing|quantification|classification|clustering|statistics?)\b/i;
const PAPER_METHOD_SIGNAL = /\b(?:threshold|positive|positivity|binar|filter|inclusion|exclusion|select(?:ion|ed)?|matching|registration|align(?:ment|ed)?|cluster|classif|marker|co[- ]expression|heatmap|matrix|sampling|representative|mode)\b/i;
const PAPER_STOPWORDS = new Set(["the", "and", "for", "with", "from", "into", "using", "use", "data", "analysis", "method", "methods", "this", "that", "were", "was", "are", "each", "their"]);

function paperTerms(query: string, scientificQuery?: ScoutScientificQuery): string[] {
  const text = [
    query,
    scientificQuery?.objective,
    scientificQuery?.query_text,
    scientificQuery?.method_query_text,
  ].filter(Boolean).join(" ").toLowerCase();
  return [...new Set(text.match(/[\p{L}\p{N}]+/gu)?.filter((token) => token.length > 3 && !PAPER_STOPWORDS.has(token)) || [])].slice(0, 24);
}

function splitPaperSections(raw: string): Array<{ heading?: string; text: string; order: number }> {
  const text = String(raw || "").replace(/\r\n/g, "\n").trim();
  if (!text) return [];
  const lines = text.split("\n");
  const sections: Array<{ heading?: string; text: string; order: number }> = [];
  let heading = "";
  let body: string[] = [];
  const flush = () => {
    const value = body.join("\n").trim();
    if (value) sections.push({ ...(heading ? { heading } : {}), text: value, order: sections.length });
    body = [];
  };
  for (const line of lines) {
    const value = line.trim();
    const markdown = /^#{1,4}\s+(.+)$/.exec(value);
    const plainHeading = value.length > 2 && value.length < 90 && (
      PAPER_METHOD_HEADING.test(value)
      || /^[A-Z][A-Z\s/&-]{3,}$/.test(value)
    );
    if (markdown || plainHeading) {
      flush();
      heading = compact(markdown?.[1] || value);
    } else {
      body.push(line);
    }
  }
  flush();
  const expanded = sections.flatMap((section) => {
    if (section.text.length <= 2_000) return [section];
    const paragraphs = section.text.split(/\n\s*\n/).map((value) => value.trim()).filter(Boolean);
    const chunks: typeof sections = [];
    let current = "";
    for (const paragraph of paragraphs.length > 1 ? paragraphs : section.text.split(/(?<=[.!?])\s+/)) {
      if (current && current.length + paragraph.length > 1_800) {
        chunks.push({ ...section, text: current.trim(), order: section.order + chunks.length / 100 });
        current = "";
      }
      current = `${current} ${paragraph}`.trim();
    }
    if (current) chunks.push({ ...section, text: current.trim(), order: section.order + chunks.length / 100 });
    return chunks;
  });
  return expanded.length ? expanded : [{ text, order: 0 }];
}

export function selectRelevantPaperChunks(raw: string, query: string, scientificQuery?: ScoutScientificQuery): ScoutPaperEvidenceChunk[] {
  const terms = paperTerms(query, scientificQuery);
  const ranked = splitPaperSections(raw).map((section) => {
    const searchable = `${section.heading || ""} ${section.text}`.toLowerCase();
    const termHits = terms.reduce((count, term) => count + Number(searchable.includes(term)), 0);
    const score = termHits * 2
      + (section.heading && PAPER_METHOD_HEADING.test(section.heading) ? 12 : 0)
      + (PAPER_METHOD_SIGNAL.test(searchable) ? 5 : 0);
    return { ...section, score };
  }).sort((left, right) => right.score - left.score || left.order - right.order);
  const selected = ranked.slice(0, 2);
  if (!selected.length) return [];
  return selected.map((section) => ({
    ...(section.heading ? { heading: section.heading } : {}),
    text: bounded(section.text, 1_800),
    score: section.score,
  }));
}

function relevantPaperText(raw: string, query: string, scientificQuery?: ScoutScientificQuery): { text: string; chunks: ScoutPaperEvidenceChunk[] } {
  const chunks = selectRelevantPaperChunks(raw, query, scientificQuery);
  return {
    chunks,
    text: chunks.map((chunk) => `${chunk.heading ? `${chunk.heading}\n` : ""}${chunk.text}`).join("\n\n"),
  };
}

function repositoryOptions(values: Array<{ url?: unknown; relation?: unknown }>): ScoutRepositoryOption[] {
  const options: ScoutRepositoryOption[] = [];
  const seen = new Set<string>();
  for (const [index, value] of values.entries()) {
    const repositoryUrl = compact(value?.url);
    if (!repositoryUrl) continue;
    const repositoryKey = normalizeRepositoryIdentity(repositoryUrl);
    if (!repositoryKey || seen.has(repositoryKey)) continue;
    seen.add(repositoryKey);
    options.push({
      repository_url: repositoryUrl,
      repository_key: repositoryKey,
      relation: compact(value?.relation) || "unknown",
      order: index,
    });
  }
  return options;
}

function normalizeRagCandidates(
  raw: Json,
  query: string,
  queryKind: ScoutRetrievalQueryKind,
  round: 1 | 2,
  includePaperOnly: boolean,
  scientificQuery?: ScoutScientificQuery,
): ScoutCandidate[] {
  const candidates: ScoutCandidate[] = [];
  const papers = externalPapers(raw);
  if (papers.length) {
    for (const [paperIndex, paper] of papers.entries()) {
      const fullPaperText = [paper.abstract, paper.fullText].filter(Boolean).join("\n\n").trim();
      const paperEvidence = relevantPaperText(fullPaperText, query, scientificQuery);
      const paperText = paperEvidence.text;
      const sourceId = `${paper.provider}:${paper.providerId}`;
      const options = repositoryOptions((paper.repositoryCandidates || []).map((repository) => ({ url: repository.url, relation: repository.relation })));
      if (options.length || includePaperOnly) candidates.push({
        candidate_id: "",
        origin: "rag_paper",
        title: paper.title,
        summary: bounded(`${paper.title}. ${paperText}`, 900),
        paper_key: normalizedPaperKey(paper.title, sourceId, paper.doi ? `doi:${paper.doi}` : `${paper.provider}:${paper.pmid || paper.pmcid || paper.providerId}`),
        repository_options: options,
        retrieval: [{
          round,
          query,
          query_kind: queryKind,
          rank: paperIndex + 1,
          score: paper.relevanceScore,
          source_id: sourceId,
          paper_title: paper.title,
          paper_text: paperText,
          paper_chunks: paperEvidence.chunks,
        }],
        memory_records: [],
      });
    }
    return candidates;
  }

  for (const [sourceIndex, source] of (Array.isArray(raw.sources) ? raw.sources : []).entries()) {
    const title = compact(source?.title) || "Retrieved method";
    const paperEvidence = relevantPaperText(String(source?.text || ""), query, scientificQuery);
    const paperText = paperEvidence.text;
    const links = Array.isArray(source?.github_links) ? source.github_links.map(compact).filter(Boolean) : [];
    const repositoryCandidates = Array.isArray(source?.repository_candidates) ? source.repository_candidates : [];
    const normalizedLinks = links.length
      ? links.map((url: string) => ({ url, relation: "unknown" }))
      : repositoryCandidates.map((repository: Json | string) => typeof repository === "string"
        ? { url: repository, relation: "unknown" }
        : { url: repository?.url, relation: repository?.relation });
    const options = repositoryOptions(normalizedLinks);
    const sourceId = compact(source?.source_id) || `S${sourceIndex + 1}`;
    if (options.length || includePaperOnly) candidates.push({
      candidate_id: "",
      origin: "rag_paper",
      title,
      summary: bounded(`${title}. ${paperText}`, 900),
      paper_key: normalizedPaperKey(title, sourceId),
      repository_options: options,
      retrieval: [{ round, query, query_kind: queryKind, rank: sourceIndex + 1, source_id: sourceId, paper_title: title, paper_text: paperText, paper_chunks: paperEvidence.chunks }],
      memory_records: [],
    });
  }
  return candidates;
}

export async function retrieveRagCandidates(input: RagRecallInput): Promise<RagRecallResult> {
  let raw: Json;
  try {
    raw = await input.client.query({
      ...input.providerInput,
      question: input.query,
      query: input.query,
      top_k: input.topK,
      candidate_pool_size: input.topK,
      require_github: input.requireGithub === true,
    }, input.cwd, input.signal);
  } catch (error) {
    return { ok: false, candidates: [], warnings: [], error: `Recipe RAG query failed: ${String(error)}` };
  }
  const warnings = Array.isArray(raw.warnings) ? raw.warnings.map(String) : [];
  if (!raw.ok) return { ok: false, candidates: [], warnings, error: String(raw.error || "Recipe RAG query failed"), raw };
  const seen = new Set<string>();
  const candidates = normalizeRagCandidates(raw, input.query, input.queryKind || (input.round === 1 ? "domain" : "retry"), input.round, input.includePaperOnly === true, input.scientificQuery).filter((candidate) => {
    const key = `paper:${candidate.paper_key || candidate.retrieval[0]?.source_id || candidate.title.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, Math.max(1, input.topK));
  return { ok: true, candidates, warnings, raw };
}

function conditionMatches(condition: string, query: ScoutScientificQuery): boolean {
  const conditionText = compact(condition).toLowerCase();
  if (!conditionText) return false;
  const queryText = `${query.raw_question} ${query.objective} ${query.biological_scope.join(" ")} ${query.data_abstraction.join(" ")}`.toLowerCase();
  if (conditionText.length >= 8 && queryText.includes(conditionText)) return true;
  const stop = new Set(["with", "from", "this", "that", "when", "input", "data", "analysis", "method", "using", "does", "not", "support"]);
  const conditionTokens = conditionText.match(/[\p{L}\p{N}]+/gu)?.filter((token) => token.length > 2 && !stop.has(token)) || [];
  if (!conditionTokens.length) return false;
  const queryTokens = new Set(queryText.match(/[\p{L}\p{N}]+/gu) || []);
  const overlap = conditionTokens.filter((token) => queryTokens.has(token));
  const semanticCondition = inferSemanticTerms(conditionText);
  const semanticQuery = new Set(inferSemanticTerms(queryText));
  const requiredOverlap = conditionTokens.length <= 2 ? conditionTokens.length : Math.max(2, Math.ceil(conditionTokens.length * 0.6));
  return overlap.length >= requiredOverlap
    || semanticCondition.some((term) => semanticQuery.has(term)) && overlap.length >= Math.max(2, Math.ceil(conditionTokens.length * 0.5));
}

function syntheticCompatibilityQuery(query: ScoutScientificQuery): RecipeQuery {
  return {
    schema_version: 1,
    question: query.raw_question,
    objective: query.objective,
    biological_scope: query.biological_scope,
    requirements: [],
    accepts: { species: query.species, modalities: [], observation_units: [] },
  };
}

function memoryRecord(recipe: LocalRecipeRecord, query: ScoutScientificQuery): ScoutMemoryRecord {
  const compatibility = recipeCompatibility(syntheticCompatibilityQuery(query), recipe.card);
  const scopedReference = recipe.card.kind === "reference" && recipe.card.use_when.some((item) => conditionMatches(item, query));
  const boundary = scopedReference || !compatibility.compatible || recipe.card.status === "watchlist";
  return {
    recipe_path: recipe.path,
    recipe_id: recipe.card.recipe_id,
    kind: recipe.card.kind,
    status: recipe.card.status,
    compatible: compatibility.compatible,
    conflicts: compatibility.conflicts,
    matched_avoid_when: [],
    use_when: recipe.card.use_when,
    avoid_when: recipe.card.avoid_when,
    boundary,
  };
}

export function applyExactRepositoryMemory(ragCandidates: ScoutCandidate[], localRecipes: LocalRecipeRecord[], query: ScoutScientificQuery): ScoutCandidate[] {
  const byRepository = new Map<string, LocalRecipeRecord[]>();
  for (const recipe of localRecipes) {
    if (!recipe.repository_key) continue;
    const values = byRepository.get(recipe.repository_key) || [];
    values.push(recipe);
    byRepository.set(recipe.repository_key, values);
  }
  return ragCandidates.map((candidate) => {
    if (!candidate.repository_key) return candidate;
    const exact = byRepository.get(candidate.repository_key) || [];
    if (!exact.length) return candidate;
    const records = exact.map((recipe) => ({ recipe, memory: memoryRecord(recipe, query) }));
    const reusable = records.find(({ recipe, memory }) => isExecutableRecipe(recipe.card) && !memory.boundary);
    const boundaries = records.filter(({ memory }) => memory.boundary);
    if (reusable) return {
      ...candidate,
      origin: "repository_memory",
      title: reusable.recipe.card.recipe_id,
      summary: reusable.recipe.description,
      recipe_path: reusable.recipe.path,
      recipe_card: reusable.recipe.card,
      memory_records: records.map(({ memory }) => memory),
    };
    if (boundaries.length) {
      const first = boundaries[0];
      const boundaryBasis = first.memory.conflicts.length
        ? "compatibility_conflict" as const
        : first.recipe.card.kind === "reference"
          ? "reference_scope" as const
          : first.recipe.card.status === "watchlist"
            ? "watchlist" as const
            : "generic" as const;
      const reason = first.memory.conflicts[0]
        || (first.recipe.card.kind === "reference"
          ? first.recipe.card.summary || "known non-executable repository boundary for this request"
          : "")
        || (first.recipe.card.status === "watchlist" ? "repository Recipe is on the watchlist" : "known repository boundary");
      return {
        ...candidate,
        origin: "repository_memory",
        title: first.recipe.card.recipe_id,
        summary: first.recipe.description,
        recipe_path: first.recipe.path,
        recipe_card: first.recipe.card,
        memory_records: records.map(({ memory }) => memory),
        known_boundary: true,
        boundary_basis: boundaryBasis,
        matched_use_when: first.memory.use_when.filter((item) => conditionMatches(item, query)),
        matched_avoid_when: [],
        boundary_evidence: uniqueStrings([
          ...first.memory.conflicts,
          ...(first.recipe.card.kind === "reference" ? [first.recipe.card.summary, ...first.recipe.card.source.evidence_refs] : []),
        ]),
        boundary_reason: reason,
      };
    }
    return { ...candidate, memory_records: records.map(({ memory }) => memory) };
  });
}

function mergeCandidate(left: ScoutCandidate, right: ScoutCandidate): ScoutCandidate {
  const preferred = right.origin === "repository_memory" || (!left.recipe_card && right.recipe_card) ? right : left;
  const repositoryOptions = [...(left.repository_options || []), ...(right.repository_options || [])]
    .reduce<ScoutRepositoryOption[]>((merged, option) => {
      const existing = merged.find((item) => item.repository_key === option.repository_key);
      if (!existing) merged.push({ ...option });
      else {
        existing.order = Math.min(existing.order, option.order);
        if (existing.relation === "unknown" && option.relation !== "unknown") existing.relation = option.relation;
      }
      return merged;
    }, [])
    .sort((leftOption, rightOption) => leftOption.order - rightOption.order);
  const retrieval = [...left.retrieval, ...right.retrieval].filter((item, index, all) => all.findIndex((other) => (
    other.round === item.round
    && other.query === item.query
    && other.source_id === item.source_id
    && other.rank === item.rank
  )) === index);
  return {
    ...left,
    ...preferred,
    candidate_id: left.candidate_id || preferred.candidate_id,
    paper_key: left.paper_key || right.paper_key,
    ...(repositoryOptions.length ? { repository_options: repositoryOptions } : {}),
    parent_candidate_id: left.parent_candidate_id || right.parent_candidate_id,
    retrieval,
    memory_records: [...left.memory_records, ...right.memory_records].filter((item, index, all) => all.findIndex((other) => other.recipe_path === item.recipe_path) === index),
    known_boundary: left.known_boundary === true || right.known_boundary === true,
    boundary_basis: right.boundary_basis || left.boundary_basis,
    matched_use_when: uniqueStrings([...(left.matched_use_when || []), ...(right.matched_use_when || [])]),
    matched_avoid_when: uniqueStrings([...(left.matched_avoid_when || []), ...(right.matched_avoid_when || [])]),
    boundary_evidence: uniqueStrings([...(left.boundary_evidence || []), ...(right.boundary_evidence || [])]),
    boundary_reason: right.boundary_reason || left.boundary_reason,
  };
}

function candidateKey(candidate: ScoutCandidate): string {
  if (candidate.repository_key) return `repo:${candidate.repository_key}`;
  if (candidate.recipe_path) return `path:${resolve(candidate.recipe_path)}`;
  return `paper:${candidate.paper_key || candidate.retrieval[0]?.source_id || candidate.title.toLowerCase()}`;
}

function stableCandidateId(candidate: ScoutCandidate): string {
  const key = candidateKey(candidate);
  const kind = key.startsWith("repo:") ? "repo" : key.startsWith("paper:") ? "paper" : "local";
  return `${kind}:${createHash("sha256").update(key).digest("hex").slice(0, 16)}`;
}

function withStableIdentity(candidate: ScoutCandidate): ScoutCandidate {
  return { ...candidate, candidate_id: stableCandidateId(candidate) };
}

export function assertStableCandidateIdentities(candidates: ScoutCandidate[]): void {
  const byId = new Map<string, string>();
  for (const candidate of candidates) {
    const id = compact(candidate.candidate_id);
    if (!id) throw new Error("RecipeScout candidate is missing a stable candidate_id");
    const key = candidateKey(candidate);
    const previous = byId.get(id);
    if (previous && previous !== key) throw new Error(`RecipeScout candidate_id collision: ${id}`);
    byId.set(id, key);
  }
}

export function combineFirstClassCandidatePools(local: ScoutCandidate[], rag: ScoutCandidate[], existing: ScoutCandidate[] = []): ScoutCandidate[] {
  const interleaved: ScoutCandidate[] = [];
  const maximum = Math.max(local.length, rag.length);
  for (let index = 0; index < maximum; index += 1) {
    if (local[index]) interleaved.push(local[index]);
    if (rag[index]) interleaved.push(rag[index]);
  }
  const combined = existing.map(withStableIdentity);
  const positions = new Map(combined.map((candidate, index) => [candidateKey(candidate), index]));
  for (const rawCandidate of interleaved) {
    const candidate = withStableIdentity(rawCandidate);
    const key = candidateKey(candidate);
    const position = positions.get(key);
    if (position === undefined) {
      positions.set(key, combined.length);
      combined.push(candidate);
    } else {
      combined[position] = mergeCandidate(combined[position], candidate);
    }
  }
  let nextId = combined.reduce((maximumId, candidate) => {
    const match = /^C(\d+)$/.exec(candidate.display_id || "");
    return Math.max(maximumId, Number(match?.[1] || 0));
  }, 0) + 1;
  for (const candidate of combined) if (!candidate.display_id) candidate.display_id = `C${nextId++}`;
  assertStableCandidateIdentities(combined);
  return combined;
}

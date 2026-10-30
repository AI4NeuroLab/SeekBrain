import { readdir, readFile, writeFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import {
  lookupValidatedRepositoryScripts,
  materializeRepository,
  REPOSITORY_SOURCE_EXTRACTOR_VERSION,
  type MaterializedRepository,
  type ValidatedRepositoryScripts,
} from "./repository-cache.ts";
import type {
  ScoutCapabilityEvidence,
  ScoutCandidate,
  ScoutFailureCode,
  ScoutInspectionFile,
  ScoutRepositoryInspection,
  ScoutScientificQuery,
} from "./scout-types.ts";

export interface RepositoryInspectorOptions {
  lookupValidatedRepositoryScripts?: (repositoryUrl: string) => Promise<ValidatedRepositoryScripts | undefined>;
  materializeRepository?: (repositoryUrl: string, question: string, title: string, signal?: AbortSignal) => Promise<MaterializedRepository>;
  evidenceCharLimit?: number;
}

const CODE_SUFFIXES = new Set([".py", ".r", ".rmd", ".qmd", ".ipynb", ".m", ".jl", ".js", ".ts", ".sh"]);
const INSPECTION_SUFFIXES = new Set([...CODE_SUFFIXES, ".md", ".txt", ".yaml", ".yml", ".json"]);
const EXCLUDED_DIRECTORIES = new Set([".git", "node_modules", "data", "datasets", "results", "figures", "dist", "build"]);

function compact(value: unknown): string {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function bounded(value: string, limit: number): string {
  const text = String(value || "").trim();
  return text.length <= limit ? text : `${text.slice(0, limit).trim()}\n…`;
}

function fileSummary(path: string, content: string): string {
  const signatures = content.match(/^\s*(?:(?:def|class|function)\s+[^\n{]+|[A-Za-z.][A-Za-z0-9._]*\s*<-\s*function\s*\([^\n]*)/gm)?.slice(0, 5) || [];
  const headings = content.match(/^#{1,3}\s+.+$/gm)?.slice(0, 5) || [];
  return compact([...headings, ...signatures].join("; ")) || `${extname(path).slice(1) || "text"} repository evidence`;
}

const CAPABILITY_PATTERNS: Array<{ capability: string; pattern: RegExp; centralWhen: RegExp }> = [
  { capability: "clustering", pattern: /\b(?:FindClusters|FindNeighbors|kmeans|hdbscan|leiden|louvain|hierarchical\s+clust|hclust|cluster(?:ing|_subtypes?)?)\b/i, centralWhen: /\b(?:cluster|subtype|cell\s+type|classif)\b/i },
  { capability: "classification and prediction", pattern: /\b(?:xgboost|random\s*forest|classifier|classification|predict\s*\(|train_test_split|cross[_ -]?validation)\b/i, centralWhen: /\b(?:classif|predict|decode|subtype|cell\s+type)\b/i },
  { capability: "marker analysis", pattern: /\b(?:FindAllMarkers|FindMarkers|marker(?:s|_genes?)?|differential(?:ly)?\s+express)\b/i, centralWhen: /\b(?:marker|gene|expression|subtype|cell\s+type)\b/i },
  { capability: "expression thresholding or binarization", pattern: /(?:\bbinari[sz](?:e|ed|ation|ing)?\b|\b(?:expression|expr|counts?|transcripts?|rna|mrna|genes?)\w*\s*(?:>=?|<=?)\s*[-+]?\d|\b(?:rowSums|colSums)\s*\([^\n)]*(?:>=?|<=?)[^\n)]*\))/i, centralWhen: /\b(?:expression|gene|rna|transcript|barcode|co[- ]expression|subtype)\b/i },
  { capability: "average or aggregate expression", pattern: /\b(?:AverageExpression|AggregateExpression|rowMeans|colMeans|aggregate\s*\(|groupby\s*\()/i, centralWhen: /\b(?:expression|gene|rna|transcript|group|summary)\b/i },
  { capability: "co-expression analysis", pattern: /\b(?:co[-_ ]expression|gene[-_ ]gene\s+correlation|cor\s*\([^\n]*(?:expression|expr(?:ession)?_matrix|gene_matrix)|corrcoef\s*\([^\n]*(?:expression|expr|gene))\b/i, centralWhen: /\b(?:co[- ]expression|expression|gene|subtype)\b/i },
  { capability: "PCA or UMAP embedding", pattern: /\b(?:RunPCA|RunUMAP|prcomp|PCA\s*\(|UMAP\s*\(|umap\s*\(|scanpy\.tl\.pca)\b/i, centralWhen: /\b(?:pca|umap|embedding|dimension|cluster|subtype)\b/i },
  { capability: "ordered expression heatmap", pattern: /\b(?:(?:ComplexHeatmap::)?Heatmap\s*\(|pheatmap(?:::pheatmap)?\s*\(|heatmap\s*\(|DotPlot\s*\(|clustermap\s*\()/i, centralWhen: /\b(?:heatmap|matrix|expression|ordered|visuali[sz]|subtype)\b/i },
];

function deduplicateCapabilityEvidence(evidence: ScoutCapabilityEvidence[]): ScoutCapabilityEvidence[] {
  const byCapability = new Map<string, ScoutCapabilityEvidence>();
  for (const item of evidence) {
    const previous = byCapability.get(item.capability);
    if (!previous || (item.central && !previous.central)) byCapability.set(item.capability, item);
  }
  return [...byCapability.values()];
}

function sourceLocation(content: string, index: number): string {
  const prefix = content.slice(0, index);
  const line = prefix.split("\n").length;
  const marker = prefix.split("\n").reverse().find((value) => /^# (?:Source lines|Notebook cell)\b/.test(value));
  return marker ? marker.replace(/^#\s*/, "") : `line ${line}`;
}

function evidenceSnippet(content: string, index: number, length: number): string {
  const start = Math.max(0, content.lastIndexOf("\n", index - 120) + 1);
  const endLine = content.indexOf("\n", index + length + 180);
  return compact(content.slice(start, endLine < 0 ? Math.min(content.length, index + length + 180) : endLine)).slice(0, 360);
}

function capabilityEvidence(path: string, content: string, query: ScoutScientificQuery): ScoutCapabilityEvidence[] {
  if (!CODE_SUFFIXES.has(extname(path.toLowerCase()))) return [];
  const queryText = `${query.objective} ${query.query_text} ${query.method_query_text}`;
  const evidence: ScoutCapabilityEvidence[] = [];
  for (const rule of CAPABILITY_PATTERNS) {
    const flags = rule.pattern.flags.includes("g") ? rule.pattern.flags : `${rule.pattern.flags}g`;
    const pattern = new RegExp(rule.pattern.source, flags);
    const match = pattern.exec(content);
    if (!match) continue;
    evidence.push({
      capability: rule.capability,
      path,
      location: sourceLocation(content, match.index),
      evidence: evidenceSnippet(content, match.index, match[0].length),
      central: rule.centralWhen.test(queryText),
    });
  }
  if (!evidence.length) {
    const signature = /^\s*(?:(?:def|class|function)\s+[^\n{]+|[A-Za-z.][A-Za-z0-9._]*\s*<-\s*function\s*\([^\n]*)/m.exec(content);
    const queryTokens = new Set(queryText.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []);
    const overlap = [...new Set(content.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [])].filter((token) => token.length > 4 && queryTokens.has(token));
    if (signature && overlap.length >= 2) evidence.push({
      capability: "task-related executable analysis function",
      path,
      location: sourceLocation(content, signature.index),
      evidence: evidenceSnippet(content, signature.index, signature[0].length),
      central: true,
    });
  }
  return evidence;
}

function evidenceStrength(evidence: ScoutCapabilityEvidence[], validated = false): ScoutRepositoryInspection["evidence_strength"] {
  const central = new Set(evidence.filter((item) => item.central).map((item) => item.capability)).size;
  if (validated || central >= 2) return "strong";
  if (central === 1) return "moderate";
  if (evidence.length >= 2) return "moderate";
  if (evidence.length === 1) return "weak";
  return "none";
}

function formattedCapabilityEvidence(evidence: ScoutCapabilityEvidence[]): string {
  return evidence.map((item) => `- ${item.capability} — ${item.path}:${item.location}\n  ${item.evidence}`).join("\n");
}

async function localTree(root: string, maximumFiles = 120): Promise<string[]> {
  const queue = [root];
  const paths: string[] = [];
  while (queue.length && paths.length < maximumFiles) {
    const directory = queue.shift()!;
    let entries;
    try { entries = await readdir(directory, { withFileTypes: true }); }
    catch { continue; }
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      if (paths.length >= maximumFiles) break;
      const path = join(directory, entry.name);
      const relativePath = relative(root, path).replaceAll("\\", "/");
      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRECTORIES.has(entry.name) && !entry.name.startsWith(".")) queue.push(path);
      } else if (entry.isFile()) {
        paths.push(relativePath);
      }
    }
  }
  return paths;
}

function rankLocalPath(path: string): number {
  const lower = path.toLowerCase();
  if (lower === "skill.md") return 100;
  if (lower === "recipe-card.json" || lower === "metadata.json") return 90;
  if (/readme/.test(lower)) return 80;
  if (CODE_SUFFIXES.has(extname(lower))) return /analysis|cluster|subtype|pipeline|main|run|model/.test(lower) ? 70 : 55;
  return 10;
}

async function inspectLocal(candidate: ScoutCandidate, query: ScoutScientificQuery, evidenceCharLimit: number): Promise<ScoutRepositoryInspection> {
  const root = String(candidate.recipe_path || "");
  if (!root) return {
    candidate_id: candidate.candidate_id,
    ok: false,
    candidate_files: [],
    tree_paths: [],
    evidence_excerpt: "",
    executable_signals: [],
    capability_evidence: [],
    evidence_strength: "none",
    hard_blockers: ["local Recipe path is missing"],
    adaptation_gaps: [],
    extractor_version: REPOSITORY_SOURCE_EXTRACTOR_VERSION,
    failure_code: "no_executable_workflow",
    error: "local Recipe path is missing",
    reused: true,
  };
  const tree = await localTree(root);
  const selected = tree.filter((path) => INSPECTION_SUFFIXES.has(extname(path.toLowerCase())) || path === "SKILL.md")
    .sort((left, right) => rankLocalPath(right) - rankLocalPath(left) || left.localeCompare(right))
    .slice(0, 6);
  const files: ScoutInspectionFile[] = [];
  const excerpts: string[] = [];
  const capabilities: ScoutCapabilityEvidence[] = [];
  for (const path of selected) {
    try {
      const localPath = join(root, path);
      const content = await readFile(localPath, "utf8");
      files.push({ path, local_path: localPath, summary: fileSummary(path, content) });
      const extracted = capabilityEvidence(path, content, query);
      capabilities.push(...extracted);
      if (!extracted.length) excerpts.push(`### ${path}\n${bounded(content, path === "SKILL.md" ? 3_500 : 1_800)}`);
    } catch { /* unreadable file is omitted */ }
  }
  const distinctCapabilities = deduplicateCapabilityEvidence(capabilities);
  const code = files.filter((file) => CODE_SUFFIXES.has(extname(file.path.toLowerCase())));
  const executable = candidate.recipe_card?.kind !== "reference" && code.length > 0;
  return {
    candidate_id: candidate.candidate_id,
    ok: executable,
    ...(candidate.repository_url ? { repository_url: candidate.repository_url } : {}),
    ...(candidate.repository_key ? { repository_key: candidate.repository_key } : {}),
    recipe_path: root,
    candidate_files: files,
    tree_paths: tree,
    evidence_excerpt: bounded(distinctCapabilities.length ? formattedCapabilityEvidence(distinctCapabilities) : excerpts.join("\n\n"), evidenceCharLimit),
    executable_signals: distinctCapabilities.map((item) => `${item.capability}: ${item.path}:${item.location}`),
    capability_evidence: distinctCapabilities,
    evidence_strength: evidenceStrength(distinctCapabilities),
    hard_blockers: executable ? [] : ["Recipe memory is non-executable or exposes no usable method contract"],
    adaptation_gaps: [],
    extractor_version: REPOSITORY_SOURCE_EXTRACTOR_VERSION,
    ...(!executable ? { failure_code: "no_executable_workflow" as ScoutFailureCode, error: "Recipe memory is non-executable or exposes no usable method contract" } : {}),
    reused: true,
  };
}

async function readEvidenceFile(path: string, limit: number): Promise<string> {
  try { return bounded(await readFile(path, "utf8"), limit); }
  catch { return ""; }
}

function materializedFailure(candidate: ScoutCandidate, materialized: MaterializedRepository): ScoutRepositoryInspection {
  return {
    candidate_id: candidate.candidate_id,
    ok: false,
    repository_url: materialized.repository_url || candidate.repository_url,
    repository_key: materialized.repository_key || candidate.repository_key,
    source_commit: materialized.source_commit,
    candidate_files: [],
    tree_paths: materialized.tree_paths || [],
    evidence_excerpt: "",
    executable_signals: [],
    capability_evidence: [],
    evidence_strength: "none",
    hard_blockers: [materialized.error || "repository could not be materialized"],
    adaptation_gaps: [],
    extractor_version: REPOSITORY_SOURCE_EXTRACTOR_VERSION,
    failure_code: "no_executable_workflow",
    error: materialized.error || "repository could not be materialized",
    reused: materialized.reused,
  };
}

async function persistedInspection(materialized: MaterializedRepository): Promise<ScoutRepositoryInspection | undefined> {
  if (!materialized.repository_dir || !materialized.source_commit) return undefined;
  try {
    const value = JSON.parse(await readFile(join(materialized.repository_dir, `inspection-${REPOSITORY_SOURCE_EXTRACTOR_VERSION}.json`), "utf8")) as ScoutRepositoryInspection;
    if (value.repository_key !== materialized.repository_key || value.source_commit !== materialized.source_commit || value.extractor_version !== REPOSITORY_SOURCE_EXTRACTOR_VERSION) return undefined;
    return value;
  } catch {
    return undefined;
  }
}

async function persistInspection(materialized: MaterializedRepository, inspection: ScoutRepositoryInspection): Promise<void> {
  if (!materialized.repository_dir || !materialized.source_commit) return;
  try {
    await writeFile(join(materialized.repository_dir, `inspection-${REPOSITORY_SOURCE_EXTRACTOR_VERSION}.json`), `${JSON.stringify(inspection, null, 2)}\n`, "utf8");
  } catch { /* cache writes are best-effort */ }
}

export class RepositoryInspector {
  readonly lookupValidated: NonNullable<RepositoryInspectorOptions["lookupValidatedRepositoryScripts"]>;
  readonly materialize: NonNullable<RepositoryInspectorOptions["materializeRepository"]>;
  readonly evidenceCharLimit: number;
  readonly inspectionCache = new Map<string, ScoutRepositoryInspection>();

  constructor(options: RepositoryInspectorOptions = {}) {
    this.lookupValidated = options.lookupValidatedRepositoryScripts || ((url) => lookupValidatedRepositoryScripts(url));
    this.materialize = options.materializeRepository || ((url, question, title, signal) => materializeRepository(url, question, title, {}, signal));
    this.evidenceCharLimit = Math.max(4_000, Math.min(24_000, Number(options.evidenceCharLimit ?? 14_000)));
  }

  async inspect(candidate: ScoutCandidate, query: ScoutScientificQuery, signal?: AbortSignal): Promise<ScoutRepositoryInspection> {
    if (candidate.known_boundary) return {
      candidate_id: candidate.candidate_id,
      ok: false,
      repository_url: candidate.repository_url,
      repository_key: candidate.repository_key,
      recipe_path: candidate.recipe_path,
      candidate_files: [],
      tree_paths: [],
      evidence_excerpt: candidate.boundary_reason || "Known repository boundary",
      executable_signals: [],
      capability_evidence: [],
      evidence_strength: "none",
      hard_blockers: [candidate.boundary_reason || "known repository boundary"],
      adaptation_gaps: [],
      extractor_version: REPOSITORY_SOURCE_EXTRACTOR_VERSION,
      failure_code: "no_executable_workflow",
      error: candidate.boundary_reason || "known repository boundary",
      reused: true,
    };
    if (candidate.recipe_path) return await inspectLocal(candidate, query, this.evidenceCharLimit);
    if (!candidate.repository_url) return {
      candidate_id: candidate.candidate_id,
      ok: false,
      candidate_files: [],
      tree_paths: [],
      evidence_excerpt: candidate.retrieval[0]?.paper_text || candidate.summary,
      executable_signals: [],
      capability_evidence: [],
      evidence_strength: "none",
      hard_blockers: ["candidate has no implementation repository"],
      adaptation_gaps: [],
      extractor_version: REPOSITORY_SOURCE_EXTRACTOR_VERSION,
      failure_code: "no_executable_workflow",
      error: "candidate has no implementation repository",
      reused: false,
    };

    const validated = await this.lookupValidated(candidate.repository_url);
    if (validated) {
      const recipe = await readEvidenceFile(validated.recipe_path, 7_000);
      const script = await readEvidenceFile(validated.script_path, 6_000);
      const capabilities = capabilityEvidence(validated.script_path, script, query);
      if (!capabilities.length) capabilities.push({
        capability: "previously validated executable analysis workflow",
        path: validated.script_path,
        location: "validated script",
        evidence: fileSummary(validated.script_path, script),
        central: true,
      });
      const distinctCapabilities = deduplicateCapabilityEvidence(capabilities);
      return {
        candidate_id: candidate.candidate_id,
        ok: true,
        repository_url: validated.repository_url,
        repository_key: validated.repository_key,
        source_commit: validated.source_commit,
        validated_recipe_path: validated.recipe_path,
        validated_script_path: validated.script_path,
        candidate_files: [
          { path: validated.recipe_path, local_path: validated.recipe_path, summary: "previously validated Recipe" },
          { path: validated.script_path, local_path: validated.script_path, summary: fileSummary(validated.script_path, script) },
        ],
        tree_paths: [validated.recipe_path, validated.script_path, validated.utility_path].filter(Boolean) as string[],
        evidence_excerpt: bounded(formattedCapabilityEvidence(distinctCapabilities) || `### Validated Recipe\n${recipe}\n\n### Validated script\n${script}`, this.evidenceCharLimit),
        executable_signals: distinctCapabilities.map((item) => `${item.capability}: ${item.path}:${item.location}`),
        capability_evidence: distinctCapabilities,
        evidence_strength: evidenceStrength(distinctCapabilities, true),
        hard_blockers: [],
        adaptation_gaps: [],
        extractor_version: REPOSITORY_SOURCE_EXTRACTOR_VERSION,
        reused: true,
      };
    }

    const materialized = await this.materialize(candidate.repository_url, query.query_text, candidate.title, signal);
    if (!materialized.ok) return materializedFailure(candidate, materialized);
    const cacheKey = `${materialized.repository_key}@${materialized.source_commit || "unknown"}:${REPOSITORY_SOURCE_EXTRACTOR_VERSION}`;
    const cached = this.inspectionCache.get(cacheKey);
    if (cached) return { ...cached, candidate_id: candidate.candidate_id, reused: true };
    const persisted = await persistedInspection(materialized);
    if (persisted) {
      this.inspectionCache.set(cacheKey, persisted);
      return { ...persisted, candidate_id: candidate.candidate_id, reused: true };
    }
    const files: ScoutInspectionFile[] = materialized.candidate_files.map((file) => ({ path: file.path, local_path: file.local_path, summary: file.summary }));
    const code = files.filter((file) => CODE_SUFFIXES.has(extname(file.path.toLowerCase())));
    const excerpts: string[] = [];
    const capabilities: ScoutCapabilityEvidence[] = [];
    for (const file of files) {
      const content = await readEvidenceFile(String(file.local_path || ""), /readme/i.test(file.path) ? 6_000 : 60_000);
      if (!content) continue;
      const extracted = capabilityEvidence(file.path, content, query);
      capabilities.push(...extracted);
      if (!extracted.length) excerpts.push(`### ${file.path}\n${bounded(content, /readme/i.test(file.path) ? 3_500 : 1_800)}`);
    }
    const distinctCapabilities = deduplicateCapabilityEvidence(capabilities);
    const executable = code.length > 0;
    const inspection: ScoutRepositoryInspection = {
      candidate_id: candidate.candidate_id,
      ok: executable,
      repository_url: materialized.repository_url,
      repository_key: materialized.repository_key,
      source_commit: materialized.source_commit,
      candidate_files: files,
      tree_paths: materialized.tree_paths || files.map((file) => file.path),
      evidence_excerpt: bounded(distinctCapabilities.length ? formattedCapabilityEvidence(distinctCapabilities) : excerpts.join("\n\n"), this.evidenceCharLimit),
      executable_signals: distinctCapabilities.map((item) => `${item.capability}: ${item.path}:${item.location}`),
      capability_evidence: distinctCapabilities,
      evidence_strength: evidenceStrength(distinctCapabilities),
      hard_blockers: executable ? [] : ["repository inspection found no executable analysis files"],
      adaptation_gaps: [],
      extractor_version: REPOSITORY_SOURCE_EXTRACTOR_VERSION,
      ...(!executable ? { failure_code: "no_executable_workflow" as ScoutFailureCode, error: "repository inspection found no executable analysis files" } : {}),
      reused: materialized.reused,
    };
    this.inspectionCache.set(cacheKey, inspection);
    await persistInspection(materialized, inspection);
    return inspection;
  }
}

export async function inspectScoutCandidates(
  inspector: RepositoryInspector,
  candidates: ScoutCandidate[],
  query: ScoutScientificQuery,
  concurrency = 2,
  signal?: AbortSignal,
): Promise<ScoutRepositoryInspection[]> {
  const results = new Array<ScoutRepositoryInspection>(candidates.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(Math.max(1, concurrency), Math.max(1, candidates.length)) }, async () => {
    while (next < candidates.length) {
      const index = next++;
      results[index] = await inspector.inspect(candidates[index], query, signal);
    }
  });
  await Promise.all(workers);
  return results;
}

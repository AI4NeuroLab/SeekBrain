import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { parse as parseYaml } from "yaml";

type Json = Record<string, any>;

export const RECIPE_KINDS = ["analysis", "preprocess", "visualization", "validation", "reference"] as const;
export type RecipeKind = (typeof RECIPE_KINDS)[number];

export const RECIPE_STATUSES = ["candidate", "provisional", "active", "watchlist"] as const;
export type RecipeStatus = (typeof RECIPE_STATUSES)[number];

export const RECIPE_ROLES = ["primary", "supporting", "visualization", "validation"] as const;
export type RecipeRole = (typeof RECIPE_ROLES)[number];

export interface RecipeDataContract {
  species: string[];
  modalities: string[];
  observation_units: string[];
  requires: string[];
}

export interface RecipeSource {
  type: "builtin" | "expert" | "trajectory" | "rag" | "repository" | "legacy";
  evidence_refs: string[];
  repository_url?: string;
  source_commit?: string;
}

export interface RecipeQuality {
  passed_runs: number;
  recipe_attributed_failures: number;
  confidence?: number;
}

export interface RecipeCard {
  schema_version: 1;
  recipe_id: string;
  version: string;
  status: RecipeStatus;
  kind: RecipeKind;
  summary: string;
  aliases: string[];
  does: string[];
  evidence_for: string[];
  accepts: RecipeDataContract;
  /** Modalities that the executable method directly operates on. */
  primary_modalities?: string[];
  /** Modalities used only as annotations, atlases, or surrounding context. */
  context_modalities?: string[];
  /** Explicitly declared cross-modality transfer roles, if any. */
  transferable_roles?: string[];
  produces: string[];
  use_when: string[];
  avoid_when: string[];
  source: RecipeSource;
  quality: RecipeQuality;
}

export interface RecipeRequirement {
  id: string;
  text: string;
  kind: "analysis" | "evidence" | "visualization";
  workstream_id?: string;
}

export interface RecipeQuery {
  schema_version: 1;
  question: string;
  objective: string;
  biological_scope: string[];
  requirements: RecipeRequirement[];
  accepts: Pick<RecipeDataContract, "species" | "modalities" | "observation_units">;
}

export interface RecipeSelection {
  recipe_id: string;
  path: string;
  role: RecipeRole;
  score: number;
  reason: string;
  covers: string[];
  source?: "local" | "repository_memory" | "rag_repository" | "rag_paper";
  repository_url?: string;
}

export interface RecipeSet {
  schema_version: 1;
  selected: RecipeSelection[];
  uncovered_requirement_ids: string[];
  complete: boolean;
}

export function isExecutableRecipe(card: Pick<RecipeCard, "kind">): boolean {
  return card.kind !== "reference";
}

const PHRASE_ALIASES: Array<[string[], string]> = [
  [["preprocess", "preprocessing", "denoise", "quality control", "预处理", "质控", "去噪"], "preprocess"],
  [["segment", "segmentation", "spike sorting", "分割", "分选"], "segmentation"],
  [["register", "registration", "alignment", "atlas alignment", "配准", "对齐"], "registration"],
  [["feature extraction", "representation", "fingerprint", "特征提取", "表征", "指纹"], "feature_extraction"],
  [["compare", "comparison", "difference", "differential", "group effect", "比较", "差异"], "group_comparison"],
  [["correlation", "association", "coupling", "相关", "关联", "耦合"], "association"],
  [["regression", "glm", "linear model", "回归"], "regression"],
  [["decode", "decoding", "classification", "classifier", "预测", "解码", "分类"], "decoding"],
  [["cluster", "clustering", "hdbscan", "聚类"], "clustering"],
  [["pca", "umap", "tsne", "embedding", "dimensionality", "降维", "嵌入"], "dimensionality_reduction"],
  [["connectivity", "connectome", "network", "functional connectivity", "连接组", "网络", "功能连接"], "connectivity"],
  [["trajectory", "progression", "longitudinal", "time course", "轨迹", "进展", "纵向"], "trajectory_analysis"],
  [["atlas map", "cortical map", "surface map", "map back", "regional map", "脑图谱", "皮层映射", "区域映射"], "spatial_mapping"],
  [["visualize", "visualization", "plot", "figure", "heatmap", "scatter", "可视化", "绘图", "热图"], "visualization"],
  [["enrichment", "gene ontology", "pathway", "富集", "通路"], "enrichment"],
  [["time series", "temporal", "dynamics", "psth", "时间序列", "动态"], "temporal_dynamics"],
  [["latent state", "hidden state", "hmm", "潜在状态", "隐状态"], "latent_state"],
  [["structure function", "structure-function", "结构功能"], "structure_function_coupling"],
  [["behavior", "behaviour", "行为"], "behavioral_encoding"],
  [["stimulus", "tuning", "刺激", "调谐"], "stimulus_encoding"],
  [["cell type", "subtype", "细胞类型", "亚型"], "cell_type_specificity"],
  [["disease", "disorder", "patient", "疾病", "患者"], "disease_related"],
  [["regional", "anatomical", "brain region", "区域", "解剖"], "regional_localization"],
  [["multimodal", "multi-modal", "cross-modal", "多模态", "跨模态"], "multimodal_coupling"],
];

const SPECIES: Array<[string[], string]> = [
  [["human", "patient", "clinical", "人类", "患者"], "human"],
  [["mouse", "mice", "murine", "小鼠"], "mouse"],
  [["zebrafish", "danio", "larval fish", "斑马鱼"], "zebrafish"],
  [["macaque", "monkey", "猕猴"], "macaque"],
  [["marmoset", "绒猴"], "marmoset"],
  [["drosophila", "fly", "果蝇"], "drosophila"],
  [["c elegans", "c_elegans", "worm", "线虫"], "c_elegans"],
];

const MODALITIES: Array<[string[], string]> = [
  [["fmri", "functional magnetic resonance", "bold"], "fmri"],
  [["calcium", "gcamp", "two photon", "2p", "ca imaging", "钙成像"], "calcium"],
  [["spike", "ephys", "electrophysiology", "neuropixels", "电生理"], "spike"],
  [["behavior", "behaviour", "pose", "tracking", "行为"], "behavior"],
  [["spatial transcriptomics", "stereo seq", "visium", "merfish", "空间转录组"], "spatial_transcriptomics"],
  [["gene", "omics", "transcriptomic", "expression", "基因", "组学", "表达"], "omics"],
  [["swc", "morphology", "reconstruction", "形态", "重建"], "morphology"],
  [["connectome", "connectivity matrix", "graph", "连接组", "连接矩阵"], "connectome"],
  [["atlas", "brain region", "图谱", "脑区"], "atlas"],
  [["video", "影像视频", "视频"], "video"],
  [["electron microscopy", " em ", "电镜"], "electron_microscopy"],
];

function compact(value: unknown): string {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(compact).filter(Boolean))];
}

function slug(value: unknown): string {
  return compact(value).toLowerCase().replace(/[\s-]+/g, "_").replace(/[^a-z0-9_]+/g, "").replace(/_+/g, "_").replace(/^_|_$/g, "");
}

function normalizedTerms(value: unknown): string[] {
  return [...new Set(strings(value).map(slug).filter(Boolean))];
}

function includesPhrase(text: string, phrase: string): boolean {
  const normalized = text.toLowerCase().replace(/[_-]+/g, " ");
  return normalized.includes(phrase.toLowerCase().replace(/[_-]+/g, " "));
}

function inferredTerms(text: string): string[] {
  return [...new Set(PHRASE_ALIASES.flatMap(([aliases, canonical]) => aliases.some((alias) => includesPhrase(text, alias)) ? [canonical] : []))];
}

function inferredFacet(text: string, vocabulary: Array<[string[], string]>): string[] {
  return [...new Set(vocabulary.flatMap(([aliases, canonical]) => aliases.some((alias) => includesPhrase(` ${text} `, alias)) ? [canonical] : []))];
}

function frontmatter(text: string): Json {
  if (!text.startsWith("---")) return {};
  const end = text.indexOf("\n---", 3);
  if (end < 0) return {};
  try { return parseYaml(text.slice(3, end)) || {}; }
  catch { return {}; }
}

async function readJson(path: string): Promise<Json> {
  try { return JSON.parse(await readFile(path, "utf8")) as Json; }
  catch { return {}; }
}

async function readCard(path: string): Promise<Json> {
  try {
    const text = await readFile(path, "utf8");
    return path.endsWith(".json") ? JSON.parse(text) as Json : parseYaml(text) || {};
  } catch {
    return {};
  }
}

function inferredSource(directory: string, metadata: Json): RecipeSource {
  const normalized = directory.replaceAll("\\", "/").toLowerCase();
  const explicit = String(metadata.source?.type || metadata.source_type || "");
  const type = explicit === "builtin" || explicit === "expert" || explicit === "trajectory" || explicit === "rag" || explicit === "repository" || explicit === "legacy"
    ? explicit
    : normalized.includes("/from_rag/") || metadata.evidence_level ? "rag"
      : normalized.includes("/from_expert/") ? "expert"
        : normalized.includes("/builtin/") || normalized.includes("/recipes/") ? "builtin"
          : "trajectory";
  return {
    type,
    evidence_refs: strings(metadata.source?.evidence_refs || metadata.evidence_refs || metadata.matched_repo_files),
    ...(metadata.repository_url || metadata.repo_link ? { repository_url: String(metadata.repository_url || metadata.repo_link) } : {}),
    ...(metadata.source_commit ? { source_commit: String(metadata.source_commit) } : {}),
  };
}

function inferredKind(name: string, text: string, evidenceLevel: unknown): RecipeKind {
  if (evidenceLevel === "paper_only") return "reference";
  if (/^(?:ns[_-])?vis(?:[_-]|$)/i.test(name) || /\b(?:visuali[sz](?:e|ation)?|plot|figure|heatmap|scatter)\b/i.test(name)) return "visualization";
  if (/^(?:ns[_-])?(?:pre|seg|reg|feat)(?:[_-]|$)/i.test(name)) return "preprocess";
  if (/\bvalidation\b/i.test(`${name} ${text.slice(0, 500)}`)) return "validation";
  return "analysis";
}

function status(value: unknown, source: RecipeSource): RecipeStatus {
  const normalized = String(value || "").toLowerCase();
  if ((RECIPE_STATUSES as readonly string[]).includes(normalized)) return normalized as RecipeStatus;
  return source.type === "rag" ? "candidate" : "active";
}

function dataContract(value: unknown, fallbackText: string): RecipeDataContract {
  const input = value && typeof value === "object" ? value as Json : {};
  return {
    species: normalizedTerms(input.species).length ? normalizedTerms(input.species) : inferredFacet(fallbackText, SPECIES),
    modalities: normalizedTerms(input.modalities).length ? normalizedTerms(input.modalities) : inferredFacet(fallbackText, MODALITIES),
    observation_units: normalizedTerms(input.observation_units || input.observation_unit),
    requires: normalizedTerms(input.requires),
  };
}

function modalityRoles(explicit: Json, accepts: RecipeDataContract): Pick<RecipeCard, "primary_modalities" | "context_modalities" | "transferable_roles"> {
  const declaredContext = normalizedTerms(explicit.context_modalities);
  const inferredContext = declaredContext.length
    ? declaredContext
    : accepts.modalities.length > 1 && accepts.modalities.includes("atlas")
      ? ["atlas"]
      : [];
  const declaredPrimary = normalizedTerms(explicit.primary_modalities);
  const inferredPrimary = declaredPrimary.length
    ? declaredPrimary
    : accepts.modalities.filter((modality) => !inferredContext.includes(modality));
  return {
    primary_modalities: inferredPrimary.length ? inferredPrimary : accepts.modalities,
    context_modalities: inferredContext,
    transferable_roles: normalizedTerms(explicit.transferable_roles),
  };
}

export async function loadRecipeCard(directory: string, skillText?: string): Promise<RecipeCard> {
  const text = skillText ?? await readFile(join(directory, "SKILL.md"), "utf8");
  const yaml = frontmatter(text);
  const metadata = await readJson(join(directory, "metadata.json"));
  const explicit = Object.keys(await readCard(join(directory, "recipe-card.json"))).length
    ? await readCard(join(directory, "recipe-card.json"))
    : await readCard(join(directory, "recipe-card.yaml"));
  const name = compact(explicit.recipe_id || yaml.name || metadata.tag || basename(directory));
  const summary = compact(explicit.summary || yaml.description || metadata.yaml_metadata?.description || "(no description)");
  const aliases = strings(explicit.aliases || [...strings(yaml.triggers || metadata.yaml_metadata?.triggers), ...strings(yaml.tags || metadata.yaml_metadata?.tags)]);
  const source = inferredSource(directory, { ...metadata, ...(explicit.source ? { source: explicit.source } : {}) });
  const searchable = [name, summary, aliases.join(" "), text.slice(0, 4000)].join(" ");
  const kind = (RECIPE_KINDS as readonly string[]).includes(String(explicit.kind)) ? explicit.kind as RecipeKind : inferredKind(name, searchable, metadata.evidence_level);
  const does = kind === "reference" ? [] : normalizedTerms(explicit.does).length ? normalizedTerms(explicit.does) : inferredTerms(searchable);
  const inferredEvidence = inferredTerms(`${summary} ${aliases.join(" ")}`).filter((term) => [
    "regional_localization", "temporal_dynamics", "trajectory_analysis", "structure_function_coupling",
    "behavioral_encoding", "stimulus_encoding", "cell_type_specificity", "disease_related", "multimodal_coupling",
    "latent_state", "connectivity",
  ].includes(term));
  const qualityInput = explicit.quality && typeof explicit.quality === "object" ? explicit.quality as Json : metadata.quality || {};
  const accepts = dataContract(explicit.accepts, searchable);
  return {
    schema_version: 1,
    recipe_id: name,
    version: compact(explicit.version || yaml.version || metadata.version || "1.0.0"),
    status: status(explicit.status || metadata.lifecycle?.status, source),
    kind,
    summary,
    aliases,
    does,
    evidence_for: kind === "reference" ? [] : normalizedTerms(explicit.evidence_for).length ? normalizedTerms(explicit.evidence_for) : inferredEvidence,
    accepts,
    ...modalityRoles(explicit, accepts),
    produces: kind === "reference" ? [] : normalizedTerms(explicit.produces),
    use_when: strings(explicit.use_when || yaml.triggers),
    avoid_when: strings(explicit.avoid_when),
    source: {
      ...source,
      ...(explicit.source && typeof explicit.source === "object" ? {
        evidence_refs: strings(explicit.source.evidence_refs || source.evidence_refs),
        ...(explicit.source.repository_url ? { repository_url: String(explicit.source.repository_url) } : {}),
        ...(explicit.source.source_commit ? { source_commit: String(explicit.source.source_commit) } : {}),
      } : {}),
    },
    quality: {
      passed_runs: Math.max(0, Number(qualityInput.passed_runs || 0)),
      recipe_attributed_failures: Math.max(0, Number(qualityInput.recipe_attributed_failures || 0)),
      ...(Number.isFinite(Number(qualityInput.confidence)) ? { confidence: Number(qualityInput.confidence) } : {}),
    },
  };
}

export function validateRecipeCard(card: RecipeCard): { ok: boolean; issues: string[]; warnings: string[] } {
  const issues: string[] = [];
  const warnings: string[] = [];
  if (!card.recipe_id.trim()) issues.push("recipe_id is required");
  if (!card.summary.trim()) issues.push("summary is required");
  if (!(RECIPE_KINDS as readonly string[]).includes(card.kind)) issues.push(`unsupported kind '${card.kind}'`);
  if (!(RECIPE_STATUSES as readonly string[]).includes(card.status)) issues.push(`unsupported status '${card.status}'`);
  if (card.kind !== "reference" && !card.does.length) warnings.push("does is empty; retrieval will rely on summary and aliases");
  if (!card.use_when.length) warnings.push("use_when is empty");
  if (!card.avoid_when.length) warnings.push("avoid_when is empty");
  return { ok: issues.length === 0, issues, warnings };
}

export function recipeRetrievalText(card: RecipeCard): string {
  return [
    card.recipe_id,
    card.summary,
    ...card.does,
    ...card.produces,
    ...card.accepts.requires,
    ...card.use_when,
  ].join(" ");
}

function inferQueryData(text: string): Pick<RecipeDataContract, "species" | "modalities" | "observation_units"> {
  return { species: inferredFacet(text, SPECIES), modalities: inferredFacet(text, MODALITIES), observation_units: [] };
}

export function inferRecipeAccepts(input: { text: string; data_contract?: Json }): Pick<RecipeDataContract, "species" | "modalities" | "observation_units"> {
  const inferred = inferQueryData(input.text);
  const supplied = input.data_contract && typeof input.data_contract === "object" ? input.data_contract : {};
  return {
    species: normalizedTerms(supplied.species).length ? normalizedTerms(supplied.species) : inferred.species,
    modalities: normalizedTerms(supplied.modalities).length ? normalizedTerms(supplied.modalities) : inferred.modalities,
    observation_units: normalizedTerms(supplied.observation_units || supplied.observation_unit),
  };
}

export function buildRecipeQuery(input: { question: string; task_brief?: Json; data_contract?: Json }): RecipeQuery {
  const brief = input.task_brief && typeof input.task_brief === "object" ? input.task_brief : {};
  const question = compact(input.question);
  const objective = compact(brief.scientific_goal || question);
  const biologicalScope = strings(brief.biological_scope);
  const rawRequirements: Array<{ id?: string; text: string; kind: RecipeRequirement["kind"]; workstream_id?: string }> = [
    ...strings(brief.hard_constraints).map((text) => ({ text, kind: "analysis" as const })),
    ...strings(brief.requested_data).map((text) => ({ text, kind: "evidence" as const })),
    ...strings(brief.output_preferences).map((text) => ({ text, kind: "visualization" as const })),
  ];
  if (!rawRequirements.length) rawRequirements.push({ text: objective, kind: "analysis" });
  const seen = new Set<string>();
  const usedIds = new Set<string>();
  const requirements = rawRequirements.flatMap((requirement) => {
    const key = requirement.text.toLowerCase();
    if (!requirement.text || seen.has(key)) return [];
    seen.add(key);
    let id = requirement.id && !usedIds.has(requirement.id) ? requirement.id : `R${seen.size}`;
    while (usedIds.has(id)) id = `R${Number(id.slice(1) || 0) + 1}`;
    usedIds.add(id);
    return [{
      id,
      text: requirement.text,
      kind: requirement.kind,
      ...(requirement.workstream_id ? { workstream_id: requirement.workstream_id } : {}),
    }];
  });
  return {
    schema_version: 1,
    question,
    objective,
    biological_scope: biologicalScope,
    requirements,
    accepts: inferRecipeAccepts({
      text: `${question} ${objective} ${biologicalScope.join(" ")} ${requirements.map((item) => item.text).join(" ")}`,
      data_contract: input.data_contract,
    }),
  };
}

export function inferSemanticTerms(text: string): string[] {
  return inferredTerms(text);
}

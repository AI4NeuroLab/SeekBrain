import type { RecipeCard } from "./recipe-card.ts";

export type Json = Record<string, any>;

export const SCOUT_CANDIDATE_ORIGINS = [
  "local",
  "repository_memory",
  "rag_repository",
  "rag_paper",
] as const;

export type ScoutCandidateOrigin = (typeof SCOUT_CANDIDATE_ORIGINS)[number];

export const SCOUT_METHOD_ROLES = [
  "scientific_backbone",
  "supporting",
  "adapter",
  "reference",
  "reject",
] as const;

export type ScoutMethodRole = (typeof SCOUT_METHOD_ROLES)[number];

export const SCOUT_TRANSFER_LEVELS = ["direct", "near", "structural", "none"] as const;
export type ScoutTransferLevel = (typeof SCOUT_TRANSFER_LEVELS)[number];

export const SCOUT_FAILURE_CODES = [
  "upstream_only",
  "reference_mapping_only",
  "paper_repo_mismatch",
  "no_executable_workflow",
  "scientifically_unrelated",
] as const;

export type ScoutFailureCode = (typeof SCOUT_FAILURE_CODES)[number];

export interface ScoutScientificQuery {
  schema_version: 1;
  raw_question: string;
  objective: string;
  biological_scope: string[];
  data_abstraction: string[];
  hard_constraints: string[];
  output_preferences: string[];
  /** Explicit target-dataset species inferred from the question and dataset metadata. */
  species: string[];
  /** Short evidence excerpts supporting the species decision. */
  species_evidence: string[];
  /** General domain-oriented retrieval query. */
  query_text: string;
  /** General method-oriented retrieval query. */
  method_query_text: string;
}

export interface ScoutQueryInterpretationInput {
  question: string;
  dataset_metadata: string;
}

export type ScoutRetrievalQueryKind = "domain" | "method" | "retry";

export interface ScoutPaperEvidenceChunk {
  heading?: string;
  text: string;
  score: number;
}

export interface ScoutRetrievalEvidence {
  round: 1 | 2;
  query: string;
  query_kind?: ScoutRetrievalQueryKind;
  rank: number;
  score?: number;
  source_id?: string;
  paper_title?: string;
  paper_text?: string;
  paper_chunks?: ScoutPaperEvidenceChunk[];
  repository_relation?: string;
}

export interface ScoutRepositoryOption {
  repository_url: string;
  repository_key: string;
  relation: string;
  order: number;
}

export interface ScoutMemoryRecord {
  recipe_path: string;
  recipe_id: string;
  kind: RecipeCard["kind"];
  status: RecipeCard["status"];
  compatible: boolean;
  conflicts: string[];
  matched_avoid_when: string[];
  use_when: string[];
  avoid_when: string[];
  boundary: boolean;
}

export interface ScoutCandidate {
  candidate_id: string;
  /** Human-readable round-local label. Internal joins must use candidate_id. */
  display_id?: string;
  origin: ScoutCandidateOrigin;
  title: string;
  summary: string;
  recipe_path?: string;
  repository_url?: string;
  repository_key?: string;
  /** Stable normalized Paper identity used to merge Q1/Q2 recall. */
  paper_key?: string;
  /** Repository links retained on a Paper until after scientific triage. */
  repository_options?: ScoutRepositoryOption[];
  /** Paper candidate that produced this delayed repository child. */
  parent_candidate_id?: string;
  recipe_card?: RecipeCard;
  retrieval: ScoutRetrievalEvidence[];
  memory_records: ScoutMemoryRecord[];
  known_boundary?: boolean;
  boundary_basis?: "compatibility_conflict" | "reference_scope" | "avoid_when" | "watchlist" | "generic";
  matched_use_when?: string[];
  matched_avoid_when?: string[];
  boundary_evidence?: string[];
  boundary_reason?: string;
}

export interface ScoutTriageDecision {
  candidate_id: string;
  inspect: boolean;
  priority: number;
  round_rank?: number;
  scientific_relevance?: "high" | "medium" | "low";
  hypothesized_capabilities?: string[];
  reason: string;
  failure_code?: ScoutFailureCode;
  /** Compatibility-only hints from older triage implementations. */
  role?: ScoutMethodRole;
  transfer_level?: ScoutTransferLevel;
}

export interface ScoutTriageInput {
  scientific_query: ScoutScientificQuery;
  candidates: ScoutCandidate[];
  inspection_budget: number;
  round: 1 | 2;
}

export interface ScoutTriageResult {
  decisions: ScoutTriageDecision[];
  warnings?: string[];
}

export interface ScoutInspectionFile {
  path: string;
  local_path?: string;
  summary: string;
}

export interface ScoutCapabilityEvidence {
  capability: string;
  path: string;
  location: string;
  evidence: string;
  central: boolean;
}

export type ScoutEvidenceStrength = "strong" | "moderate" | "weak" | "none";

export interface ScoutRepositoryInspection {
  candidate_id: string;
  ok: boolean;
  repository_url?: string;
  repository_key?: string;
  source_commit?: string;
  recipe_path?: string;
  validated_recipe_path?: string;
  validated_script_path?: string;
  candidate_files: ScoutInspectionFile[];
  tree_paths: string[];
  evidence_excerpt: string;
  executable_signals: string[];
  capability_evidence: ScoutCapabilityEvidence[];
  evidence_strength: ScoutEvidenceStrength;
  hard_blockers: string[];
  adaptation_gaps: string[];
  extractor_version: string;
  failure_code?: ScoutFailureCode;
  error?: string;
  reused: boolean;
}

export type ScoutRetryMode = "recovery" | "improvement";

export interface ScoutFinalSelection {
  candidate_id: string;
  role: "scientific_backbone" | "supporting";
  transfer_level?: Exclude<ScoutTransferLevel, "none">;
  evidence_strength?: ScoutEvidenceStrength;
  reason: string;
  adaptation_gaps?: string[];
  executable_capabilities?: string[];
}

export interface ScoutFinalizeInput {
  scientific_query: ScoutScientificQuery;
  candidates: ScoutCandidate[];
  triage: ScoutTriageDecision[];
  inspections: ScoutRepositoryInspection[];
  round: 1 | 2;
  retry_mode?: ScoutRetryMode;
  previous_result?: ScoutFinalizeResult;
}

export interface ScoutFinalizeResult {
  selected: ScoutFinalSelection[];
  retry_query?: string;
  retry_reason?: string;
  retry_mode?: ScoutRetryMode;
  unresolved_gap?: string;
  retained_incumbent?: string;
  decision_change_reason?: string;
  warnings?: string[];
}

export interface MethodPackMethod {
  candidate_id: string;
  role: "scientific_backbone" | "supporting";
  transfer_level: Exclude<ScoutTransferLevel, "none">;
  title: string;
  summary: string;
  reason: string;
  adaptation_gaps: string[];
  origin: ScoutCandidateOrigin;
  recipe_path?: string;
  repository_url?: string;
  repository_key?: string;
  source_commit?: string;
  reference_files: string[];
  executable_capabilities: string[];
  evidence_strength: ScoutEvidenceStrength;
  improvement_retry?: boolean;
}

export interface MethodPackPaperEvidence {
  candidate_id: string;
  paper_key?: string;
  title: string;
  source_ids: string[];
  chunks: ScoutPaperEvidenceChunk[];
}

export interface MethodPack {
  schema_version: 1;
  status: "matched" | "no_match";
  scientific_query: ScoutScientificQuery;
  primary?: MethodPackMethod;
  supporting?: MethodPackMethod;
  paper_evidence: MethodPackPaperEvidence[];
  downstream_constraints: string[];
  warnings: string[];
  retry?: {
    performed: boolean;
    mode?: ScoutRetryMode;
    retained_incumbent?: string;
    decision_change_reason?: string;
  };
}

export interface ScoutRoundTrace {
  round: 1 | 2;
  query: string;
  queries?: string[];
  rag_top_k: number;
  candidate_ids: string[];
  paper_candidate_ids?: string[];
  expanded_repository_candidate_ids?: string[];
  retry_mode?: ScoutRetryMode;
  triage: ScoutTriageDecision[];
  inspected_candidate_ids: string[];
  finalization: ScoutFinalizeResult;
}

export const SCOUT_REPOSITORY_EXPANSION_ACTIONS = [
  "inspection_shortlist",
  "known_boundary",
  "duplicate_repository",
  "paper_not_selected",
  "budget_exhausted",
] as const;

export type ScoutRepositoryExpansionAction = (typeof SCOUT_REPOSITORY_EXPANSION_ACTIONS)[number];

export interface ScoutRepositoryExpansionTrace {
  round: 1 | 2;
  parent_candidate_id: string;
  repository_url: string;
  repository_key: string;
  relation: string;
  action: ScoutRepositoryExpansionAction;
  repository_candidate_id?: string;
  reason: string;
}

export interface RecipeScoutTrace {
  schema_version: 1;
  trace_id: string;
  resolution_mode: "recipe_scout_v2";
  scientific_query: ScoutScientificQuery;
  budgets: {
    rag_rounds: number;
    initial_rag_top_k: number;
    retry_rag_top_k: number;
    repository_inspections: number;
    inspection_concurrency: number;
    selected_methods: number;
  };
  paper_candidates: ScoutCandidate[];
  candidates: ScoutCandidate[];
  repository_expansions: ScoutRepositoryExpansionTrace[];
  inspections: ScoutRepositoryInspection[];
  rounds: ScoutRoundTrace[];
  method_pack: MethodPack;
  warnings: string[];
}

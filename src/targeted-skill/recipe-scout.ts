import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import type { LiteratureQueryClient } from "../literature-compat/contracts.ts";
import {
  applyExactRepositoryMemory,
  assertStableCandidateIdentities,
  buildScoutScientificQuery,
  combineFirstClassCandidatePools,
  loadLocalRecipeIndex,
  normalizeScoutScientificQuery,
  retrieveRagCandidates,
  type LocalRecipeRecord,
  type RagRecallResult,
} from "./candidate-retrieval.ts";
import { RepositoryInspector, inspectScoutCandidates, type RepositoryInspectorOptions } from "./repository-inspector.ts";
import {
  SCOUT_FAILURE_CODES,
  SCOUT_TRANSFER_LEVELS,
  type Json,
  type MethodPackPaperEvidence,
  type MethodPack,
  type MethodPackMethod,
  type RecipeScoutTrace,
  type ScoutCandidate,
  type ScoutCapabilityEvidence,
  type ScoutEvidenceStrength,
  type ScoutFailureCode,
  type ScoutFinalizeInput,
  type ScoutFinalizeResult,
  type ScoutFinalSelection,
  type ScoutRepositoryExpansionTrace,
  type ScoutRepositoryInspection,
  type ScoutRepositoryOption,
  type ScoutQueryInterpretationInput,
  type ScoutRetryMode,
  type ScoutRoundTrace,
  type ScoutScientificQuery,
  type ScoutTransferLevel,
  type ScoutTriageDecision,
  type ScoutTriageInput,
  type ScoutTriageResult,
} from "./scout-types.ts";

export interface RecipeScoutV2Options extends RepositoryInspectorOptions {
  packageTrajectoryDir?: string;
  ensureTrajectoryDir?: () => Promise<string>;
  userSkillsRoot?: string;
  interpretScientificQuery?: (input: ScoutQueryInterpretationInput, signal?: AbortSignal) => Promise<Json>;
  triageCandidates?: (input: ScoutTriageInput, signal?: AbortSignal) => Promise<ScoutTriageResult>;
  finalizeCandidates?: (input: ScoutFinalizeInput, signal?: AbortSignal) => Promise<ScoutFinalizeResult>;
}

interface ScoutBudgets {
  ragRounds: number;
  initialRagTopK: number;
  retryRagTopK: number;
  localTopK: number;
  inspections: number;
  initialInspectionLimit: number;
  inspectionConcurrency: number;
  selectedMethods: number;
}

const TRANSFER_SET = new Set<string>(SCOUT_TRANSFER_LEVELS);
const FAILURE_SET = new Set<string>(SCOUT_FAILURE_CODES);

function compact(value: unknown): string {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(compact).filter(Boolean))];
}

function bool(value: unknown, fallback: boolean): boolean {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "string") return !["0", "false", "no", "off"].includes(value.toLowerCase());
  return Boolean(value);
}

function integer(value: unknown, fallback: number, minimum: number, maximum: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(minimum, Math.min(maximum, Math.floor(parsed))) : fallback;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map(compact).filter(Boolean))];
}

function uniquePaths(values: unknown[], root: string): string[] {
  return [...new Set(values.filter(Boolean).map(String).map((value) => isAbsolute(value) ? resolve(value) : resolve(root, value)))];
}

function budgets(input: Json): ScoutBudgets {
  const compatibility = input.compatibility && typeof input.compatibility === "object" ? input.compatibility as Json : {};
  const scout = compatibility.scout && typeof compatibility.scout === "object" ? compatibility.scout as Json : {};
  const inspections = integer(input.scout_repository_inspections ?? scout.repository_inspections, 4, 1, 6);
  return {
    ragRounds: integer(input.scout_rag_rounds ?? scout.rag_rounds, 2, 1, 2),
    initialRagTopK: integer(input.scout_initial_rag_top_k ?? scout.initial_rag_top_k, 8, 1, 20),
    retryRagTopK: integer(input.scout_retry_rag_top_k ?? scout.retry_rag_top_k, 4, 1, 10),
    localTopK: integer(input.scout_local_top_k ?? scout.local_top_k, 8, 1, 20),
    inspections,
    initialInspectionLimit: integer(input.scout_initial_inspection_limit ?? scout.initial_inspection_limit, Math.max(1, inspections - 1), 1, inspections),
    inspectionConcurrency: integer(input.scout_inspection_concurrency ?? scout.inspection_concurrency, 2, 1, 4),
    selectedMethods: integer(input.scout_selected_methods ?? scout.selected_methods, 2, 1, 2),
  };
}

function downstreamConstraints(input: Json, query: ScoutScientificQuery): string[] {
  void input;
  return unique([
    ...query.hard_constraints,
    ...query.output_preferences,
  ]).slice(0, 20);
}

function boundaryDecision(candidate: ScoutCandidate): ScoutTriageDecision {
  return {
    candidate_id: candidate.candidate_id,
    inspect: false,
    priority: 0,
    scientific_relevance: "low",
    hypothesized_capabilities: [],
    reason: candidate.boundary_reason || "exact repository memory marks this candidate outside the executable boundary for the current task",
    failure_code: "no_executable_workflow",
  };
}

function deterministicTriage(input: ScoutTriageInput): ScoutTriageResult {
  const decisions = input.candidates.map((candidate, index): ScoutTriageDecision => {
    if (candidate.known_boundary) return boundaryDecision(candidate);
    const hasExecutableSource = Boolean(candidate.repository_url || candidate.recipe_path || (candidate.repository_options || []).length);
    if (!hasExecutableSource) return {
      candidate_id: candidate.candidate_id,
      inspect: false,
      priority: 0,
      round_rank: index + 1,
      scientific_relevance: "medium",
      hypothesized_capabilities: [],
      reason: "paper evidence has no executable repository and is retained only as a reference",
      failure_code: "no_executable_workflow",
    };
    const inspect = true;
    return {
      candidate_id: candidate.candidate_id,
      inspect,
      priority: Math.max(0, Math.min(1, 1 - index / Math.max(1, input.candidates.length))),
      round_rank: index + 1,
      scientific_relevance: inspect ? "high" : "medium",
      hypothesized_capabilities: [],
      reason: inspect
        ? candidate.origin === "rag_paper"
          ? "scientifically relevant Paper group is eligible for fair repository expansion"
          : "high-ranked executable candidate requires lightweight repository inspection"
        : "kept outside the bounded inspection shortlist",
    };
  });
  return { decisions };
}

function normalizedTransfer(value: unknown, fallback: ScoutTransferLevel): ScoutTransferLevel {
  return TRANSFER_SET.has(String(value)) ? String(value) as ScoutTransferLevel : fallback;
}

function normalizedFailure(value: unknown): ScoutFailureCode | undefined {
  return FAILURE_SET.has(String(value)) ? String(value) as ScoutFailureCode : undefined;
}

function normalizeTriage(raw: ScoutTriageResult | undefined, input: ScoutTriageInput): ScoutTriageResult {
  const deterministic = deterministicTriage(input);
  if (!raw || !Array.isArray(raw.decisions)) return deterministic;
  const byId = new Map(raw.decisions.map((decision) => [compact(decision.candidate_id), decision]));
  const expectedIds = new Set(input.candidates.map((candidate) => candidate.candidate_id));
  const missingIds = input.candidates.map((candidate) => candidate.candidate_id).filter((candidateId) => !byId.has(candidateId));
  const unknownIds = [...byId.keys()].filter((candidateId) => !expectedIds.has(candidateId));
  const normalized = input.candidates.map((candidate) => {
    if (candidate.known_boundary) return boundaryDecision(candidate);
    const fallback = deterministic.decisions.find((decision) => decision.candidate_id === candidate.candidate_id)!;
    const hasExecutableSource = Boolean(candidate.repository_url || candidate.recipe_path || (candidate.repository_options || []).length);
    if (!hasExecutableSource) return fallback;
    const provided = byId.get(candidate.candidate_id);
    if (!provided) return fallback;
    const failureCode = normalizedFailure(provided.failure_code);
    return {
      candidate_id: candidate.candidate_id,
      inspect: provided.inspect === true,
      priority: Number.isFinite(Number(provided.priority)) ? Math.max(0, Math.min(1, Number(provided.priority))) : fallback.priority,
      round_rank: Number.isFinite(Number(provided.round_rank)) ? Math.max(1, Math.floor(Number(provided.round_rank))) : fallback.round_rank,
      scientific_relevance: provided.scientific_relevance === "high" || provided.scientific_relevance === "low" ? provided.scientific_relevance : "medium",
      hypothesized_capabilities: strings(provided.hypothesized_capabilities).slice(0, 8),
      reason: compact(provided.reason) || fallback.reason,
      ...(failureCode ? { failure_code: failureCode } : {}),
    } satisfies ScoutTriageDecision;
  });
  return {
    // `inspect` on a Paper group means eligible for delayed expansion. The
    // repository-level budget is enforced after triage, so multiple links from
    // one Paper cannot consume the shortlist before other Papers are seen.
    decisions: normalized,
    warnings: unique([
      ...strings(raw.warnings),
      ...(missingIds.length ? [`Triage omitted ${missingIds.length} candidate(s); deterministic decisions were used for: ${missingIds.join(", ")}`] : []),
      ...(unknownIds.length ? [`Triage returned ${unknownIds.length} unknown candidate ID(s), which were ignored: ${unknownIds.join(", ")}`] : []),
    ]),
  };
}

const REPOSITORY_RELATION_PRIORITY: Record<string, number> = {
  paper_analysis_code: 0,
  paper_model_code: 1,
  supplementary_code: 2,
  unknown: 3,
  dependency: 4,
  cited_resource: 5,
};

interface RepositoryExpansionPlan {
  candidates: ScoutCandidate[];
  triage: ScoutTriageDecision[];
  inspection_candidates: ScoutCandidate[];
  repository_candidate_ids: string[];
  trace: ScoutRepositoryExpansionTrace[];
}

interface ExpansionQueueItem {
  candidate: ScoutCandidate;
  decision: ScoutTriageDecision;
  parent?: ScoutCandidate;
  option?: ScoutRepositoryOption;
}

function repositoryLabel(repositoryUrl: string): string {
  const parts = repositoryUrl.replace(/\/+$/, "").split("/").filter(Boolean);
  return parts.slice(-2).join("/") || repositoryUrl;
}

function repositoryChild(parent: ScoutCandidate, option: ScoutRepositoryOption): ScoutCandidate {
  return {
    candidate_id: "",
    origin: "rag_repository",
    title: `${parent.title} — ${repositoryLabel(option.repository_url)}`,
    summary: parent.summary,
    repository_url: option.repository_url,
    repository_key: option.repository_key,
    paper_key: parent.paper_key,
    parent_candidate_id: parent.candidate_id,
    retrieval: parent.retrieval.map((item) => ({ ...item, repository_relation: option.relation })),
    memory_records: [],
  };
}

function repositoryCandidateSort(left: ExpansionQueueItem, right: ExpansionQueueItem): number {
  const leftMemory = left.candidate.origin === "repository_memory" ? 0 : 1;
  const rightMemory = right.candidate.origin === "repository_memory" ? 0 : 1;
  if (leftMemory !== rightMemory) return leftMemory - rightMemory;
  const leftRelation = REPOSITORY_RELATION_PRIORITY[left.option?.relation || "unknown"] ?? 6;
  const rightRelation = REPOSITORY_RELATION_PRIORITY[right.option?.relation || "unknown"] ?? 6;
  return leftRelation - rightRelation || (left.option?.order || 0) - (right.option?.order || 0);
}

function repositoryScheduleKey(candidate: ScoutCandidate): string {
  if (candidate.repository_key) return `repo:${candidate.repository_key}`;
  return `candidate:${candidate.candidate_id}`;
}

function mergeTriageDecisions(existing: ScoutTriageDecision[], incoming: ScoutTriageDecision[]): ScoutTriageDecision[] {
  const merged = new Map(existing.map((decision) => [decision.candidate_id, decision]));
  for (const decision of incoming) {
    const previous = merged.get(decision.candidate_id);
    if (!previous || (decision.inspect && !previous.inspect) || decision.priority > previous.priority) {
      merged.set(decision.candidate_id, decision);
    }
  }
  return [...merged.values()];
}

function expandRepositoryShortlist(input: {
  sourceCandidates: ScoutCandidate[];
  sourceTriage: ScoutTriageDecision[];
  existingCandidates?: ScoutCandidate[];
  localRecipes: LocalRecipeRecord[];
  scientificQuery: ScoutScientificQuery;
  inspectionBudget: number;
  round: 1 | 2;
  alreadyInspectedCandidateIds?: Set<string>;
  alreadyInspectedRepositoryKeys?: Set<string>;
}): RepositoryExpansionPlan {
  const decisionById = new Map(input.sourceTriage.map((decision) => [decision.candidate_id, decision]));
  const paperCandidates = input.sourceCandidates.filter((candidate) => candidate.origin === "rag_paper" && (candidate.repository_options || []).length > 0);
  const directCandidates = input.sourceCandidates.filter((candidate) => !paperCandidates.includes(candidate));
  let candidates = combineFirstClassCandidatePools([], directCandidates, input.existingCandidates || []);
  const trace: ScoutRepositoryExpansionTrace[] = [];
  const traceByOption = new Map<string, ScoutRepositoryExpansionTrace>();
  const queues: Array<{ priority: number; values: ExpansionQueueItem[] }> = [];
  const childrenToMerge: ScoutCandidate[] = [];
  const scheduledKeys = new Set<string>();
  const boundaryKeys = new Set<string>();
  const parentDecisionByKey = new Map<string, ScoutTriageDecision>();
  const occupiedRepositoryKeys = new Set(input.alreadyInspectedRepositoryKeys || []);
  const occupiedCandidateIds = new Set(input.alreadyInspectedCandidateIds || []);

  const isOccupied = (candidate: ScoutCandidate) => (
    occupiedCandidateIds.has(candidate.candidate_id)
    || (candidate.repository_key ? occupiedRepositoryKeys.has(candidate.repository_key) : false)
    || scheduledKeys.has(repositoryScheduleKey(candidate))
  );

  for (const paper of paperCandidates) {
    const decision = decisionById.get(paper.candidate_id);
    const eligible = decision?.inspect === true;
    const rawChildren = combineFirstClassCandidatePools([], (paper.repository_options || []).map((option) => repositoryChild(paper, option)));
    const rememberedChildren = applyExactRepositoryMemory(rawChildren, input.localRecipes, input.scientificQuery);
    const values: ExpansionQueueItem[] = [];
    for (const [index, option] of (paper.repository_options || []).entries()) {
      const child = rememberedChildren[index];
      const key = `${paper.candidate_id}:${option.repository_key}`;
      const row: ScoutRepositoryExpansionTrace = {
        round: input.round,
        parent_candidate_id: paper.candidate_id,
        repository_url: option.repository_url,
        repository_key: option.repository_key,
        relation: option.relation,
        action: eligible ? "budget_exhausted" : "paper_not_selected",
        reason: eligible
          ? "Paper passed scientific triage but the repository was not reached inside the bounded shortlist"
          : "Paper did not pass scientific triage for repository expansion",
      };
      trace.push(row);
      traceByOption.set(key, row);
      if (!eligible || !decision) continue;
      if (child.known_boundary) {
        row.action = "known_boundary";
        row.reason = child.boundary_reason || "exact repository memory marks this option as a known boundary";
        childrenToMerge.push(child);
        boundaryKeys.add(repositoryScheduleKey(child));
        const previous = parentDecisionByKey.get(repositoryScheduleKey(child));
        if (!previous || decision.priority > previous.priority) parentDecisionByKey.set(repositoryScheduleKey(child), decision);
        continue;
      }
      values.push({ candidate: child, decision, parent: paper, option });
    }
    if (values.length) queues.push({ priority: decision?.priority || 0, values: values.sort(repositoryCandidateSort) });
  }

  for (const candidate of directCandidates) {
    const decision = decisionById.get(candidate.candidate_id);
    if (!decision?.inspect || candidate.known_boundary) continue;
    queues.push({ priority: decision.priority, values: [{ candidate, decision }] });
  }
  queues.sort((left, right) => right.priority - left.priority);

  let scheduled = 0;
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const queue of queues) {
      const item = queue.values.shift();
      if (!item) continue;
      progressed = true;
      const key = repositoryScheduleKey(item.candidate);
      const row = item.parent && item.option ? traceByOption.get(`${item.parent.candidate_id}:${item.option.repository_key}`) : undefined;
      if (isOccupied(item.candidate)) {
        if (item.parent) childrenToMerge.push(item.candidate);
        if (row) {
          row.action = "duplicate_repository";
          row.reason = "the same repository was already shortlisted from local memory or another Paper";
        }
        continue;
      }
      if (scheduled >= input.inspectionBudget) continue;
      scheduled += 1;
      scheduledKeys.add(key);
      if (item.candidate.repository_key) occupiedRepositoryKeys.add(item.candidate.repository_key);
      else occupiedCandidateIds.add(item.candidate.candidate_id);
      if (item.parent) childrenToMerge.push(item.candidate);
      const previous = parentDecisionByKey.get(key);
      if (!previous || item.decision.priority > previous.priority) parentDecisionByKey.set(key, item.decision);
      if (row) {
        row.action = "inspection_shortlist";
        row.reason = item.candidate.origin === "repository_memory"
          ? "exact reusable Recipe memory was prioritized before remote repository inspection"
          : "selected by fair round-robin expansion across scientifically triaged Papers";
      }
    }
  }

  candidates = combineFirstClassCandidatePools([], childrenToMerge, candidates);
  const currentDecisions = new Map<string, ScoutTriageDecision>();
  for (const candidate of directCandidates) {
    const finalCandidate = candidates.find((value) => value.candidate_id === candidate.candidate_id);
    const original = decisionById.get(candidate.candidate_id);
    if (!finalCandidate || !original) continue;
    if (finalCandidate.known_boundary) currentDecisions.set(finalCandidate.candidate_id, boundaryDecision(finalCandidate));
    else currentDecisions.set(finalCandidate.candidate_id, {
      ...original,
      inspect: scheduledKeys.has(repositoryScheduleKey(finalCandidate)),
    });
  }

  for (const candidate of candidates) {
    const key = repositoryScheduleKey(candidate);
    const parentDecision = parentDecisionByKey.get(key);
    if (!parentDecision) continue;
    if (candidate.known_boundary || boundaryKeys.has(key)) currentDecisions.set(candidate.candidate_id, boundaryDecision(candidate));
    else if (scheduledKeys.has(key)) currentDecisions.set(candidate.candidate_id, {
      ...parentDecision,
      candidate_id: candidate.candidate_id,
      inspect: true,
      reason: `${parentDecision.reason}; repository option admitted after fair Paper-group expansion`,
    });
  }

  for (const row of trace) {
    const candidate = candidates.find((value) => value.repository_key === row.repository_key);
    if (candidate && row.action !== "paper_not_selected" && row.action !== "budget_exhausted") row.repository_candidate_id = candidate.candidate_id;
  }
  const triage = [...currentDecisions.values()];
  const priorityById = new Map(triage.map((decision) => [decision.candidate_id, decision.priority]));
  const inspectionCandidates = candidates
    .filter((candidate) => currentDecisions.get(candidate.candidate_id)?.inspect === true)
    .sort((left, right) => (priorityById.get(right.candidate_id) || 0) - (priorityById.get(left.candidate_id) || 0));
  return {
    candidates,
    triage,
    inspection_candidates: inspectionCandidates,
    repository_candidate_ids: unique(trace.map((row) => row.repository_candidate_id || "")),
    trace,
  };
}

function normalizedEvidenceStrength(value: unknown, fallback: ScoutEvidenceStrength): ScoutEvidenceStrength {
  return value === "strong" || value === "moderate" || value === "weak" || value === "none" ? value : fallback;
}

function finalizeResult(raw: ScoutFinalizeResult | undefined, input: ScoutFinalizeInput, maximumSelected: number): ScoutFinalizeResult {
  const candidates = new Map(input.candidates.map((candidate) => [candidate.candidate_id, candidate]));
  const selected: ScoutFinalSelection[] = [];
  const seenIds = new Set<string>();
  const seenRoles = new Set<string>();
  const warnings = strings(raw?.warnings);
  for (const value of Array.isArray(raw?.selected) ? raw.selected : []) {
    if (selected.length >= maximumSelected) {
      warnings.push(`ignored extra selected candidate '${compact(value.candidate_id)}'`);
      continue;
    }
    const candidateId = compact(value.candidate_id);
    const candidate = candidates.get(candidateId);
    if (!candidate) {
      warnings.push(`ignored unknown selected candidate '${candidateId}'`);
      continue;
    }
    if (candidate.known_boundary) {
      warnings.push(`ignored known-boundary candidate '${candidateId}'`);
      continue;
    }
    if (seenIds.has(candidateId)) {
      warnings.push(`ignored duplicate selected candidate '${candidateId}'`);
      continue;
    }
    const role = value.role === "scientific_backbone" || value.role === "supporting" ? value.role : undefined;
    if (!role || seenRoles.has(role)) {
      warnings.push(`ignored selected candidate '${candidateId}' with invalid or duplicate role`);
      continue;
    }
    const transfer = normalizedTransfer(value.transfer_level, "none");
    if (transfer === "none") {
      warnings.push(`ignored selected candidate '${candidateId}' with invalid transfer_level`);
      continue;
    }
    selected.push({
      candidate_id: candidateId,
      role,
      transfer_level: transfer,
      evidence_strength: normalizedEvidenceStrength(value.evidence_strength, "none"),
      reason: compact(value.reason).slice(0, 2_000) || "selected by RecipeScout finalizer",
      adaptation_gaps: strings(value.adaptation_gaps).slice(0, 12),
      executable_capabilities: strings(value.executable_capabilities).slice(0, 12),
    });
    seenIds.add(candidateId);
    seenRoles.add(role);
  }
  const retryMode = raw?.retry_mode === "recovery" || raw?.retry_mode === "improvement" ? raw.retry_mode : undefined;
  return {
    selected,
    ...(compact(raw?.retry_query) ? { retry_query: compact(raw?.retry_query).slice(0, 1000) } : {}),
    ...(compact(raw?.retry_reason) ? { retry_reason: compact(raw?.retry_reason) } : {}),
    ...(retryMode ? { retry_mode: retryMode } : {}),
    ...(compact(raw?.unresolved_gap) ? { unresolved_gap: compact(raw?.unresolved_gap) } : {}),
    ...(compact(raw?.retained_incumbent) && seenIds.has(compact(raw?.retained_incumbent)) ? { retained_incumbent: compact(raw?.retained_incumbent) } : {}),
    ...(compact(raw?.decision_change_reason) ? { decision_change_reason: compact(raw?.decision_change_reason).slice(0, 2_000) } : {}),
    warnings: unique(warnings),
  };
}

function deterministicFinalize(_input: ScoutFinalizeInput): ScoutFinalizeResult {
  return { selected: [], warnings: ["RecipeScout finalizer is unavailable; no candidate was selected."] };
}

function normalizeFinalize(raw: ScoutFinalizeResult | undefined, input: ScoutFinalizeInput, maximumSelected: number): ScoutFinalizeResult {
  return finalizeResult(raw, input, maximumSelected);
}

function failureDirectedRetry(query: ScoutScientificQuery): string {
  return compact(`${query.method_query_text}. Find an executable repository implementing the central requested method.`).slice(0, 1000);
}

function retryAssessment(
  query: ScoutScientificQuery,
  finalization: ScoutFinalizeResult,
): { mode: ScoutRetryMode; query: string; reason: string; unresolvedGap: string } | undefined {
  const primary = finalization.selected.find((item) => item.role === "scientific_backbone");
  if (!primary) {
    const unresolvedGap = compact(finalization.unresolved_gap) || "the finalizer selected no scientific backbone";
    return {
      mode: "recovery",
      query: compact(finalization.retry_query) || failureDirectedRetry(query),
      reason: compact(finalization.retry_reason) || unresolvedGap,
      unresolvedGap,
    };
  }
  if (finalization.retry_mode === "improvement") {
    const unresolvedGap = compact(finalization.unresolved_gap) || "the finalizer requested a closer executable method";
    return {
      mode: "improvement",
      query: compact(finalization.retry_query) || compact(`${query.method_query_text}. Find a closer executable repository for ${unresolvedGap}.`).slice(0, 1000),
      reason: compact(finalization.retry_reason) || unresolvedGap,
      unresolvedGap,
    };
  }
  return undefined;
}

function referenceFiles(inspection: ScoutRepositoryInspection | undefined): string[] {
  if (!inspection) return [];
  return unique([
    inspection.validated_script_path || "",
    inspection.validated_recipe_path || "",
    ...inspection.candidate_files.map((file) => file.local_path || ""),
  ]);
}

function methodFromSelection(
  selection: ScoutFinalSelection,
  candidates: ScoutCandidate[],
  inspections: ScoutRepositoryInspection[],
  finalization: ScoutFinalizeResult,
): MethodPackMethod | undefined {
  const candidate = candidates.find((item) => item.candidate_id === selection.candidate_id);
  if (!candidate) return undefined;
  const inspection = inspections.find((item) => item.candidate_id === selection.candidate_id);
  return {
    candidate_id: candidate.candidate_id,
    role: selection.role,
    transfer_level: selection.transfer_level || "structural",
    title: candidate.title,
    summary: candidate.summary,
    reason: selection.reason,
    adaptation_gaps: strings(selection.adaptation_gaps),
    origin: candidate.origin,
    ...(candidate.recipe_path ? { recipe_path: candidate.recipe_path } : {}),
    ...(candidate.repository_url ? { repository_url: candidate.repository_url } : {}),
    ...(candidate.repository_key ? { repository_key: candidate.repository_key } : {}),
    ...(inspection?.source_commit ? { source_commit: inspection.source_commit } : {}),
    reference_files: referenceFiles(inspection),
    executable_capabilities: strings(selection.executable_capabilities),
    evidence_strength: selection.evidence_strength || "none",
    improvement_retry: finalization.retry_mode === "improvement" || finalization.retained_incumbent !== undefined,
  };
}

function paperEvidence(
  paperCandidates: ScoutCandidate[],
  selectedCandidates: ScoutCandidate[],
): MethodPackPaperEvidence[] {
  const selectedPaperKeys = new Set(selectedCandidates.map((candidate) => candidate.paper_key).filter(Boolean));
  const ranked = paperCandidates.map((candidate) => {
    const chunks = candidate.retrieval.flatMap((item) => item.paper_chunks || []).filter((chunk, index, all) => all.findIndex((other) => other.text === chunk.text) === index)
      .sort((left, right) => right.score - left.score)
      .slice(0, 2);
    const bestRank = Math.min(...candidate.retrieval.map((item) => item.rank), 99);
    const relevance = Math.max(...candidate.retrieval.map((item) => Number(item.score || 0)), 0);
    const score = (candidate.paper_key && selectedPaperKeys.has(candidate.paper_key) ? 20 : 0)
      + Math.max(0, 10 - bestRank)
      + relevance
      + chunks.reduce((sum, chunk) => sum + chunk.score, 0);
    return { candidate, chunks, score };
  }).filter((item) => item.chunks.length).sort((left, right) => right.score - left.score).slice(0, 3);
  let remaining = 9_000;
  return ranked.flatMap(({ candidate, chunks }) => {
    const boundedChunks = chunks.flatMap((chunk) => {
      if (remaining <= 0) return [];
      const text = chunk.text.slice(0, remaining);
      remaining -= text.length;
      return [{ ...chunk, text }];
    });
    if (!boundedChunks.length) return [];
    return [{
      candidate_id: candidate.candidate_id,
      ...(candidate.paper_key ? { paper_key: candidate.paper_key } : {}),
      title: candidate.title,
      source_ids: unique(candidate.retrieval.map((item) => item.source_id || "")),
      chunks: boundedChunks,
    }];
  });
}

function buildMethodPack(
  query: ScoutScientificQuery,
  candidates: ScoutCandidate[],
  paperCandidates: ScoutCandidate[],
  inspections: ScoutRepositoryInspection[],
  finalization: ScoutFinalizeResult,
  constraints: string[],
  warnings: string[],
): MethodPack {
  const primarySelection = finalization.selected.find((selection) => selection.role === "scientific_backbone");
  const supportingSelection = finalization.selected.find((selection) => selection.role === "supporting");
  const primary = primarySelection ? methodFromSelection(primarySelection, candidates, inspections, finalization) : undefined;
  const supporting = supportingSelection ? methodFromSelection(supportingSelection, candidates, inspections, finalization) : undefined;
  return {
    schema_version: 1,
    status: primary ? "matched" : "no_match",
    scientific_query: query,
    ...(primary ? { primary } : {}),
    ...(supporting ? { supporting } : {}),
    paper_evidence: paperEvidence(paperCandidates, candidates.filter((candidate) => finalization.selected.some((selection) => selection.candidate_id === candidate.candidate_id))),
    downstream_constraints: constraints,
    warnings: unique(warnings),
    retry: {
      performed: finalization.retry_mode !== undefined || finalization.retained_incumbent !== undefined,
      ...(finalization.retry_mode ? { mode: finalization.retry_mode } : {}),
      ...(finalization.retained_incumbent ? { retained_incumbent: finalization.retained_incumbent } : {}),
      ...(finalization.decision_change_reason ? { decision_change_reason: finalization.decision_change_reason } : {}),
    },
  };
}

export function renderMethodGuidance(pack: MethodPack): string {
  const sections = [
    "# MethodPack guidance",
  ];
  const methodSection = (label: string, method: MethodPackMethod) => [
    "",
    `## ${label}`,
    "",
    `- Method: ${method.title}`,
    method.repository_url ? `- Repository: ${method.repository_url}` : "",
    method.recipe_path ? `- Local Recipe memory: ${method.recipe_path}` : "",
    `- Transfer level: ${method.transfer_level}`,
    `- Evidence strength: ${method.evidence_strength}`,
    `- Why useful: ${method.reason}`,
    method.reference_files.length ? `- Inspect these files first: ${method.reference_files.join(", ")}` : "",
    "",
    method.summary,
    ...(method.executable_capabilities.length ? [
      "",
      "Executable capabilities:",
      ...method.executable_capabilities.map((capability) => `- ${capability}`),
    ] : []),
    ...(method.adaptation_gaps.length ? ["", "Adaptation gaps:", ...method.adaptation_gaps.map((gap) => `- ${gap}`)] : []),
  ].filter(Boolean);
  if (pack.primary) sections.push(...methodSection("Scientific backbone", pack.primary));
  if (pack.supporting) sections.push(...methodSection("Optional supporting method", pack.supporting));
  if (pack.paper_evidence.length) sections.push(
    "",
    "## Relevant Paper method evidence",
    "",
    "Paper evidence is independent of repository admission and may guide task-specific protocol choices:",
    "",
    ...pack.paper_evidence.flatMap((paper) => [
      `### ${paper.title}`,
      "",
      ...paper.chunks.flatMap((chunk) => [
        chunk.heading ? `- ${chunk.heading}` : "- Relevant method passage",
        `  ${chunk.text}`,
      ]),
      "",
    ]),
  );
  if (!pack.primary) sections.push(
    "",
    "## Result",
    "",
    "No candidate passed scientific-backbone and executable-capability acceptance. Continue without a Recipe rather than forcing a weak match.",
  );
  return `${sections.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
}

async function writeArtifacts(traceDir: unknown, trace: RecipeScoutTrace, guidance: string): Promise<Json> {
  if (!traceDir) return {};
  const directory = resolve(String(traceDir));
  await mkdir(directory, { recursive: true });
  const methodPackPath = join(directory, "method_pack.json");
  const guidancePath = join(directory, "method_guidance.md");
  const tracePath = join(directory, "recipe_scout_trace.json");
  await Promise.all([
    writeFile(methodPackPath, `${JSON.stringify(trace.method_pack, null, 2)}\n`, "utf8"),
    writeFile(guidancePath, guidance, "utf8"),
    writeFile(tracePath, `${JSON.stringify(trace, null, 2)}\n`, "utf8"),
  ]);
  return { method_pack_json: methodPackPath, method_guidance_md: guidancePath, recipe_scout_trace_json: tracePath };
}

export class RecipeScoutV2 {
  readonly inspector: RepositoryInspector;

  constructor(readonly ragClient: LiteratureQueryClient, readonly options: RecipeScoutV2Options = {}) {
    this.inspector = new RepositoryInspector(options);
  }

  async triage(input: ScoutTriageInput, signal?: AbortSignal): Promise<ScoutTriageResult> {
    if (!this.options.triageCandidates) return deterministicTriage(input);
    try { return normalizeTriage(await this.options.triageCandidates(input, signal), input); }
    catch (error) {
      const fallback = deterministicTriage(input);
      return { ...fallback, warnings: [`RecipeScout triage agent failed; deterministic shortlist used: ${String(error)}`] };
    }
  }

  async finalize(input: ScoutFinalizeInput, maximumSelected: number, signal?: AbortSignal): Promise<ScoutFinalizeResult> {
    if (!this.options.finalizeCandidates) return deterministicFinalize(input);
    try { return normalizeFinalize(await this.options.finalizeCandidates(input, signal), input, maximumSelected); }
    catch (error) {
      const fallback = deterministicFinalize(input);
      return { ...fallback, warnings: [`RecipeScout finalizer failed; deterministic acceptance used: ${String(error)}`] };
    }
  }

  async resolve(input: Json, cwd = process.cwd(), signal?: AbortSignal): Promise<Json> {
    const traceId = compact(input.trace_id) || randomUUID();
    const queryCharLimit = integer(input.scout_query_char_limit, 1200, 400, 2400);
    const fallbackQuery = buildScoutScientificQuery(input, queryCharLimit);
    const scoutBudgets = budgets(input);
    const warnings: string[] = [];
    if (!fallbackQuery.raw_question) return {
      ok: false,
      matched: false,
      source: "none",
      resolution_mode: "recipe_scout_v2",
      targeted_skill: "",
      skill_paths: [],
      reference_paths: [],
      generated: false,
      warnings: ["question is required"],
      error: "question is required",
      trace_id: traceId,
    };
    let scientificQuery = fallbackQuery;
    if (this.options.interpretScientificQuery) {
      try {
        const interpreted = await this.options.interpretScientificQuery({
          question: fallbackQuery.raw_question,
          dataset_metadata: compact(input.dataset_metadata),
        }, signal);
        scientificQuery = normalizeScoutScientificQuery(interpreted, fallbackQuery.raw_question, queryCharLimit);
      } catch (error) {
        warnings.push(`RecipeScout query interpretation failed; original question used without inferred facets: ${String(error)}`);
      }
    }
    if (!bool(input.skill_enable, true)) return {
      ok: true,
      matched: false,
      source: "none",
      resolution_mode: "recipe_scout_v2",
      targeted_skill: "",
      skill_paths: [],
      reference_paths: [],
      generated: false,
      warnings: ["analysis recipe module disabled"],
      trace_id: traceId,
    };

    const projectRoot = resolve(input.root_dir || cwd);
    const userSkillsRoot = resolve(this.options.userSkillsRoot || join(homedir(), ".seekbrain", "skills"));
    const managedPromise = this.options.ensureTrajectoryDir ? this.options.ensureTrajectoryDir().catch((error) => {
      warnings.push(`managed Recipe repertoire unavailable: ${String(error)}`);
      return undefined;
    }) : Promise.resolve(undefined);
    const provider = compact(input.literature_provider || input.paper_source || "none");
    const ragAvailable = provider !== "none";
    const emptyRecall = (): RagRecallResult => ({ ok: true, candidates: [], warnings: [] });
    const ragRoundOnePromise: Promise<[RagRecallResult, RagRecallResult]> = ragAvailable
      ? Promise.all([
        retrieveRagCandidates({
          client: this.ragClient,
          query: scientificQuery.query_text,
          queryKind: "domain",
          round: 1,
          topK: scoutBudgets.initialRagTopK,
          cwd,
          providerInput: input,
          includePaperOnly: true,
          requireGithub: false,
          scientificQuery,
          signal,
        }),
        retrieveRagCandidates({
          client: this.ragClient,
          query: scientificQuery.method_query_text,
          queryKind: "method",
          round: 1,
          topK: scoutBudgets.initialRagTopK,
          cwd,
          providerInput: input,
          includePaperOnly: false,
          requireGithub: true,
          scientificQuery,
          signal,
        }),
      ])
      : Promise.resolve([emptyRecall(), emptyRecall()]);
    const managedTrajectory = await managedPromise;
    const primary = input.skill_dir || managedTrajectory || this.options.packageTrajectoryDir || join(projectRoot, "recipes");
    const extras = Array.isArray(input.extra_skill_dirs) ? input.extra_skill_dirs : [
      join(projectRoot, ".seekbrain", "skills", "from_expert"),
      join(userSkillsRoot, "from_expert"),
      join(userSkillsRoot, "from_rag"),
    ];
    const directories = uniquePaths([primary, managedTrajectory, ...extras], projectRoot);
    const localPromise = bool(input.match_skill_enable, true)
      ? loadLocalRecipeIndex(directories, scientificQuery, scoutBudgets.localTopK)
      : Promise.resolve({ all: [] as LocalRecipeRecord[], candidates: [] as ScoutCandidate[] });
    const [local, [ragDomain, ragMethod]] = await Promise.all([localPromise, ragRoundOnePromise]);
    for (const recall of [ragDomain, ragMethod]) {
      warnings.push(...recall.warnings);
      if (!recall.ok && recall.error) warnings.push(recall.error);
    }
    let ragQueryCount = ragAvailable ? 2 : 0;
    let paperCandidates = combineFirstClassCandidatePools(ragDomain.candidates, ragMethod.candidates);
    const sourceCandidatesOne = combineFirstClassCandidatePools(local.candidates, paperCandidates);
    assertStableCandidateIdentities(sourceCandidatesOne);
    const allInspections: ScoutRepositoryInspection[] = [];
    const rounds: ScoutRoundTrace[] = [];
    const repositoryExpansions: ScoutRepositoryExpansionTrace[] = [];

    const triageOne = await this.triage({
      scientific_query: scientificQuery,
      candidates: sourceCandidatesOne,
      inspection_budget: Math.min(scoutBudgets.initialInspectionLimit, scoutBudgets.inspections),
      round: 1,
    }, signal);
    warnings.push(...(triageOne.warnings || []));
    const expansionOne = expandRepositoryShortlist({
      sourceCandidates: sourceCandidatesOne,
      sourceTriage: triageOne.decisions,
      localRecipes: local.all,
      scientificQuery,
      inspectionBudget: Math.min(scoutBudgets.initialInspectionLimit, scoutBudgets.inspections),
      round: 1,
    });
    let candidates = expansionOne.candidates;
    assertStableCandidateIdentities(candidates);
    let allTriage = expansionOne.triage;
    repositoryExpansions.push(...expansionOne.trace);
    const inspectOne = expansionOne.inspection_candidates;
    allInspections.push(...await inspectScoutCandidates(this.inspector, inspectOne, scientificQuery, scoutBudgets.inspectionConcurrency, signal));
    const roundOneInspectedIds = [...inspectOne.map((candidate) => candidate.candidate_id)];
    const roundOneExpandedIds = [...expansionOne.repository_candidate_ids];
    let finalization = await this.finalize({
      scientific_query: scientificQuery,
      candidates,
      triage: allTriage,
      inspections: allInspections,
      round: 1,
    }, scoutBudgets.selectedMethods, signal);
    warnings.push(...(finalization.warnings || []));
    const roundOneFinalization = finalization;
    rounds.push({
      round: 1,
      query: scientificQuery.query_text,
      queries: ragAvailable ? [scientificQuery.query_text, scientificQuery.method_query_text] : [],
      rag_top_k: ragAvailable ? scoutBudgets.initialRagTopK : 0,
      candidate_ids: sourceCandidatesOne.map((candidate) => candidate.candidate_id),
      paper_candidate_ids: paperCandidates.map((candidate) => candidate.candidate_id),
      expanded_repository_candidate_ids: unique(roundOneExpandedIds),
      triage: triageOne.decisions,
      inspected_candidate_ids: unique(roundOneInspectedIds),
      finalization,
    });

    const remainingInspections = () => Math.max(0, scoutBudgets.inspections - allInspections.length);
    const retryPlan = retryAssessment(scientificQuery, finalization);
    if (retryPlan && ragAvailable && scoutBudgets.ragRounds > 1 && remainingInspections() > 0) {
      const retryQuery = retryPlan.query;
      const retry = await retrieveRagCandidates({
        client: this.ragClient,
        query: retryQuery,
        queryKind: "retry",
        round: 2,
        topK: scoutBudgets.retryRagTopK,
        cwd,
        providerInput: input,
        includePaperOnly: false,
        requireGithub: true,
        scientificQuery,
        signal,
      });
      warnings.push(...retry.warnings);
      if (!retry.ok && retry.error) warnings.push(retry.error);
      ragQueryCount += 1;
      const retryPaperKeys = new Set(retry.candidates.map((candidate) => candidate.paper_key).filter(Boolean));
      paperCandidates = combineFirstClassCandidatePools([], retry.candidates, paperCandidates);
      const retryPapers = paperCandidates.filter((candidate) => candidate.paper_key && retryPaperKeys.has(candidate.paper_key));
      const triageTwo = normalizeTriage(undefined, {
        scientific_query: scientificQuery,
        candidates: retryPapers,
        inspection_budget: remainingInspections(),
        round: 2,
      });
      const expansionTwo = expandRepositoryShortlist({
        sourceCandidates: retryPapers,
        sourceTriage: triageTwo.decisions,
        existingCandidates: candidates,
        localRecipes: local.all,
        scientificQuery,
        inspectionBudget: remainingInspections(),
        round: 2,
        alreadyInspectedCandidateIds: new Set(allInspections.map((inspection) => inspection.candidate_id)),
        alreadyInspectedRepositoryKeys: new Set(allInspections.map((inspection) => inspection.repository_key).filter(Boolean) as string[]),
      });
      candidates = expansionTwo.candidates;
      assertStableCandidateIdentities(candidates);
      allTriage = mergeTriageDecisions(allTriage, expansionTwo.triage);
      repositoryExpansions.push(...expansionTwo.trace);
      const inspectTwo = expansionTwo.inspection_candidates;
      allInspections.push(...await inspectScoutCandidates(this.inspector, inspectTwo, scientificQuery, scoutBudgets.inspectionConcurrency, signal));
      finalization = await this.finalize({
        scientific_query: scientificQuery,
        candidates,
        triage: allTriage,
        inspections: allInspections,
        round: 2,
        retry_mode: retryPlan.mode,
        previous_result: roundOneFinalization,
      }, scoutBudgets.selectedMethods, signal);
      finalization = {
        ...finalization,
        retry_mode: retryPlan.mode,
        retry_reason: retryPlan.reason,
        unresolved_gap: retryPlan.unresolvedGap,
      };
      warnings.push(...(finalization.warnings || []));
      rounds.push({
        round: 2,
        retry_mode: retryPlan.mode,
        query: retryQuery,
        queries: [retryQuery],
        rag_top_k: scoutBudgets.retryRagTopK,
        candidate_ids: retryPapers.map((candidate) => candidate.candidate_id),
        paper_candidate_ids: retryPapers.map((candidate) => candidate.candidate_id),
        expanded_repository_candidate_ids: expansionTwo.repository_candidate_ids,
        triage: triageTwo.decisions,
        inspected_candidate_ids: inspectTwo.map((candidate) => candidate.candidate_id),
        finalization,
      });
    }

    assertStableCandidateIdentities(candidates);
    assertStableCandidateIdentities(paperCandidates);
    const methodPack = buildMethodPack(scientificQuery, candidates, paperCandidates, allInspections, finalization, downstreamConstraints(input, scientificQuery), warnings);
    const guidance = renderMethodGuidance(methodPack);
    const trace: RecipeScoutTrace = {
      schema_version: 1,
      trace_id: traceId,
      resolution_mode: "recipe_scout_v2",
      scientific_query: scientificQuery,
      budgets: {
        rag_rounds: scoutBudgets.ragRounds,
        initial_rag_top_k: scoutBudgets.initialRagTopK,
        retry_rag_top_k: scoutBudgets.retryRagTopK,
        repository_inspections: scoutBudgets.inspections,
        inspection_concurrency: scoutBudgets.inspectionConcurrency,
        selected_methods: scoutBudgets.selectedMethods,
      },
      paper_candidates: paperCandidates,
      candidates,
      repository_expansions: repositoryExpansions,
      inspections: allInspections,
      rounds,
      method_pack: methodPack,
      warnings: unique(warnings),
    };
    const artifacts = await writeArtifacts(input.trace_dir, trace, guidance);
    const selectedMethods = [methodPack.primary, methodPack.supporting].filter(Boolean) as MethodPackMethod[];
    const skillPaths = unique(selectedMethods.map((method) => method.recipe_path || ""));
    const files = unique(selectedMethods.flatMap((method) => method.reference_files));
    const compatibilityRecipeSet = {
      schema_version: 1,
      selected: selectedMethods.map((method) => ({
        recipe_id: method.title,
        path: method.recipe_path || method.repository_url || method.candidate_id,
        role: method.role === "scientific_backbone" ? "primary" : "supporting",
        score: method.transfer_level === "direct" ? 1 : method.transfer_level === "near" ? 0.85 : 0.7,
        reason: method.reason,
        source: method.origin,
        ...(method.repository_url ? { repository_url: method.repository_url } : {}),
      })),
      complete: Boolean(methodPack.primary),
      compatibility_projection: true,
    };
    return {
      ok: true,
      matched: methodPack.status === "matched",
      source: methodPack.status === "matched" ? "method_pack" : "none",
      resolution_mode: "recipe_scout_v2",
      targeted_skill: methodPack.primary ? guidance : "",
      targeted_skill_preview: guidance.slice(0, 2400),
      skill_paths: skillPaths,
      reference_paths: files,
      generated: false,
      warnings: unique(warnings),
      trace_id: traceId,
      method_pack: methodPack,
      recipe_set: compatibilityRecipeSet,
      ...(methodPack.primary?.repository_url ? {
        repository_reference: {
          repository_key: methodPack.primary.repository_key,
          repository_url: methodPack.primary.repository_url,
          source_commit: methodPack.primary.source_commit,
          reference_files: methodPack.primary.reference_files,
          reused_validated_scripts: allInspections.find((inspection) => inspection.candidate_id === methodPack.primary?.candidate_id)?.validated_script_path !== undefined,
        },
      } : {}),
      artifacts,
      details: {
        rag_round_count: rounds.length,
        rag_query_count: ragQueryCount,
        repository_inspection_count: allInspections.length,
        candidate_count: candidates.length,
        selected_method_count: selectedMethods.length,
        crystallization_deferred: true,
      },
    };
  }
}

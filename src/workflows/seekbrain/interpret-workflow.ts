import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { Type } from "typebox";
import { ArtifactService, type Artifact } from "../../core/index.ts";
import type { StageAgentResult } from "./research-skill-workflow.ts";
import type { RunLifecycleWorkflow, WorkflowJson, WorkflowRunContext } from "./run-lifecycle.ts";

interface InterpretAgentTool {
  name: string;
  label?: string;
  description: string;
  parameters: unknown;
  execute: (...args: any[]) => Promise<unknown> | unknown;
}

export interface InterpretWorkflowDependencies {
  lifecycle: RunLifecycleWorkflow;
  currentArtifactsValidated(state: WorkflowJson): boolean;
  nextStep(validation: WorkflowJson, runId: string, figurePath: string): WorkflowJson;
  retrievePapers?(input: WorkflowJson, cwd: string, signal?: AbortSignal): Promise<WorkflowJson>;
  loadImages(paths: string[]): Promise<{ images: WorkflowJson[]; warnings: string[] }>;
  runAgent(input: {
    runDir: string;
    prompt: string;
    agentConfig: WorkflowJson;
    finalizeSchema: unknown;
    images: WorkflowJson[];
    customTools?: InterpretAgentTool[];
    signal?: AbortSignal;
  }): Promise<StageAgentResult>;
  writeJson(path: string, value: WorkflowJson): Promise<void>;
  writeText?(path: string, value: string): Promise<void>;
  snapshot(run: WorkflowRunContext, label: string): Promise<unknown>;
  appendEvent(event: WorkflowJson): Promise<void>;
  publishTaskEvent?(event: {
    cwd: string;
    parentRunId: string;
    taskId: string;
    payload: WorkflowJson;
  }): Promise<boolean>;
}

const VISION_IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

export interface InterpretWorkflowInput {
  cwd: string;
  runId: string;
  researchRolePrompt?: string;
  rolePrompt: string;
  agentConfig: WorkflowJson;
  researchFinalizeSchema?: unknown;
  finalizeSchema: unknown;
  signal?: AbortSignal;
}

export const InterpretationEvidenceSchema = Type.Object({
  result_findings: Type.Array(Type.Object({
    id: Type.String(),
    finding: Type.String(),
    relationship_type: Type.String(),
    quantitative_support: Type.Array(Type.String()),
    scope: Type.String(),
    evidence_origin: Type.Union([
      Type.Literal("statistics"),
      Type.Literal("figure"),
      Type.Literal("code"),
    ]),
    strength: Type.Literal("direct"),
  }), { minItems: 1, maxItems: 5 }),
  cross_result_relationships: Type.Optional(Type.Array(Type.Object({
    id: Type.String(),
    result_ids: Type.Array(Type.String(), { minItems: 2 }),
    relationship: Type.String(),
  }), { maxItems: 4 })),
  literature_links: Type.Optional(Type.Array(Type.Object({
    result_ids: Type.Array(Type.String(), { minItems: 1 }),
    source_ids: Type.Array(Type.String(), { minItems: 1 }),
    biological_context: Type.String(),
    scope_fit: Type.Union([
      Type.Literal("direct"),
      Type.Literal("near"),
      Type.Literal("contextual"),
    ]),
    interpretation_level: Type.Union([
      Type.Literal("direct"),
      Type.Literal("contextual"),
      Type.Literal("contradictory"),
    ]),
    boundary: Type.String(),
  }), { maxItems: 6 })),
  unresolved_interpretations: Type.Optional(Type.Array(Type.Object({
    result_ids: Type.Array(Type.String()),
    question: Type.String(),
    reason: Type.String(),
  }), { maxItems: 6 })),
});

export const ConclusionClaimsSchema = Type.Object({
  claims: Type.Array(Type.Object({
    id: Type.String(),
    observation: Type.String(),
    result_evidence: Type.Array(Type.String(), { minItems: 1 }),
    biological_interpretation: Type.Optional(Type.String()),
    literature_evidence: Type.Optional(Type.Array(Type.String())),
    interpretation_level: Type.Union([
      Type.Literal("observed_only"),
      Type.Literal("supported_context"),
    ]),
    boundary: Type.Optional(Type.String()),
  }), { minItems: 1, maxItems: 5 }),
  primary_claim_id: Type.String(),
  limitations: Type.Array(Type.String()),
  next_research_directions: Type.Array(Type.Object({
    title: Type.String(),
    research_question: Type.String(),
  })),
});

function resolveQuestion(run: WorkflowRunContext): string {
  const value = String(run.state.question || "").trim();
  if (!value) throw new Error("question is missing from state.json");
  return value;
}

const RETRIEVAL_STOPWORDS = new Set([
  "about", "above", "after", "again", "against", "all", "along", "also", "among", "an", "analysis", "analyze",
  "and", "any", "are", "as", "at", "be", "because", "been", "before", "being", "below", "between", "both",
  "but", "by", "can", "could", "data", "did", "do", "does", "doing", "done", "each", "few", "for", "from",
  "further", "had", "has", "have", "having", "here", "how", "if", "in", "into", "is", "it", "its", "more",
  "most", "not", "of", "on", "or", "other", "our", "out", "over", "per", "same", "should", "such", "than",
  "that", "the", "their", "them", "then", "there", "these", "they", "this", "those", "through", "to", "under",
  "use", "used", "using", "very", "was", "we", "were", "what", "when", "where", "which", "while", "with",
  "within", "would", "across", "together", "result", "results", "cells", "cell", "neurons", "neuron", "fish",
  "identify", "determine", "define", "show", "shown", "three", "whole", "brain", "map", "mapping", "method",
  "count", "counts", "number", "positive", "negative", "pooled", "total", "value", "values", "mean", "median",
  "fraction", "percent", "percentage", "index", "indices", "axis", "figure", "statistics", "threshold", "min",
  "max", "name", "names", "true", "false", "matches", "less", "greater", "including", "include", "includes",
  "range", "ranges",
  "spatial", "distribution", "distributions", "registered", "centroid", "centroids", "identity", "identities",
  "annotation", "annotations", "anatomical", "region", "regions", "gene", "genes", "expression", "rna", "spot",
  "spots", "population", "populations", "selected", "highlight", "contour", "contours", "pos", "pooled",
  "applied", "applying", "labeled", "labelled", "expressing", "matching", "sum", "combined", "finite", "valid",
  "dorsal", "ventral", "anterior", "posterior", "lateral", "medial", "rostral", "caudal",
]);

const NARRATIVE_STATISTICS_KEYS = new Set(["assumptions", "warnings", "notes", "description", "method", "methods", "invariants"]);
const SEMANTIC_STATISTICS_VALUE_KEY = /(?:gene|marker|region|area|cell.?type|subtype|class|category|group|condition|stimulus|behavior|species|organism|sex|stage|label|name)s?$/i;

const PASSAGE_HEADING = /\b(?:result|results|discussion|conclusion|interpretation|finding|findings|figure|fig\.?|supplement)\b/i;

interface LiteraturePassage {
  heading?: string;
  text: string;
  order: number;
  score: number;
  matched_terms: string[];
}

interface EvidenceTerm {
  value: string;
  priority: number;
}

function evidenceVocabulary(query: string, statistics?: unknown): EvidenceTerm[] {
  const values: Array<{ text: string; priority: number }> = [{ text: query, priority: 3 }];
  const visit = (value: unknown, depth = 0, parentKey = "") => {
    if (depth > 4 || values.length > 240) return;
    if (typeof value === "string") {
      const wordCount = value.trim().split(/\s+/).filter(Boolean).length;
      if (!NARRATIVE_STATISTICS_KEYS.has(parentKey)
        && SEMANTIC_STATISTICS_VALUE_KEY.test(parentKey)
        && value.length <= 100
        && wordCount <= 8) {
        values.push({ text: value, priority: 4 });
      }
      return;
    }
    if (Array.isArray(value)) {
      if (NARRATIVE_STATISTICS_KEYS.has(parentKey)) return;
      for (const item of value.slice(0, 20)) visit(item, depth + 1, parentKey);
      return;
    }
    if (value && typeof value === "object") {
      for (const [key, child] of Object.entries(value).slice(0, 80)) {
        const normalizedKey = key.toLowerCase();
        if (!NARRATIVE_STATISTICS_KEYS.has(normalizedKey)) values.push({ text: key.replace(/_/g, " "), priority: 2 });
        visit(child, depth + 1, normalizedKey);
      }
    }
  };
  visit(statistics);
  const priorities = new Map<string, number>();
  for (const item of values) {
    const terms = item.text.toLowerCase().match(/[\p{L}][\p{L}\p{N}_+-]{2,}/gu) || [];
    for (const term of terms.flatMap((value) => value.split(/[_-]+/))) {
      if (term.length < 3 || RETRIEVAL_STOPWORDS.has(term) || /^\d+$/.test(term)) continue;
      priorities.set(term, Math.max(priorities.get(term) || 0, item.priority));
    }
  }
  return [...priorities.entries()].map(([value, priority]) => ({ value, priority }))
    .sort((left, right) => right.priority - left.priority || right.value.length - left.value.length)
    .slice(0, 60);
}

function textTokens(text: string): Set<string> {
  return new Set(text.toLowerCase().match(/[\p{L}][\p{L}\p{N}_+-]{1,}/gu) || []);
}

function matchedEvidenceTerms(text: string, terms: EvidenceTerm[]): EvidenceTerm[] {
  const tokens = textTokens(text);
  return terms.filter((term) => tokens.has(term.value));
}

const SPECIES_TERMS = ["zebrafish", "mouse", "mice", "rat", "human", "macaque", "drosophila", "medaka", "c elegans"];

function paperSpeciesScore(query: string, title: string): number {
  const queryTokens = textTokens(query);
  const titleTokens = textTokens(title);
  const requested = SPECIES_TERMS.filter((species) => species.includes(" ") ? query.toLowerCase().includes(species) : queryTokens.has(species));
  if (!requested.length) return 0;
  const matched = requested.some((species) => species.includes(" ") ? title.toLowerCase().includes(species) : titleTokens.has(species));
  if (matched) return 80;
  const otherSpecies = SPECIES_TERMS.filter((species) => !requested.includes(species));
  const mismatched = otherSpecies.some((species) => species.includes(" ") ? title.toLowerCase().includes(species) : titleTokens.has(species));
  return mismatched ? -80 : 0;
}

function splitLiteraturePassages(raw: unknown): Array<Omit<LiteraturePassage, "score" | "matched_terms">> {
  const text = String(raw || "").replace(/\r\n/g, "\n").trim();
  if (!text) return [];
  const sections: Array<{ heading?: string; body: string }> = [];
  let heading = "";
  let body: string[] = [];
  const flush = () => {
    const value = body.join("\n").trim();
    if (value) sections.push({ ...(heading ? { heading } : {}), body: value });
    body = [];
  };
  for (const line of text.split("\n")) {
    const value = line.trim();
    const markdown = /^#{1,5}\s+(.+)$/.exec(value);
    const plain = value.length >= 3 && value.length <= 100
      && (/^(?:abstract|introduction|results?|discussion|conclusions?|methods?|figure\s+\d+)/i.test(value)
        || /^[A-Z][A-Z\s/&:()-]{4,}$/.test(value));
    if (markdown || plain) {
      flush();
      heading = String(markdown?.[1] || value).trim();
    } else body.push(line);
  }
  flush();
  const passages: Array<Omit<LiteraturePassage, "score" | "matched_terms">> = [];
  for (const section of sections.length ? sections : [{ body: text }]) {
    const paragraphs = section.body.split(/\n\s*\n+/).map((item) => item.replace(/\s+/g, " ").trim()).filter((item) => item.length >= 50);
    let current = "";
    for (const paragraph of paragraphs.length ? paragraphs : [section.body.replace(/\s+/g, " ").trim()]) {
      if (current && current.length + paragraph.length > 1_600) {
        passages.push({ ...(section.heading ? { heading: section.heading } : {}), text: current, order: passages.length });
        current = "";
      }
      current = `${current} ${paragraph}`.trim();
    }
    if (current) passages.push({ ...(section.heading ? { heading: section.heading } : {}), text: current, order: passages.length });
  }
  return passages;
}

function rankLiteraturePassages(raw: unknown, terms: EvidenceTerm[]): LiteraturePassage[] {
  const passages = splitLiteraturePassages(raw);
  if (!passages.length) return [];
  const documentFrequency = new Map<string, number>();
  for (const term of terms) {
    const count = passages.reduce((sum, passage) => sum + Number(textTokens(`${passage.heading || ""} ${passage.text}`).has(term.value)), 0);
    documentFrequency.set(term.value, count);
  }
  return passages.map((passage) => {
    const searchable = `${passage.heading || ""} ${passage.text}`;
    const tokens = textTokens(searchable);
    const matchedTerms = terms.filter((term) => tokens.has(term.value));
    const matched = matchedTerms.map((term) => term.value);
    const weighted = matched.reduce((sum, term) => {
      const frequency = documentFrequency.get(term) || passages.length;
      const rarity = Math.log(1 + passages.length / frequency);
      const priority = matchedTerms.find((item) => item.value === term)?.priority || 1;
      return sum + rarity * priority * (term.length >= 7 ? 1.8 : 1);
    }, 0);
    const cooccurrence = matched.length >= 2 ? Math.min(10, matched.length * 1.5) : 0;
    const headingBonus = passage.heading && PASSAGE_HEADING.test(passage.heading) ? 4 : 0;
    return { ...passage, score: weighted + cooccurrence + headingBonus, matched_terms: matched };
  }).sort((left, right) => right.score - left.score || left.order - right.order);
}

function passageWindow(passages: LiteraturePassage[], selected: LiteraturePassage, limit = 1_300): string {
  const ordered = [...passages].sort((left, right) => left.order - right.order);
  const index = ordered.findIndex((item) => item.order === selected.order);
  const centered = [ordered[index]?.text, ordered[index - 1]?.text, ordered[index + 1]?.text].filter(Boolean).join("\n\n");
  return centered.slice(0, limit).trim();
}

export function compactConclusionSources(sources: unknown, query: string, statistics?: unknown, contextLimit = 7_000): WorkflowJson[] {
  if (!Array.isArray(sources)) return [];
  const terms = evidenceVocabulary(query, statistics);
  const uniqueSources = sources.filter((source: WorkflowJson, index: number, all: WorkflowJson[]) => {
    const title = String(source?.title || "").trim().toLowerCase();
    return !title || all.findIndex((candidate) => String(candidate?.title || "").trim().toLowerCase() === title) === index;
  });
  const rankedPapers = uniqueSources.slice(0, 4).map((source: WorkflowJson) => {
    const title = String(source?.title || "(untitled paper)");
    const passages = rankLiteraturePassages(source?.text || source?.full_text || source?.content, terms);
    const first = passages[0];
    const second = passages.find((passage) => first
      && passage.heading !== first.heading
      && Math.abs(passage.order - first.order) > 1);
    const selected = [first, second].filter((passage): passage is LiteraturePassage => Boolean(passage && passage.score > 0));
    const fallback = passages[0] ? [passages[0]] : [];
    const chosen = selected.length ? selected : fallback;
    const titleMatches = matchedEvidenceTerms(title, terms);
    const titleScore = titleMatches.reduce((sum, term) => sum + term.priority * (term.value.length >= 7 ? 6 : 3), 0)
      + paperSpeciesScore(query, title);
    return {
      title,
      pub_time: source?.pub_time || "",
      magazine: source?.magazine || "",
      passages: chosen.map((passage) => ({
        heading: passage.heading || "",
        matched_terms: passage.matched_terms,
        text: passageWindow(passages, passage),
      })),
      score: titleScore + (chosen[0]?.score || 0) + (chosen[1]?.score || 0) * 0.35,
      matchedTermCount: new Set([
        ...titleMatches.map((term) => term.value),
        ...chosen.flatMap((passage) => passage.matched_terms),
      ]).size,
    };
  }).sort((left, right) => right.score - left.score);
  const relevantPapers = rankedPapers.filter((paper) => paper.matchedTermCount >= 2 || paper.score >= 4);
  const selectedPapers = (relevantPapers.length ? relevantPapers : rankedPapers).slice(0, 3);
  const perPaper = Math.max(1_200, Math.floor(contextLimit / Math.max(1, selectedPapers.length)));
  return selectedPapers.map(({ score, matchedTermCount, passages, ...paper }) => ({
    ...paper,
    text: passages.map((passage) => [
      passage.heading ? `## ${passage.heading}` : "",
      passage.text,
    ].filter(Boolean).join("\n")).join("\n\n").slice(0, perPaper),
    passages: passages.map(({ text, ...metadata }) => metadata),
    relevance_score: Number(score.toFixed(3)),
  }));
}

interface ConclusionResearchAttempt {
  query: string;
  purpose: string;
  cached: boolean;
  ok: boolean;
  returned_titles: string[];
  warnings: string[];
  error?: string;
}

interface ConclusionResearchTrace {
  paper_source: string;
  max_calls: number;
  provider_calls: number;
  attempts: ConclusionResearchAttempt[];
  retrieved_sources: WorkflowJson[];
  selected_evidence: WorkflowJson[];
  unresolved_gaps: string[];
}

function normalizeLiteratureQuery(value: unknown): string {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 1_000);
}

function normalizedEvidenceText(value: unknown): string {
  return String(value || "")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function conclusionSearchTool(input: {
  dependencies: InterpretWorkflowDependencies;
  cwd: string;
  run: WorkflowRunContext;
  statistics: unknown;
  agentConfig: WorkflowJson;
  trace: ConclusionResearchTrace;
  retrievedSources: Map<string, WorkflowJson>;
  sourceIdsByKey: Map<string, string>;
  signal?: AbortSignal;
}): InterpretAgentTool | undefined {
  const rag = input.agentConfig.rag || {};
  const provider = String(rag.literature_provider || rag.paper_source || "none");
  if (!input.dependencies.retrievePapers || provider === "none") return undefined;
  const cache = new Map<string, WorkflowJson>();
  const tracePath = join(input.run.runDir, "conclusion_research_sources.json");
  const persist = () => input.dependencies.writeJson(tracePath, input.trace as unknown as WorkflowJson);
  return {
    name: "search_neuroscience_literature",
    label: "Search neuroscience literature",
    description: "Search neuroscience literature for one explicit biological interpretation question and return concise evidence passages. Revise later queries using gaps or terminology learned from earlier results.",
    parameters: Type.Object({
      query: Type.String({ minLength: 3, maxLength: 1_000 }),
      purpose: Type.String({ minLength: 3, maxLength: 500 }),
    }),
    async execute(_toolCallId: string, params: WorkflowJson, toolSignal?: AbortSignal) {
      const query = normalizeLiteratureQuery(params.query);
      const purpose = normalizeLiteratureQuery(params.purpose).slice(0, 500);
      const cacheKey = query.toLocaleLowerCase();
      const cached = cache.get(cacheKey);
      if (cached) {
        input.trace.attempts.push({
          query, purpose, cached: true, ok: Boolean(cached.ok),
          returned_titles: Array.isArray(cached.sources) ? cached.sources.map((source: WorkflowJson) => String(source.title || "")) : [],
          warnings: [],
        });
        await persist();
        return { content: [{ type: "text", text: JSON.stringify(cached) }], details: { cached: true, query } };
      }
      if (input.trace.provider_calls >= input.trace.max_calls) {
        const message = `Literature search budget exhausted after ${input.trace.max_calls} distinct queries. Use the evidence already returned and retain unresolved gaps explicitly.`;
        input.trace.attempts.push({ query, purpose, cached: false, ok: false, returned_titles: [], warnings: [message] });
        await persist();
        return { content: [{ type: "text", text: message }], details: { budget_exhausted: true }, isError: true };
      }
      input.trace.provider_calls += 1;
      let result: WorkflowJson;
      try {
        result = await input.dependencies.retrievePapers!({
          ...rag,
          ...(rag.base_url ? { rag_base_url: rag.base_url } : {}),
          question: query,
          top_k: Math.min(5, Math.max(1, Number(rag.top_k || 4))),
          require_github: false,
          source_char_limit: Math.min(500_000, Math.max(12_000, Number(rag.full_text_char_limit || 300_000))),
        }, input.cwd, toolSignal || input.signal);
      } catch (error) {
        result = { ok: false, sources: [], error: String(error), warnings: ["Conclusion literature retrieval failed"] };
      }
      const compactSources = compactConclusionSources(
        result.sources,
        `${query} ${purpose}`,
        input.statistics,
        Math.min(9_000, Math.max(3_000, Number(rag.context_char_limit || 7_000))),
      );
      const sources = compactSources.map((source, index) => {
        const title = String(source.title || "").trim();
        const sourceKey = normalizedEvidenceText(title) || `${cacheKey}:${index}`;
        let sourceId = input.sourceIdsByKey.get(sourceKey);
        if (!sourceId) {
          sourceId = `S${input.sourceIdsByKey.size + 1}`;
          input.sourceIdsByKey.set(sourceKey, sourceId);
        }
        const identified: WorkflowJson = { ...source, source_id: sourceId };
        const previous = input.retrievedSources.get(sourceId);
        input.retrievedSources.set(sourceId, previous || {
          ...identified,
          query,
          purpose,
        });
        return identified;
      });
      const response: WorkflowJson = {
        ok: Boolean(result.ok) && sources.length > 0,
        query,
        purpose,
        paper_source: result.paper_source || provider,
        sources,
        warnings: result.warnings || [],
        ...(result.error ? { error: result.error } : {}),
      };
      input.trace.retrieved_sources = [...input.retrievedSources.values()];
      cache.set(cacheKey, response);
      input.trace.attempts.push({
        query, purpose, cached: false, ok: Boolean(response.ok),
        returned_titles: sources.map((source) => String(source.title || "")),
        warnings: Array.isArray(result.warnings) ? result.warnings.map(String) : [],
        ...(result.error ? { error: String(result.error) } : {}),
      });
      await persist();
      const text = sources.length
        ? JSON.stringify(response)
        : JSON.stringify({ ...response, guidance: "No usable passage was found. Diagnose the evidence gap and revise terminology, split an overly combined question, broaden one biological dimension, or remove technical workflow language." });
      return { content: [{ type: "text", text }], details: { cached: false, query, provider_call: input.trace.provider_calls }, isError: false };
    },
  };
}

async function readStatistics(run: WorkflowRunContext): Promise<unknown> {
  const inline = run.state.code?.statistics;
  if (inline && typeof inline === "object") return inline;
  const path = String(run.state.code?.statistics_path || join(run.runDir, "statistics.json"));
  try { return JSON.parse(await readFile(path, "utf8")); } catch { return {}; }
}

function codeFilePaths(run: WorkflowRunContext, artifacts: ArtifactService): string[] {
  const declared: string[] = Array.isArray(run.state.code?.code_files)
    ? run.state.code.code_files.map((entry: WorkflowJson) => String(entry?.path || "")).filter(Boolean)
    : [];
  const fallback: string[] = artifacts.normalizeMany(run.state.artifacts || [])
    .filter((artifact) => artifact.kind === "code")
    .map((artifact) => String(artifact.path));
  return [...new Set((declared.length ? declared : fallback).map((path: string) => artifacts.paths.resolve(path)))];
}

function visionFigures(run: WorkflowRunContext, artifacts: ArtifactService): Artifact[] {
  const isActualVisionFigure = (artifact: Artifact) => artifact.kind === "figure"
    && VISION_IMAGE_EXTENSIONS.has(extname(artifact.path).toLowerCase())
    && existsSync(artifacts.paths.resolve(artifact.path));
  const indexed = artifacts.normalizeMany(run.state.artifacts || []).filter(isActualVisionFigure);
  if (indexed.length) return indexed;
  return artifacts.normalizeMany(run.state.deliverables || []).filter(isActualVisionFigure);
}

function finalizationPrompt(rolePrompt: string, body: string): string {
  return [
    rolePrompt.trim(),
    "",
    "You are the isolated SeekBrain Interpretation Agent.",
    "Return only by calling finalize_interpretation. Do not expose scratch reasoning.",
    "",
    body,
  ].join("\n");
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean) : [];
}

function sanitizeInterpretationEvidence(
  value: WorkflowJson,
  retrievedSources: Map<string, WorkflowJson>,
): { evidence: WorkflowJson; rejected: string[] } {
  const rejected: string[] = [];
  const seenResultIds = new Set<string>();
  const resultFindings = (Array.isArray(value.result_findings) ? value.result_findings : [])
    .filter((entry: WorkflowJson) => {
      const id = String(entry?.id || "").trim();
      if (!id || seenResultIds.has(id)) {
        rejected.push(`Rejected result finding with missing or duplicate ID: ${id || "(missing)"}`);
        return false;
      }
      seenResultIds.add(id);
      return Boolean(String(entry?.finding || "").trim());
    })
    .slice(0, 5)
    .map((entry: WorkflowJson) => ({
      id: String(entry.id),
      finding: String(entry.finding),
      relationship_type: String(entry.relationship_type || "observed_relationship"),
      quantitative_support: stringArray(entry.quantitative_support),
      scope: String(entry.scope || "current analysis"),
      evidence_origin: ["statistics", "figure", "code"].includes(String(entry.evidence_origin))
        ? String(entry.evidence_origin)
        : "statistics",
      strength: "direct",
    }));
  const validResultIds = new Set(resultFindings.map((entry) => entry.id));

  const seenRelationshipIds = new Set<string>();
  const crossResultRelationships = (Array.isArray(value.cross_result_relationships) ? value.cross_result_relationships : [])
    .map((entry: WorkflowJson) => ({
      id: String(entry?.id || "").trim(),
      result_ids: [...new Set(stringArray(entry?.result_ids).filter((id) => validResultIds.has(id)))],
      relationship: String(entry?.relationship || "").trim(),
    }))
    .filter((entry) => {
      const valid = Boolean(entry.id && entry.relationship && entry.result_ids.length >= 2 && !seenRelationshipIds.has(entry.id));
      if (!valid) rejected.push(`Rejected invalid cross-result relationship: ${entry.id || "(missing)"}`);
      if (valid) seenRelationshipIds.add(entry.id);
      return valid;
    })
    .slice(0, 4);

  const unresolved = (Array.isArray(value.unresolved_interpretations) ? value.unresolved_interpretations : [])
    .map((entry: WorkflowJson) => ({
      result_ids: [...new Set(stringArray(entry?.result_ids).filter((id) => validResultIds.has(id)))],
      question: String(entry?.question || "").trim(),
      reason: String(entry?.reason || "").trim(),
    }))
    .filter((entry) => entry.question && entry.reason)
    .slice(0, 6);

  const literatureLinks = (Array.isArray(value.literature_links) ? value.literature_links : [])
    .map((entry: WorkflowJson) => {
      const resultIds = [...new Set(stringArray(entry?.result_ids).filter((id) => validResultIds.has(id)))];
      const requestedSourceIds = [...new Set(stringArray(entry?.source_ids))];
      const sourceIds = requestedSourceIds.filter((id) => retrievedSources.has(id));
      for (const id of requestedSourceIds.filter((candidate) => !retrievedSources.has(candidate))) {
        rejected.push(`Rejected unknown literature source ID: ${id}`);
      }
      return {
        result_ids: resultIds,
        source_ids: sourceIds,
        biological_context: String(entry?.biological_context || "").trim(),
        scope_fit: ["direct", "near", "contextual"].includes(String(entry?.scope_fit))
          ? String(entry.scope_fit)
          : "contextual",
        interpretation_level: ["direct", "contextual", "contradictory"].includes(String(entry?.interpretation_level))
          ? String(entry.interpretation_level)
          : "contextual",
        boundary: String(entry?.boundary || "").trim(),
      };
    })
    .filter((entry) => {
      const valid = entry.result_ids.length > 0 && entry.source_ids.length > 0 && Boolean(entry.biological_context);
      if (!valid && entry.result_ids.length > 0) {
        unresolved.push({
          result_ids: entry.result_ids,
          question: "What biological context explains this observed relationship?",
          reason: "No valid literature source from this retrieval run supported the proposed connection.",
        });
      }
      return valid;
    })
    .slice(0, 6);

  return {
    evidence: {
      result_findings: resultFindings,
      cross_result_relationships: crossResultRelationships,
      literature_links: literatureLinks,
      unresolved_interpretations: unresolved.slice(0, 6),
    },
    rejected,
  };
}

function literatureContextForWriter(evidence: WorkflowJson, retrievedSources: Map<string, WorkflowJson>): WorkflowJson[] {
  const selectedIds = new Set(
    (Array.isArray(evidence.literature_links) ? evidence.literature_links : [])
      .flatMap((entry: WorkflowJson) => stringArray(entry.source_ids)),
  );
  let remaining = 18_000;
  const selected: WorkflowJson[] = [];
  for (const sourceId of selectedIds) {
    const source = retrievedSources.get(sourceId);
    if (!source || remaining <= 0) continue;
    const text = String(source.text || "");
    const excerpt = text.slice(0, Math.min(3_000, remaining));
    remaining -= excerpt.length;
    selected.push({
      source_id: sourceId,
      title: source.title || "",
      pub_time: source.pub_time || "",
      magazine: source.magazine || "",
      query: source.query || "",
      excerpt,
    });
  }
  return selected;
}

function renderConclusionClaim(claim: WorkflowJson): string {
  return [claim.observation, claim.biological_interpretation]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" ");
}

function sanitizeConclusionClaims(value: WorkflowJson, evidence: WorkflowJson): {
  claims: WorkflowJson[];
  primaryClaimId: string;
} {
  const resultIds = new Set([
    ...(Array.isArray(evidence.result_findings) ? evidence.result_findings.map((entry: WorkflowJson) => String(entry.id)) : []),
    ...(Array.isArray(evidence.cross_result_relationships) ? evidence.cross_result_relationships.map((entry: WorkflowJson) => String(entry.id)) : []),
  ]);
  const allowedSourcesByResult = new Map<string, Set<string>>();
  for (const link of Array.isArray(evidence.literature_links) ? evidence.literature_links : []) {
    for (const resultId of stringArray(link.result_ids)) {
      const allowed = allowedSourcesByResult.get(resultId) || new Set<string>();
      for (const sourceId of stringArray(link.source_ids)) allowed.add(sourceId);
      allowedSourcesByResult.set(resultId, allowed);
    }
  }
  const seenClaimIds = new Set<string>();
  const claims = (Array.isArray(value.claims) ? value.claims : [])
    .map((entry: WorkflowJson, index: number) => {
      const id = String(entry?.id || `C${index + 1}`).trim();
      const resultEvidence = [...new Set(stringArray(entry?.result_evidence).filter((resultId) => resultIds.has(resultId)))];
      const allowedSources = new Set(resultEvidence.flatMap((resultId) => [...(allowedSourcesByResult.get(resultId) || [])]));
      const literatureEvidence = [...new Set(stringArray(entry?.literature_evidence).filter((sourceId) => allowedSources.has(sourceId)))];
      const supported = literatureEvidence.length > 0 && Boolean(String(entry?.biological_interpretation || "").trim());
      return {
        id,
        observation: String(entry?.observation || "").trim(),
        result_evidence: resultEvidence,
        ...(supported ? { biological_interpretation: String(entry.biological_interpretation).trim() } : {}),
        ...(supported ? { literature_evidence: literatureEvidence } : {}),
        interpretation_level: supported ? "supported_context" : "observed_only",
        ...(String(entry?.boundary || "").trim() ? { boundary: String(entry.boundary).trim() } : {}),
      };
    })
    .filter((entry) => {
      const valid = Boolean(entry.id && entry.observation && entry.result_evidence.length > 0 && !seenClaimIds.has(entry.id));
      if (valid) seenClaimIds.add(entry.id);
      return valid;
    })
    .slice(0, 5);
  const requestedPrimary = String(value.primary_claim_id || "").trim();
  const primaryClaimId = claims.some((claim) => claim.id === requestedPrimary)
    ? requestedPrimary
    : String(claims[0]?.id || "");
  return { claims, primaryClaimId };
}

export class InterpretWorkflow {
  constructor(readonly dependencies: InterpretWorkflowDependencies) {}

  async execute(input: InterpretWorkflowInput): Promise<WorkflowJson> {
    const run = await this.dependencies.lifecycle.resolveRun(input.cwd, input.runId);
    let reportAvailability: WorkflowJson = { available: false, completed_round_count: 0 };
    if (!this.dependencies.currentArtifactsValidated(run.state)) {
      return {
        ok: false,
        run_id: run.runId,
        blocked_by_validation_policy: true,
        error: "The latest Code/refinement artifacts must be validated before interpretation.",
        next_step: { tool: "seekbrain_validation_run", args: { run_id: run.runId } },
      };
    }
    if (run.state.validation?.route === "retry_code") {
      return {
        ok: false,
        run_id: run.runId,
        blocked_by_validation_policy: true,
        error: "Blocking validation issues must be repaired before interpretation.",
        next_step: this.dependencies.nextStep(run.state.validation, run.runId, ""),
      };
    }

    const validation = run.state.validation || {};
    const planPath = String(run.state.plan?.path || join(run.runDir, "plan.md"));
    const artifacts = new ArtifactService(run.runDir);
    const codePaths = codeFilePaths(run, artifacts);
    const figures = visionFigures(run, artifacts);
    if (input.agentConfig.vision !== true && (figures.length > 0 || run.state.flow_version !== "0.1.4")) {
      return {
        ok: false,
        run_id: run.runId,
        error: "configuration issue: seekbrain_interpretation_run requires vision=true. Use a vision-capable Interpretation model.",
        figure_paths: figures.map((artifact) => artifact.path),
      };
    }
    if (!figures.length && run.state.flow_version !== "0.1.4") {
      return { ok: false, run_id: run.runId, error: "seekbrain_interpretation_run requires at least one validated scientific figure artifact" };
    }
    const vision = await this.dependencies.loadImages(figures.map((artifact) => artifact.path));
    if (figures.length && !vision.images.length) {
      return { ok: false, run_id: run.runId, error: "failed to load interpretation images", warnings: vision.warnings };
    }
    const figuresText = figures.map((artifact, index) => `(${index + 1}) ${artifact.path}${artifact.role ? ` [${artifact.role}]` : ""}${artifact.description ? ` — ${artifact.description}` : ""}`).join("\n");
    const statistics = await readStatistics(run);
    const statsPath = String(run.state.code?.statistics_path || join(run.runDir, "statistics.json"));
    const codeWarnings = Array.isArray(run.state.code?.warnings) ? run.state.code.warnings.map(String).filter(Boolean) : [];
    const question = resolveQuestion(run);
    const rag = input.agentConfig.rag || {};
    const researchTrace: ConclusionResearchTrace = {
      paper_source: String(rag.literature_provider || rag.paper_source || "none"),
      max_calls: Math.min(6, Math.max(1, Number(rag.max_calls || 4))),
      provider_calls: 0,
      attempts: [],
      retrieved_sources: [],
      selected_evidence: [],
      unresolved_gaps: [],
    };
    const retrievedSources = new Map<string, WorkflowJson>();
    const sourceIdsByKey = new Map<string, string>();
    const literatureTool = conclusionSearchTool({
      dependencies: this.dependencies,
      cwd: input.cwd,
      run,
      statistics,
      agentConfig: input.agentConfig,
      trace: researchTrace,
      retrievedSources,
      sourceIdsByKey,
      signal: input.signal,
    });
    const researchPrompt = finalizationPrompt(input.researchRolePrompt || input.rolePrompt, [
      `Question:\n${question}`,
      `Scientific figures (${figures.length}):\n${figuresText}`,
      `Approved plan path:\n${planPath}`,
      `Generated code paths:\n${codePaths.length ? codePaths.join("\n") : "None recorded."}`,
      `Statistics file:\n${statsPath}`,
      codeWarnings.length ? `Code execution limitations:\n${JSON.stringify(codeWarnings, null, 2)}` : "",
      literatureTool ? `Literature search is available through search_neuroscience_literature. The shared budget is ${researchTrace.max_calls} distinct queries; identical normalized queries are cached.` : "No conclusion-stage literature provider is configured; keep unsupported biological interpretations bounded.",
      "Prepare InterpretationEvidence for a separate writer. Do not draft the final conclusion.",
    ].filter(Boolean).join("\n\n"));

    const researchAgent = await this.dependencies.runAgent({
      runDir: run.runDir,
      prompt: researchPrompt,
      agentConfig: input.agentConfig,
      finalizeSchema: input.researchFinalizeSchema || InterpretationEvidenceSchema,
      images: vision.images,
      customTools: literatureTool ? [literatureTool] : [],
      signal: input.signal,
    });

    if (!researchAgent.ok || !researchAgent.result) {
      await this.dependencies.writeJson(
        join(run.runDir, "conclusion_research_sources.json"),
        researchTrace as unknown as WorkflowJson,
      );
      await this.dependencies.appendEvent({ run_id: run.runId, event: "seekbrain_interpretation_run", ok: false });
      return {
        run_id: run.runId,
        ok: false,
        error: researchAgent.error || "Interpretation Researcher did not produce evidence.",
        output_path: researchAgent.output_path,
        debug: { subagent_dir: researchAgent.subagent_dir, snapshot_dir: researchAgent.snapshot_dir },
      };
    }

    const sanitized = sanitizeInterpretationEvidence(researchAgent.result, retrievedSources);
    const evidence = sanitized.evidence;
    if (!Array.isArray(evidence.result_findings) || evidence.result_findings.length === 0) {
      await this.dependencies.appendEvent({ run_id: run.runId, event: "seekbrain_interpretation_run", ok: false });
      return {
        run_id: run.runId,
        ok: false,
        error: "Interpretation Researcher produced no valid result findings.",
      };
    }
    researchTrace.retrieved_sources = [...retrievedSources.values()];
    researchTrace.selected_evidence = Array.isArray(evidence.literature_links) ? evidence.literature_links : [];
    const unresolvedQuestions = (Array.isArray(evidence.unresolved_interpretations) ? evidence.unresolved_interpretations : [])
      .map((entry: WorkflowJson) => String(entry.question || "").trim())
      .filter(Boolean);
    researchTrace.unresolved_gaps = [...new Set([...unresolvedQuestions, ...sanitized.rejected])].slice(0, 8);
    await this.dependencies.writeJson(
      join(run.runDir, "conclusion_research_sources.json"),
      researchTrace as unknown as WorkflowJson,
    );
    await this.dependencies.writeJson(join(run.runDir, "conclusion_result_evidence.json"), {
      result_findings: evidence.result_findings,
      cross_result_relationships: evidence.cross_result_relationships,
      unresolved_interpretations: evidence.unresolved_interpretations,
    });
    await this.dependencies.writeJson(join(run.runDir, "conclusion_evidence.json"), evidence);

    const writerLiterature = literatureContextForWriter(evidence, retrievedSources);
    const writerPrompt = finalizationPrompt(input.rolePrompt, [
      `Original question:\n${question}`,
      `InterpretationEvidence:\n${JSON.stringify(evidence, null, 2)}`,
      writerLiterature.length
        ? `Literature context referenced by the evidence:\n${JSON.stringify(writerLiterature, null, 2)}`
        : "No usable literature context was selected. Keep biological interpretation at the observed-result level.",
      codeWarnings.length ? `Material execution limitations:\n${JSON.stringify(codeWarnings, null, 2)}` : "",
      "Write the final structured claims. Do not search, inspect unrelated files, or add information outside this evidence.",
    ].filter(Boolean).join("\n\n"));

    const agent = await this.dependencies.runAgent({
      runDir: run.runDir,
      prompt: writerPrompt,
      agentConfig: input.agentConfig,
      finalizeSchema: input.finalizeSchema || ConclusionClaimsSchema,
      images: [],
      signal: input.signal,
    });

    const conclusionsPath = join(run.runDir, "conclusions.json");
    if (agent.ok && agent.result) {
      const structured = sanitizeConclusionClaims(agent.result, evidence);
      if (!structured.claims.length) {
        await this.dependencies.appendEvent({ run_id: run.runId, event: "seekbrain_interpretation_run", ok: false });
        return {
          run_id: run.runId,
          ok: false,
          error: "Conclusion Writer produced no claim linked to valid result evidence.",
          output_path: agent.output_path,
          debug: { subagent_dir: agent.subagent_dir, snapshot_dir: agent.snapshot_dir },
        };
      }
      const unresolvedBlocking = validation.route === "conclude_with_limitations" && Array.isArray(validation.blocking_issues)
        ? validation.blocking_issues.map((issue: unknown) => `Unresolved validation issue: ${String(issue)}`)
        : [];
      const dummySignals = Array.isArray(run.state.checks?.dummy_data_signals) ? run.state.checks.dummy_data_signals.map(String) : [];
      const limitations = [...new Set([
        ...(Array.isArray(agent.result.limitations) ? agent.result.limitations.map(String) : []),
        ...unresolvedBlocking,
        ...(dummySignals.length ? [`Possible real-input substitution signals require caution: ${dummySignals.join(", ")}`] : []),
      ])];
      const completedAt = new Date().toISOString();
      const primaryClaim = structured.claims.find((claim) => claim.id === structured.primaryClaimId) || structured.claims[0];
      const renderedClaims = structured.claims.map(renderConclusionClaim).filter(Boolean);
      const conclusion = {
        conclusions: renderedClaims,
        summary: renderConclusionClaim(primaryClaim),
        limitations,
        next_research_directions: Array.isArray(agent.result.next_research_directions) ? agent.result.next_research_directions : [],
        completed_at: completedAt,
      };
      await this.dependencies.writeJson(conclusionsPath, conclusion);
      const compactReference = { path: conclusionsPath, summary: conclusion.summary, status: "complete", completed_at: completedAt };
      await this.dependencies.lifecycle.updateState(run, {
        interpretation: compactReference,
        conclusions: compactReference,
        conclusion_warnings: { dummy_data_limited: dummySignals.length > 0, dummy_data_signals: dummySignals },
      });
      if (run.state.parent_run_id && run.state.research_task_id) {
        const payload = {
          child_run_id: run.runId,
          completed_at: completedAt,
          interpretation_path: conclusionsPath,
          conclusions_path: conclusionsPath,
          summary: conclusion.summary,
        };
        const publishedToScheduler = await this.dependencies.publishTaskEvent?.({
          cwd: input.cwd,
          parentRunId: String(run.state.parent_run_id),
          taskId: String(run.state.research_task_id),
          payload,
        }) === true;
        if (!publishedToScheduler) {
          try {
            const parent = await this.dependencies.lifecycle.resolveRun(input.cwd, String(run.state.parent_run_id));
            const planning = parent.state.research_planning || {};
            const taskRuns = Array.isArray(planning.task_runs) ? planning.task_runs : [];
            const updatedTaskRuns = taskRuns.map((item: WorkflowJson) => item.run_id === run.runId
              ? { ...item, status: "complete", ...payload }
              : item);
            const allComplete = updatedTaskRuns.length > 0 && updatedTaskRuns.every((item: WorkflowJson) => item.status === "complete");
            await this.dependencies.lifecycle.updateState(parent, {
              research_planning: { ...planning, status: allComplete ? "tasks_complete" : "tasks_running", task_runs: updatedTaskRuns },
            });
            if (planning.task_manifest_path) {
              await this.dependencies.writeJson(String(planning.task_manifest_path), {
                parent_run_id: parent.runId,
                research_plan_path: planning.research_plan_path,
                updated_at: completedAt,
                task_runs: updatedTaskRuns,
              });
            }
          } catch { /* conclusions remain durable */ }
        }
      }
      await this.dependencies.lifecycle.updateResearchRoundManifest(run, {
        status: "concluded",
        completed_at: completedAt,
        interpretation_path: conclusionsPath,
        conclusions_path: conclusionsPath,
        summary: conclusion.summary,
        next_research_directions: conclusion.next_research_directions,
      });
      reportAvailability = await this.dependencies.lifecycle.reportAvailability(run);
      await this.dependencies.snapshot(run, "after_interpret");
      agent.result = conclusion;
    }
    await this.dependencies.appendEvent({ run_id: run.runId, event: "seekbrain_interpretation_run", ok: agent.ok });
    return {
      run_id: run.runId,
      ok: agent.ok,
      error: agent.error,
      result: agent.result ? { conclusions: agent.result.conclusions, summary: agent.result.summary, limitations: agent.result.limitations } : undefined,
      interpretation_path: agent.ok ? conclusionsPath : undefined,
      conclusions_path: agent.ok ? conclusionsPath : undefined,
      next_research_directions: agent.ok ? agent.result?.next_research_directions : undefined,
      report_available: agent.ok ? reportAvailability.available : false,
      completed_round_count: agent.ok ? reportAvailability.completed_round_count : undefined,
      report_hint: agent.ok ? reportAvailability.hint : undefined,
      guidance: agent.ok ? "Summarize the conclusions for the user. Start no new round until the user accepts or supplies a direction." : undefined,
      output_path: agent.output_path,
      debug: { subagent_dir: agent.subagent_dir, snapshot_dir: agent.snapshot_dir },
    };
  }
}

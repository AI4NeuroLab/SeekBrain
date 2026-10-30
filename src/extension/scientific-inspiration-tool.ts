import { readFile } from "node:fs/promises";
import { Type } from "typebox";
import { atomicWriteJson } from "../core/index.ts";
import type { ExistingPiCustomTool } from "./existing-pi-agent-adapter.ts";
import type { PublicWebSearchClient, PublicWebSearchResult } from "./public-web-search.ts";

export type ScientificInspirationIntent = "remote_analogy" | "nearest_prior" | "counterevidence";

export interface ScientificInspirationParameters {
  intent: ScientificInspirationIntent;
  target_abstraction: string;
  current_hypothesis: string;
  source_strategy?: "rag_first" | "include_ncs" | "ncs_only";
}

export interface ScientificInspirationSource {
  source_id: string;
  dedupe_key: string;
  title: string;
  text: string;
  provider?: string;
  url?: string;
  site?: string;
  venue?: string;
  published_at?: string;
  source_family?: string;
}

export interface ScientificInspirationEvidence {
  evidence_id: string;
  intent: ScientificInspirationIntent;
  source_strategy: "rag_first" | "include_ncs" | "ncs_only";
  target_abstraction: string;
  current_hypothesis: string;
  query: string;
  cache_key: string;
  created_at: string;
  ok: boolean;
  web_provider: string;
  source_ids: string[];
  warnings: string[];
  error?: string;
}

export interface ScientificInspirationLedger {
  version: 1;
  created_at: string;
  updated_at: string;
  max_distinct_queries: number;
  provider_calls: number;
  entries: ScientificInspirationEvidence[];
  sources: ScientificInspirationSource[];
}

export interface ScientificInspirationToolOptions {
  cwd: string;
  ledgerPath: string;
  webSearch: PublicWebSearchClient;
  maxDistinctQueries?: number;
  maxCallsPerToolInstance?: number;
  resultLimit?: number;
  sourceCharLimit?: number;
  now?: () => Date;
}

const INTENTS = new Set<ScientificInspirationIntent>([
  "remote_analogy",
  "nearest_prior",
  "counterevidence",
]);

function compact(value: unknown, limit: number): string {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function normalized(value: unknown): string {
  return compact(value, 4_000)
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cacheKey(params: ScientificInspirationParameters): string {
  return [params.intent, params.source_strategy || "rag_first", normalized(params.target_abstraction), normalized(params.current_hypothesis)].join("|");
}

export function buildScientificInspirationQuery(params: ScientificInspirationParameters): string {
  const abstraction = significantTerms(params.target_abstraction, 12).join(" ");
  const hypothesis = significantTerms(params.current_hypothesis, 14).join(" ");
  if (params.intent === "remote_analogy") {
    return compact(`${abstraction} ${hypothesis} transferable mechanism cross-disciplinary analogy`, 700);
  }
  if (params.intent === "nearest_prior") {
    return compact(`${hypothesis} ${abstraction} closest prior work scientific`, 700);
  }
  return compact(`${hypothesis} ${abstraction} contradictory evidence confound null result alternative explanation`, 700);
}

const SEARCH_STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "because", "by", "for", "from", "has", "have", "in", "into", "is", "it",
  "many", "may", "of", "on", "or", "otherwise", "that", "the", "their", "this", "to", "while", "with",
]);

function significantTerms(value: unknown, limit: number): string[] {
  const tokens = compact(value, 3_000).match(/[\p{L}\p{N}][\p{L}\p{N}_-]*/gu) || [];
  const seen = new Set<string>();
  return tokens.filter((token) => {
    const key = token.toLocaleLowerCase();
    if (key.length < 3 || SEARCH_STOP_WORDS.has(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, limit);
}

function sourceDedupeKey(source: Record<string, any>): string {
  const url = normalized(source.url);
  if (url) return `url:${url}`;
  const title = normalized(source.title);
  if (title) return `title:${title}`;
  return `text:${normalized(source.snippet || source.text).slice(0, 300)}`;
}

function compactSource(source: Record<string, any>, sourceId: string, charLimit: number): ScientificInspirationSource {
  return {
    source_id: sourceId,
    dedupe_key: sourceDedupeKey(source),
    title: compact(source.title || "(untitled web result)", 500),
    text: compact(source.snippet || source.text, charLimit),
    ...(source.provider ? { provider: compact(source.provider, 100) } : {}),
    ...(source.url ? { url: compact(source.url, 1_000) } : {}),
    ...(source.site ? { site: compact(source.site, 300) } : {}),
    ...(source.venue ? { venue: compact(source.venue, 300) } : {}),
    ...(source.published_at ? { published_at: compact(source.published_at, 50) } : {}),
    ...(source.source_family ? { source_family: compact(source.source_family, 100) } : {}),
  };
}

function validLedger(value: unknown): value is ScientificInspirationLedger {
  if (!value || typeof value !== "object") return false;
  const ledger = value as Partial<ScientificInspirationLedger>;
  return ledger.version === 1
    && Array.isArray(ledger.entries)
    && Array.isArray(ledger.sources)
    && Number.isFinite(ledger.provider_calls);
}

class PersistentEvidenceLedger {
  ledger?: ScientificInspirationLedger;
  loadPromise?: Promise<ScientificInspirationLedger>;
  writeChain: Promise<void> = Promise.resolve();

  constructor(readonly options: ScientificInspirationToolOptions) {}

  async load(): Promise<ScientificInspirationLedger> {
    if (this.ledger) return this.ledger;
    this.loadPromise ??= (async () => {
      try {
        const parsed = JSON.parse(await readFile(this.options.ledgerPath, "utf8"));
        if (validLedger(parsed)) {
          parsed.max_distinct_queries = Math.max(1, Number(this.options.maxDistinctQueries || parsed.max_distinct_queries || 9));
          return parsed;
        }
      } catch {
        // A missing or incomplete ledger starts a new creative exploration.
      }
      const now = (this.options.now?.() || new Date()).toISOString();
      return {
        version: 1,
        created_at: now,
        updated_at: now,
        max_distinct_queries: Math.max(1, Number(this.options.maxDistinctQueries || 9)),
        provider_calls: 0,
        entries: [],
        sources: [],
      };
    })();
    this.ledger = await this.loadPromise;
    return this.ledger;
  }

  async persist(): Promise<void> {
    const ledger = await this.load();
    ledger.updated_at = (this.options.now?.() || new Date()).toISOString();
    this.writeChain = this.writeChain.then(() => atomicWriteJson(this.options.ledgerPath, ledger));
    await this.writeChain;
  }
}

function responseFor(
  ledger: ScientificInspirationLedger,
  entry: ScientificInspirationEvidence,
  cached: boolean,
): Record<string, unknown> {
  const selected = new Set(entry.source_ids);
  return {
    ok: entry.ok,
    cached,
    evidence_id: entry.evidence_id,
    intent: entry.intent,
    source_strategy: entry.source_strategy || "rag_first",
    query: entry.query,
    web_provider: entry.web_provider,
    sources: ledger.sources.filter((source) => selected.has(source.source_id)),
    warnings: entry.warnings,
    ...(entry.error ? { error: entry.error } : {}),
    budget: {
      used: ledger.provider_calls,
      max: ledger.max_distinct_queries,
      remaining: Math.max(0, ledger.max_distinct_queries - ledger.provider_calls),
    },
  };
}

/**
 * Creates an opt-in Pi custom tool. Merely constructing this tool does not
 * register it with the main SeekBrain workflow or change stage routing.
 */
export function createScientificInspirationTool(options: ScientificInspirationToolOptions): ExistingPiCustomTool {
  const store = new PersistentEvidenceLedger(options);
  const inflight = new Map<string, Promise<Record<string, unknown>>>();
  let instanceProviderCalls = 0;

  async function execute(params: ScientificInspirationParameters, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const cleaned: ScientificInspirationParameters = {
      intent: compact(params.intent, 100) as ScientificInspirationIntent,
      target_abstraction: compact(params.target_abstraction, 1_500),
      current_hypothesis: compact(params.current_hypothesis, 2_000),
      source_strategy: params.source_strategy === "include_ncs" || params.source_strategy === "ncs_only"
        ? params.source_strategy
        : "rag_first",
    };
    if (!INTENTS.has(cleaned.intent)) throw new Error(`Unsupported scientific inspiration intent: ${cleaned.intent}`);
    if (!cleaned.target_abstraction) throw new Error("target_abstraction is required");
    if (!cleaned.current_hypothesis) throw new Error("current_hypothesis is required");

    const key = cacheKey(cleaned);
    const ledger = await store.load();
    const cached = ledger.entries.find((entry) => entry.cache_key === key);
    if (cached) return responseFor(ledger, cached, true);
    const pending = inflight.get(key);
    if (pending) return await pending;

    const request = (async () => {
      const current = await store.load();
      const existing = current.entries.find((entry) => entry.cache_key === key);
      if (existing) return responseFor(current, existing, true);
      if (current.provider_calls >= current.max_distinct_queries) {
        return {
          ok: false,
          cached: false,
          budget_exhausted: true,
          error: `Scientific inspiration search budget exhausted after ${current.max_distinct_queries} distinct queries.`,
          budget: { used: current.provider_calls, max: current.max_distinct_queries, remaining: 0 },
        };
      }
      const instanceLimit = Math.max(1, Number(options.maxCallsPerToolInstance || current.max_distinct_queries));
      if (instanceProviderCalls >= instanceLimit) {
        return {
          ok: false,
          cached: false,
          request_budget_exhausted: true,
          error: `This search request reached its ${instanceLimit}-attempt limit.`,
          budget: { used: current.provider_calls, max: current.max_distinct_queries, remaining: Math.max(0, current.max_distinct_queries - current.provider_calls) },
        };
      }

      current.provider_calls += 1;
      instanceProviderCalls += 1;
      const query = buildScientificInspirationQuery(cleaned);
      let result: PublicWebSearchResult;
      try {
        result = await options.webSearch.search({
          query,
          limit: Math.min(10, Math.max(1, Number(options.resultLimit || 6))),
          source_strategy: cleaned.source_strategy,
        }, signal);
      } catch (error) {
        result = { ok: false, provider: "unknown", results: [], warnings: ["Scientific inspiration Web search failed"], error: String(error) };
      }

      const sourceIds: string[] = [];
      const sourceByKey = new Map(current.sources.map((source) => [source.dedupe_key, source]));
      for (const raw of Array.isArray(result.results) ? result.results : []) {
        if (!raw || typeof raw !== "object") continue;
        const key = sourceDedupeKey(raw);
        let source = sourceByKey.get(key);
        if (!source) {
          source = compactSource(raw, `S${current.sources.length + 1}`, Math.min(20_000, Math.max(1_000, Number(options.sourceCharLimit || 4_000))));
          current.sources.push(source);
          sourceByKey.set(key, source);
        }
        sourceIds.push(source.source_id);
      }
      const now = (options.now?.() || new Date()).toISOString();
      const entry: ScientificInspirationEvidence = {
        evidence_id: `E${current.entries.length + 1}`,
        intent: cleaned.intent,
        source_strategy: cleaned.source_strategy || "rag_first",
        target_abstraction: cleaned.target_abstraction,
        current_hypothesis: cleaned.current_hypothesis,
        query,
        cache_key: key,
        created_at: now,
        ok: Boolean(result.ok) && sourceIds.length > 0,
        web_provider: compact(result.provider || "unknown", 100),
        source_ids: [...new Set(sourceIds)],
        warnings: Array.isArray(result.warnings) ? result.warnings.map((warning) => compact(warning, 500)).filter(Boolean) : [],
        ...(result.error ? { error: compact(result.error, 2_000) } : {}),
      };
      current.entries.push(entry);
      await store.persist();
      return responseFor(current, entry, false);
    })();
    inflight.set(key, request);
    try {
      return await request;
    } finally {
      inflight.delete(key);
    }
  }

  return {
    name: "search_scientific_inspiration",
    label: "Search scientific inspiration",
    description: "Search scientific literature with one explicit intent: transfer a remote mechanism, locate the nearest prior work, or seek counterevidence. SeekBrain literature RAG is primary and recent Nature/Science/Cell search is a bounded supplement. All calls share a persistent evidence ledger and a distinct-query budget.",
    parameters: Type.Object({
      intent: Type.Union([
        Type.Literal("remote_analogy"),
        Type.Literal("nearest_prior"),
        Type.Literal("counterevidence"),
      ]),
      target_abstraction: Type.String({ minLength: 3, maxLength: 1_500 }),
      current_hypothesis: Type.String({ minLength: 3, maxLength: 2_000 }),
      source_strategy: Type.Optional(Type.Union([
        Type.Literal("rag_first"),
        Type.Literal("include_ncs"),
        Type.Literal("ncs_only"),
      ], { description: "Use rag_first by default. Use include_ncs when the researcher explicitly requests Web/NCS search, and ncs_only only when they explicitly exclude RAG." })),
    }),
    async execute(_toolCallId: string, params: ScientificInspirationParameters, signal?: AbortSignal) {
      const result = await execute(params, signal);
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        details: {
          ledger_path: options.ledgerPath,
          evidence_id: result.evidence_id,
          cached: result.cached,
          budget: result.budget,
        },
        isError: result.budget_exhausted === true || result.request_budget_exhausted === true,
      };
    },
  };
}

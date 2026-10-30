import { randomUUID } from "node:crypto";
import type { LiteratureQueryClient, LiteratureQueryInput, LiteratureQueryResult, PaperRecord } from "../contracts.ts";
import { resolveLiteratureCredential } from "../credentials.ts";
import { PmcEnricher } from "../shared/pmc-enricher.ts";
import { discoverPaperRepositories } from "../shared/repository-extractor.ts";
import { SemanticScholarClient } from "./client.ts";
import { planSemanticScholarQueries } from "./query-planner.ts";

type Json = Record<string, any>;

export interface SemanticScholarRetrieverOptions {
  fetchImpl?: typeof fetch;
  env?: NodeJS.ProcessEnv;
  pmcEnricher?: PmcEnricher;
  clientFactory?: (options: ConstructorParameters<typeof SemanticScholarClient>[0]) => SemanticScholarClient;
}

function stringValue(value: unknown): string | undefined {
  const text = String(value || "").trim();
  return text || undefined;
}

function pmcidValue(value: unknown): string | undefined {
  const text = stringValue(value);
  return text ? `PMC${text.replace(/^PMC/i, "")}` : undefined;
}

function normalizePaper(raw: Json): PaperRecord | undefined {
  const title = stringValue(raw.title);
  const providerId = stringValue(raw.paperId);
  if (!title || !providerId) return undefined;
  const external = raw.externalIds && typeof raw.externalIds === "object" ? raw.externalIds : {};
  return {
    provider: "semantic_scholar",
    providerId,
    title,
    ...(stringValue(raw.abstract || raw.tldr?.text) ? { abstract: stringValue(raw.abstract || raw.tldr?.text) } : {}),
    authors: Array.isArray(raw.authors) ? raw.authors.map((author: Json) => stringValue(author?.name)).filter((name: string | undefined): name is string => Boolean(name)) : [],
    ...(Number.isFinite(Number(raw.year)) ? { year: Number(raw.year) } : {}),
    ...(stringValue(raw.venue) ? { venue: stringValue(raw.venue) } : {}),
    ...(stringValue(external.DOI) ? { doi: stringValue(external.DOI) } : {}),
    ...(stringValue(external.PubMed) ? { pmid: stringValue(external.PubMed) } : {}),
    ...(pmcidValue(external.PubMedCentral) ? { pmcid: pmcidValue(external.PubMedCentral) } : {}),
    ...(stringValue(raw.openAccessPdf?.url) ? { openAccessPdf: stringValue(raw.openAccessPdf.url) } : {}),
    repositoryCandidates: [],
  };
}

function identity(paper: PaperRecord): string[] {
  return [paper.providerId, paper.doi && `doi:${paper.doi.toLowerCase()}`, paper.pmid && `pmid:${paper.pmid}`, paper.pmcid && `pmcid:${paper.pmcid}`, `title:${paper.title.toLowerCase().replace(/\W+/g, " ").trim()}`].filter((value): value is string => Boolean(value));
}

function mergePapers(groups: Json[][]): PaperRecord[] {
  const papers: PaperRecord[] = [];
  const aliases = new Map<string, PaperRecord>();
  for (const raw of groups.flat()) {
    const paper = normalizePaper(raw);
    if (!paper) continue;
    const existing = identity(paper).map((key) => aliases.get(key)).find(Boolean);
    if (existing) {
      if (!existing.abstract && paper.abstract) existing.abstract = paper.abstract;
      if (!existing.doi && paper.doi) existing.doi = paper.doi;
      if (!existing.pmid && paper.pmid) existing.pmid = paper.pmid;
      if (!existing.pmcid && paper.pmcid) existing.pmcid = paper.pmcid;
      if (!existing.openAccessPdf && paper.openAccessPdf) existing.openAccessPdf = paper.openAccessPdf;
      for (const key of identity(existing)) aliases.set(key, existing);
      continue;
    }
    papers.push(paper);
    for (const key of identity(paper)) aliases.set(key, paper);
  }
  return papers;
}

function tokens(value: string): Set<string> {
  return new Set(value.toLowerCase().match(/[\p{L}\p{N}]+/gu)?.filter((word) => word.length > 2) || []);
}

function relevance(question: string, paper: PaperRecord): number {
  const query = tokens(question);
  if (!query.size) return 0;
  const title = tokens(paper.title);
  const body = tokens(`${paper.abstract || ""} ${paper.fullText || ""}`);
  let score = 0;
  for (const token of query) {
    if (title.has(token)) score += 3;
    else if (body.has(token)) score += 1;
  }
  return score / (query.size * 3);
}

function source(paper: PaperRecord, index: number, sourceCharLimit: number) {
  const identifiers = [paper.doi && `DOI: ${paper.doi}`, paper.pmid && `PMID: ${paper.pmid}`, paper.pmcid && `PMCID: ${paper.pmcid}`].filter(Boolean);
  const text = [paper.abstract, paper.fullText, identifiers.join(" · ")].filter(Boolean).join("\n\n").slice(0, sourceCharLimit);
  return {
    source_id: `S${index + 1}`,
    title: paper.title,
    pub_time: paper.year ?? "",
    magazine: paper.venue ?? "",
    github_links: [],
    text,
    provider: paper.provider,
    provider_id: paper.providerId,
    doi: paper.doi,
    pmid: paper.pmid,
    pmcid: paper.pmcid,
    open_access_pdf: paper.openAccessPdf,
    repository_candidates: paper.repositoryCandidates,
  };
}

export class SemanticScholarRetriever implements LiteratureQueryClient {
  readonly fetchImpl: typeof fetch;
  readonly env: NodeJS.ProcessEnv;
  readonly pmcEnricher: PmcEnricher;
  readonly clientFactory: NonNullable<SemanticScholarRetrieverOptions["clientFactory"]>;

  constructor(options: SemanticScholarRetrieverOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.env = options.env ?? process.env;
    this.pmcEnricher = options.pmcEnricher ?? new PmcEnricher({ fetchImpl: this.fetchImpl });
    this.clientFactory = options.clientFactory ?? ((clientOptions) => new SemanticScholarClient(clientOptions));
  }

  async query(input: LiteratureQueryInput, _cwd?: string, signal?: AbortSignal): Promise<LiteratureQueryResult> {
    const traceId = randomUUID();
    const question = String(input.question || input.query || "").trim();
    if (!question) return { ok: false, trace_id: traceId, paper_source: "semantic_scholar", sources: [], source_count: 0, warnings: ["question/query is required"], error: "question/query is required" };
    try {
      const credential = await resolveLiteratureCredential({
        provider: "semantic_scholar",
        credentialRef: input.credential_ref,
        credentialStore: input.credential_store,
      }, this.env);
      if (!credential.apiKey) throw new Error("Semantic Scholar API key is not configured");
      const client = this.clientFactory({
        baseUrl: input.base_url,
        apiKey: credential.apiKey,
        credentialIdentity: credential.identity,
        fetchImpl: this.fetchImpl,
        timeoutSeconds: Number(input.timeout ?? input.rag_timeout ?? 60),
      });
      const requestedTopK = Number(input.top_k ?? 4);
      const resultLimit = Number.isFinite(requestedTopK) ? Math.max(1, Math.min(100, Math.floor(requestedTopK))) : 4;
      const requestedPool = Number(input.candidate_pool_size ?? Math.max(resultLimit, 10));
      const queryLimit = Number.isFinite(requestedPool) ? Math.max(resultLimit, Math.min(100, Math.floor(requestedPool))) : Math.max(resultLimit, 10);
      const variants = planSemanticScholarQueries(question, Number(input.query_variant_count ?? 3), input.literature_queries);
      const successful: Json[][] = [];
      const warnings: string[] = [];
      let attemptedQueryCount = 0;
      for (const [index, variant] of variants.entries()) {
        attemptedQueryCount += 1;
        try {
          successful.push(await client.search(variant, queryLimit, signal));
        } catch (error) {
          warnings.push(`Semantic Scholar query ${index + 1} failed: ${String(error)}`);
        }
        if (mergePapers(successful).length >= queryLimit) break;
      }
      if (!successful.length) throw new Error(warnings[0] || "Semantic Scholar retrieval failed");
      const papers = mergePapers(successful);
      for (const paper of papers) paper.relevanceScore = relevance(question, paper);
      papers.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0) || (b.year || 0) - (a.year || 0) || a.title.localeCompare(b.title));
      const enrichLimit = Math.min(papers.length, queryLimit);
      let enrichedFullTextCount = 0;
      for (const paper of papers.slice(0, enrichLimit)) {
        if (!paper.pmcid) continue;
        try {
          paper.fullText = await this.pmcEnricher.fullText(paper.pmcid, signal);
          if (paper.fullText) enrichedFullTextCount += 1;
        } catch (error) {
          warnings.push(`PMC enrichment failed for ${paper.pmcid}: ${String(error)}`);
        }
      }
      for (const paper of papers) paper.repositoryCandidates = discoverPaperRepositories(paper);
      for (const paper of papers) paper.relevanceScore = relevance(question, paper);
      papers.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0) || (b.year || 0) - (a.year || 0) || a.title.localeCompare(b.title));
      const selected = papers.slice(0, resultLimit);
      const requestedCharLimit = Number(input.source_char_limit ?? 5000);
      const sourceCharLimit = Number.isFinite(requestedCharLimit) ? Math.max(500, Math.floor(requestedCharLimit)) : 5000;
      const sources = selected.map((paper, index) => source(paper, index, sourceCharLimit));
      return {
        ok: true,
        trace_id: traceId,
        paper_source: "semantic_scholar",
        sources,
        source_count: sources.length,
        warnings,
        ...((input.require_github === true || input.include_papers === true) ? { papers: selected } : {}),
        metrics: {
          query_variant_count: variants.length,
          attempted_query_count: attemptedQueryCount,
          retrieved_count: papers.length,
          enriched_full_text_count: enrichedFullTextCount,
        },
      };
    } catch (error) {
      return { ok: false, trace_id: traceId, paper_source: "semantic_scholar", sources: [], source_count: 0, warnings: ["Semantic Scholar retrieval failed"], error: String(error) };
    }
  }
}

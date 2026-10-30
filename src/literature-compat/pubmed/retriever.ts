import { randomUUID } from "node:crypto";
import type { LiteratureQueryClient, LiteratureQueryInput, LiteratureQueryResult, PaperRecord } from "../contracts.ts";
import { resolveLiteratureCredential } from "../credentials.ts";
import { PmcEnricher } from "../shared/pmc-enricher.ts";
import { discoverPaperRepositories } from "../shared/repository-extractor.ts";
import { PubMedClient } from "./client.ts";
import { parsePubMedFetchXml, parsePubMedSummary } from "./parser.ts";
import { planPubMedQueries } from "./query-planner.ts";

export interface PubMedRetrieverOptions {
  fetchImpl?: typeof fetch;
  env?: NodeJS.ProcessEnv;
  pmcEnricher?: PmcEnricher;
  clientFactory?: (options: ConstructorParameters<typeof PubMedClient>[0]) => PubMedClient;
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

function rank(question: string, papers: PaperRecord[]): void {
  for (const paper of papers) paper.relevanceScore = relevance(question, paper);
  papers.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0) || (b.year || 0) - (a.year || 0) || a.title.localeCompare(b.title));
}

function paperIdentity(paper: PaperRecord): string[] {
  return [
    paper.doi && `doi:${paper.doi.toLowerCase()}`,
    paper.pmcid && `pmcid:${paper.pmcid.toUpperCase()}`,
    `title:${paper.title.toLowerCase().replace(/\W+/g, " ").trim()}`,
  ].filter((value): value is string => Boolean(value));
}

function mergeDuplicatePapers(papers: PaperRecord[]): PaperRecord[] {
  const merged: PaperRecord[] = [];
  const aliases = new Map<string, PaperRecord>();
  for (const paper of papers) {
    const existing = paperIdentity(paper).map((key) => aliases.get(key)).find(Boolean);
    if (!existing) {
      merged.push(paper);
      for (const key of paperIdentity(paper)) aliases.set(key, paper);
      continue;
    }
    if (!existing.abstract && paper.abstract) existing.abstract = paper.abstract;
    if (!existing.fullText && paper.fullText) existing.fullText = paper.fullText;
    if (!existing.doi && paper.doi) existing.doi = paper.doi;
    if (!existing.pmcid && paper.pmcid) existing.pmcid = paper.pmcid;
    for (const key of paperIdentity(existing)) aliases.set(key, existing);
  }
  return merged;
}

function source(paper: PaperRecord, index: number, sourceCharLimit: number) {
  const identifiers = [paper.doi && `DOI: ${paper.doi}`, paper.pmid && `PMID: ${paper.pmid}`, paper.pmcid && `PMCID: ${paper.pmcid}`].filter(Boolean);
  return {
    source_id: `S${index + 1}`,
    title: paper.title,
    pub_time: paper.year ?? "",
    magazine: paper.venue ?? "",
    github_links: [],
    text: [paper.abstract, paper.fullText, identifiers.join(" · ")].filter(Boolean).join("\n\n").slice(0, sourceCharLimit),
    provider: paper.provider,
    provider_id: paper.providerId,
    doi: paper.doi,
    pmid: paper.pmid,
    pmcid: paper.pmcid,
    open_access_pdf: paper.openAccessPdf,
    repository_candidates: paper.repositoryCandidates,
  };
}

export class PubMedRetriever implements LiteratureQueryClient {
  readonly fetchImpl: typeof fetch;
  readonly env: NodeJS.ProcessEnv;
  readonly pmcEnricher: PmcEnricher;
  readonly clientFactory: NonNullable<PubMedRetrieverOptions["clientFactory"]>;

  constructor(options: PubMedRetrieverOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.env = options.env ?? process.env;
    this.pmcEnricher = options.pmcEnricher ?? new PmcEnricher({ fetchImpl: this.fetchImpl });
    this.clientFactory = options.clientFactory ?? ((clientOptions) => new PubMedClient(clientOptions));
  }

  async query(input: LiteratureQueryInput, _cwd?: string, signal?: AbortSignal): Promise<LiteratureQueryResult> {
    const traceId = randomUUID();
    const question = String(input.question || input.query || "").trim();
    if (!question) return { ok: false, trace_id: traceId, paper_source: "pubmed", sources: [], source_count: 0, warnings: ["question/query is required"], error: "question/query is required" };
    try {
      const credential = await resolveLiteratureCredential({
        provider: "pubmed",
        credentialRef: input.credential_ref,
        credentialStore: input.credential_store,
      }, this.env);
      if (!credential.apiKey) throw new Error("NCBI API key is not configured");
      const client = this.clientFactory({
        baseUrl: input.base_url,
        apiKey: credential.apiKey,
        credentialIdentity: credential.identity,
        tool: input.tool || this.env.NCBI_TOOL || "seekbrain",
        email: input.email || this.env.NCBI_EMAIL,
        fetchImpl: this.fetchImpl,
        timeoutSeconds: Number(input.timeout ?? input.rag_timeout ?? 60),
      });
      const requestedTopK = Number(input.top_k ?? 4);
      const resultLimit = Number.isFinite(requestedTopK) ? Math.max(1, Math.min(100, Math.floor(requestedTopK))) : 4;
      const requestedPool = Number(input.candidate_pool_size ?? Math.max(resultLimit, 10));
      const candidatePoolSize = Number.isFinite(requestedPool) ? Math.max(resultLimit, Math.min(100, Math.floor(requestedPool))) : Math.max(resultLimit, 10);
      const variants = planPubMedQueries(question, Number(input.query_variant_count ?? 3), input.literature_queries);
      const searches = await Promise.allSettled(variants.map((variant) => client.search(variant, candidatePoolSize, signal)));
      const warnings = searches.flatMap((result, index) => result.status === "rejected" ? [`PubMed query ${index + 1} failed: ${String(result.reason)}`] : []);
      const successful = searches.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
      if (!successful.length) throw new Error(warnings[0] || "PubMed retrieval failed");
      const pmids = [...new Set(successful.flat())].slice(0, candidatePoolSize);
      if (!pmids.length) return {
        ok: true, trace_id: traceId, paper_source: "pubmed", sources: [], source_count: 0,
        warnings: [...warnings, "PubMed returned no usable sources"], ...((input.require_github === true || input.include_papers === true) ? { papers: [] } : {}),
        metrics: { query_variant_count: variants.length, retrieved_count: 0, enriched_full_text_count: 0 },
      };

      const [summaryResult, fetchResult] = await Promise.allSettled([
        client.summary(pmids, signal),
        client.fetchArticles(pmids, signal),
      ]);
      if (summaryResult.status === "rejected") warnings.push(`PubMed ESummary failed: ${String(summaryResult.reason)}`);
      if (fetchResult.status === "rejected") warnings.push(`PubMed EFetch failed: ${String(fetchResult.reason)}`);
      if (summaryResult.status === "rejected" && fetchResult.status === "rejected") throw new Error("PubMed metadata retrieval failed");

      const summaries = summaryResult.status === "fulfilled" ? parsePubMedSummary(summaryResult.value) : new Map<string, PaperRecord>();
      const fetched = fetchResult.status === "fulfilled" ? parsePubMedFetchXml(fetchResult.value) : new Map<string, Partial<PaperRecord>>();
      const normalizedPapers: PaperRecord[] = [];
      for (const pmid of pmids) {
        const summary = summaries.get(pmid);
        const details = fetched.get(pmid);
        const title = String(details?.title || summary?.title || "").trim();
        if (!title) continue;
        normalizedPapers.push({
          provider: "pubmed",
          providerId: pmid,
          title,
          authors: summary?.authors || [],
          ...(details?.abstract ? { abstract: details.abstract } : summary?.abstract ? { abstract: summary.abstract } : {}),
          ...(summary?.year ? { year: summary.year } : {}),
          ...(summary?.venue ? { venue: summary.venue } : {}),
          ...(details?.doi || summary?.doi ? { doi: details?.doi || summary?.doi } : {}),
          pmid,
          ...(details?.pmcid || summary?.pmcid ? { pmcid: details?.pmcid || summary?.pmcid } : {}),
          repositoryCandidates: [],
        });
      }

      const papers = mergeDuplicatePapers(normalizedPapers);
      rank(question, papers);
      let enrichedFullTextCount = 0;
      for (const paper of papers) {
        if (!paper.pmcid) continue;
        try {
          paper.fullText = await this.pmcEnricher.fullText(paper.pmcid, signal);
          if (paper.fullText) enrichedFullTextCount += 1;
        } catch (error) {
          warnings.push(`PMC enrichment failed for ${paper.pmcid}: ${String(error)}`);
        }
      }
      for (const paper of papers) paper.repositoryCandidates = discoverPaperRepositories(paper);
      rank(question, papers);
      const selected = papers.slice(0, resultLimit);
      const requestedCharLimit = Number(input.source_char_limit ?? 5000);
      const sourceCharLimit = Number.isFinite(requestedCharLimit) ? Math.max(500, Math.floor(requestedCharLimit)) : 5000;
      const sources = selected.map((paper, index) => source(paper, index, sourceCharLimit));
      return {
        ok: true,
        trace_id: traceId,
        paper_source: "pubmed",
        sources,
        source_count: sources.length,
        warnings,
        ...((input.require_github === true || input.include_papers === true) ? { papers: selected } : {}),
        metrics: {
          query_variant_count: variants.length,
          retrieved_count: papers.length,
          enriched_full_text_count: enrichedFullTextCount,
        },
      };
    } catch (error) {
      return { ok: false, trace_id: traceId, paper_source: "pubmed", sources: [], source_count: 0, warnings: ["PubMed retrieval failed"], error: String(error) };
    }
  }
}

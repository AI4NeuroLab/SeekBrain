import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MemoryCache } from "../../src/literature-compat/cache.ts";
import { PubMedClient } from "../../src/literature-compat/pubmed/client.ts";
import { PubMedRetriever } from "../../src/literature-compat/pubmed/retriever.ts";
import { RetryQueue } from "../../src/literature-compat/rate-limiter.ts";
import { RepositoryValidator } from "../../src/literature-compat/shared/repository-validator.ts";
import { PmcEnricher } from "../../src/literature-compat/shared/pmc-enricher.ts";
import { SemanticScholarClient } from "../../src/literature-compat/semantic-scholar/client.ts";
import { SemanticScholarRetriever } from "../../src/literature-compat/semantic-scholar/retriever.ts";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "literature");

async function json(path: string) {
  return JSON.parse(await readFile(join(FIXTURES, path), "utf8"));
}

async function text(path: string) {
  return await readFile(join(FIXTURES, path), "utf8");
}

async function fixtureTransport() {
  const [mint, wilson, summary, articles, mintPmc, wilsonPmc] = await Promise.all([
    json("semantic-scholar/mint-paper.json"),
    json("semantic-scholar/wilson-paper.json"),
    json("pubmed/esummary.json"),
    text("pubmed/articles.xml"),
    text("pmc/PMC12043240.xml"),
    text("pmc/PMC12321575.xml"),
  ]);
  const fetchImpl: typeof fetch = async (request) => {
    const url = new URL(String(request));
    if (url.pathname.endsWith("/paper/search")) {
      const query = url.searchParams.get("query") || "";
      return new Response(JSON.stringify({ data: [/MINT|multivariate information|toolbox/i.test(query) ? mint : wilson] }), { status: 200 });
    }
    if (url.pathname.endsWith("/esearch.fcgi")) {
      const term = url.searchParams.get("term") || "";
      return new Response(JSON.stringify({ esearchresult: { idlist: [/MINT|multivariate|toolbox/i.test(term) ? "40233091" : "40702322"] } }), { status: 200 });
    }
    if (url.pathname.endsWith("/esummary.fcgi")) return new Response(JSON.stringify(summary), { status: 200 });
    if (url.pathname.endsWith("/efetch.fcgi") && url.searchParams.get("db") === "pubmed") return new Response(articles, { status: 200 });
    if (url.pathname.endsWith("/efetch.fcgi") && url.searchParams.get("db") === "pmc") {
      return new Response(url.searchParams.get("id") === "12043240" ? mintPmc : wilsonPmc, { status: 200 });
    }
    return new Response("not found", { status: 404 });
  };
  return fetchImpl;
}

function semanticRetriever(fetchImpl: typeof fetch) {
  const cache = new MemoryCache();
  const queue = new RetryQueue({ minimumIntervalMs: 0 });
  return new SemanticScholarRetriever({
    fetchImpl,
    env: { SEMANTIC_SCHOLAR_API_KEY: "fixture-secret" },
    pmcEnricher: new PmcEnricher({ fetchImpl, cache, queue }),
    clientFactory: (options) => new SemanticScholarClient({ ...options, cache, queue }),
  });
}

function pubmedRetriever(fetchImpl: typeof fetch) {
  const cache = new MemoryCache();
  const queue = new RetryQueue({ minimumIntervalMs: 0 });
  return new PubMedRetriever({
    fetchImpl,
    env: { NCBI_API_KEY: "fixture-secret" },
    pmcEnricher: new PmcEnricher({ fetchImpl, cache, queue }),
    clientFactory: (options) => new PubMedClient({ ...options, cache, queue }),
  });
}

describe("real MINT and Wilson literature fixtures", () => {
  it("recovers the explicitly associated MINT repository through Semantic Scholar and PMC", async () => {
    const result = await semanticRetriever(await fixtureTransport()).query({
      paper_source: "semantic_scholar",
      question: "MINT multivariate neural information toolbox software",
      base_url: "https://api.semanticscholar.test/graph/v1",
      top_k: 1,
      require_github: true,
    });
    expect(result).toMatchObject({ ok: true, source_count: 1, sources: [{ doi: "10.1371/journal.pcbi.1012934", pmid: "40233091", pmcid: "PMC12043240" }] });
    const repositories = result.papers[0].repositoryCandidates;
    expect(repositories).toEqual(expect.arrayContaining([
      expect.objectContaining({ url: "https://github.com/panzerilab/MINT", relation: "paper_analysis_code" }),
      expect.objectContaining({ url: "https://github.com/panzerilab/MINT_figures", relation: "supplementary_code" }),
    ]));
    const validator = new RepositoryValidator({ run: async () => true, cache: new MemoryCache() });
    await expect(validator.validate(repositories.find((item: any) => item.url.endsWith("/MINT")))).resolves.toMatchObject({ ok: true, url: "https://github.com/panzerilab/MINT" });
    expect(JSON.stringify(result)).not.toContain("fixture-secret");
  });

  it("does not mislabel Wilson preprocessing dependencies or cited GitHub resources as paper code", async () => {
    const result = await semanticRetriever(await fixtureTransport()).query({
      paper_source: "semantic_scholar",
      question: "Drosophila head direction cue intensity encoding accuracy bump width",
      base_url: "https://api.semanticscholar.test/graph/v1",
      top_k: 1,
      require_github: true,
    });
    expect(result).toMatchObject({ ok: true, sources: [{ doi: "10.1038/s41593-024-01823-z", pmid: "40702322", pmcid: "PMC12321575" }] });
    const repositories = result.papers[0].repositoryCandidates;
    expect(repositories).toEqual(expect.arrayContaining([
      expect.objectContaining({ url: "https://github.com/flatironinstitute/NoRMCorre", relation: "dependency" }),
      expect.objectContaining({ url: expect.stringContaining("betanalpha/knitr_case_studies"), relation: "cited_resource" }),
    ]));
    expect(repositories.some((item: any) => item.relation === "paper_analysis_code" || item.relation === "paper_model_code")).toBe(false);
  });

  it("normalizes the same real identifiers and repository evidence through PubMed", async () => {
    const retriever = pubmedRetriever(await fixtureTransport());
    const mint = await retriever.query({ paper_source: "pubmed", question: "MINT multivariate neural information toolbox", base_url: "https://eutils.ncbi.test/entrez/eutils", top_k: 1, require_github: true });
    expect(mint).toMatchObject({ ok: true, sources: [{ provider_id: "40233091", doi: "10.1371/journal.pcbi.1012934", pmcid: "PMC12043240" }] });
    expect(mint.papers[0].repositoryCandidates).toContainEqual(expect.objectContaining({ url: "https://github.com/panzerilab/MINT", relation: "paper_analysis_code" }));

    const wilson = await retriever.query({ paper_source: "pubmed", question: "Drosophila head direction encoding accuracy visual cues", base_url: "https://eutils.ncbi.test/entrez/eutils", top_k: 1, require_github: true });
    expect(wilson).toMatchObject({ ok: true, sources: [{ provider_id: "40702322", doi: "10.1038/s41593-024-01823-z", pmcid: "PMC12321575" }] });
    expect(wilson.papers[0].repositoryCandidates.some((item: any) => item.relation === "paper_analysis_code")).toBe(false);
  });
  it.each(["pubmed", "semantic_scholar"] as const)("exposes original papers to the shared cache without requiring repositories (%s)", async provider => {
    const fetchImpl = await fixtureTransport();
    const retriever = provider === "pubmed" ? pubmedRetriever(fetchImpl) : semanticRetriever(fetchImpl);
    const result = await retriever.query({ paper_source: provider,
      question: "Drosophila head direction encoding accuracy visual cues",
      base_url: provider === "pubmed" ? "https://eutils.ncbi.test/entrez/eutils" : "https://api.semanticscholar.test/graph/v1",
      top_k: 1, require_github: false, include_papers: true, source_char_limit: 500 });
    expect(result.ok).toBe(true);
    expect(result.papers[0]).toMatchObject({ doi: "10.1038/s41593-024-01823-z", pmcid: "PMC12321575" });
    expect(result.papers[0].abstract.length).toBeGreaterThan(10);
    expect(result.papers[0].fullText.length).toBeGreaterThan(result.sources[0].text.length);
    expect(result.sources[0].text.length).toBeLessThanOrEqual(500);
  });

});

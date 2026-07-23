import { describe, expect, it, vi } from "vitest";
import { MemoryCache } from "../../src/literature-compat/cache.ts";
import { PubMedClient } from "../../src/literature-compat/pubmed/client.ts";
import { parsePubMedFetchXml, parsePubMedSummary } from "../../src/literature-compat/pubmed/parser.ts";
import { planPubMedQueries } from "../../src/literature-compat/pubmed/query-planner.ts";
import { PubMedRetriever } from "../../src/literature-compat/pubmed/retriever.ts";
import { RetryQueue } from "../../src/literature-compat/rate-limiter.ts";
import { PmcEnricher } from "../../src/literature-compat/shared/pmc-enricher.ts";

const SUMMARY = {
  result: {
    uids: ["101", "202", "303"],
    "101": {
      title: "Drosophila head direction calcium imaging",
      pubdate: "2025 Jan",
      fulljournalname: "Neuron",
      authors: [{ name: "Fly Author" }],
      articleids: [
        { idtype: "pubmed", value: "101" },
        { idtype: "doi", value: "10.1000/fly" },
        { idtype: "pmc", value: "PMC12043240" },
      ],
    },
    "202": {
      title: "Generic imaging workflow",
      pubdate: "2024",
      fulljournalname: "Methods",
      authors: [{ name: "Other Author" }],
      articleids: [{ idtype: "pubmed", value: "202" }],
    },
    "303": {
      title: "Drosophila head direction calcium imaging",
      pubdate: "2025",
      fulljournalname: "Neuron",
      authors: [{ name: "Fly Author" }],
      articleids: [{ idtype: "pubmed", value: "303" }, { idtype: "doi", value: "10.1000/fly" }],
    },
  },
};

const FETCH_XML = `
<PubmedArticleSet>
  <PubmedArticle>
    <MedlineCitation><PMID>101</PMID><Article>
      <ArticleTitle>Drosophila <i>head direction</i> calcium imaging</ArticleTitle>
      <Abstract><AbstractText>EPG neurons encode a visual-cue-aligned bump attractor.</AbstractText></Abstract>
    </Article></MedlineCitation>
    <PubmedData><ArticleIdList><ArticleId IdType="doi">10.1000/fly</ArticleId><ArticleId IdType="pmc">PMC12043240</ArticleId></ArticleIdList></PubmedData>
  </PubmedArticle>
  <PubmedArticle>
    <MedlineCitation><PMID>202</PMID><Article>
      <ArticleTitle>Generic imaging workflow</ArticleTitle>
      <Abstract><AbstractText>General image processing.</AbstractText></Abstract>
    </Article></MedlineCitation>
  </PubmedArticle>
  <PubmedArticle>
    <MedlineCitation><PMID>303</PMID><Article>
      <ArticleTitle>Drosophila head direction calcium imaging</ArticleTitle>
      <Abstract><AbstractText>Duplicate indexing record.</AbstractText></Abstract>
    </Article></MedlineCitation>
    <PubmedData><ArticleIdList><ArticleId IdType="doi">10.1000/fly</ArticleId></ArticleIdList></PubmedData>
  </PubmedArticle>
</PubmedArticleSet>`;

describe("PubMed compatibility", () => {
  it("uses short planned queries without a finite neuroscience synonym dictionary", () => {
    const planned = ["drosophila head direction", "calcium imaging EPG", "visual landmark ring attractor"];
    expect(planPubMedQueries("A long original research question", 3, planned)).toEqual(planned);

    const fallback = planPubMedQueries("How do SC and FC change during development?", 3);
    expect(fallback.length).toBeGreaterThan(0);
    expect(fallback.every((query) => !query.includes("[Title/Abstract]"))).toBe(true);
    expect(fallback.join(" ")).toContain("SC");
    expect(fallback.join(" ")).toContain("FC");
  });

  it("parses ESummary metadata and EFetch abstracts and identifiers", () => {
    expect(parsePubMedSummary(SUMMARY).get("101")).toMatchObject({
      provider: "pubmed", providerId: "101", year: 2025, venue: "Neuron", doi: "10.1000/fly", pmcid: "PMC12043240",
    });
    expect(parsePubMedFetchXml(FETCH_XML).get("101")).toMatchObject({
      title: "Drosophila head direction calcium imaging",
      abstract: "EPG neurons encode a visual-cue-aligned bump attractor.",
      doi: "10.1000/fly",
      pmcid: "PMC12043240",
    });
  });

  it("retrieves, deduplicates, enriches and normalizes PubMed candidates without leaking credentials", async () => {
    const requests: URL[] = [];
    const fetchImpl = vi.fn<typeof fetch>(async (request) => {
      const url = new URL(String(request));
      requests.push(url);
      const endpoint = url.pathname.split("/").at(-1);
      const database = url.searchParams.get("db");
      if (endpoint === "esearch.fcgi") {
        const term = url.searchParams.get("term") || "";
        const ids = term.includes("calcium") ? ["101", "202", "303"] : ["101"];
        return new Response(JSON.stringify({ esearchresult: { idlist: ids } }), { status: 200 });
      }
      if (endpoint === "esummary.fcgi") return new Response(JSON.stringify(SUMMARY), { status: 200 });
      if (endpoint === "efetch.fcgi" && database === "pubmed") return new Response(FETCH_XML, { status: 200 });
      if (endpoint === "efetch.fcgi" && database === "pmc") {
        return new Response("<article><body><p>PMC full text confirms Drosophila visual landmark head direction coding. Our analysis code is available at https://github.com/flylab/pubmed-code.</p></body></article>", { status: 200 });
      }
      return new Response("not found", { status: 404 });
    });
    const cache = new MemoryCache();
    const queue = new RetryQueue({ minimumIntervalMs: 0 });
    const retriever = new PubMedRetriever({
      fetchImpl,
      env: { NCBI_API_KEY: "ncbi-secret", NCBI_EMAIL: "researcher@example.org" },
      pmcEnricher: new PmcEnricher({ fetchImpl, cache, queue }),
      clientFactory: (options) => new PubMedClient({ ...options, cache, queue }),
    });
    const input = {
      paper_source: "pubmed" as const,
      question: "Drosophila head direction calcium imaging visual cue bump attractor",
      base_url: "https://eutils.ncbi.test/entrez/eutils",
      top_k: 2,
      candidate_pool_size: 10,
      tool: "seekbrain-test",
      require_github: true,
      literature_queries: ["drosophila calcium imaging", "head direction circuit", "visual cue bump"],
    };

    const result = await retriever.query(input);
    expect(result).toMatchObject({
      ok: true,
      paper_source: "pubmed",
      source_count: 2,
      metrics: { query_variant_count: 3, retrieved_count: 2, enriched_full_text_count: 1 },
    });
    expect(result.sources[0]).toMatchObject({
      provider: "pubmed", provider_id: "101", pmid: "101", pmcid: "PMC12043240", doi: "10.1000/fly", github_links: [],
    });
    expect(result.sources[0].text).toContain("PMC full text confirms Drosophila");
    expect(result.papers[0].repositoryCandidates).toEqual([expect.objectContaining({ url: "https://github.com/flylab/pubmed-code", relation: "paper_analysis_code", discoverySource: "pmc_full_text" })]);
    expect(result.sources[0].github_links).toEqual([]);
    expect(requests.filter((url) => url.pathname.endsWith("esearch.fcgi"))).toHaveLength(3);
    expect(requests.filter((url) => url.pathname.endsWith("esummary.fcgi"))).toHaveLength(1);
    expect(requests.filter((url) => url.pathname.endsWith("efetch.fcgi") && url.searchParams.get("db") === "pubmed")).toHaveLength(1);
    expect(requests.every((url) => url.searchParams.get("api_key") === "ncbi-secret" || url.searchParams.get("db") === "pmc")).toBe(true);
    expect(requests.filter((url) => url.searchParams.get("db") !== "pmc").every((url) => url.searchParams.get("tool") === "seekbrain-test")).toBe(true);
    expect(requests.filter((url) => url.searchParams.get("db") !== "pmc").every((url) => url.searchParams.get("email") === "researcher@example.org")).toBe(true);
    expect([...cache.values.keys()].join("\n")).not.toContain("ncbi-secret");
    expect(JSON.stringify(result)).not.toContain("ncbi-secret");

    await expect(retriever.query(input)).resolves.toMatchObject({ ok: true, source_count: 2 });
    expect(fetchImpl).toHaveBeenCalledTimes(6);
  });

  it("fails safely without an NCBI key", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const result = await new PubMedRetriever({ fetchImpl, env: {} }).query({ paper_source: "pubmed", question: "question" });
    expect(result).toMatchObject({ ok: false, paper_source: "pubmed", sources: [], source_count: 0 });
    expect(result.error).toContain("NCBI API key is not configured");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { MemoryCache } from "../../src/literature-compat/cache.ts";
import { resolveLiteratureCredential } from "../../src/literature-compat/credentials.ts";
import { RetryQueue } from "../../src/literature-compat/rate-limiter.ts";
import { decodePmcXml, PmcEnricher } from "../../src/literature-compat/shared/pmc-enricher.ts";
import { SemanticScholarClient } from "../../src/literature-compat/semantic-scholar/client.ts";
import { planSemanticScholarQueries } from "../../src/literature-compat/semantic-scholar/query-planner.ts";
import { SemanticScholarRetriever } from "../../src/literature-compat/semantic-scholar/retriever.ts";

describe("literature compatibility infrastructure", () => {
  it("resolves environment credentials before the protected store without exposing the secret identity", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekbrain-literature-credentials-"));
    try {
      const store = join(root, "credentials.json");
      await writeFile(store, JSON.stringify({ credentials: { semantic_default: { api_key: "stored-secret" } } }));
      await expect(resolveLiteratureCredential({ provider: "semantic_scholar", credentialRef: "semantic_default", credentialStore: store }, {
        SEMANTIC_SCHOLAR_API_KEY: "environment-secret",
      })).resolves.toEqual({ apiKey: "environment-secret", identity: "semantic_scholar:env:SEMANTIC_SCHOLAR_API_KEY" });
      await expect(resolveLiteratureCredential({ provider: "semantic_scholar", credentialRef: "semantic_default", credentialStore: store }, {}))
        .resolves.toEqual({ apiKey: "stored-secret", identity: "semantic_scholar:store:semantic_default" });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("uses provider-neutral planned queries and keeps a bounded generic fallback", () => {
    const planned = ["drosophila EPG head direction", "ring attractor visual landmark", "calcium imaging neural bump"];
    expect(planSemanticScholarQueries("A long original research question", 3, planned)).toEqual(planned);

    const fallback = planSemanticScholarQueries("Analyze the HD cell bump-scene mapping and plot three side-by-side panels for each epoch.", 3);
    expect(fallback.length).toBeGreaterThan(0);
    expect(fallback.length).toBeLessThanOrEqual(3);
    expect(fallback.every((query) => query.split(/\s+/).length <= 7)).toBe(true);
    expect(fallback.join(" ")).not.toMatch(/plot|side|three|analyze/i);
  });

  it("honors Retry-After and stops after the bounded retry count", async () => {
    const waits: number[] = [];
    const queue = new RetryQueue({ minimumIntervalMs: 0, maxRetries: 2, sleep: async (milliseconds) => { waits.push(milliseconds); }, random: () => 0 });
    let calls = 0;
    const response = await queue.schedule(async () => {
      calls += 1;
      return calls < 3
        ? new Response("limited", { status: 429, headers: { "retry-after": "1" } })
        : new Response("ok", { status: 200 });
    });
    expect(response.status).toBe(200);
    expect(calls).toBe(3);
    expect(waits).toEqual([1000, 1000]);
  });

  it("decodes and caches PMC XML by PMCID", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response("<article><body><p>Code &amp; data</p></body></article>", { status: 200 }));
    const enricher = new PmcEnricher({ fetchImpl, cache: new MemoryCache(), queue: new RetryQueue({ minimumIntervalMs: 0 }) });
    await expect(enricher.fullText("PMC12043240")).resolves.toBe("Code & data");
    await expect(enricher.fullText("12043240")).resolves.toBe("Code & data");
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(decodePmcXml("<p>A &lt; B</p>")).toBe("A < B");
  });

  it("resumes from an atomic 0600 cache across cache instances and coalesces concurrent loads", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekbrain-literature-cache-"));
    try {
      const path = join(root, "literature-cache.json");
      const first = new MemoryCache(60_000, path);
      let loads = 0;
      const [one, two] = await Promise.all([
        first.getOrLoad("semantic:store:default:query", async () => { loads += 1; return { papers: ["MINT"] }; }),
        first.getOrLoad("semantic:store:default:query", async () => { loads += 1; return { papers: ["other"] }; }),
      ]);
      expect(one).toEqual({ papers: ["MINT"] });
      expect(two).toEqual(one);
      expect(loads).toBe(1);
      expect((await stat(path)).mode & 0o777).toBe(0o600);

      const resumed = new MemoryCache(60_000, path);
      await expect(resumed.getOrLoad("semantic:store:default:query", async () => { throw new Error("network must not run"); })).resolves.toEqual({ papers: ["MINT"] });
      expect(await readFile(path, "utf8")).not.toContain("credential-secret");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("SemanticScholarRetriever", () => {
  it("merges query variants, reranks locally, retains external IDs and enriches PMCID papers", async () => {
    const requests: Array<{ url: string; headers: Headers }> = [];
    let searchCalls = 0;
    const fetchImpl = vi.fn<typeof fetch>(async (request, init) => {
      const url = String(request);
      requests.push({ url, headers: new Headers(init?.headers) });
      if (url.includes("efetch.fcgi")) {
        return new Response("<article><body><p>Full text describes Drosophila head direction calcium imaging.</p></body></article>", { status: 200 });
      }
      searchCalls += 1;
      const query = new URL(url).searchParams.get("query") || "";
      const common = {
        paperId: "paper-1",
        title: "Drosophila head direction circuits",
        abstract: "EPG calcium imaging reveals a bump attractor under visual cues. Our source code is available at https://github.com/flylab/head-direction.",
        year: 2025,
        venue: "Neuron",
        authors: [{ name: "A. Author" }],
        externalIds: { DOI: "10.1000/example", PubMed: "123", PubMedCentral: "12043240" },
        openAccessPdf: { url: "https://example.org/paper.pdf" },
      };
      return new Response(JSON.stringify({ data: [common, ...(searchCalls === 3 ? [{
        paperId: "paper-2", title: "Unrelated software", abstract: "Generic software package", year: 2026, authors: [], externalIds: {},
      }] : [])] }), { status: 200, headers: { "content-type": "application/json" } });
    });
    const queue = new RetryQueue({ minimumIntervalMs: 0 });
    const cache = new MemoryCache();
    const retriever = new SemanticScholarRetriever({
      fetchImpl,
      env: { SEMANTIC_SCHOLAR_API_KEY: "semantic-secret" },
      pmcEnricher: new PmcEnricher({ fetchImpl, cache, queue }),
      clientFactory: (options) => new SemanticScholarClient({ ...options, cache, queue }),
    });

    const result = await retriever.query({
      paper_source: "semantic_scholar",
      question: "Drosophila EPG calcium imaging head direction visual cue bump attractor",
      base_url: "https://api.semanticscholar.test/graph/v1",
      top_k: 2,
      candidate_pool_size: 10,
      require_github: true,
      literature_queries: ["drosophila EPG", "head direction circuit", "calcium imaging bump"],
    });

    expect(result).toMatchObject({
      ok: true,
      paper_source: "semantic_scholar",
      source_count: 2,
      metrics: { query_variant_count: 3, attempted_query_count: 3, retrieved_count: 2, enriched_full_text_count: 1 },
    });
    expect(result.sources[0]).toMatchObject({
      title: "Drosophila head direction circuits",
      doi: "10.1000/example",
      pmid: "123",
      pmcid: "PMC12043240",
      open_access_pdf: "https://example.org/paper.pdf",
      github_links: [],
    });
    expect(result.sources[0].text).toContain("Full text describes Drosophila");
    expect(result.papers[0].repositoryCandidates).toEqual([expect.objectContaining({ url: "https://github.com/flylab/head-direction", relation: "paper_analysis_code", discoverySource: "abstract" })]);
    expect(result.sources[0].github_links).toEqual([]);
    expect(requests.filter((request) => request.url.includes("paper/search"))).toHaveLength(3);
    expect(requests.filter((request) => request.url.includes("paper/search")).map((request) => new URL(request.url).searchParams.get("query")))
      .toEqual(["drosophila EPG", "head direction circuit", "calcium imaging bump"]);
    expect(requests.filter((request) => request.url.includes("paper/search")).every((request) => request.headers.get("x-api-key") === "semantic-secret")).toBe(true);
    expect(JSON.stringify(result)).not.toContain("semantic-secret");

    const repeated = await retriever.query({
      paper_source: "semantic_scholar",
      question: "Drosophila EPG calcium imaging head direction visual cue bump attractor",
      base_url: "https://api.semanticscholar.test/graph/v1",
      top_k: 2,
      candidate_pool_size: 10,
      require_github: true,
      literature_queries: ["drosophila EPG", "head direction circuit", "calcium imaging bump"],
    });
    expect(repeated).toMatchObject({ ok: true, source_count: 2 });
    expect(fetchImpl).toHaveBeenCalledTimes(4);
    const consumerResult = await retriever.query({
      paper_source: "semantic_scholar",
      question: "Drosophila EPG calcium imaging head direction visual cue bump attractor",
      base_url: "https://api.semanticscholar.test/graph/v1",
      top_k: 2,
      candidate_pool_size: 10,
      require_github: false,
      literature_queries: ["drosophila EPG", "head direction circuit", "calcium imaging bump"],
    });
    expect(consumerResult).not.toHaveProperty("papers");
    expect(consumerResult.sources[0].text.length).toBeLessThanOrEqual(5000);
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it("runs variants sequentially and keeps earlier papers when a later query is rate limited", async () => {
    let active = 0;
    let maximumActive = 0;
    let calls = 0;
    const retriever = new SemanticScholarRetriever({
      env: { SEMANTIC_SCHOLAR_API_KEY: "semantic-secret" },
      clientFactory: () => ({
        async search() {
          calls += 1;
          active += 1;
          maximumActive = Math.max(maximumActive, active);
          await Promise.resolve();
          active -= 1;
          if (calls === 2) throw new Error("Semantic Scholar returned HTTP 429");
          return calls === 1 ? [{
            paperId: "paper-1",
            title: "Zebrafish head direction bump",
            abstract: "Head direction cells track a visual landmark.",
            authors: [],
            externalIds: {},
          }] : [];
        },
      } as unknown as SemanticScholarClient),
    });

    const result = await retriever.query({
      paper_source: "semantic_scholar",
      question: "HD cells encode a visual bump in zebrafish",
      candidate_pool_size: 10,
      top_k: 2,
    });

    expect(result).toMatchObject({
      ok: true,
      source_count: 1,
      warnings: [expect.stringContaining("query 2 failed")],
      metrics: { query_variant_count: 2, attempted_query_count: 2, retrieved_count: 1 },
    });
    expect(maximumActive).toBe(1);
  });

  it("stops issuing variants once the requested candidate pool is full", async () => {
    const search = vi.fn(async () => [{
      paperId: "paper-1", title: "Paper one", abstract: "zebrafish visual bump", authors: [], externalIds: {},
    }, {
      paperId: "paper-2", title: "Paper two", abstract: "zebrafish head direction", authors: [], externalIds: {},
    }]);
    const retriever = new SemanticScholarRetriever({
      env: { SEMANTIC_SCHOLAR_API_KEY: "semantic-secret" },
      clientFactory: () => ({ search } as unknown as SemanticScholarClient),
    });

    const result = await retriever.query({
      paper_source: "semantic_scholar",
      question: "HD cells encode a visual bump in zebrafish",
      candidate_pool_size: 2,
      top_k: 2,
    });

    expect(result).toMatchObject({ ok: true, source_count: 2, metrics: { attempted_query_count: 1 } });
    expect(search).toHaveBeenCalledOnce();
  });

  it("fails safely without credentials and does not make a network request", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const result = await new SemanticScholarRetriever({ fetchImpl, env: {} }).query({ paper_source: "semantic_scholar", question: "question" });
    expect(result).toMatchObject({ ok: false, paper_source: "semantic_scholar", sources: [], source_count: 0 });
    expect(result.error).toContain("API key is not configured");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

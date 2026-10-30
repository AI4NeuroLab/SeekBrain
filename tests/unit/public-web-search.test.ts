import { describe, expect, it } from "vitest";
import { JinaBingPublicWebSearchClient, parseJinaBingResults, TrustedPublisherWebSearchClient } from "../../src/extension/public-web-search.ts";

const markdown = `Title: query - Bing

Markdown Content:

1.   ## [**Remote mechanism paper**](https://www.bing.com/ck/a?u=a1aHR0cHM6Ly9leGFtcGxlLm9yZy9yZW1vdGUtbWVjaGFuaXNt)

2026 · A cross-disciplinary mechanism with transferable structure.

2.   ## [Direct public result](https://arxiv.org/abs/2607.28498)

Target-conditioned abstraction for scientific inspiration retrieval.
`;

describe("public Web search preview", () => {
  it("parses public results and resolves Bing redirect URLs", () => {
    expect(parseJinaBingResults(markdown)).toEqual([
      {
        title: "Remote mechanism paper",
        url: "https://example.org/remote-mechanism",
        snippet: "2026 · A cross-disciplinary mechanism with transferable structure.",
        site: "example.org",
      },
      {
        title: "Direct public result",
        url: "https://arxiv.org/abs/2607.28498",
        snippet: "Target-conditioned abstraction for scientific inspiration retrieval.",
        site: "arxiv.org",
      },
    ]);
  });

  it("searches through the public Web client contract", async () => {
    let requestedUrl = "";
    const client = new JinaBingPublicWebSearchClient(async (url: any) => {
      requestedUrl = String(url);
      return new Response(markdown, { status: 200 });
    });
    const result = await client.search({ query: "remote scientific mechanism", limit: 1 });
    expect(requestedUrl).toContain("www.bing.com/search?q=remote%20scientific%20mechanism");
    expect(result).toMatchObject({ ok: true, provider: "jina_bing_preview" });
    expect(result.results).toHaveLength(1);
  });

  it("keeps only recent Nature, Science, and Cell-family papers from public Crossref metadata", async () => {
    let requestedUrl = "";
    const client = new TrustedPublisherWebSearchClient({
      now: () => new Date("2026-08-17T00:00:00Z"),
      fetchImpl: async (url: any) => {
        requestedUrl = String(url);
        return new Response(JSON.stringify({ message: { items: [
          {
            DOI: "10.3390/noise",
            title: ["Untrusted result"],
            published: { "date-parts": [[2026, 7, 1]] },
            "container-title": ["Other Journal"],
          },
          {
            DOI: "10.1038/s41598-026-noise",
            title: ["Broad Nature Portfolio result"],
            published: { "date-parts": [[2026, 7, 2]] },
            "container-title": ["Scientific Reports"],
          },
          {
            DOI: "10.1038/s41562-026-02533-1",
            title: ["Arousal reflects latent state transitions"],
            abstract: "<jats:p>Relevant evidence.</jats:p>",
            published: { "date-parts": [[2026, 8, 5]] },
            "container-title": ["Nature Human Behaviour"],
          },
          {
            DOI: "10.1126/science.example",
            title: ["Science result"],
            published: { "date-parts": [[2025, 4]] },
            "container-title": ["Science"],
          },
          {
            DOI: "10.1016/j.neuron.2026.01.001",
            title: ["Neuron result"],
            published: { "date-parts": [[2026, 1, 2]] },
            "container-title": ["Neuron"],
          },
        ] } }), { status: 200 });
      },
    });
    const result = await client.search({ query: "latent state arousal", limit: 3 });

    expect(requestedUrl).toContain("from-pub-date%3A2024-08-17");
    expect(result).toMatchObject({ ok: true, provider: "crossref_nature_science_cell" });
    expect(result.results.map((item) => item.source_family)).toEqual(["nature", "science", "cell"]);
    expect(result.results[0]).toMatchObject({
      url: "https://doi.org/10.1038/s41562-026-02533-1",
      venue: "Nature Human Behaviour",
      published_at: "2026-08-05",
      snippet: "Relevant evidence.",
    });
  });
});

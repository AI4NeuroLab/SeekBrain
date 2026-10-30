import { describe, expect, it, vi } from "vitest";
import { RagFirstScientificSearchClient } from "../../src/extension/scientific-inspiration-search.ts";

describe("RAG-first scientific inspiration search", () => {
  it("uses literature RAG alone when it returns enough usable sources", async () => {
    const supplement = { search: vi.fn() };
    const client = new RagFirstScientificSearchClient({
      cwd: "/run",
      resolveRagInput: async () => ({ rag_base_url: "http://rag" }),
      retrieveRag: async () => ({
        ok: true,
        sources: [1, 2, 3, 4].map((index) => ({ title: `RAG ${index}`, text: `Evidence ${index}` })),
      }),
      ncsSupplement: supplement as any,
    });
    const result = await client.search({ query: "state transition", limit: 6 });
    expect(result).toMatchObject({ ok: true, provider: "ailab_rag" });
    expect(result.results).toHaveLength(4);
    expect(supplement.search).not.toHaveBeenCalled();
  });

  it("uses the bounded NCS supplement only when the Search Agent requests it", async () => {
    const supplement = { search: vi.fn(async () => ({
      ok: true,
      provider: "crossref_nature_science_cell",
      results: [
        { title: "Nature mechanism", url: "https://doi.org/10.1038/example", snippet: "Recent evidence", source_family: "nature" },
        { title: "Science mechanism", url: "https://doi.org/10.1126/example", snippet: "Recent evidence", source_family: "science" },
      ],
    })) };
    const retrieveRag = vi.fn(async (input: any) => ({
      ok: true,
      sources: [{ title: "RAG paper", text: "Primary evidence" }],
      received: input,
    }));
    const client = new RagFirstScientificSearchClient({
      cwd: "/run",
      resolveRagInput: async () => ({ rag_base_url: "http://rag", timeout: 20 }),
      retrieveRag,
      ncsSupplement: supplement as any,
    });
    const result = await client.search({ query: "competitive occupancy", limit: 6, source_strategy: "include_ncs" });
    expect(result).toMatchObject({ ok: true, provider: "ailab_rag+ncs_crossref" });
    expect(result.results.map((item) => item.title)).toEqual(["RAG paper", "Nature mechanism", "Science mechanism"]);
    expect(retrieveRag).toHaveBeenCalledWith(expect.objectContaining({
      question: "competitive occupancy",
      top_k: 6,
      require_github: false,
    }), "/run", undefined);
    expect(supplement.search).toHaveBeenCalledWith({ query: "competitive occupancy", limit: 2 }, undefined);
  });

  it("does not silently switch sources when a RAG-first attempt is unavailable", async () => {
    const client = new RagFirstScientificSearchClient({
      cwd: "/run",
      resolveRagInput: async () => ({}),
      retrieveRag: async () => ({ ok: false, sources: [], error: "offline", warnings: ["RAG offline"] }),
      ncsSupplement: { search: async () => ({
        ok: true,
        provider: "crossref_nature_science_cell",
        results: [{ title: "Cell paper", url: "https://doi.org/example", snippet: "Evidence", source_family: "cell" }],
      }) },
    });
    const result = await client.search({ query: "alternative mechanism", limit: 4 });
    expect(result).toMatchObject({ ok: false, provider: "ailab_rag" });
    expect(result.warnings).toContain("RAG offline");
    expect(result.results).toEqual([]);
  });

  it("always includes bounded NCS results when the researcher explicitly requests Web search", async () => {
    const supplement = { search: vi.fn(async () => ({
      ok: true,
      provider: "crossref_nature_science_cell",
      results: [
        { title: "Nature recent", url: "https://doi.org/nature", snippet: "NCS evidence", source_family: "nature" },
        { title: "Cell recent", url: "https://doi.org/cell", snippet: "NCS evidence", source_family: "cell" },
      ],
    })) };
    const client = new RagFirstScientificSearchClient({
      cwd: "/run",
      resolveRagInput: async () => ({ rag_base_url: "http://rag" }),
      retrieveRag: async () => ({
        ok: true,
        sources: [1, 2, 3, 4, 5, 6].map((index) => ({ title: `RAG ${index}`, text: "Evidence" })),
      }),
      ncsSupplement: supplement as any,
    });
    const result = await client.search({ query: "explicit web request", limit: 6, source_strategy: "include_ncs" });
    expect(result.provider).toBe("ailab_rag+ncs_crossref");
    expect(result.results.map((item) => item.title)).toEqual(["RAG 1", "RAG 2", "RAG 3", "RAG 4", "Nature recent", "Cell recent"]);
    expect(supplement.search).toHaveBeenCalledWith({ query: "explicit web request", limit: 2 }, undefined);
  });

  it("can honor an explicit NCS-only request without calling RAG", async () => {
    const retrieveRag = vi.fn();
    const client = new RagFirstScientificSearchClient({
      cwd: "/run",
      resolveRagInput: async () => ({}),
      retrieveRag,
      ncsSupplement: { search: async () => ({
        ok: true,
        provider: "crossref_nature_science_cell",
        results: [{ title: "Science only", url: "https://doi.org/science", snippet: "Evidence", source_family: "science" }],
      }) },
    });
    const result = await client.search({ query: "NCS only", limit: 4, source_strategy: "ncs_only" });
    expect(result).toMatchObject({ ok: true, provider: "ncs_crossref" });
    expect(retrieveRag).not.toHaveBeenCalled();
  });
});

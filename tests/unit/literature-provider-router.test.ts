import { describe, expect, it, vi } from "vitest";
import { LiteratureProviderRouter } from "../../src/literature-compat/index.ts";
import { PaperRagClient } from "../../src/targeted-skill/index.ts";

describe("LiteratureProviderRouter", () => {
  it("delegates absent and explicit AILab requests through the frozen client contract", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const client = new PaperRagClient(async (url, init) => {
      requests.push({ url: String(url), init });
      return new Response(JSON.stringify({ results: [{ title: "Paper", full_text: "Method", github_links: [] }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    const router = new LiteratureProviderRouter(client);

    const legacy = await router.query({ question: "legacy question", base_url: "http://ailab.example/", top_k: 2, require_github: true });
    const explicit = await router.query({
      paper_source: "ailab_rag",
      question: "explicit question",
      literature_queries: ["must not alter AILab"],
      base_url: "http://ailab.example/",
      top_k: 4,
      require_github: false,
    });

    expect(requests.map((request) => request.url)).toEqual(["http://ailab.example/queryfull", "http://ailab.example/queryfull"]);
    expect(requests.map((request) => ({
      method: request.init?.method,
      headers: request.init?.headers,
      body: JSON.parse(String(request.init?.body)),
    }))).toEqual([
      { method: "POST", headers: { "content-type": "application/json" }, body: { query: "legacy question", top_k: 2, require_github: true } },
      { method: "POST", headers: { "content-type": "application/json" }, body: { query: "explicit question", top_k: 4, require_github: false } },
    ]);
    expect(legacy).toMatchObject({ ok: true, source_count: 1, sources: [{ title: "Paper", text: "Method" }] });
    expect(explicit).toMatchObject({ ok: true, source_count: 1, sources: [{ title: "Paper", text: "Method" }] });
  });

  it("does not call AILab for none or unimplemented external providers", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const router = new LiteratureProviderRouter(new PaperRagClient(fetchImpl));

    await expect(router.query({ paper_source: "none", question: "question" })).resolves.toMatchObject({ ok: false, paper_source: "none", sources: [], source_count: 0 });
    await expect(router.query({ paper_source: "semantic_scholar", question: "question" })).resolves.toMatchObject({ ok: false, paper_source: "semantic_scholar", sources: [], source_count: 0 });
    await expect(router.query({ paper_source: "pubmed", question: "question" })).resolves.toMatchObject({ ok: false, paper_source: "pubmed", sources: [], source_count: 0 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("dispatches an installed external adapter without touching AILab", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const semantic = { query: vi.fn(async () => ({ ok: true, sources: [{ title: "Semantic result" }], source_count: 1 })) };
    const router = new LiteratureProviderRouter(new PaperRagClient(fetchImpl), { semantic_scholar: semantic });

    await expect(router.query({ paper_source: "semantic_scholar", question: "question" })).resolves.toMatchObject({ ok: true, source_count: 1 });
    expect(semantic.query).toHaveBeenCalledOnce();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

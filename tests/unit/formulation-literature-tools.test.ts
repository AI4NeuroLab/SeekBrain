import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createAgentSession, DefaultResourceLoader, SessionManager, SettingsManager, type AgentSession, type ToolDefinition } from "@earendil-works/pi-coding-agent";
import { createFormulationLiteratureTools } from "../../src/formulation-literature/formulation-literature-tools.ts";
import { FormulationFullTextClient } from "../../src/formulation-literature/full-text-client.ts";

function parsed(result: any) {
  return JSON.parse(result.content[0].text);
}

function toolsFor(runDir: string, papers: unknown, readOutputCharLimit = 50_000) {
  const requests: any[] = [];
  const fetchImpl = async (_url: string | URL | Request, init?: RequestInit) => {
    requests.push(JSON.parse(String(init?.body || "{}")));
    return new Response(JSON.stringify(papers), { status: 200, headers: { "content-type": "application/json" } });
  };
  const tools = createFormulationLiteratureTools({
    cacheDir: runDir,
    client: new FormulationFullTextClient(fetchImpl as typeof fetch),
    resolveConfig: async () => ({
      provider: "ailab_rag",
      baseUrl: "http://rag.example",
      topK: 2,
      timeoutMs: 5_000,
      readOutputCharLimit,
    }),
  });
  return { search: tools[0], read: tools[1], requests };
}

describe("formulation literature tools", () => {
  it("lets Pi inject tool guidance into the system prompt only while tools are active", async () => {
    const runDir = await mkdtemp(join(tmpdir(), "seekbrain-literature-prompt-"));
    let session: AgentSession | undefined;
    try {
      const { search, read } = toolsFor(runDir, []);
      const tools = [search, read];
      const agentDir = join(runDir, "pi");
      const settingsManager = SettingsManager.inMemory();
      const resourceLoader = new DefaultResourceLoader({
        cwd: runDir, agentDir, settingsManager,
        noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true,
      });
      await resourceLoader.reload();
      ({ session } = await createAgentSession({
        cwd: runDir, agentDir, settingsManager, resourceLoader,
        sessionManager: SessionManager.inMemory(runDir),
        tools: tools.map(tool => tool.name), customTools: tools as ToolDefinition[],
      }));
      for (const tool of tools) {
        expect(session.systemPrompt).toContain(tool.promptSnippet);
        for (const guideline of tool.promptGuidelines || []) {
          expect(session.systemPrompt.split(guideline)).toHaveLength(2);
        }
      }
      session.setActiveToolsByName([]);
      for (const tool of tools) {
        expect(session.systemPrompt).not.toContain(tool.promptSnippet);
        for (const guideline of tool.promptGuidelines || []) expect(session.systemPrompt).not.toContain(guideline);
      }
    } finally {
      session?.dispose();
      await rm(runDir, { recursive: true, force: true });
    }
  });

  it("searches full text, returns abstracts, and restores the exact paper by stable ID", async () => {
    const runDir = await mkdtemp(join(tmpdir(), "seekbrain-formulation-literature-"));
    try {
      const fullText = "# Abstract\nA precise abstract.\n\n# Introduction\n" + "full evidence ".repeat(800);
      const { search, read, requests } = toolsFor(runDir, [{
        track_id: "paper-7",
        title: "Paper seven",
        full_text: fullText,
        similarity_score: 0.91,
      }]);
      const searchValue = parsed(await search.execute("search-1", { query: "neural geometry" }));
      expect(requests).toEqual([{ query: "neural geometry", top_k: 2, require_github: false }]);
      expect(searchValue.papers).toEqual([expect.objectContaining({
        paper_id: "ailab_rag:paper-7",
        title: "Paper seven",
        abstract: "A precise abstract.",
      })]);
      expect(searchValue.papers[0].full_text).toBeUndefined();

      const readValue = parsed(await read.execute("read-1", { paper_id: "ailab_rag:paper-7" }));
      expect(readValue.full_text).toBe(fullText);
      expect(readValue.truncated).toBe(false);
      expect(await readFile(readValue.full_text_path, "utf8")).toBe(fullText);
    } finally {
      await rm(runDir, { recursive: true, force: true });
    }
  });

  it("deduplicates repeated track IDs and persists source text without the legacy source limit", async () => {
    const runDir = await mkdtemp(join(tmpdir(), "seekbrain-formulation-literature-dedupe-"));
    try {
      const fullText = "x".repeat(20_000);
      const record = { track_id: 42, title: "Long paper", full_text: fullText };
      const { search, read } = toolsFor(runDir, [record, record]);
      const searchValue = parsed(await search.execute("search-1", { query: "long paper" }));
      expect(searchValue.papers).toHaveLength(1);
      const readValue = parsed(await read.execute("read-1", { paper_id: "ailab_rag:42" }));
      expect(readValue.full_text).toHaveLength(20_000);
      expect(await readFile(readValue.full_text_path, "utf8")).toHaveLength(20_000);
    } finally {
      await rm(runDir, { recursive: true, force: true });
    }
  });

  it("marks oversized model output as truncated while preserving the complete readable file", async () => {
    const runDir = await mkdtemp(join(tmpdir(), "seekbrain-formulation-literature-large-"));
    try {
      const fullText = "0123456789".repeat(500);
      const { search, read } = toolsFor(runDir, [{ track_id: "large", title: "Large", full_text: fullText }], 1_000);
      await search.execute("search-1", { query: "large" });
      const readValue = parsed(await read.execute("read-1", { paper_id: "ailab_rag:large" }));
      expect(readValue.truncated).toBe(true);
      expect(readValue.full_text).toHaveLength(1_000);
      expect(readValue.full_text_chars).toBe(5_000);
      expect(await readFile(readValue.full_text_path, "utf8")).toBe(fullText);
    } finally {
      await rm(runDir, { recursive: true, force: true });
    }
  });

  it("shares cached papers between independent agents without a second request and reports provider failures", async () => {
    const first = await mkdtemp(join(tmpdir(), "seekbrain-formulation-literature-run-a-"));
    const second = await mkdtemp(join(tmpdir(), "seekbrain-formulation-literature-run-b-"));
    try {
      const { search, read } = toolsFor(first, [{ track_id: "private", title: "Private", full_text: "content" }]);
      await search.execute("search-1", { query: "private" });
      const other = toolsFor(first, []);
      expect(parsed(await other.read.execute("read-1", { paper_id: "ailab_rag:private" })).full_text).toBe("content");
      expect(other.requests).toEqual([]);
      const missing: any = await other.read.execute("missing", { paper_id: "unknown" });
      expect(missing.isError).toBe(true);
      expect(parsed(missing).error).toContain("Unknown paper_id");

      const unavailable = createFormulationLiteratureTools({
        cacheDir: second,
        resolveConfig: async () => ({ provider: "none", baseUrl: "" }),
      })[0];
      const failed: any = await unavailable.execute("search-2", { query: "anything" });
      expect(failed.isError).toBe(true);
      expect(parsed(failed).error).toContain("unavailable");
    } finally {
      await rm(first, { recursive: true, force: true });
      await rm(second, { recursive: true, force: true });
    }
  });
  it("preserves supplied abstracts and citation metadata, and labels body previews honestly", async () => {
    const cacheDir = await mkdtemp(join(tmpdir(), "seekbrain-literature-metadata-"));
    try {
      const { search, read } = toolsFor(cacheDir, [
        { track_id: "metadata", title: "Study", full_text: "Body evidence", abstract: "Provider abstract.",
          authors: [{ name: "A. Author" }], doi: "10.123/example", pmid: "123", pmcid: "PMC123", url: "https://example.org/paper", pub_time: "2025" },
        { track_id: "preview", title: "Preview", full_text: "Body with no abstract heading." },
        { track_id: "abstract-only", title: "Abstract only", abstract: "Only an abstract is available." },
      ]);
      const result = parsed(await search.execute("s", { query: "study" }));
      expect(result.sources).toBeUndefined();
      expect(result.papers[0]).toMatchObject({ abstract: "Provider abstract.", doi: "10.123/example", pmid: "123", pmcid: "PMC123",
        url: "https://example.org/paper", authors: ["A. Author"], published_at: "2025", full_text_available: true });
      expect(result.papers[1]).toMatchObject({ abstract: "", preview: "Body with no abstract heading." });
      expect(result.papers[2]).toMatchObject({ abstract: "Only an abstract is available.", full_text_available: false });
      const restored = parsed(await read.execute("r", { paper_id: result.papers[0].paper_id }));
      expect(restored).toMatchObject({ doi: "10.123/example", full_text: "Body evidence" });
      const unavailable: any = await read.execute("r", { paper_id: result.papers[2].paper_id });
      expect(unavailable.isError).toBe(true);
      expect(parsed(unavailable).full_text).toBeUndefined();
      expect(parsed(unavailable).error).toContain("no full text");
    } finally { await rm(cacheDir, { recursive: true, force: true }); }
  });

  it("persists concurrent searches from separate instances without losing papers", async () => {
    const cacheDir = await mkdtemp(join(tmpdir(), "seekbrain-literature-concurrent-"));
    try {
      const agents = Array.from({ length: 8 }, (_, i) => toolsFor(cacheDir, [{ track_id: String(i), title: `Study ${i}`, full_text: `Evidence ${i}` }]));
      await Promise.all(agents.map(agent => agent.search.execute("s", { query: "evidence" })));
      const resumed = toolsFor(cacheDir, []);
      for (let i = 0; i < agents.length; i++) expect(parsed(await resumed.read.execute("r", { paper_id: `ailab_rag:${i}` })).full_text).toBe(`Evidence ${i}`);
      expect(resumed.requests).toEqual([]);
    } finally { await rm(cacheDir, { recursive: true, force: true }); }
  });

});

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { ExistingPiAgentAdapter } from "../../src/extension/existing-pi-agent-adapter.ts";
import { createScientificInspirationTool } from "../../src/extension/scientific-inspiration-tool.ts";

const params = {
  intent: "remote_analogy" as const,
  target_abstraction: "many heterogeneous measurements share a latent global component",
  current_hypothesis: "a shared latent state coordinates otherwise distinct neural decoders",
};

describe("scientific inspiration custom tool", () => {
  it("shares, deduplicates, and restores evidence through a persistent ledger", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekbrain-inspiration-"));
    const ledgerPath = join(root, "creative_evidence_ledger.json");
    let providerCalls = 0;
    const webSearch = {
      async search(input: any) {
        providerCalls += 1;
        expect(input.query).toContain("cross-disciplinary analogy");
        expect(input.source_strategy).toBe("rag_first");
        return {
          ok: true,
          provider: "public_web_test",
          results: [{
          title: "Common-mode rejection in distributed sensor systems",
            url: "https://example.org/common-mode",
            snippet: "A transferable mechanism for separating shared global activity from channel-specific signals.",
            site: "example.org",
          }],
          warnings: [],
        };
      },
    };
    const tool = createScientificInspirationTool({
      cwd: root,
      ledgerPath,
      webSearch,
      maxDistinctQueries: 3,
    });

    const first: any = await tool.execute("call-1", params);
    const second: any = await tool.execute("call-2", params);
    expect(providerCalls).toBe(1);
    expect(JSON.parse(first.content[0].text)).toMatchObject({ cached: false, evidence_id: "E1", sources: [{ source_id: "S1" }] });
    expect(JSON.parse(second.content[0].text)).toMatchObject({ cached: true, evidence_id: "E1", sources: [{ source_id: "S1" }] });

    const restored = createScientificInspirationTool({
      cwd: root,
      ledgerPath,
      webSearch,
      maxDistinctQueries: 3,
    });
    const third: any = await restored.execute("call-3", params);
    expect(providerCalls).toBe(1);
    expect(JSON.parse(third.content[0].text)).toMatchObject({ cached: true, evidence_id: "E1" });

    const ledger = JSON.parse(await readFile(ledgerPath, "utf8"));
    expect(ledger).toMatchObject({ version: 1, provider_calls: 1 });
    expect(ledger.entries).toHaveLength(1);
    expect(ledger.entries[0].source_strategy).toBe("rag_first");
    expect(ledger.sources).toHaveLength(1);
  });

  it("treats an explicit NCS request as a distinct cached query", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekbrain-inspiration-source-"));
    const seen: string[] = [];
    const tool = createScientificInspirationTool({
      cwd: root,
      ledgerPath: join(root, "creative_evidence_ledger.json"),
      webSearch: {
        async search(input) {
          seen.push(String(input.source_strategy));
          return { ok: true, provider: "test", results: [{ title: String(input.source_strategy), url: "", snippet: "Evidence" }] };
        },
      },
      maxDistinctQueries: 3,
    });
    await tool.execute("default", params);
    await tool.execute("ncs", { ...params, source_strategy: "include_ncs" });
    await tool.execute("ncs-cached", { ...params, source_strategy: "include_ncs" });
    expect(seen).toEqual(["rag_first", "include_ncs"]);
  });

  it("deduplicates a source across different search intents and enforces the shared budget", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekbrain-inspiration-budget-"));
    const ledgerPath = join(root, "creative_evidence_ledger.json");
    let providerCalls = 0;
    const tool = createScientificInspirationTool({
      cwd: root,
      ledgerPath,
      webSearch: {
        async search() {
          providerCalls += 1;
          return { ok: true, provider: "public_web_test", results: [{ url: "https://example.org/shared", title: "Shared source", snippet: "Evidence" }] };
        },
      },
      maxDistinctQueries: 2,
    });

    await tool.execute("remote", params);
    await tool.execute("prior", { ...params, intent: "nearest_prior" });
    const exhausted: any = await tool.execute("counter", { ...params, intent: "counterevidence" });
    const ledger = JSON.parse(await readFile(ledgerPath, "utf8"));

    expect(providerCalls).toBe(2);
    expect(ledger.entries).toHaveLength(2);
    expect(ledger.sources).toHaveLength(1);
    expect(JSON.parse(exhausted.content[0].text)).toMatchObject({ ok: false, budget_exhausted: true });
    expect(exhausted.isError).toBe(true);
  });

  it("limits one Search Agent request to three real retrieval attempts", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekbrain-inspiration-request-budget-"));
    let providerCalls = 0;
    const tool = createScientificInspirationTool({
      cwd: root,
      ledgerPath: join(root, "creative_search_pool.json"),
      webSearch: { async search() {
        providerCalls += 1;
        return {
          ok: true,
          provider: "test",
          results: [{ title: `Paper ${providerCalls}`, url: `https://example.test/paper-${providerCalls}`, snippet: "Evidence" }],
        };
      } },
      maxDistinctQueries: 9,
      maxCallsPerToolInstance: 3,
    });
    for (let index = 1; index <= 3; index += 1) {
      await tool.execute(`attempt-${index}`, { ...params, current_hypothesis: `hypothesis ${index}` });
    }
    const fourth: any = await tool.execute("attempt-4", { ...params, current_hypothesis: "hypothesis 4" });
    expect(providerCalls).toBe(3);
    expect(JSON.parse(fourth.content[0].text)).toMatchObject({ ok: false, request_budget_exhausted: true });
  });

  it("can be invoked by Pi as an isolated customTool without changing workflow tools", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekbrain-inspiration-pi-"));
    let finalTool: any;
    let inspirationTool: any;
    let inspirationResult: any;
    const sdk = {
      defineTool(definition: any) {
        if (definition.name === "finish") finalTool = definition;
        if (definition.name === "search_scientific_inspiration") inspirationTool = definition;
        return definition;
      },
      SessionManager: { inMemory: () => ({}) },
      async createAgentSession() {
        return { session: {
          subscribe: () => () => {},
          async prompt() {
            inspirationResult = await inspirationTool.execute("search-1", params);
            await finalTool.execute("finish-1", { answer: "done" });
          },
          getSessionStats: () => ({}),
          async dispose() {},
        } };
      },
    };
    const customTool = createScientificInspirationTool({
      cwd: root,
      ledgerPath: join(root, "creative_evidence_ledger.json"),
      webSearch: {
        async search() {
          return { ok: true, provider: "public_web_test", results: [{ title: "Paper", url: "https://example.org/paper", snippet: "Evidence" }] };
        },
      },
    });
    const result = await new ExistingPiAgentAdapter({ codingSdkLoader: async () => sdk }).run({
      runDir: root,
      finalizeTool: "finish",
      finalizeSchema: {},
      prompt: "Find a remote analogy",
      tools: ["read"],
      customTools: [customTool],
    });

    expect(result).toMatchObject({ ok: true, result: { answer: "done" } });
    expect(JSON.parse(inspirationResult.content[0].text)).toMatchObject({ ok: true, evidence_id: "E1" });
  });
});

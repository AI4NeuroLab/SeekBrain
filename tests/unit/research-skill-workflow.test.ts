import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { atomicWriteJson, FileRunRepository } from "../../src/core/index.ts";
import { LiteratureProviderRouter } from "../../src/literature-compat/index.ts";
import { PaperRagClient } from "../../src/targeted-skill/index.ts";
import { ResearchSkillWorkflow, RunLifecycleWorkflow } from "../../src/workflows/index.ts";

async function fixture() {
  const cwd = await mkdtemp(join(tmpdir(), "seekbrain-research-stage-"));
  const lifecycle = new RunLifecycleWorkflow(new FileRunRepository());
  const run = await lifecycle.startRun(cwd, "run", undefined, "research question");
  await lifecycle.updateState(run, { literature_queries: ["planned query one", "planned query two"] });
  const events: any[] = [];
  return { cwd, lifecycle, run, events };
}

describe("research and skill workflows", () => {
  it("resolves and persists a targeted skill through an injected port", async () => {
    const item = await fixture();
    try {
      const workflow = new ResearchSkillWorkflow({
        lifecycle: item.lifecycle,
        resolveSkill: async (input) => {
          expect(input).toMatchObject({
            paper_source: "ailab_rag",
            literature_provider: "ailab_rag",
            base_url: "https://ailab.example",
            rag_base_url: "https://ailab.example",
            relevance_threshold: 0.55,
            top_k: 2,
          });
          expect(input).not.toHaveProperty("literature_queries");
          return { ok: true, matched: true, source: "existing_skill", targeted_skill: `skill for ${input.question}`, private_trace: "hidden" };
        },
        retrievePapers: async () => ({}),
        runAgent: async () => ({ ok: false }),
        writeJson: atomicWriteJson,
        writeText: async (path, value) => { const { writeFile } = await import("node:fs/promises"); await writeFile(path, value); },
        appendEvent: async (event) => { item.events.push(event); },
        summarize: ({ private_trace: _hidden, ...visible }) => visible,
      });
      const result = await workflow.resolveTargetedSkill({
        cwd: item.cwd,
        workflowRoot: item.cwd,
        runId: item.run.runId,
        params: {},
        config: {
          paths: {},
          modules: { targeted_skill: { relevance_threshold: 0.55, top_k: 2 } },
          literature: { paper_source: "ailab_rag", providers: { ailab_rag: { base_url: "https://ailab.example" } } },
        },
        flags: { targeted_skill_match: true, targeted_skill_generate: false, deep_research: true, literature_provider: "ailab_rag" },
      });
      expect(result).toMatchObject({ ok: true, matched: true, run_id: item.run.runId });
      const state = JSON.parse(await readFile(join(item.run.runDir, "state.json"), "utf8"));
      expect(state.targeted_skill).toContain("research question");
      expect(state.targeted_skill_result.private_trace).toBeUndefined();
      expect(item.events[0].event).toBe("resolve_targeted_skill");
    } finally {
      await rm(item.cwd, { recursive: true, force: true });
    }
  });

  it("retrieves papers, synthesizes context and persists bounded stage state", async () => {
    const item = await fixture();
    try {
      let requestBody: unknown;
      const router = new LiteratureProviderRouter(new PaperRagClient(async (_url, init) => {
        requestBody = JSON.parse(String(init?.body));
        return new Response(JSON.stringify({ results: [{ title: "Paper", full_text: "Method", github_links: [] }] }), { status: 200, headers: { "content-type": "application/json" } });
      }));
      const workflow = new ResearchSkillWorkflow({
        lifecycle: item.lifecycle,
        resolveSkill: async () => ({}),
        retrievePapers: async (input, cwd, signal) => {
          expect(input).toMatchObject({ paper_source: "ailab_rag", base_url: "https://ailab.example", rag_base_url: "https://ailab.example" });
          expect(input).not.toHaveProperty("literature_queries");
          return await router.query(input, cwd, signal);
        },
        runAgent: async ({ prompt }) => ({
          ok: true,
          result: { deep_research_context: `context:${prompt.includes("Paper")}`, summary: "summary", warnings: [] },
          output_path: "output.json",
        }),
        writeJson: atomicWriteJson,
        writeText: async (path, value) => { const { writeFile } = await import("node:fs/promises"); await writeFile(path, value); },
        appendEvent: async (event) => { item.events.push(event); },
        summarize: (value) => value,
      });
      const result = await workflow.deepResearch({
        cwd: item.cwd,
        workflowRoot: item.cwd,
        runId: item.run.runId,
        params: {},
        flags: { targeted_skill_match: true, targeted_skill_generate: true, deep_research: true },
        agentConfig: { rag: { paper_source: "ailab_rag", base_url: "https://ailab.example" } },
        rolePrompt: "research role",
        finalizeSchema: {},
      });
      expect(result).toMatchObject({ ok: true, rag: { source_count: 1 } });
      expect(requestBody).toEqual({ query: "research question", top_k: 4, require_github: false });
      const state = JSON.parse(await readFile(join(item.run.runDir, "state.json"), "utf8"));
      expect(state.deep_research_context).toBe("context:true");
      expect(state.deep_research.summary).toBe("summary");
      expect(item.events[0]).toMatchObject({ event: "neuro_deep_research", source_count: 1 });
    } finally {
      await rm(item.cwd, { recursive: true, force: true });
    }
  });

  it("forwards planned queries to both external targeted Skill and Deep Research", async () => {
    const item = await fixture();
    try {
      const planned = ["planned query one", "planned query two"];
      let skillInput: Record<string, any> | undefined;
      let researchInput: Record<string, any> | undefined;
      const workflow = new ResearchSkillWorkflow({
        lifecycle: item.lifecycle,
        resolveSkill: async (input) => {
          skillInput = input;
          return { ok: true, matched: false, source: "none", targeted_skill: "" };
        },
        retrievePapers: async (input) => {
          researchInput = input;
          return { ok: true, sources: [], warnings: [] };
        },
        runAgent: async () => ({ ok: false }),
        writeJson: atomicWriteJson,
        writeText: async () => {},
        appendEvent: async () => {},
        summarize: (value) => value,
      });
      await workflow.resolveTargetedSkill({
        cwd: item.cwd,
        workflowRoot: item.cwd,
        runId: item.run.runId,
        params: {},
        config: { paths: {}, literature: { paper_source: "semantic_scholar", providers: { semantic_scholar: {} } } },
        flags: { targeted_skill_match: true, targeted_skill_generate: true, deep_research: true, literature_provider: "semantic_scholar" },
      });
      await workflow.deepResearch({
        cwd: item.cwd,
        workflowRoot: item.cwd,
        runId: item.run.runId,
        params: {},
        flags: { targeted_skill_match: true, targeted_skill_generate: true, deep_research: true, literature_provider: "semantic_scholar" },
        agentConfig: { rag: { paper_source: "semantic_scholar" } },
        rolePrompt: "research role",
        finalizeSchema: {},
      });
      expect(skillInput?.literature_queries).toEqual(planned);
      expect(researchInput?.literature_queries).toEqual(planned);
    } finally {
      await rm(item.cwd, { recursive: true, force: true });
    }
  });

  it("skips Deep Research without calling retrieval when no literature provider exists", async () => {
    const item = await fixture();
    try {
      let retrievalCalls = 0;
      const workflow = new ResearchSkillWorkflow({
        lifecycle: item.lifecycle,
        resolveSkill: async () => ({}),
        retrievePapers: async () => { retrievalCalls += 1; return {}; },
        runAgent: async () => ({ ok: false }),
        writeJson: atomicWriteJson,
        writeText: async () => {},
        appendEvent: async () => {},
        summarize: (value) => value,
      });
      const result = await workflow.deepResearch({
        cwd: item.cwd,
        workflowRoot: item.cwd,
        runId: item.run.runId,
        params: {},
        flags: { targeted_skill_match: true, targeted_skill_generate: false, deep_research: false, has_literature_provider: false, literature_provider: "none" },
        agentConfig: {},
        rolePrompt: "research role",
        finalizeSchema: {},
      });
      expect(result).toMatchObject({ ok: true, skipped: true, reason: "no_literature_provider", config_key: "literature.paper_source" });
      expect(retrievalCalls).toBe(0);
    } finally {
      await rm(item.cwd, { recursive: true, force: true });
    }
  });
});

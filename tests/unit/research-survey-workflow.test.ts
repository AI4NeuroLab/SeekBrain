import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { FileRunRepository } from "../../src/core/index.ts";
import { LiteratureProviderRouter } from "../../src/literature-compat/index.ts";
import { PaperRagClient } from "../../src/targeted-skill/index.ts";
import { ResearchSurveyWorkflow, RunLifecycleWorkflow } from "../../src/workflows/index.ts";

function storageDependencies(lifecycle: RunLifecycleWorkflow) {
  return {
    lifecycle,
    writeJson: async (path: string, value: Record<string, any>) => {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, JSON.stringify(value, null, 2));
    },
    writeText: async (path: string, value: string) => {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, value);
    },
  };
}

describe("research survey workflow", () => {
  it("matches LiteratureGroundingAgent outputs, persists provenance, and reuses an identical survey", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "seekbrain-survey-"));
    try {
      const lifecycle = new RunLifecycleWorkflow(new FileRunRepository());
      const run = await lifecycle.startRun(cwd, "run", undefined, "How do SC and FC relate during development?");
      await lifecycle.updateState(run, {
        user_background: "Prior observations suggest developmental reorganization.",
        data_info: JSON.stringify({ files: ["sc.npy", "fc_6dpf.npy", "fc_7dpf.npy"] }),
        literature_queries: ["developmental structural connectivity", "functional connectivity maturation"],
        research_planning: { status: "approved" },
      });
      let retrievalCalls = 0;
      let synthesisCalls = 0;
      let requestBody: unknown;
      const events: any[] = [];
      const router = new LiteratureProviderRouter(new PaperRagClient(async (_url, init) => {
        requestBody = JSON.parse(String(init?.body));
        return new Response(JSON.stringify({ results: [{
          title: "Developmental connectomics",
          pub_time: "2024",
          magazine: "Neuron",
          github_links: ["https://github.com/example/code"],
          full_text: "Structural and functional coupling changes with age.",
        }] }), { status: 200, headers: { "content-type": "application/json" } });
      }));
      const workflow = new ResearchSurveyWorkflow({
        ...storageDependencies(lifecycle),
        retrievePapers: async (input, requestCwd, signal) => {
          retrievalCalls += 1;
          expect(input.question).toContain("[Scientific Question]");
          expect(input.question).toContain("[User-provided Background]");
          expect(input.question).toContain("developmental reorganization");
          expect(input.question).toContain("fc_6dpf.npy");
          expect(input).toMatchObject({ paper_source: "ailab_rag", base_url: "https://ailab.example", rag_base_url: "https://ailab.example", top_k: 4, require_github: false, source_char_limit: 5000 });
          expect(input).not.toHaveProperty("literature_queries");
          return await router.query(input, requestCwd, signal);
        },
        runAgent: async ({ prompt }) => {
          synthesisCalls += 1;
          expect(prompt).toContain("Paper 1: Developmental connectomics");
          expect(prompt).toContain("Established Findings");
          expect(prompt).toContain("Unresolved Gaps");
          expect(prompt).not.toContain("Do not recommend analysis methods");
          expect(prompt).not.toContain("what numerical ranges");
          expect(prompt).not.toContain("semantic validation");
          expect(prompt).toContain("Do not include source ids, citation markers, paper labels");
          return { ok: true, result: { literature_grounding_context: "Development changes coupling strength." } };
        },
        appendEvent: async (event) => { events.push(event); },
      });
      const input = {
        cwd,
        runId: run.runId,
        enabled: true,
        agentConfig: { rag: { paper_source: "ailab_rag", base_url: "https://ailab.example", rag_base_url: "https://ailab.example" } },
        rolePrompt: "Survey role",
        finalizeSchema: {},
      };
      const first = await workflow.execute(input);
      expect(first).toMatchObject({ ok: true, reused: false, status: "ready", source_count: 1, paper_source: "ailab_rag" });
      expect(requestBody).toEqual({ query: expect.stringContaining("[Scientific Question]"), top_k: 4, require_github: false });
      expect(first.literature_grounding_context).toBe("[Literature Grounding Background]\nDevelopment changes coupling strength.");
      expect(first.sources[0]).not.toHaveProperty("text");
      expect(JSON.parse(await readFile(first.result_path, "utf8"))).toEqual({
        literature_grounding_context: first.literature_grounding_context,
        sources: first.sources,
        paper_source: "ailab_rag",
      });
      const state = JSON.parse(await readFile(join(run.runDir, "state.json"), "utf8"));
      expect(state.research_planning).toMatchObject({ status: "approved", survey: { status: "ready", source_count: 1 } });
      expect(state.literature_grounding_context).toBe(first.literature_grounding_context);
      expect(events.at(-1)).toMatchObject({ event: "neuro_research_survey", ok: true, source_count: 1 });

      const second = await workflow.execute(input);
      expect(second).toMatchObject({ ok: true, reused: true, source_count: 1 });
      expect(retrievalCalls).toBe(1);
      expect(synthesisCalls).toBe(1);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("forwards planned queries to an external Research Survey", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "seekbrain-survey-external-"));
    try {
      const lifecycle = new RunLifecycleWorkflow(new FileRunRepository());
      const run = await lifecycle.startRun(cwd, "run", undefined, "How does the circuit develop?");
      const planned = ["circuit development", "neural maturation"];
      await lifecycle.updateState(run, { literature_queries: planned, research_planning: { status: "approved" } });
      let retrievalInput: Record<string, any> | undefined;
      const workflow = new ResearchSurveyWorkflow({
        ...storageDependencies(lifecycle),
        retrievePapers: async (input) => {
          retrievalInput = input;
          return { ok: true, sources: [], warnings: [] };
        },
        runAgent: async () => ({ ok: false }),
        appendEvent: async () => {},
      });
      await workflow.execute({
        cwd,
        runId: run.runId,
        enabled: true,
        agentConfig: { rag: { paper_source: "pubmed" } },
        rolePrompt: "survey",
        finalizeSchema: {},
      });
      expect(retrievalInput?.literature_queries).toEqual(planned);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("uses the original non-blocking fallback when retrieval fails", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "seekbrain-survey-fallback-"));
    try {
      const lifecycle = new RunLifecycleWorkflow(new FileRunRepository());
      const run = await lifecycle.startRun(cwd, "run", undefined, "Question");
      await lifecycle.updateState(run, {
        user_background: "A pilot observation supplied by the user.",
        research_planning: { status: "approved" },
      });
      let synthesisCalls = 0;
      const workflow = new ResearchSurveyWorkflow({
        ...storageDependencies(lifecycle),
        retrievePapers: async () => ({ ok: false, sources: [], warnings: ["Paper RAG query failed"], error: "offline" }),
        runAgent: async () => {
          synthesisCalls += 1;
          return { ok: false, error: "must not run" };
        },
        appendEvent: async () => {},
      });
      const result = await workflow.execute({
        cwd, runId: run.runId, enabled: true,
        agentConfig: { rag: { paper_source: "ailab_rag" } }, rolePrompt: "survey", finalizeSchema: {},
      });
      expect(result).toMatchObject({ ok: true, status: "fallback", source_count: 0 });
      expect(result.literature_grounding_context).toContain("## Established Findings");
      expect(result.literature_grounding_context).toContain("Paper retrieval (ailab_rag) returned no usable literature evidence");
      expect(result.literature_grounding_context).toContain("User-provided background (not independently supported by the retrieved literature)");
      expect(result.literature_grounding_context).toContain("A pilot observation supplied by the user.");
      expect(result.literature_grounding_context).toContain("## Unresolved Gaps");
      expect(result.literature_grounding_context).toContain("## Research Planning Context");
      expect(synthesisCalls).toBe(0);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("can be disabled without changing the independent Deep Research configuration", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "seekbrain-survey-disabled-"));
    try {
      const lifecycle = new RunLifecycleWorkflow(new FileRunRepository());
      const run = await lifecycle.startRun(cwd, "run", undefined, "Question");
      await lifecycle.updateState(run, {
        literature_grounding_context: "stale background",
        literature_grounding_sources: [{ source_id: "S1" }],
        research_planning: { status: "approved", survey: { status: "ready", literature_grounding_context: "stale background" } },
      });
      let retrievalCalls = 0;
      const workflow = new ResearchSurveyWorkflow({
        ...storageDependencies(lifecycle),
        retrievePapers: async () => { retrievalCalls += 1; return {}; },
        runAgent: async () => ({ ok: false }),
        appendEvent: async () => {},
      });
      const result = await workflow.execute({ cwd, runId: run.runId, enabled: false, agentConfig: {}, rolePrompt: "survey", finalizeSchema: {} });
      expect(result).toMatchObject({ ok: true, skipped: true, reason: "disabled_by_user_config" });
      expect(retrievalCalls).toBe(0);
      const state = JSON.parse(await readFile(join(run.runDir, "state.json"), "utf8"));
      expect(state.literature_grounding_context).toBe("");
      expect(state.literature_grounding_sources).toEqual([]);
      expect(state.research_planning.survey.status).toBe("disabled");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("reports an explicit no-provider reason without retrieving papers", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "seekbrain-survey-no-provider-"));
    try {
      const lifecycle = new RunLifecycleWorkflow(new FileRunRepository());
      const run = await lifecycle.startRun(cwd, "run", undefined, "Question");
      await lifecycle.updateState(run, { research_planning: { status: "approved" } });
      let retrievalCalls = 0;
      const workflow = new ResearchSurveyWorkflow({
        ...storageDependencies(lifecycle),
        retrievePapers: async () => { retrievalCalls += 1; return {}; },
        runAgent: async () => ({ ok: false }),
        appendEvent: async () => {},
      });
      const result = await workflow.execute({
        cwd,
        runId: run.runId,
        enabled: false,
        disabledReason: "no_literature_provider",
        agentConfig: {},
        rolePrompt: "survey",
        finalizeSchema: {},
      });
      expect(result).toMatchObject({ ok: true, skipped: true, reason: "no_literature_provider" });
      expect(retrievalCalls).toBe(0);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("does not retrieve papers before Research Planning is approved", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "seekbrain-survey-gated-"));
    try {
      const lifecycle = new RunLifecycleWorkflow(new FileRunRepository());
      const run = await lifecycle.startRun(cwd, "run", undefined, "Question");
      await lifecycle.updateState(run, { research_planning: { status: "pending_review" } });
      let retrievalCalls = 0;
      const workflow = new ResearchSurveyWorkflow({
        ...storageDependencies(lifecycle),
        retrievePapers: async () => { retrievalCalls += 1; return {}; },
        runAgent: async () => ({ ok: false }),
        appendEvent: async () => {},
      });
      const result = await workflow.execute({ cwd, runId: run.runId, enabled: true, agentConfig: {}, rolePrompt: "survey", finalizeSchema: {} });
      expect(result).toMatchObject({ ok: false, blocked_by_human_review: true, required_stage: "research_planning" });
      expect(retrievalCalls).toBe(0);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

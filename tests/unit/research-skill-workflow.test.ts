import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { atomicWriteJson, FileRunRepository } from "../../src/core/index.ts";
import { LiteratureProviderRouter } from "../../src/literature-compat/index.ts";
import { PaperRagClient } from "../../src/targeted-skill/index.ts";
import { compactRecipeMethodContract, ResearchSkillWorkflow, RunLifecycleWorkflow } from "../../src/workflows/index.ts";

async function fixture() {
  const cwd = await mkdtemp(join(tmpdir(), "seekbrain-research-stage-"));
  const lifecycle = new RunLifecycleWorkflow(new FileRunRepository());
  const run = await lifecycle.startRun(cwd, "run", undefined, "research question");
  await lifecycle.updateState(run, { literature_queries: ["planned query one", "planned query two"] });
  const events: any[] = [];
  return { cwd, lifecycle, run, events };
}

describe("research and skill workflows", () => {
  it("extracts a method contract without bundled implementation code or expected results", () => {
    const recipe = `[SKILL.md]\n# FC recipe\n\n## When to use this\nRelevance prose.\n\n## Preconditions\nNeed regional traces.\n\n## Inputs and outputs\nInput region_series.npy.\n\n## Procedure\n1. Smooth.\n2. Correlate.\n\n## Key parameters\nsigma=2.\n\n## Expected results\nmean=0.4.\n\n## Pitfalls\nExclude symmetrically.\n\n## Bundled files\n\n\`\`\`python\nprint('large implementation')\n\`\`\``;
    const contract = compactRecipeMethodContract(recipe);
    expect(contract).toContain("## Procedure");
    expect(contract).toContain("sigma=2");
    expect(contract).toContain("Exclude symmetrically");
    expect(contract).not.toContain("Expected results");
    expect(contract).not.toContain("large implementation");
    expect(contract).not.toContain("Relevance prose");
  });

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
        flags: { targeted_skill_match: true, targeted_skill_generate: false, literature_provider: "ailab_rag" },
      });
      expect(result).toMatchObject({ ok: true, matched: true, run_id: item.run.runId });
      expect(result.targeted_skill).toBeUndefined();
      const state = JSON.parse(await readFile(join(item.run.runDir, "state.json"), "utf8"));
      expect(state.targeted_skill).toBeUndefined();
      expect(state.targeted_skill_path).toBe(join(item.run.runDir, "targeted_skill.md"));
      expect(await readFile(state.targeted_skill_path, "utf8")).toContain("research question");
      expect(state.targeted_skill_result.summary).toContain("research question");
      expect(state.targeted_skill_result.method_contract).toContain("skill for research question");
      expect(state.targeted_skill_result.private_trace).toBeUndefined();
      expect(item.events[0].event).toBe("seekbrain_recipe_retrieve");
    } finally {
      await rm(item.cwd, { recursive: true, force: true });
    }
  });

  it("keeps the raw question authoritative and forwards canonical dataset metadata to RecipeScout", async () => {
    const item = await fixture();
    try {
      await item.lifecycle.updateState(item.run, {
        question: "compressed canonical question",
        original_question: "raw question with exact scientific details",
        scientific_background: "larval zebrafish multiplexed FISH measurements",
        data_info: "{\"species\":\"zebrafish\",\"modality\":\"connectome\"}",
      });
      let received: Record<string, any> | undefined;
      const workflow = new ResearchSkillWorkflow({
        lifecycle: item.lifecycle,
        resolveSkill: async (input) => {
          received = input;
          return { ok: true, matched: false, source: "none", targeted_skill: "" };
        },
        writeText: async () => {},
        appendEvent: async () => {},
        summarize: (value) => value,
      });
      await workflow.resolveTargetedSkill({
        cwd: item.cwd,
        workflowRoot: item.cwd,
        runId: item.run.runId,
        params: {},
        config: { paths: {}, modules: { targeted_skill: { resolution_mode: "recipe_scout_v2" } }, literature: { paper_source: "none", providers: {} } },
        flags: { targeted_skill_match: true, targeted_skill_generate: false },
      });
      expect(received).toMatchObject({
        resolution_mode: "recipe_scout_v2",
        question: "raw question with exact scientific details",
        dataset_metadata: "{\"species\":\"zebrafish\",\"modality\":\"connectome\"}",
      });
      expect(received).not.toHaveProperty("scientific_background");
      expect(received).not.toHaveProperty("literature_queries");
    } finally {
      await rm(item.cwd, { recursive: true, force: true });
    }
  });

});

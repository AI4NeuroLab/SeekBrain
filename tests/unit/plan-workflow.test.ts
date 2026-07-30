import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FileRunRepository } from "../../src/core/index.ts";
import { PlanWorkflow, RunLifecycleWorkflow } from "../../src/workflows/index.ts";

describe("plan workflow", () => {
  it("plans through an injected agent and persists state plus the review gate", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "seekbrain-plan-stage-"));
    try {
      const lifecycle = new RunLifecycleWorkflow(new FileRunRepository());
      const run = await lifecycle.startRun(cwd, "run", undefined, "stored question");
      const metadataPath = join(cwd, "metadata.json");
      await writeFile(metadataPath, JSON.stringify({
        schema_version: 4,
        root_dir: "/data",
        dataset_type: "repeated_experimental_sessions",
        entities: { repeated_units: ["fish1"] },
        inventory: { file_count: 20 },
        relationships: [{ kind: "unit_stage", unit_pattern: "fish*", stages: ["pre", "post"] }],
        asset_families: [
          { id: "family_1", pattern: "fish*/pre/traces.npy", role: "neural_activity", schema_variants: [{ schema: { shape: [20, 100] } }] },
          { id: "family_2", pattern: "fish*/pre/scandata.json", role: "acquisition_configuration", schema_variants: [{ schema: { top_level_keys: ["laser_power"] } }] },
        ],
        quality: { status: "complete" },
      }));
      await writeFile(join(run.runDir, "targeted_skill.md"), "# Accepted method\nUse Pearson correlation.");
      await lifecycle.updateState(run, {
        metadata_locked: true,
        metadata_json_path: metadataPath,
        human_reviews: { plan: { feedback: ["add a control", { text: "state assumptions" }] } },
      });
      const events: any[] = [];
      let capturedPrompt = "";
      const workflow = new PlanWorkflow({
        lifecycle,
        runAgent: async ({ prompt }) => {
          capturedPrompt = prompt;
          return {
            ok: true,
            result: {
              plan_markdown: "# Test plan",
              review_summary: "review this plan",
              warnings: [],
            },
            output_path: "output.json",
          };
        },
        writeText: (path, value) => writeFile(path, value),
        appendEvent: async (event) => { events.push(event); },
      });
      const result = await workflow.execute({
        cwd,
        runId: run.runId,
        rolePrompt: "planner role",
        agentConfig: {},
        finalizeSchema: {},
        humanReviewRequired: true,
      });

      expect(capturedPrompt).toContain("Question:\nstored question");
      expect(capturedPrompt).toContain('"root_dir":"/data"');
      expect(capturedPrompt).toContain("fish*/pre/traces.npy");
      expect(capturedPrompt).toContain("scandata.json");
      expect(capturedPrompt).toContain("Selected recipe (already accepted; do not reassess relevance):\n# Accepted method");
      expect(capturedPrompt).toContain("1. add a control\n2. state assumptions");
      expect(capturedPrompt).not.toContain("Recipe Relevance");
      expect(await readFile(join(run.runDir, "plan.md"), "utf8")).toBe("# Test plan");
      const state = JSON.parse(await readFile(join(run.runDir, "state.json"), "utf8"));
      expect(state.plan.review_summary).toBe("review this plan");
      expect(state.plan.path).toBe(join(run.runDir, "plan.md"));
      expect(state.plan.plan_markdown).toBeUndefined();
      expect(events[0]).toMatchObject({ event: "seekbrain_formulation_generate", ok: true });
      expect(result).toMatchObject({
        ok: true,
        result: { review_summary: "review this plan", warnings: [] },
        human_review: { required: true, approved: false, needs_user_review: true, review_owner: "main_agent" },
      });
      expect(result.plan_markdown).toBeUndefined();
      expect(result.guidance).toContain("seekbrain_formulation_researcher_review");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("uses each revised Plan as the next authoritative baseline and rejects stale review decisions", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "seekbrain-plan-revisions-"));
    try {
      const lifecycle = new RunLifecycleWorkflow(new FileRunRepository());
      const run = await lifecycle.startRun(cwd, "run", undefined, "stored question");
      const planPath = join(run.runDir, "plan.md");
      await writeFile(planPath, "# Plan v1\n\nKeep this control.");
      await lifecycle.updateState(run, { plan: { path: planPath, review_summary: "v1", warnings: [], revision: 1 } });
      const prompts: string[] = [];
      let call = 0;
      const workflow = new PlanWorkflow({
        lifecycle,
        runAgent: async ({ prompt }) => {
          prompts.push(prompt);
          call += 1;
          return { ok: true, result: {
            plan_markdown: call === 1 ? "# Plan v2\n\nKeep this control.\n\nAdd check A." : "# Plan v3\n\nKeep this control.\n\nAdd check A.\n\nAdd check B.",
            review_summary: `v${call + 1}`,
            warnings: [],
          } };
        },
        writeText: (path, value) => writeFile(path, value),
        appendEvent: async () => {},
      });
      const revisionInput = { cwd, runId: run.runId, rolePrompt: "planner", agentConfig: {}, finalizeSchema: {} };
      expect(await workflow.revise({ ...revisionInput, feedback: "Add check A.", expectedRevision: 1 })).toMatchObject({ ok: true, revision: 2 });
      expect(await workflow.revise({ ...revisionInput, feedback: "Add check B.", expectedRevision: 2 })).toMatchObject({ ok: true, revision: 3 });
      expect(prompts[1]).toContain("# Plan v2");
      expect(prompts[1]).toContain("Keep this control.");
      expect(await readFile(planPath, "utf8")).toContain("Add check B.");
      expect(await workflow.revise({ ...revisionInput, restorePrevious: true, expectedRevision: 3 })).toMatchObject({ ok: true, rolled_back: true, revision: 4 });
      expect(await readFile(planPath, "utf8")).toContain("Add check A.");
      expect(await readFile(planPath, "utf8")).not.toContain("Add check B.");
      expect(JSON.parse(await readFile(join(run.runDir, "plan.previous.json"), "utf8")).plan_markdown).toContain("Add check B.");
      expect(await workflow.revise({ ...revisionInput, feedback: "stale", expectedRevision: 1 })).toMatchObject({ ok: false, stale_revision: true, current_revision: 4 });
      expect(prompts).toHaveLength(2);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

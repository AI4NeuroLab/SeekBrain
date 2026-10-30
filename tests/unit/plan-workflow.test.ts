import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { atomicWriteJson, FileRunRepository } from "../../src/core/index.ts";
import { PlanWorkflow, RunLifecycleWorkflow } from "../../src/workflows/index.ts";

describe("plan workflow", () => {
  it("keeps the Intern-style formulation rules and SeekBrain dataset adaptation explicit", async () => {
    const prompt = await readFile(join(process.cwd(), "prompts", "plan.md"), "utf8");
    const normalized = prompt.replace(/\s+/g, " ");
    expect(normalized).toContain("The question and data context are always the primary drivers");
    expect(normalized).toContain("Use dataset metadata as a navigation aid");
    expect(normalized).toContain("Inspect relevant raw and derived artifacts together");
    expect(normalized).toContain("evidence for reconstructing transformations");
    expect(normalized).toContain("establish its shape, axis meanings, row or column alignment");
    expect(normalized).toContain("Keep computation or identity order distinct from display order");
    expect(normalized).toContain("For each central transformation, define one cheap invariant");
    expect(normalized).toContain("Prefer the interpretation that satisfies the strongest verified relationship");
    expect(normalized).toContain("investigate the central conflict before finalizing");
    expect(normalized).toContain("Classify unresolved conditions as an execution blocker, an interpretation gate, or a non-blocking warning");
    expect(normalized).toContain("Only grounded central decisions enter mandatory execution requirements");
    expect(normalized).toContain("Prefer one consolidated, targeted dataset probe");
    expect(normalized).toContain("directly implement it without guessing missing details");
    expect(normalized).toContain("Use only analyses that are plausible from the inspected dataset context");
    expect(normalized).toContain("Prioritize biological interpretability over generic machine-learning boilerplate");
    expect(normalized).toContain("identify the observational unit, grouping or repeated-measure unit");
    expect(normalized).toContain("bootstrap, shuffle, permutation, uncertainty, or multiplicity unit");
    expect(normalized).toContain("Before finishing, compare `execution_contract` with Assumptions and Warnings");
    expect(normalized).toContain("Unresolved choices remain in Assumptions and Warnings rather than becoming mandatory requirements");
    expect(normalized).toContain("An analysis Recipe is a reusable neuroscience analysis Skill");
    expect(normalized).toContain("Use seekbrain_recipe_search_local to discover relevant local Skills");
    expect(normalized).toContain("read its SKILL.md from the returned skill_path");
  });

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
        task_brief: {
          raw_question: "stored question",
          scientific_goal: "compressed routing summary",
          intent_mode: "focused_analysis",
          intent_status: "ready",
          biological_scope: [],
          requested_data: [],
          hard_constraints: [],
          output_preferences: [],
        },
        human_reviews: { plan: { feedback: ["add a control", { text: "state assumptions" }] } },
      });
      const events: any[] = [];
      let capturedPrompt = "";
      let capturedCustomTools: any[] | undefined;
      const toolCalls: string[] = [];
      const formulationTools = [{ name: "seekbrain_literature_search" }, { name: "seekbrain_paper_read" }, { name: "seekbrain_recipe_search_local" }] as any;
      const workflow = new PlanWorkflow({
        lifecycle,
        createCustomTools: () => formulationTools,
        runAgent: async ({ prompt, customTools, beforeToolCall }) => {
          capturedPrompt = prompt;
          capturedCustomTools = customTools;
          await beforeToolCall?.({ toolName: "seekbrain_recipe_search_local", toolCallId: "tool-1", args: { query: "correlation" } });
          return {
            ok: true,
            result: {
              plan_markdown: "# Test plan",
              execution_contract: {
                requirements: ["Compare repeated fish sessions using Pearson correlation."],
                validation_checks: ["Verify statistics and figures use the declared repeated-session inputs."],
              },
              review_summary: "review this plan",
              warnings: [],
            },
            output_path: "output.json",
          };
        },
        writeText: (path, value) => writeFile(path, value),
        writeJson: atomicWriteJson,
        appendEvent: async (event) => { events.push(event); },
      });
      const result = await workflow.execute({
        cwd,
        runId: run.runId,
        rolePrompt: "planner role",
        agentConfig: {},
        finalizeSchema: {},
        humanReviewRequired: true,
        onToolCall: ({ toolName }) => { toolCalls.push(toolName); },
      });

      expect(capturedPrompt).toContain("Question:\nstored question");
      expect(capturedPrompt).not.toContain("TaskBrief");
      expect(capturedPrompt).toContain(`Dataset metadata JSON path:\n${metadataPath}`);
      expect(capturedPrompt).toContain("Dataset root:\n/data");
      expect(capturedPrompt).toContain("inspect the dataset read-only");
      expect(capturedPrompt).not.toContain('"root_dir":"/data"');
      expect(capturedPrompt).not.toContain("fish*/pre/traces.npy");
      expect(capturedPrompt).not.toContain("scandata.json");
      expect(capturedPrompt).toContain("Accepted method guidance:\n# Accepted method");
      expect(capturedPrompt).toContain("1. add a control\n2. state assumptions");
      expect(capturedCustomTools).toBe(formulationTools);
      expect(toolCalls).toEqual(["seekbrain_recipe_search_local"]);
      expect(capturedPrompt).not.toContain("Recipe Relevance");
      expect(await readFile(join(run.runDir, "plan.md"), "utf8")).toBe("# Test plan");
      const state = JSON.parse(await readFile(join(run.runDir, "state.json"), "utf8"));
      expect(state.plan.review_summary).toBe("review this plan");
      expect(state.plan.path).toBe(join(run.runDir, "plan.md"));
      expect(state.execution_contract.requirements).toHaveLength(1);
      expect(JSON.parse(await readFile(join(run.runDir, "execution_contract.json"), "utf8"))).toEqual(state.execution_contract);
      expect(state.plan.plan_markdown).toBeUndefined();
      expect(events[0]).toMatchObject({ event: "seekbrain_formulation_generate", ok: true });
      expect(result).toMatchObject({
        ok: true,
        revision: 1,
        result: { review_summary: "review this plan", warnings: [] },
        human_review: { required: true, approved: false, needs_user_review: true, review_owner: "main_agent" },
      });
      expect(result.plan_markdown).toBeUndefined();
      expect(result.guidance).toContain("seekbrain_formulation_researcher_review");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("passes only atomic basic context from the raw question and ignores extra_path_info", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "seekbrain-plan-basic-context-"));
    try {
      const lifecycle = new RunLifecycleWorkflow(new FileRunRepository());
      const question = "Classify zebrafish neurons from fish 1-3 using RNA spot counts, gene identities, fish identities, and brain-region annotations.";
      const run = await lifecycle.startRun(cwd, "run", undefined, question);
      await lifecycle.updateState(run, {
        extra_path_info: "Assume every count above zero is positive and every unique barcode is a subtype.",
        task_brief: {
          raw_question: question,
          scientific_goal: "compressed and potentially lossy",
          intent_mode: "focused_analysis",
          intent_status: "ready",
          biological_scope: [],
          requested_data: [],
          hard_constraints: [],
          output_preferences: [],
        },
      });
      let capturedPrompt = "";
      const workflow = new PlanWorkflow({
        lifecycle,
        runAgent: async ({ prompt }) => {
          capturedPrompt = prompt;
          return { ok: true, result: {
            plan_markdown: "# Plan",
            execution_contract: { requirements: ["Use the declared cohort."], validation_checks: ["Verify cohort selection."] },
            review_summary: "RNA observations from fish 1-3 are classified.",
            warnings: [],
          } };
        },
        writeText: (path, value) => writeFile(path, value),
        writeJson: atomicWriteJson,
        appendEvent: async () => {},
      });
      await workflow.execute({ cwd, runId: run.runId, rolePrompt: "planner", agentConfig: {}, finalizeSchema: {}, humanReviewRequired: false });
      expect(capturedPrompt).toContain('"species": [');
      expect(capturedPrompt).toContain('"zebrafish"');
      expect(capturedPrompt).toContain('"observation_units": [');
      expect(capturedPrompt).toContain('"neuron"');
      expect(capturedPrompt).toContain('"cohort": [');
      expect(capturedPrompt).toContain("fish 1-3");
      expect(capturedPrompt).toContain('"available_annotations": [');
      expect(capturedPrompt).not.toContain("Assume every count above zero");
      expect(capturedPrompt).not.toContain("compressed and potentially lossy");
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
            execution_contract: {
              requirements: ["Keep this control.", ...(call >= 1 ? ["Add check A."] : []), ...(call >= 2 ? ["Add check B."] : [])],
              validation_checks: ["Verify every required check is implemented."],
            },
            review_summary: `v${call + 1}`,
            warnings: [],
          } };
        },
        writeText: (path, value) => writeFile(path, value),
        writeJson: atomicWriteJson,
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

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { atomicWriteJson, FileRunRepository } from "../../src/core/index.ts";
import { RunLifecycleWorkflow, ValidateWorkflow } from "../../src/workflows/index.ts";

async function fixture() {
  const cwd = await mkdtemp(join(tmpdir(), "seekbrain-validate-stage-"));
  const lifecycle = new RunLifecycleWorkflow(new FileRunRepository());
  const run = await lifecycle.startRun(cwd, "run", undefined, "validate the result");
  await lifecycle.updateState(run, {
    code_attempt: 1,
    image_refinement_count: 0,
    plan: { plan_markdown: "# Plan" },
    execution_contract: {
      requirements: ["Analyze the declared sample set."],
      validation_checks: ["Verify statistics and figures report the same sample count."],
    },
    code: {
      code_files: [{ path: "generated_code.py" }],
      statistics_path: join(run.runDir, "statistics.json"),
      statistics: { n: 20 },
      warnings: ["Exploratory subset used."],
      confidence: 0.8,
    },
    artifacts: [{ path: "figure.png", kind: "figure", role: "main", description: "primary figure" }],
    validation_invalidated_by_code_edit: true,
    refinement_pending_validation: true,
  });
  await writeFile(join(run.runDir, "plan.md"), "# Plan");
  await writeFile(join(run.runDir, "generated_code.py"), "print('analysis')");
  await writeFile(join(run.runDir, "statistics.json"), JSON.stringify({ n: 20 }));
  await writeFile(join(run.runDir, "figure.png"), "png");
  return { cwd, lifecycle, run };
}

function dependencies(item: Awaited<ReturnType<typeof fixture>>) {
  return {
    lifecycle: item.lifecycle,
    loadImages: async () => ({ images: [{ type: "image" }], warnings: [] }),
    runAgent: async () => ({ ok: false }),
    normalize: (result: any) => result || {},
    nextStep: () => ({}),
    writeJson: atomicWriteJson,
    snapshot: async () => undefined,
    appendEvent: async () => undefined,
  };
}

describe("validate workflow", () => {
  it("rejects a non-vision validator before loading images", async () => {
    const item = await fixture();
    try {
      let loaded = false;
      const workflow = new ValidateWorkflow({
        ...dependencies(item),
        loadImages: async () => { loaded = true; return { images: [], warnings: [] }; },
      });
      const result = await workflow.execute({
        cwd: item.cwd,
        runId: item.run.runId,
        rolePrompt: "validator role",
        agentConfig: { vision: false },
        finalizeSchema: {},
        maxCodeAttempts: 3,
        imageRefineEnabled: false,
      });
      expect(loaded).toBe(false);
      expect(result.error).toContain("requires vision=true");
      expect(result.figure_paths).toEqual([join(item.run.runDir, "figure.png")]);
    } finally {
      await rm(item.cwd, { recursive: true, force: true });
    }
  });

  it("normalizes, persists and routes a successful visual validation", async () => {
    const item = await fixture();
    try {
      const events: any[] = [];
      const snapshots: string[] = [];
      let capturedPrompt = "";
      let normalizedContext: any;
      const workflow = new ValidateWorkflow({
        ...dependencies(item),
        runAgent: async ({ prompt, images }) => {
          capturedPrompt = prompt;
          expect(images).toHaveLength(1);
          return { ok: true, result: { pass: true, per_figure: [{ path: "figure.png", pass: true, issues: [] }], figure_observations: ["Positive effect"], summary: "valid" } };
        },
        normalize: (result, context) => {
          normalizedContext = context;
          return { ...result, route: "proceed", validated_code_attempt: context.codeAttempt };
        },
        nextStep: (_validation, runId) => ({ tool: "seekbrain_interpretation_run", args: { run_id: runId } }),
        snapshot: async (_run, label) => { snapshots.push(label); },
        appendEvent: async (event) => { events.push(event); },
      });
      const result = await workflow.execute({
        cwd: item.cwd,
        runId: item.run.runId,
        rolePrompt: "validator role",
        agentConfig: { vision: true },
        finalizeSchema: {},
        maxCodeAttempts: 3,
        imageRefineEnabled: false,
      });

      expect(capturedPrompt).toContain("Figures (1):");
      expect(capturedPrompt).toContain("Execution contract (authoritative validation target):");
      expect(capturedPrompt).toContain("Verify statistics and figures report the same sample count.");
      expect(capturedPrompt).toContain("[main] — primary figure");
      expect(capturedPrompt).toContain(`Approved plan path:\n${join(item.run.runDir, "plan.md")}`);
      expect(capturedPrompt).toContain(`Generated code paths:\n${join(item.run.runDir, "generated_code.py")}`);
      expect(capturedPrompt).toContain(`Statistics file:\n${join(item.run.runDir, "statistics.json")}`);
      expect(capturedPrompt).not.toContain("Essential statistics:");
      expect(capturedPrompt).toContain('"Exploratory subset used."');
      expect(capturedPrompt).toContain('"confidence": 0.8');
      expect(capturedPrompt).toContain("Presentation refinement available: no");
      expect(capturedPrompt).toContain("Finalize with: { pass, per_figure: [{ path, pass, issues }]");
      expect(capturedPrompt).toContain("Include every required field. Use empty arrays when there are no findings.");
      expect(normalizedContext).toEqual({ codeAttempt: 1, refinementCount: 0, maxCodeAttempts: 3, imageRefineEnabled: false });
      const validation = JSON.parse(await readFile(join(item.run.runDir, "validation.json"), "utf8"));
      expect(validation.route).toBe("proceed");
      const state = JSON.parse(await readFile(join(item.run.runDir, "state.json"), "utf8"));
      expect(state.validation_invalidated_by_code_edit).toBe(false);
      expect(state.refinement_pending_validation).toBe(false);
      expect(result).toMatchObject({ ok: true, next_step: { tool: "seekbrain_interpretation_run" } });
      expect(events[0]).toMatchObject({ event: "seekbrain_validation_run", pass: true, route: "proceed" });
      expect(snapshots).toEqual(["after_validate"]);
    } finally {
      await rm(item.cwd, { recursive: true, force: true });
    }
  });

  it("recovers an existing figure from deliverables when its state artifact kind was polluted", async () => {
    const item = await fixture();
    try {
      await item.lifecycle.updateState(item.run, {
        artifacts: [{ path: "figure.png", kind: "code", role: "analysis_script" }],
        deliverables: [{ path: "figure.png", kind: "figure", role: "main", description: "canonical figure" }],
      });
      let loadedPaths: string[] = [];
      const workflow = new ValidateWorkflow({
        ...dependencies(item),
        loadImages: async (paths) => { loadedPaths = paths; return { images: [{ type: "image" }], warnings: [] }; },
        runAgent: async () => ({ ok: true, result: { pass: true, per_figure: [], figure_observations: [], summary: "valid" } }),
        normalize: (result) => ({ ...result, route: "proceed", validated_code_attempt: 1 }),
      });
      const result = await workflow.execute({
        cwd: item.cwd,
        runId: item.run.runId,
        rolePrompt: "validator role",
        agentConfig: { vision: true },
        finalizeSchema: {},
        maxCodeAttempts: 3,
        imageRefineEnabled: false,
      });
      expect(result.ok).toBe(true);
      expect(loadedPaths).toEqual([join(item.run.runDir, "figure.png")]);
    } finally {
      await rm(item.cwd, { recursive: true, force: true });
    }
  });

  it("persists Recipe attribution and lets the bounded revision handler augment the existing Code retry", async () => {
    const item = await fixture();
    try {
      await item.lifecycle.updateState(item.run, {
        targeted_skill_path: join(item.run.runDir, "targeted_skill.md"),
        targeted_skill_result: {
          source: "generated_from_rag",
          recipe_status: "candidate",
          recipe_set: { selected: [{ recipe_id: "repo-recipe", path: "/skills/repo-recipe" }] },
          method_contract: "## Preconditions\n\nTwo groups are required.",
        },
      });
      await writeFile(join(item.run.runDir, "targeted_skill.md"), "# Recipe");
      let prompt = "";
      let handlerInput: any;
      const workflow = new ValidateWorkflow({
        ...dependencies(item),
        runAgent: async (input) => {
          prompt = input.prompt;
          return {
            ok: true,
            result: {
              pass: false,
              per_figure: [{ path: "figure.png", pass: false, issues: ["group contrast missing"] }],
              blocking_issues: ["group contrast missing"],
              recipe_feedback: {
                attribution: "recipe_defect",
                recipe_id: "repo-recipe",
                defect_type: "missing_precondition",
                failed_checks: ["two groups required"],
                evidence: ["one group was observed"],
                preserve: ["figure path exists"],
                suggested_scope: "local",
                summary: "Input guard is missing.",
              },
              summary: "invalid",
            },
          };
        },
        normalize: (result, context) => ({ ...result, pass: false, route: "retry_code", next_code_feedback: "group contrast missing", validated_code_attempt: context.codeAttempt }),
        handleRecipeFeedback: async (input) => {
          handlerInput = input;
          return {
            state_patch: { recipe_revision_count: 1, recipe_revision_candidate: { status: "candidate" } },
            validation_patch: { next_code_feedback: "group contrast missing\nRecipe revision guidance: validate groups", recipe_revision: { status: "candidate" } },
          };
        },
        nextStep: (validation, runId) => ({ tool: "seekbrain_code_execute", args: { run_id: runId, validation_feedback: validation.next_code_feedback } }),
      });
      const result = await workflow.execute({
        cwd: item.cwd,
        runId: item.run.runId,
        rolePrompt: "validator role",
        agentConfig: { vision: true },
        finalizeSchema: {},
        maxCodeAttempts: 3,
        imageRefineEnabled: false,
        recipeRevision: { enabled: true, budget: 1, generated_only: true },
      });
      expect(prompt).toContain("Recipe selection and contract:");
      expect(prompt).toContain("repo-recipe");
      expect(prompt).toContain("Do not rewrite the Recipe yourself");
      expect(handlerInput).toMatchObject({ enabled: true, budget: 1, generatedOnly: true, validation: { recipe_feedback: { attribution: "recipe_defect" } } });
      expect(result.next_step.args.validation_feedback).toContain("Recipe revision guidance");
      expect(JSON.parse(await readFile(join(item.run.runDir, "recipe_feedback.json"), "utf8"))).toMatchObject({ recipe_id: "repo-recipe", attribution: "recipe_defect" });
      const state = JSON.parse(await readFile(join(item.run.runDir, "state.json"), "utf8"));
      expect(state).toMatchObject({ recipe_revision_count: 1, recipe_revision_candidate: { status: "candidate" }, recipe_feedback: { attribution: "recipe_defect" } });
    } finally {
      await rm(item.cwd, { recursive: true, force: true });
    }
  });
});

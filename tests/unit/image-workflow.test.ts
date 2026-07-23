import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { atomicWriteJson, FileRunRepository } from "../../src/core/index.ts";
import { ImageWorkflow, RunLifecycleWorkflow } from "../../src/workflows/index.ts";

async function fixture() {
  const cwd = await mkdtemp(join(tmpdir(), "seekbrain-image-stage-"));
  const lifecycle = new RunLifecycleWorkflow(new FileRunRepository());
  const run = await lifecycle.startRun(cwd, "run", undefined, "interpret the figures");
  await lifecycle.updateState(run, {
    code_attempt: 1,
    image_refinement_count: 0,
    validation: {
      pass: true,
      route: "refine_image",
      validated_code_attempt: 1,
      refine_target: { figure_path: "figure.png" },
      refinement_feedback: "move the legend",
      per_figure: [],
    },
    artifacts: [
      { path: "generated_code.py", kind: "code" },
      { path: "figure.png", kind: "figure", role: "main", produced_by: "generated_code.py" },
      { path: "secondary.png", kind: "figure", produced_by: "generated_code.py" },
    ],
  });
  return { cwd, lifecycle, run };
}

function baseDependencies(item: Awaited<ReturnType<typeof fixture>>) {
  return {
    lifecycle: item.lifecycle,
    loadImages: async () => ({ images: [{ type: "image" }], warnings: [] }),
    runRefiner: async () => ({ ok: false }),
    createGuard: async () => ({ guard: true }),
    finalizeGuard: async () => ({ accepted: true, violations: [] }),
    fastPass: (validation: any) => ({ allowed: true, validation }),
    nextStep: () => ({}),
    writeJson: atomicWriteJson,
    snapshot: async () => undefined,
    appendEvent: async () => undefined,
  };
}

describe("image workflows", () => {
  it("fast-passes one authorized presentation-only refinement", async () => {
    const item = await fixture();
    try {
      const events: any[] = [];
      const snapshots: string[] = [];
      let capturedPrompt = "";
      const workflow = new ImageWorkflow({
        ...baseDependencies(item),
        runRefiner: async ({ prompt }) => {
          capturedPrompt = prompt;
          return { ok: true, result: { refined_code_patch: "patch", refined_figure_path: "figure.png", summary: "improved", remaining_issues: [], stop: true } };
        },
        fastPass: (_validation, refinement, context) => ({
          allowed: context.integrityAccepted === true,
          validation: { pass: true, route: "proceed", per_figure: [], refinement_summary: refinement?.summary },
        }),
        nextStep: (_validation, runId) => ({ tool: "neuro_interpret", args: { run_id: runId } }),
        snapshot: async (_run, label) => { snapshots.push(label); },
        appendEvent: async (event) => { events.push(event); },
      });
      const result = await workflow.refine({
        cwd: item.cwd,
        runId: item.run.runId,
        rolePrompt: "refiner role",
        agentConfig: { vision: true },
        finalizeSchema: {},
        enabled: true,
      });

      expect(capturedPrompt).toContain("Feedback:\nmove the legend");
      expect(capturedPrompt).toContain("本次共生成 2 张图");
      expect(capturedPrompt).toContain(join(item.run.runDir, "generated_code.py"));
      expect(capturedPrompt).toContain("最小成本方式调用绘图函数并重绘");
      expect(capturedPrompt).not.toContain("plot cache");
      expect(result).toMatchObject({ ok: true, fast_pass: true, next_step: { tool: "neuro_interpret" } });
      const state = JSON.parse(await readFile(join(item.run.runDir, "state.json"), "utf8"));
      expect(state.image_refinement_count).toBe(1);
      expect(state.refinement_fast_pass).toBe(true);
      expect(state.validation.route).toBe("proceed");
      expect(events[0]).toMatchObject({ event: "neuro_refine_image", ok: true, fast_pass: true });
      expect(snapshots).toEqual(["after_refine"]);
    } finally {
      await rm(item.cwd, { recursive: true, force: true });
    }
  });

  it("consumes a failed refinement attempt and routes directly to Interpret", async () => {
    const item = await fixture();
    try {
      const snapshots: string[] = [];
      const events: any[] = [];
      const workflow = new ImageWorkflow({
        ...baseDependencies(item),
        runRefiner: async () => ({ ok: true, result: { summary: "redrew figure" } }),
        finalizeGuard: async () => ({ accepted: false, violations: [join(item.run.runDir, "statistics.json")] }),
        nextStep: (validation, runId) => ({ tool: validation.route === "proceed" ? "neuro_interpret" : "neuro_refine_image", args: { run_id: runId } }),
        snapshot: async (_run, label) => { snapshots.push(label); },
        appendEvent: async (event) => { events.push(event); },
      });

      const result = await workflow.refine({
        cwd: item.cwd,
        runId: item.run.runId,
        rolePrompt: "refiner role",
        agentConfig: { vision: true },
        finalizeSchema: {},
        enabled: true,
      });

      expect(result).toMatchObject({
        ok: false,
        fast_pass: false,
        next_step: { tool: "neuro_interpret" },
        integrity_violations: [join(item.run.runDir, "statistics.json")],
      });
      expect(result.guidance).toContain("Do not run Validate or Refine again");
      const state = JSON.parse(await readFile(join(item.run.runDir, "state.json"), "utf8"));
      expect(state.image_refinement_count).toBe(1);
      expect(state.refinement_fast_pass).toBe(false);
      expect(state.validation.route).toBe("proceed");
      expect(state.validation.refinement_failed).toBe(true);
      expect(state.validation.methodological_caveats.at(-1)).toContain("Remaining presentation issue: move the legend");
      expect(state.refinement_attempts).toHaveLength(1);
      expect(events[0]).toMatchObject({ event: "neuro_refine_image", ok: false, image_refinement_count: 1, next_step: { tool: "neuro_interpret" } });
      expect(snapshots).toEqual(["after_refine_failure"]);
    } finally {
      await rm(item.cwd, { recursive: true, force: true });
    }
  });

});

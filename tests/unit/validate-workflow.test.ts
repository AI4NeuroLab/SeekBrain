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
      expect(capturedPrompt).toContain("[main] — primary figure");
      expect(capturedPrompt).toContain(`Approved plan path:\n${join(item.run.runDir, "plan.md")}`);
      expect(capturedPrompt).toContain(`Generated code paths:\n${join(item.run.runDir, "generated_code.py")}`);
      expect(capturedPrompt).toContain(`Statistics path:\n${join(item.run.runDir, "statistics.json")}`);
      expect(capturedPrompt).toContain('Essential statistics:\n{\n  "n": 20\n}');
      expect(capturedPrompt).toContain('"Exploratory subset used."');
      expect(capturedPrompt).toContain('"confidence": 0.8');
      expect(capturedPrompt).toContain("Presentation refinement available: no");
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
});

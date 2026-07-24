import { mkdtemp, readFile, rm } from "node:fs/promises";
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
    code: { statistics: { n: 20 } },
    artifacts: [{ path: "figure.png", kind: "figure", role: "main", description: "primary figure" }],
    validation_invalidated_by_code_edit: true,
    refinement_pending_validation: true,
  });
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
          return { ok: true, result: { pass: true, per_figure: [{ path: "figure.png", pass: true, issues: [] }], summary: "valid" } };
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
        additionalContext: "check labels",
        rolePrompt: "validator role",
        agentConfig: { vision: true },
        finalizeSchema: {},
        maxCodeAttempts: 3,
      });

      expect(capturedPrompt).toContain("Figures (1):");
      expect(capturedPrompt).toContain("[main] — primary figure");
      expect(capturedPrompt).toContain('Statistics:\n{\n  "n": 20\n}');
      expect(capturedPrompt).toContain("Additional context from the main agent:\ncheck labels");
      expect(normalizedContext).toEqual({ codeAttempt: 1, refinementCount: 0, maxCodeAttempts: 3 });
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
});

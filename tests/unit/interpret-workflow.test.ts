import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { atomicWriteJson, FileRunRepository } from "../../src/core/index.ts";
import { InterpretWorkflow, RunLifecycleWorkflow } from "../../src/workflows/index.ts";

async function fixture() {
  const cwd = await mkdtemp(join(tmpdir(), "seekbrain-interpret-stage-"));
  const lifecycle = new RunLifecycleWorkflow(new FileRunRepository());
  const research = await lifecycle.startResearch({ cwd, projectPath: "project", question: "What does the validated result show?" });
  await lifecycle.updateState(research.run, {
    code_attempt: 1,
    code: {
      code_files: [{ path: "generated_code.py" }],
      statistics: { n: 22, effect: 0.42 },
      warnings: ["Exploratory execution: analyzed 12 of 22 eligible fish; full-scope confirmation is recommended."],
    },
    validation: {
      pass: true,
      route: "proceed",
      validated_code_attempt: 1,
      summary: "The result is coherent.",
      figure_observations: ["The matrix is predominantly positive."],
      methodological_caveats: ["Small cohort"],
    },
    checks: { dummy_data_signals: [] },
    deep_research_context: "Prior work predicts a positive effect.",
  });
  return { cwd, lifecycle, research };
}

function dependencies(item: Awaited<ReturnType<typeof fixture>>) {
  return {
    lifecycle: item.lifecycle,
    currentArtifactsValidated: () => true,
    nextStep: () => ({ tool: "seekbrain_code_execute" }),
    runAgent: async () => ({ ok: false }),
    writeJson: atomicWriteJson,
    snapshot: async () => undefined,
    appendEvent: async () => undefined,
  };
}

describe("Interpret workflow", () => {
  it("uses validated text evidence and persists only conclusions.json", async () => {
    const item = await fixture();
    try {
      let capturedPrompt = "";
      const events: any[] = [];
      const workflow = new InterpretWorkflow({
        ...dependencies(item),
        runAgent: async ({ prompt }) => {
          capturedPrompt = prompt;
          return {
            ok: true,
            result: {
              conclusions: ["The cohort shows positive functional connectivity."],
              summary: "The validated result supports a positive group-level effect.",
              limitations: [],
              next_research_directions: [{ title: "Individual variability", research_question: "How stable is the effect across fish?" }],
            },
          };
        },
        appendEvent: async (event) => { events.push(event); },
      });
      const result = await workflow.execute({ cwd: item.cwd, runId: item.research.run.runId, rolePrompt: "Interpret validated evidence.", agentConfig: {}, finalizeSchema: {} });
      expect(capturedPrompt).toContain("The matrix is predominantly positive.");
      expect(capturedPrompt).toContain(`Approved plan path:\n${join(item.research.run.runDir, "plan.md")}`);
      expect(capturedPrompt).toContain(`Generated code paths:\n${join(item.research.run.runDir, "generated_code.py")}`);
      expect(capturedPrompt).toContain('"effect": 0.42');
      expect(capturedPrompt).toContain("Exploratory execution: analyzed 12 of 22 eligible fish");
      expect(capturedPrompt).not.toContain("Canonical figure");
      expect(result).toMatchObject({ ok: true, interpretation_path: join(item.research.run.runDir, "conclusions.json") });
      const conclusions = JSON.parse(await readFile(join(item.research.run.runDir, "conclusions.json"), "utf8"));
      expect(conclusions.limitations).toContain("Small cohort");
      expect(conclusions.limitations).toContain("Exploratory execution: analyzed 12 of 22 eligible fish; full-scope confirmation is recommended.");
      expect(existsSync(join(item.research.run.runDir, "interpretation.json"))).toBe(false);
      expect(existsSync(join(item.research.run.runDir, "image_analysis.md"))).toBe(false);
      const state = JSON.parse(await readFile(join(item.research.run.runDir, "state.json"), "utf8"));
      expect(state.interpretation.path).toBe(join(item.research.run.runDir, "conclusions.json"));
      expect(state.conclusions.conclusions).toBeUndefined();
      expect(events).toEqual([expect.objectContaining({ event: "seekbrain_interpretation_run", ok: true })]);
    } finally { await rm(item.cwd, { recursive: true, force: true }); }
  });

  it("blocks interpretation until current artifacts are validated", async () => {
    const item = await fixture();
    try {
      let invoked = false;
      const workflow = new InterpretWorkflow({ ...dependencies(item), currentArtifactsValidated: () => false, runAgent: async () => { invoked = true; return { ok: false }; } });
      const result = await workflow.execute({ cwd: item.cwd, runId: item.research.run.runId, rolePrompt: "role", agentConfig: {}, finalizeSchema: {} });
      expect(invoked).toBe(false);
      expect(result).toMatchObject({ ok: false, next_step: { tool: "seekbrain_validation_run" } });
    } finally { await rm(item.cwd, { recursive: true, force: true }); }
  });
});

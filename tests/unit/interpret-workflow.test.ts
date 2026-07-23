import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { atomicWriteJson, FileRunRepository } from "../../src/core/index.ts";
import { InterpretWorkflow, RunLifecycleWorkflow } from "../../src/workflows/index.ts";

async function fixture() {
  const cwd = await mkdtemp(join(tmpdir(), "seekbrain-interpret-stage-"));
  const lifecycle = new RunLifecycleWorkflow(new FileRunRepository());
  const research = await lifecycle.startResearch({ cwd, projectPath: "project", question: "What does the main figure show?" });
  await lifecycle.updateState(research.run, {
    code_attempt: 1,
    plan: { plan_markdown: "# Plan\nCompute and visualize the primary effect." },
    code: { statistics: { n: 22, effect: 0.42 }, exec_log: "completed successfully" },
    validation: { pass: true, route: "proceed", validated_code_attempt: 1, methodological_caveats: ["Small cohort"] },
    checks: { dummy_data_signals: [] },
    deep_research_context: "Prior work predicts a positive effect.",
    artifacts: [
      { path: "generated_code.py", kind: "code" },
      { path: "figure.png", kind: "figure", role: "main", produced_by: "generated_code.py" },
      { path: "diagnostic.png", kind: "figure", role: "diagnostic", produced_by: "generated_code.py" },
      { path: "statistics.json", kind: "data", description: "numeric results" },
    ],
  });
  return { cwd, lifecycle, research };
}

function dependencies(item: Awaited<ReturnType<typeof fixture>>) {
  return {
    lifecycle: item.lifecycle,
    currentArtifactsValidated: () => true,
    nextStep: () => ({ tool: "neuro_code" }),
    loadImages: async () => ({ images: [{ type: "image", data: "mock" }], warnings: [] }),
    runAgent: async () => ({ ok: false }),
    writeJson: atomicWriteJson,
    writeText: (path: string, value: string) => writeFile(path, value),
    snapshot: async () => undefined,
    appendEvent: async () => undefined,
  };
}

describe("Interpret workflow", () => {
  it("analyzes one canonical figure and persists one combined interpretation", async () => {
    const item = await fixture();
    try {
      let calls = 0;
      let capturedPrompt = "";
      let loadedPaths: string[] = [];
      const events: any[] = [];
      const workflow = new InterpretWorkflow({
        ...dependencies(item),
        loadImages: async (paths) => {
          loadedPaths = paths;
          return { images: [{ type: "image", data: "mock" }], warnings: [] };
        },
        runAgent: async ({ prompt, images }) => {
          calls += 1;
          capturedPrompt = prompt;
          expect(images).toHaveLength(1);
          return {
            ok: true,
            result: {
              image_analysis: {
                figure_type: "heatmap",
                observations: ["The lower triangle is predominantly red."],
                quantitative_evidence: ["Mean effect is 0.42."],
                biological_interpretation: ["Connectivity is broadly positive."],
                alternative_explanations: ["Smoothing may inflate local similarity."],
                limitations: ["Only the group average is shown."],
              },
              conclusions: ["The cohort shows positive functional connectivity."],
              summary: "The main figure supports a positive group-level effect.",
              limitations: [],
              confidence: 0.86,
              next_research_directions: [{ title: "Individual variability", question: "How stable is the effect across fish?" }],
            },
          };
        },
        appendEvent: async (event) => { events.push(event); },
      });

      const result = await workflow.execute({
        cwd: item.cwd,
        runId: item.research.run.runId,
        additionalContext: "Focus on biological meaning.",
        rolePrompt: "Interpret the validated result.",
        agentConfig: { vision: true },
        finalizeSchema: {},
      });

      expect(calls).toBe(1);
      expect(loadedPaths).toEqual([join(item.research.run.runDir, "figure.png")]);
      expect(capturedPrompt).toContain("Prior work predicts a positive effect.");
      expect(capturedPrompt).toContain('"effect": 0.42');
      expect(capturedPrompt).toContain("diagnostic.png");
      expect(result).toMatchObject({ ok: true, ignored_figure_paths: [join(item.research.run.runDir, "diagnostic.png")] });

      const interpretation = JSON.parse(await readFile(join(item.research.run.runDir, "interpretation.json"), "utf8"));
      const conclusions = JSON.parse(await readFile(join(item.research.run.runDir, "conclusions.json"), "utf8"));
      const analysis = await readFile(join(item.research.run.runDir, "image_analysis.md"), "utf8");
      const state = JSON.parse(await readFile(join(item.research.run.runDir, "state.json"), "utf8"));
      expect(interpretation.image_analysis.figure_type).toBe("heatmap");
      expect(conclusions.limitations).toContain("Small cohort");
      expect(analysis).toContain("The lower triangle is predominantly red.");
      expect(state.interpretation.summary).toContain("positive group-level effect");
      expect(state.image_analyses).toHaveLength(1);
      expect(state.conclusions.conclusions).toHaveLength(1);
      expect(events).toEqual([expect.objectContaining({ event: "neuro_interpret", ok: true })]);
    } finally {
      await rm(item.cwd, { recursive: true, force: true });
    }
  });

  it("blocks interpretation until current artifacts are validated", async () => {
    const item = await fixture();
    try {
      let invoked = false;
      const workflow = new InterpretWorkflow({
        ...dependencies(item),
        currentArtifactsValidated: () => false,
        runAgent: async () => { invoked = true; return { ok: false }; },
      });
      const result = await workflow.execute({ cwd: item.cwd, runId: item.research.run.runId, rolePrompt: "role", agentConfig: { vision: true }, finalizeSchema: {} });
      expect(invoked).toBe(false);
      expect(result).toMatchObject({ ok: false, next_step: { tool: "neuro_validate" } });
    } finally {
      await rm(item.cwd, { recursive: true, force: true });
    }
  });
});

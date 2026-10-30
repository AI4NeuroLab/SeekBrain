import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { atomicWriteJson, FileRunRepository } from "../../src/core/index.ts";
import {
  TaskBriefWorkflow,
  RunLifecycleWorkflow,
  deterministicTaskBrief,
} from "../../src/workflows/index.ts";

function createWorkflow(
  lifecycle: RunLifecycleWorkflow,
  runAgent: (input: any) => Promise<any>,
  events: any[] = [],
) {
  return new TaskBriefWorkflow({
    lifecycle,
    runAgent,
    writeJson: atomicWriteJson,
    appendEvent: async (event) => { events.push(event); },
  });
}

describe("TaskBrief workflow", () => {
  it("uses an identity fast path for an already precise ordinary question", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "seekbrain-intent-identity-"));
    try {
      const lifecycle = new RunLifecycleWorkflow(new FileRunRepository());
      const run = await lifecycle.startRun(cwd, "run", undefined, "How does cortical thickness change across Alzheimer disease progression?");
      let agentCalls = 0;
      const workflow = createWorkflow(lifecycle, async () => {
        agentCalls += 1;
        return { ok: false, error: "unexpected" };
      });

      const result = await workflow.resolveDirect({
        cwd,
        runId: run.runId,
        rolePrompt: "extract intent",
        agentConfig: {},
      });

      expect(agentCalls).toBe(0);
      expect(result).toMatchObject({ ok: true, agent_called: false, reused: false });
      expect(result.task_brief).toMatchObject({
        intent_mode: "focused_analysis",
        intent_status: "ready",
      });
      const state = JSON.parse(await readFile(join(run.runDir, "state.json"), "utf8"));
      expect(state.original_question).toBe("How does cortical thickness change across Alzheimer disease progression?");
      expect(state.question).toBe("How does cortical thickness change across Alzheimer disease progression?");
      expect(state.task_brief_path).toBe(join(run.runDir, "task_brief.json"));
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("extracts noisy direct input once, preserves provenance, and reuses the result", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "seekbrain-intent-agent-"));
    const raw = [
      "Using the dataset located at /mnt/shared/disease, identify interpretable cross-disorder cortical trajectories.",
      "Use cortical surface map-back figures and trajectory plots over disease progression.",
      "Save all outputs in /mnt/shared/results/2026-08-05 (format YYYY-MM-DD_HH-MM-SS).",
    ].join(" ");
    try {
      const lifecycle = new RunLifecycleWorkflow(new FileRunRepository());
      const run = await lifecycle.startRun(cwd, "run", undefined, raw);
      let agentCalls = 0;
      const workflow = createWorkflow(lifecycle, async ({ prompt, agentConfig }) => {
        agentCalls += 1;
        expect(prompt).toContain("semantic extraction, not research planning");
        expect(agentConfig).toEqual({ thinking: "off" });
        return {
          ok: true,
          result: {
            scientific_goal: "Identify biologically interpretable cross-disorder cortical trajectories.",
            intent_mode: "focused_analysis",
            intent_status: "ready",
            biological_scope: ["Cross-disorder cortical changes"],
            requested_data: ["Disease-progression effects linked to brain regions"],
            hard_constraints: ["Maintain biological interpretability"],
            output_preferences: ["Cortical surface map-back figures", "Trajectory plots over disease progression"],
          },
        };
      });

      const first = await workflow.resolveDirect({
        cwd,
        runId: run.runId,
        rolePrompt: "extract intent",
        agentConfig: { thinking: "off" },
      });
      const second = await workflow.resolveDirect({
        cwd,
        runId: run.runId,
        rolePrompt: "extract intent",
        agentConfig: { thinking: "off" },
      });

      expect(agentCalls).toBe(1);
      expect(second.reused).toBe(true);
      expect(first.question).toBe(raw);
      expect(first.task_brief.scientific_goal).not.toContain("/mnt/");
      expect(first.task_brief.output_preferences).toHaveLength(2);
      const state = JSON.parse(await readFile(join(run.runDir, "state.json"), "utf8"));
      expect(state.original_question).toBe(raw);
      expect(state.question).toBe(raw);
      expect(JSON.parse(await readFile(state.task_brief_path, "utf8"))).toEqual(state.task_brief);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("falls back without blocking and isolates output-path changes", async () => {
    const scientific = "conduct an innovative neuroscience discovery project with clear biological interpretability, cortical surface map-back figures, and trajectory plots over disease progression.";
    const first = `Using the dataset located at /mnt/shared/dataset, ${scientific} Save all outputs in /mnt/results/one (format YYYY-MM-DD_HH-MM-SS).`;
    const second = `Using the dataset located at /mnt/shared/dataset, ${scientific} Save all outputs in /mnt/results/two (format YYYY-MM-DD_HH-MM-SS).`;
    expect(deterministicTaskBrief(first).scientific_goal)
      .toBe(deterministicTaskBrief(second).scientific_goal);

    const cwd = await mkdtemp(join(tmpdir(), "seekbrain-intent-fallback-"));
    try {
      const lifecycle = new RunLifecycleWorkflow(new FileRunRepository());
      const run = await lifecycle.startRun(cwd, "run", undefined, first);
      const workflow = createWorkflow(lifecycle, async () => ({ ok: false, error: "model unavailable" }));
      const result = await workflow.resolveDirect({
        cwd,
        runId: run.runId,
        rolePrompt: "extract intent",
        agentConfig: { thinking: "off" },
      });

      expect(result).toMatchObject({ ok: true, agent_called: true, fallback_reason: "model unavailable" });
      expect(result.task_brief).toMatchObject({
        intent_mode: "open_discovery",
        intent_status: "ready",
      });
      expect(result.question).toBe(first);
      expect(result.task_brief.scientific_goal).not.toMatch(/\/mnt\/|YYYY|outputs?/i);
      expect(result.task_brief.scientific_goal).toMatch(/biological interpretability/i);
      expect(result.task_brief.output_preferences).toHaveLength(2);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("drops CLI transport sections while retaining the scientific query", () => {
    const brief = deterministicTaskBrief([
      "## Query",
      "Test whether disease progression follows distinct cortical trajectories.",
      "## Dataset / Metadata",
      "Root: /mnt/shared/disease-data",
      "Modality inventory used by the launcher.",
      "## Output work directory",
      "/mnt/shared/results/run-1",
      "## Extra path / access notes",
      "Read-only mounted storage.",
      "## Non-interactive execution policy",
      "Enable automatic mode.",
      "Final report: PDF",
    ].join("\n"));

    expect(brief.scientific_goal).toBe("Test whether disease progression follows distinct cortical trajectories.");
  });

  it("separates focused analysis, open discovery, and ambiguous intake without using R counts", () => {
    expect(deterministicTaskBrief("Perform PCA on the cell expression matrix.")).toMatchObject({
      intent_mode: "focused_analysis",
      intent_status: "ready",
    });
    expect(deterministicTaskBrief("Find scientifically valuable discoveries in this dataset.")).toMatchObject({
      intent_mode: "open_discovery",
      intent_status: "ready",
    });
    expect(deterministicTaskBrief("Analyze this dataset.")).toMatchObject({
      intent_mode: "focused_analysis",
      intent_status: "ambiguous",
    });
  });

  it("persists Research Route requirements without a second semantic agent call", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "seekbrain-intent-route-"));
    const question = "Classify fish 1-3 neurons from RNA counts, exclude cfos from subtype identity, retain it for display, use 10-cell modes, and sample every 130 cells.";
    try {
      const lifecycle = new RunLifecycleWorkflow(new FileRunRepository());
      const run = await lifecycle.startRun(cwd, "run", undefined, question);
      let agentCalls = 0;
      const workflow = createWorkflow(lifecycle, async () => {
        agentCalls += 1;
        return { ok: false, error: "unexpected" };
      });
      const result = await workflow.resolveRoute({
        cwd,
        runId: run.runId,
        originalQuestion: question,
        taskBrief: {
          scientific_goal: "Classify fish neurons from RNA barcodes and visualize ordered subtype patterns.",
          intent_mode: "focused_analysis",
          intent_status: "ready",
          biological_scope: ["fish 1-3 neurons"],
          requested_data: ["Use continuous RNA spot counts with gene, fish, and brain-region identities."],
          hard_constraints: [
            "Exclude cfos from subtype identity while retaining it for display.",
            "Summarize annotations by mode every 10 cells.",
          ],
          output_preferences: ["Select one representative expression cell every 130 cells."],
        },
      });

      expect(agentCalls).toBe(0);
      expect(result.task_brief).toMatchObject({
        intent_mode: "focused_analysis",
        intent_status: "ready",
      });
      expect(result.task_brief.requested_data).toContain("Use continuous RNA spot counts with gene, fish, and brain-region identities.");
      expect(result.task_brief.hard_constraints).toHaveLength(2);
      expect(result.task_brief.output_preferences).toContain("Select one representative expression cell every 130 cells.");
      const state = JSON.parse(await readFile(join(run.runDir, "state.json"), "utf8"));
      expect(state.original_question).toBe(question);
      expect(state.question).toBe(question);
      expect(state.task_brief.hard_constraints).toHaveLength(2);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("rejects placeholder Route fields and falls back to the raw scientific question", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "seekbrain-intent-placeholder-"));
    const question = "Classify fish 1-3 neurons from RNA spot counts into molecular subtypes.";
    try {
      const lifecycle = new RunLifecycleWorkflow(new FileRunRepository());
      const run = await lifecycle.startRun(cwd, "run", undefined, question);
      const workflow = createWorkflow(lifecycle, async () => ({ ok: false, error: "unexpected" }));
      const result = await workflow.resolveRoute({
        cwd,
        runId: run.runId,
        originalQuestion: question,
        taskBrief: {
          scientific_goal: "placeholder",
          intent_mode: "focused_analysis",
          intent_status: "ready",
          biological_scope: ["unknown"],
          requested_data: ["TBD"],
          hard_constraints: [],
          output_preferences: [],
        },
      });

      expect(result.task_brief.scientific_goal).toBe(question);
      expect(result.task_brief.biological_scope).toEqual([]);
      expect(result.task_brief.requested_data).toEqual([]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("treats a Research Planning child question like an ordinary direct question", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "seekbrain-intent-leaf-"));
    try {
      const lifecycle = new RunLifecycleWorkflow(new FileRunRepository());
      const run = await lifecycle.startRun(cwd, "run", undefined, "Quantify cortical progression differences between disorders.");
      await lifecycle.updateState(run, {
        inherited_context: {
          source: "research_planning_engine",
          subquestion: {
            question: "Do cortical trajectories differ across disorders?",
            hypothesis: "Disorders follow distinct cortical trajectories.",
          },
          task: {
            id: "SQ1-T1",
            title: "Compare cortical trajectories",
            analysis_question: "Quantify cortical progression differences between disorders.",
            biological_hypothesis: "Disorders follow distinct cortical trajectories.",
            analysis_strategy: "Map effects to cortical regions and compare progression trajectories.",
            expected_evidence: "Region-resolved trajectory differences with uncertainty.",
            supports_conclusion_if: "Trajectory differences are robust across sensitivity checks.",
            contradicts_conclusion_if: "Trajectories overlap within uncertainty.",
          },
        },
      });
      let agentCalls = 0;
      const workflow = createWorkflow(lifecycle, async () => {
        agentCalls += 1;
        return { ok: false };
      });

      const directInput = { cwd, runId: run.runId, rolePrompt: "extract intent", agentConfig: {} };
      const result = await workflow.resolveDirect(directInput);
      const reused = await workflow.resolveDirect(directInput);
      expect(agentCalls).toBe(0);
      expect(result.task_brief).toMatchObject({
        intent_mode: "focused_analysis",
        intent_status: "ready",
        hard_constraints: [],
      });
      expect(result.question).toBe("Quantify cortical progression differences between disorders.");
      expect(reused.reused).toBe(true);
      expect(reused.question).toBe(result.question);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

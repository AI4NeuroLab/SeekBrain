import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_SEEKBRAIN_CONFIG, FileRunRepository } from "../../src/core/index.ts";
import {
  RunLifecycleWorkflow,
  capabilitiesResult,
  pingResult,
  workflowConfigResult,
} from "../../src/workflows/index.ts";

describe("Phase 4 lifecycle workflows", () => {
  it("creates, indexes, updates and resumes a run without Pi dependencies", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "seekbrain-lifecycle-"));
    const previous = process.env.SEEKBRAIN_NON_INTERACTIVE;
    process.env.SEEKBRAIN_NON_INTERACTIVE = "1";
    try {
      const workflow = new RunLifecycleWorkflow(new FileRunRepository());
      const created = await workflow.startRun(cwd, "run", undefined, "first question");
      expect(created.state).toMatchObject({ schema_version: 2, question: "first question" });
      expect(created.state.deliverables).toHaveLength(4);
      expect(await workflow.ping(cwd)).toEqual({ runCount: 1 });

      const resumed = await workflow.resumeRun(cwd, "run", "follow-up question");
      expect(resumed.runId).toBe(created.runId);
      expect(resumed.state.question).toBe("follow-up question");
      expect(resumed.state.question_history).toHaveLength(1);
      expect(JSON.parse(await readFile(join(cwd, "run", "state.json"), "utf8")).question).toBe("follow-up question");
    } finally {
      if (previous === undefined) delete process.env.SEEKBRAIN_NON_INTERACTIVE;
      else process.env.SEEKBRAIN_NON_INTERACTIVE = previous;
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("creates an independent next research round with inherited metadata", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "seekbrain-rounds-"));
    const previous = process.env.SEEKBRAIN_NON_INTERACTIVE;
    process.env.SEEKBRAIN_NON_INTERACTIVE = "1";
    try {
      const workflow = new RunLifecycleWorkflow(new FileRunRepository());
      const first = await workflow.startResearch({
        cwd,
        projectPath: "project",
        question: "round one",
        metadata: { data_info: "locked metadata", user_background: "user-supplied scientific context" },
      });
      await workflow.updateResearchRoundManifest(first.run, { status: "concluded" });
      expect(await workflow.reportAvailability(first.run)).toMatchObject({ available: false, completed_round_count: 1 });
      const second = await workflow.continueResearch(cwd, first.projectDir, "round two");
      expect(second.roundNumber).toBe(2);
      expect(second.run.state).toMatchObject({
        parent_run_id: first.run.runId,
        data_info: "locked metadata",
        user_background: "user-supplied scientific context",
        question: "round two",
      });
      await workflow.updateResearchRoundManifest(second.run, { status: "concluded" });
      expect(await workflow.reportAvailability(second.run)).toMatchObject({ available: true, completed_round_count: 2 });
    } finally {
      if (previous === undefined) delete process.env.SEEKBRAIN_NON_INTERACTIVE;
      else process.env.SEEKBRAIN_NON_INTERACTIVE = previous;
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("keeps deferred project planning separate from the first ordinary analysis round", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "seekbrain-deferred-round-"));
    try {
      const workflow = new RunLifecycleWorkflow(new FileRunRepository());
      const planning = await workflow.startResearch({
        cwd,
        projectPath: "project",
        question: "overall question",
        metadata: { data_info: "locked metadata", user_background: "user-supplied scientific context" },
        deferInitialRound: true,
      });
      expect(planning.roundName).toBe("planning");
      expect(planning.run.runDir).toBe(join(cwd, "project", "planning"));
      await expect(readFile(join(cwd, "project", "round1", "state.json"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
      const manifestBefore = JSON.parse(await readFile(join(cwd, "project", "project.json"), "utf8"));
      expect(manifestBefore.rounds).toEqual([]);
      expect(manifestBefore.planning_run.run_id).toBe(planning.run.runId);
      await workflow.updateState(planning.run, { literature_queries: ["zebrafish head direction", "visual landmark plasticity"] });

      const ordinary = await workflow.materializeInitialRound(cwd, planning.run.runId);
      expect(ordinary.roundNumber).toBe(1);
      expect(ordinary.run.runDir).toBe(join(cwd, "project", "round1"));
      expect(ordinary.run.state).toMatchObject({
        data_info: "locked metadata",
        user_background: "user-supplied scientific context",
        planning_source_run_id: planning.run.runId,
        literature_queries: ["zebrafish head direction", "visual landmark plasticity"],
      });
      const reused = await workflow.materializeInitialRound(cwd, planning.run.runId);
      expect(reused).toMatchObject({ reused: true, roundNumber: 1 });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("builds stable system responses as pure workflow functions", () => {
    expect(pingResult(3)).toEqual({ ok: true, extension: "seekbrain", run_count: 3 });
    const capabilities = capabilitiesResult(DEFAULT_SEEKBRAIN_CONFIG);
    expect(capabilities).toMatchObject({
      ok: true,
      continuation_tool: "neuro_continue_research",
      optional: { deep_research: "disabled_no_literature_provider", image_refine: "enabled" },
      literature: { provider: "none", available: false },
    });
    expect(workflowConfigResult(DEFAULT_SEEKBRAIN_CONFIG)).toMatchObject({
      optional: { research_planning: "enabled", research_survey: "disabled_no_literature_provider", deep_research: "disabled_no_literature_provider", targeted_skill: "enabled" },
      human_review: { enabled: false },
    });
  });
});

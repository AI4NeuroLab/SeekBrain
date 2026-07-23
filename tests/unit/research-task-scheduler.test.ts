import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { atomicWriteJson, FileRunRepository } from "../../src/core/index.ts";
import { ResearchTaskScheduler, RunLifecycleWorkflow } from "../../src/workflows/index.ts";

async function fixture() {
  const cwd = await mkdtemp(join(tmpdir(), "seekbrain-scheduler-"));
  const lifecycle = new RunLifecycleWorkflow(new FileRunRepository());
  const started = await lifecycle.startResearch({
    cwd,
    projectPath: "research-parent",
    question: "How do complementary evidence branches address the overall hypothesis?",
  });
  const parent = started.run;
  const taskRuns = ["SQ1-T1", "SQ2-T1", "SQ3-T1"].map((taskId, index) => ({
    task_id: taskId,
    subquestion_id: `SQ${index + 1}`,
    run_id: `child-${index + 1}`,
    run_dir: join(started.projectDir, "research_tasks", taskId, "round1"),
    state_path: join(started.projectDir, "research_tasks", taskId, "round1", "state.json"),
    question: `Task ${index + 1}`,
    status: "pending",
  }));
  const taskManifestPath = join(parent.runDir, "research_plan", "task_manifest.json");
  await mkdir(dirname(taskManifestPath), { recursive: true });
  await atomicWriteJson(taskManifestPath, { parent_run_id: parent.runId, task_runs: taskRuns });
  await lifecycle.updateState(parent, {
    research_planning: {
      status: "tasks_ready",
      active_route: "research_planning",
      final_plan_path: join(parent.runDir, "research_plan", "final_plan.json"),
      task_manifest_path: taskManifestPath,
      task_runs: taskRuns,
    },
  });
  const scheduler = new ResearchTaskScheduler({ lifecycle, writeJson: atomicWriteJson });
  return { cwd, lifecycle, parent, projectDir: started.projectDir, scheduler };
}

describe("ResearchTaskScheduler", () => {
  it("reconciles interrupted active tasks from durable child stages", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "seekbrain-scheduler-recovery-"));
    try {
      const lifecycle = new RunLifecycleWorkflow(new FileRunRepository());
      const started = await lifecycle.startResearch({ cwd, projectPath: "research-parent", question: "overall" });
      const childSpecs = [
        { id: "T1", status: "executing", state: { plan: { summary: "ready" }, human_reviews: { plan: { status: "approved" } } } },
        { id: "T2", status: "validating", state: { plan: { summary: "ready" }, human_reviews: { plan: { status: "approved" } }, code: { summary: "done" }, code_attempt: 1 } },
        { id: "T3", status: "interpreting", state: { plan: { summary: "ready" }, human_reviews: { plan: { status: "approved" } }, interpretation: { summary: "interpreted" }, conclusions: { summary: "concluded" } } },
        { id: "T4", status: "planning", state: {} },
      ];
      const taskRuns = [];
      for (const spec of childSpecs) {
        const child = await lifecycle.startRun(cwd, join(started.projectDir, "research_tasks", spec.id, "round1"), undefined, spec.id);
        await lifecycle.updateState(child, spec.state);
        taskRuns.push({ task_id: spec.id, subquestion_id: spec.id, run_id: child.runId, run_dir: child.runDir, state_path: child.statePath, status: spec.status });
      }
      const manifestPath = join(started.run.runDir, "research_plan", "task_manifest.json");
      await mkdir(dirname(manifestPath), { recursive: true });
      await atomicWriteJson(manifestPath, { parent_run_id: started.run.runId, task_runs: taskRuns });
      await lifecycle.updateState(started.run, {
        research_planning: { status: "tasks_ready", active_route: "research_planning", task_manifest_path: manifestPath, task_runs: taskRuns },
      });
      const scheduler = new ResearchTaskScheduler({ lifecycle, writeJson: atomicWriteJson });
      await scheduler.initialize({ cwd, runId: started.run.runId, planningConcurrency: 3, executionConcurrency: 2 });

      const recovered = await scheduler.recoverInterruptedTasks(cwd, started.run.runId);
      expect(recovered.tasks.map((task: any) => task.status)).toEqual(["approved", "approved", "complete", "queued"]);
      expect(recovered.recovered_tasks).toEqual([
        { task_id: "T1", from: "executing", to: "approved" },
        { task_id: "T2", from: "validating", to: "approved" },
        { task_id: "T3", from: "interpreting", to: "complete" },
        { task_id: "T4", from: "planning", to: "queued" },
      ]);
      expect((await readFile(join(started.projectDir, "execution", "events.jsonl"), "utf8")).match(/task_recovered/g)).toHaveLength(4);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("is opt-in and rejects an ordinary SeekBrain run without writing execution state", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "seekbrain-no-scheduler-"));
    try {
      const lifecycle = new RunLifecycleWorkflow(new FileRunRepository());
      const run = await lifecycle.startRun(cwd, "round1", undefined, "ordinary question");
      const scheduler = new ResearchTaskScheduler({ lifecycle, writeJson: atomicWriteJson });
      await expect(scheduler.initialize({ cwd, runId: run.runId })).rejects.toThrow(/only for a parent Research Planning run/);
      await expect(readFile(join(cwd, "execution", "scheduler.json"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("enforces slots, merges worker events once, and recovers from durable state", async () => {
    const { cwd, lifecycle, parent, projectDir, scheduler } = await fixture();
    try {
      const initialized = await scheduler.initialize({
        cwd,
        runId: parent.runId,
        planningConcurrency: 2,
        executionConcurrency: 1,
      });
      expect(initialized).toMatchObject({ status: "ready", reused: false, task_count: 3 });
      expect(initialized.limits).toEqual({ planning_concurrency: 2, execution_concurrency: 1 });

      const planning = await scheduler.claimPlanningTasks(cwd, parent.runId);
      expect(planning.claimed_task_ids).toEqual(["SQ1-T1", "SQ2-T1"]);
      expect(planning.task_status_counts).toMatchObject({ planning: 2, queued: 1 });

      await scheduler.publishEvent({
        cwd, parentRunId: parent.runId, taskId: "SQ1-T1", type: "plan_ready", eventId: "plan-1",
        payload: { plan_path: "/plans/one.md", plan_summary: "First plan" },
      });
      await scheduler.publishEvent({
        cwd, parentRunId: parent.runId, taskId: "SQ2-T1", type: "plan_ready", eventId: "plan-2",
        payload: { plan_path: "/plans/two.md", plan_summary: "Second plan" },
      });
      expect(await scheduler.drainEvents(cwd, parent.runId)).toEqual({ accepted: 2, rejected: 0, pending: 0 });

      const queue = JSON.parse(await readFile(join(projectDir, "execution", "review_queue.json"), "utf8"));
      expect(queue.items.map((item: any) => item.task_id)).toEqual(["SQ1-T1", "SQ2-T1"]);
      expect(queue.items.every((item: any) => item.status === "waiting")).toBe(true);

      await scheduler.publishEvent({
        cwd, parentRunId: parent.runId, taskId: "SQ1-T1", type: "plan_ready", eventId: "plan-1",
        payload: { plan_path: "/plans/one.md" },
      });
      expect(await scheduler.drainEvents(cwd, parent.runId)).toEqual({ accepted: 0, rejected: 0, pending: 0 });

      await scheduler.publishEvent({ cwd, parentRunId: parent.runId, taskId: "SQ1-T1", type: "plan_approved", eventId: "approve-1" });
      await scheduler.publishEvent({ cwd, parentRunId: parent.runId, taskId: "SQ2-T1", type: "plan_approved", eventId: "approve-2" });
      expect(await scheduler.drainEvents(cwd, parent.runId)).toMatchObject({ accepted: 2, rejected: 0 });
      const execution = await scheduler.claimExecutionTasks(cwd, parent.runId);
      expect(execution.claimed_task_ids).toEqual(["SQ1-T1"]);
      expect(execution.task_status_counts).toMatchObject({ executing: 1, approved: 1, queued: 1 });

      await scheduler.publishEvent({ cwd, parentRunId: parent.runId, taskId: "SQ3-T1", type: "task_completed", eventId: "invalid-complete" });
      expect(await scheduler.drainEvents(cwd, parent.runId)).toMatchObject({ accepted: 0, rejected: 1 });

      const recovered = new ResearchTaskScheduler({ lifecycle, writeJson: atomicWriteJson });
      const snapshot = await recovered.initialize({ cwd, runId: parent.runId, planningConcurrency: 9, executionConcurrency: 9 });
      expect(snapshot).toMatchObject({ reused: true, status: "running" });
      expect(snapshot.limits).toEqual({ planning_concurrency: 2, execution_concurrency: 1 });
      expect(snapshot.task_status_counts).toMatchObject({ executing: 1, approved: 1, queued: 1 });

      const persistedParent = JSON.parse(await readFile(parent.statePath, "utf8"));
      expect(persistedParent.research_execution).toMatchObject({
        status: "running",
        planning_concurrency: 2,
        execution_concurrency: 1,
      });
      expect(persistedParent.research_planning.task_runs.map((item: any) => item.status)).toEqual(["executing", "approved", "queued"]);
      expect((await readFile(join(projectDir, "execution", "events.jsonl"), "utf8")).trim().split("\n")).toHaveLength(5);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("serializes review, requeues revisions, and auto-approves later valid Plans only within the execution", async () => {
    const { cwd, parent, projectDir, scheduler } = await fixture();
    try {
      await scheduler.initialize({ cwd, runId: parent.runId, planningConcurrency: 3, executionConcurrency: 2 });
      await scheduler.claimPlanningTasks(cwd, parent.runId);
      for (const taskId of ["SQ1-T1", "SQ2-T1"]) {
        await scheduler.publishEvent({
          cwd, parentRunId: parent.runId, taskId, type: "plan_ready", eventId: `ready-${taskId}`,
          payload: { plan_path: `/plans/${taskId}.md` },
        });
      }
      await scheduler.drainEvents(cwd, parent.runId);
      expect((await scheduler.nextPlanReview(cwd, parent.runId)).current.task_id).toBe("SQ1-T1");

      await scheduler.recordPlanReview({ cwd, runId: parent.runId, taskId: "SQ1-T1", decision: "revise", feedback: "Add a robustness check." });
      expect((await scheduler.nextPlanReview(cwd, parent.runId)).current.task_id).toBe("SQ2-T1");
      await scheduler.claimPlanningTasks(cwd, parent.runId);
      await scheduler.publishEvent({
        cwd, parentRunId: parent.runId, taskId: "SQ1-T1", type: "plan_ready", eventId: "ready-SQ1-revision",
        payload: { plan_path: "/plans/SQ1-revised.md" },
      });
      await scheduler.drainEvents(cwd, parent.runId);

      await scheduler.recordPlanReview({ cwd, runId: parent.runId, taskId: "SQ2-T1", decision: "approve_remaining" });
      expect((await scheduler.nextPlanReview(cwd, parent.runId)).queue_length).toBe(0);

      await scheduler.publishEvent({
        cwd, parentRunId: parent.runId, taskId: "SQ3-T1", type: "plan_ready", eventId: "ready-SQ3-late",
        payload: { plan_path: "/plans/SQ3.md" },
      });
      await scheduler.drainEvents(cwd, parent.runId);
      const status = await scheduler.status(cwd, parent.runId, false);
      expect(status.tasks.map((task: any) => task.status)).toEqual(["approved", "approved", "approved"]);
      const queue = JSON.parse(await readFile(join(projectDir, "execution", "review_queue.json"), "utf8"));
      expect(queue.approve_remaining).toBe(true);
      expect(queue.items.filter((item: any) => item.status === "waiting")).toHaveLength(0);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

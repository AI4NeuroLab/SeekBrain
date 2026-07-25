import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { atomicWriteJson, FileRunRepository } from "../../src/core/index.ts";
import { ResearchTaskExecutionCoordinator, ResearchTaskScheduler, RunLifecycleWorkflow } from "../../src/workflows/index.ts";
import { createResearchTaskExecutor } from "../../src/extension/runtime/create-research-task-executor.ts";

describe("Research Task runtime executor", () => {
  it("publishes and reuses an already interpreted child result without rerunning stages", async () => {
    const publish = vi.fn(async () => {});
    const codeWorkflow = { execute: vi.fn() };
    const validateWorkflow = { execute: vi.fn() };
    const imageWorkflow = { refine: vi.fn() };
    const interpretWorkflow = { execute: vi.fn() };
    const execute = createResearchTaskExecutor({
      projectRoot: "/project",
      loadConfig: vi.fn(async () => ({})),
      workflowConfig: vi.fn(() => ({ image_refine: true })),
      readPrompt: vi.fn(async (name) => name),
      resolveRun: vi.fn(async () => ({
        runDir: "/project/child",
        state: {
          interpretation: { summary: "existing interpretation" },
          conclusions: { summary: "existing conclusions" },
        },
      })) as any,
      pickAgentConfig: vi.fn(() => ({})),
      humanGateEnabled: vi.fn(() => true),
      defaultMaxCodeAttempts: 3,
      codeWorkflow: codeWorkflow as any,
      validateWorkflow: validateWorkflow as any,
      imageWorkflow: imageWorkflow as any,
      interpretWorkflow: interpretWorkflow as any,
    });

    await expect(execute({
      cwd: "/project",
      parentRunId: "parent",
      task: { task_id: "T1", run_id: "child" },
      publish,
    })).resolves.toMatchObject({ ok: true, recovered_existing_result: true });
    expect(publish).toHaveBeenCalledWith("task_completed", expect.objectContaining({
      summary: "existing conclusions",
      recovered_existing_result: true,
    }));
    expect(codeWorkflow.execute).not.toHaveBeenCalled();
    expect(validateWorkflow.execute).not.toHaveBeenCalled();
    expect(imageWorkflow.refine).not.toHaveBeenCalled();
    expect(interpretWorkflow.execute).not.toHaveBeenCalled();
  });
});

describe("ResearchTaskExecutionCoordinator", () => {
  it("runs only the bounded approved batch concurrently and isolates one worker failure", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "seekbrain-task-execution-"));
    try {
      const lifecycle = new RunLifecycleWorkflow(new FileRunRepository());
      const started = await lifecycle.startResearch({ cwd, projectPath: "parent", question: "overall question" });
      const parent = started.run;
      const taskRuns = ["T1", "T2", "T3"].map((taskId) => ({
        task_id: taskId,
        subquestion_id: taskId,
        run_id: `run-${taskId}`,
        run_dir: join(started.projectDir, "research_tasks", taskId, "round1"),
        status: "approved",
      }));
      const manifestPath = join(parent.runDir, "research_plan", "task_manifest.json");
      await mkdir(dirname(manifestPath), { recursive: true });
      await atomicWriteJson(manifestPath, { parent_run_id: parent.runId, task_runs: taskRuns });
      await lifecycle.updateState(parent, {
        research_planning: { status: "tasks_ready", active_route: "research_planning", task_manifest_path: manifestPath, task_runs: taskRuns },
      });
      const scheduler = new ResearchTaskScheduler({ lifecycle, writeJson: atomicWriteJson });
      await scheduler.initialize({ cwd, runId: parent.runId, planningConcurrency: 3, executionConcurrency: 2 });

      let active = 0;
      let maxActive = 0;
      const startedTasks: string[] = [];
      const attempts = new Map<string, number>();
      const afterCodeToolCall = async () => undefined;
      const coordinator = new ResearchTaskExecutionCoordinator({
        scheduler,
        executeTask: async ({ task, publish, afterCodeToolCall: handler }) => {
          expect(handler).toBe(afterCodeToolCall);
          active += 1;
          maxActive = Math.max(maxActive, active);
          startedTasks.push(task.task_id);
          attempts.set(task.task_id, Number(attempts.get(task.task_id) || 0) + 1);
          await new Promise((resolve) => setTimeout(resolve, 20));
          await publish("validation_started");
          if (task.task_id === "T2" && attempts.get("T2") === 1) {
            active -= 1;
            throw new Error("isolated failure");
          }
          await publish("interpretation_started");
          await publish("task_completed", { summary: `${task.task_id} complete` });
          active -= 1;
          return { task_id: task.task_id, ok: true };
        },
      });

      const first = await coordinator.execute({ cwd, runId: parent.runId, afterCodeToolCallForTask: () => afterCodeToolCall });
      expect(first).toMatchObject({ ok: false, executed_count: 1, failed_count: 1, status: "attention_required" });
      expect(startedTasks).toEqual(["T1", "T2"]);
      expect(maxActive).toBe(2);
      expect(first.task_status_counts).toMatchObject({ complete: 1, failed: 1, approved: 1 });

      expect(await scheduler.controlTask({ cwd, runId: parent.runId, taskId: "T2", action: "retry_execution" })).toMatchObject({ ok: true, task: { status: "approved" } });
      const second = await coordinator.execute({ cwd, runId: parent.runId, afterCodeToolCallForTask: () => afterCodeToolCall });
      expect(second).toMatchObject({ ok: true, executed_count: 2, failed_count: 0, status: "complete" });
      expect(startedTasks).toEqual(["T1", "T2", "T2", "T3"]);
      const state = JSON.parse(await readFile(parent.statePath, "utf8"));
      expect(state.research_planning.task_runs.map((task: any) => task.status)).toEqual(["complete", "complete", "complete"]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

import type { WorkflowJson } from "./run-lifecycle.ts";
import type { ResearchTaskScheduler, ResearchTaskEventType } from "./research-task-scheduler.ts";

export interface ResearchTaskExecutionDependencies {
  scheduler: ResearchTaskScheduler;
  executeTask(input: {
    cwd: string;
    parentRunId: string;
    task: WorkflowJson;
    publish(type: ResearchTaskEventType, payload?: WorkflowJson): Promise<void>;
    signal?: AbortSignal;
  }): Promise<WorkflowJson>;
}

export interface ExecuteResearchTasksInput {
  cwd: string;
  runId: string;
  signal?: AbortSignal;
  onProgress?: (event: { task_id: string; type: ResearchTaskEventType; payload: WorkflowJson }) => void;
}

/**
 * Claims one bounded execution batch and runs child rounds concurrently.
 * Child stages publish immutable Scheduler events; this coordinator drains
 * them only after all workers settle, preserving one parent-state writer.
 */
export class ResearchTaskExecutionCoordinator {
  constructor(readonly dependencies: ResearchTaskExecutionDependencies) {}

  async execute(input: ExecuteResearchTasksInput): Promise<WorkflowJson> {
    const claimed = await this.dependencies.scheduler.claimExecutionTasks(input.cwd, input.runId);
    const claimedIds = new Set((claimed.claimed_task_ids || []).map(String));
    const tasks = (Array.isArray(claimed.tasks) ? claimed.tasks : []).filter((task: WorkflowJson) => claimedIds.has(String(task.task_id)));
    if (!tasks.length) {
      return {
        ok: true,
        parent_run_id: input.runId,
        executed_count: 0,
        failed_count: 0,
        results: [],
        status: claimed.status,
        message: "No approved research task is currently available for execution.",
      };
    }

    const results = await Promise.all(tasks.map(async (task: WorkflowJson) => {
      const publish = async (type: ResearchTaskEventType, payload: WorkflowJson = {}) => {
        await this.dependencies.scheduler.publishEvent({
          cwd: input.cwd,
          parentRunId: input.runId,
          taskId: String(task.task_id),
          type,
          payload,
        });
        input.onProgress?.({ task_id: String(task.task_id), type, payload });
      };
      try {
        return await this.dependencies.executeTask({
          cwd: input.cwd,
          parentRunId: input.runId,
          task,
          publish,
          signal: input.signal,
        });
      } catch (error) {
        await publish("task_failed", { failed_stage: "execution", error: String(error) });
        return { task_id: task.task_id, run_id: task.run_id, ok: false, error: String(error) };
      }
    }));
    const scheduler = await this.dependencies.scheduler.status(input.cwd, input.runId, true);
    return {
      ok: results.every((result: WorkflowJson) => result.ok === true),
      parent_run_id: input.runId,
      executed_count: results.filter((result: WorkflowJson) => result.ok === true).length,
      failed_count: results.filter((result: WorkflowJson) => result.ok !== true).length,
      results,
      status: scheduler.status,
      task_status_counts: scheduler.task_status_counts,
    };
  }
}

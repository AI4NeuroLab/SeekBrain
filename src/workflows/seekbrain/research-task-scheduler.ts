import { randomUUID } from "node:crypto";
import { appendFile, mkdir, readFile, readdir, rm } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import type { RunLifecycleWorkflow, WorkflowJson, WorkflowRunContext } from "./run-lifecycle.ts";

export type ResearchTaskStatus =
  | "queued"
  | "planning"
  | "awaiting_plan_review"
  | "revising_plan"
  | "approved"
  | "executing"
  | "validating"
  | "interpreting"
  | "complete"
  | "blocked"
  | "failed"
  | "cancelled";

export type ResearchTaskEventType =
  | "planning_started"
  | "skill_started"
  | "skill_resolved"
  | "deep_research_started"
  | "deep_research_completed"
  | "plan_started"
  | "plan_ready"
  | "plan_revision_requested"
  | "plan_approved"
  | "execution_started"
  | "code_started"
  | "code_completed"
  | "validation_started"
  | "validation_completed"
  | "refinement_started"
  | "refinement_completed"
  | "interpretation_started"
  | "task_completed"
  | "task_blocked"
  | "task_failed"
  | "task_cancelled"
  | "task_execution_retry_requested"
  | "task_retry_requested";

export interface ResearchTaskEvent {
  event_id: string;
  parent_run_id: string;
  task_id: string;
  type: ResearchTaskEventType;
  payload: WorkflowJson;
  created_at: string;
}

export interface ResearchTaskSchedulerDependencies {
  lifecycle: RunLifecycleWorkflow;
  writeJson(path: string, value: WorkflowJson): Promise<void>;
}

export interface InitializeResearchExecutionInput {
  cwd: string;
  runId: string;
  planningConcurrency?: number;
  executionConcurrency?: number;
}

const ACTIVE_PLANNING = new Set<ResearchTaskStatus>(["planning"]);
const ACTIVE_EXECUTION = new Set<ResearchTaskStatus>(["executing", "validating", "interpreting"]);
const TERMINAL = new Set<ResearchTaskStatus>(["complete", "blocked", "failed", "cancelled"]);

const EVENT_TARGET: Record<ResearchTaskEventType, ResearchTaskStatus> = {
  planning_started: "planning",
  skill_started: "planning",
  skill_resolved: "planning",
  deep_research_started: "planning",
  deep_research_completed: "planning",
  plan_started: "planning",
  plan_ready: "awaiting_plan_review",
  plan_revision_requested: "revising_plan",
  plan_approved: "approved",
  execution_started: "executing",
  code_started: "executing",
  code_completed: "executing",
  validation_started: "validating",
  validation_completed: "validating",
  refinement_started: "validating",
  refinement_completed: "validating",
  interpretation_started: "interpreting",
  task_completed: "complete",
  task_blocked: "blocked",
  task_failed: "failed",
  task_cancelled: "cancelled",
  task_execution_retry_requested: "approved",
  task_retry_requested: "queued",
};

const EVENT_ORDER: Record<ResearchTaskEventType, number> = {
  planning_started: 10,
  skill_started: 11,
  deep_research_started: 11,
  skill_resolved: 12,
  deep_research_completed: 12,
  plan_started: 13,
  plan_ready: 20,
  plan_revision_requested: 30,
  plan_approved: 40,
  execution_started: 50,
  code_started: 51,
  code_completed: 55,
  validation_started: 60,
  validation_completed: 65,
  refinement_started: 66,
  refinement_completed: 67,
  interpretation_started: 70,
  task_completed: 80,
  task_blocked: 90,
  task_failed: 90,
  task_cancelled: 90,
  task_execution_retry_requested: 100,
  task_retry_requested: 100,
};

const ALLOWED_FROM: Record<ResearchTaskEventType, ResearchTaskStatus[]> = {
  planning_started: ["queued"],
  skill_started: ["planning"],
  skill_resolved: ["planning"],
  deep_research_started: ["planning"],
  deep_research_completed: ["planning"],
  plan_started: ["planning"],
  plan_ready: ["planning", "revising_plan"],
  plan_revision_requested: ["awaiting_plan_review"],
  plan_approved: ["awaiting_plan_review"],
  execution_started: ["approved"],
  code_started: ["executing"],
  code_completed: ["executing"],
  validation_started: ["executing"],
  validation_completed: ["validating"],
  refinement_started: ["validating"],
  refinement_completed: ["validating"],
  interpretation_started: ["validating"],
  task_completed: ["executing", "validating", "interpreting"],
  task_blocked: ["planning", "awaiting_plan_review", "approved", "executing", "validating", "interpreting"],
  task_failed: ["planning", "awaiting_plan_review", "approved", "executing", "validating", "interpreting"],
  task_cancelled: ["queued", "planning", "awaiting_plan_review", "revising_plan", "approved", "executing", "validating", "interpreting", "blocked", "failed"],
  task_execution_retry_requested: ["blocked", "failed", "cancelled"],
  task_retry_requested: ["blocked", "failed", "cancelled"],
};

function positiveConcurrency(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 ? Math.min(parsed, 16) : fallback;
}

function schedulerPaths(parent: WorkflowRunContext) {
  const projectDir = String(parent.state.project_dir || dirname(parent.runDir));
  const executionDir = join(projectDir, "execution");
  return {
    projectDir,
    executionDir,
    schedulerPath: join(executionDir, "scheduler.json"),
    reviewQueuePath: join(executionDir, "review_queue.json"),
    eventsPath: join(executionDir, "events.jsonl"),
    inboxDir: join(executionDir, "inbox"),
  };
}

async function readJson(path: string): Promise<WorkflowJson | undefined> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as WorkflowJson;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

function normalizeInitialStatus(value: unknown): ResearchTaskStatus {
  const status = String(value || "");
  if (status === "pending") return "queued";
  if (status === "concluded") return "complete";
  return [
    "queued", "planning", "awaiting_plan_review", "revising_plan", "approved",
    "executing", "validating", "interpreting", "complete", "blocked", "failed", "cancelled",
  ].includes(status) ? status as ResearchTaskStatus : "queued";
}

function schedulerStatus(tasks: WorkflowJson[]): string {
  if (tasks.length > 0 && tasks.every((task) => task.status === "complete")) return "complete";
  if (tasks.some((task) => task.status === "blocked" || task.status === "failed")) return "attention_required";
  if (tasks.some((task) => task.status !== "queued")) return "running";
  return "ready";
}

/**
 * Durable coordinator for Research Planning child projects.
 *
 * Workers publish immutable inbox events. Only drainEvents/claim* mutate the
 * scheduler, review queue, task manifest, or parent state, which gives the
 * parent project one explicit writer even when child work runs concurrently.
 */
export class ResearchTaskScheduler {
  constructor(readonly dependencies: ResearchTaskSchedulerDependencies) {}

  async upsertExtensionTask(cwd: string, runId: string, taskRun: WorkflowJson): Promise<WorkflowJson> {
    const parent = await this.parent(cwd, runId);
    const paths = schedulerPaths(parent);
    const scheduler = await this.requireScheduler(paths.schedulerPath);
    const reviewQueue = await readJson(paths.reviewQueuePath) || {
      schema_version: 1, parent_run_id: parent.runId, policy: "serialized", approve_remaining: false, items: [],
    };
    const tasks = scheduler.tasks as WorkflowJson[];
    const taskId = String(taskRun.task_id || "");
    if (!taskId) throw new Error("Extension task_id is required.");
    const existingIndex = tasks.findIndex((item) => String(item.task_id) === taskId);
    const now = new Date().toISOString();
    const queued = {
      ...taskRun,
      ordinal: existingIndex >= 0 ? tasks[existingIndex].ordinal : tasks.length + 1,
      status: "queued",
      scheduler_updated_at: now,
    };
    scheduler.tasks = existingIndex >= 0
      ? tasks.map((item, index) => index === existingIndex ? queued : item)
      : [...tasks, queued];
    scheduler.status = schedulerStatus(scheduler.tasks);
    scheduler.updated_at = now;
    reviewQueue.items = (Array.isArray(reviewQueue.items) ? reviewQueue.items : [])
      .filter((item: WorkflowJson) => String(item.task_id) !== taskId);
    reviewQueue.updated_at = now;
    await this.dependencies.writeJson(paths.schedulerPath, scheduler);
    await this.dependencies.writeJson(paths.reviewQueuePath, reviewQueue);
    await this.persistParent(parent, scheduler, paths);
    return { ...this.result(scheduler, paths, true), extension_task: queued };
  }

  async initialize(input: InitializeResearchExecutionInput): Promise<WorkflowJson> {
    const parent = await this.parent(input.cwd, input.runId);
    const paths = schedulerPaths(parent);
    const existing = await readJson(paths.schedulerPath);
    if (existing?.schema_version === 1 && existing.parent_run_id === parent.runId) {
      return this.result(existing, paths, true);
    }

    const planning = parent.state.research_planning || {};
    const taskRuns = Array.isArray(planning.task_runs) ? planning.task_runs : [];
    if (!taskRuns.length || !["tasks_ready", "tasks_running", "tasks_complete"].includes(String(planning.status || ""))) {
      throw new Error("Analysis Execution requires an approved, materialized hierarchical research plan. Call seekbrain_analysis_tasks_prepare first.");
    }
    const now = new Date().toISOString();
    const scheduler: WorkflowJson = {
      schema_version: 1,
      parent_run_id: parent.runId,
      project_dir: paths.projectDir,
      status: "ready",
      limits: {
        planning_concurrency: positiveConcurrency(input.planningConcurrency, 3),
        execution_concurrency: positiveConcurrency(input.executionConcurrency, 2),
      },
      tasks: taskRuns.map((task: WorkflowJson, index: number) => ({
        ...task,
        ordinal: index + 1,
        status: normalizeInitialStatus(task.status),
        scheduler_updated_at: now,
      })),
      processed_event_ids: [],
      accepted_event_count: 0,
      rejected_event_count: 0,
      created_at: now,
      updated_at: now,
    };
    const reviewQueue = {
      schema_version: 1,
      parent_run_id: parent.runId,
      policy: "serialized",
      approve_remaining: false,
      items: [],
      created_at: now,
      updated_at: now,
    };
    await mkdir(paths.inboxDir, { recursive: true });
    await this.dependencies.writeJson(paths.schedulerPath, scheduler);
    await this.dependencies.writeJson(paths.reviewQueuePath, reviewQueue);
    await this.persistParent(parent, scheduler, paths);
    return this.result(scheduler, paths, false);
  }

  async status(cwd: string, runId: string, drain = true): Promise<WorkflowJson> {
    if (drain) await this.drainEvents(cwd, runId);
    const parent = await this.parent(cwd, runId);
    const paths = schedulerPaths(parent);
    const scheduler = await this.requireScheduler(paths.schedulerPath);
    return this.result(scheduler, paths, true);
  }

  /**
   * Reconcile tasks left in an in-memory active state after their owning tool
   * call was interrupted. Child state is the durable source of truth: a
   * concluded child is complete, an approved persisted Plan is executable, an
   * unapproved persisted Plan returns to review, and everything earlier is
   * queued for planning again.
   */
  async recoverInterruptedTasks(cwd: string, runId: string): Promise<WorkflowJson> {
    await this.drainEvents(cwd, runId);
    const parent = await this.parent(cwd, runId);
    const paths = schedulerPaths(parent);
    const scheduler = await this.requireScheduler(paths.schedulerPath);
    const reviewQueue = await readJson(paths.reviewQueuePath) || {
      schema_version: 1, parent_run_id: parent.runId, policy: "serialized", approve_remaining: false, items: [],
    };
    const activeStatuses = new Set<ResearchTaskStatus>(["planning", "revising_plan", "executing", "validating", "interpreting"]);
    const recovered: WorkflowJson[] = [];
    const now = new Date().toISOString();

    for (const task of scheduler.tasks as WorkflowJson[]) {
      if (!activeStatuses.has(task.status as ResearchTaskStatus)) continue;
      const child = await this.dependencies.lifecycle.resolveRun(cwd, String(task.run_id));
      const concluded = Boolean(child.state.interpretation && child.state.conclusions);
      const hasPlan = Boolean(child.state.plan);
      const planApproved = child.state.human_reviews?.plan?.status === "approved";
      const nextStatus: ResearchTaskStatus = concluded
        ? "complete"
        : hasPlan && planApproved ? "approved" : hasPlan ? "awaiting_plan_review" : "queued";
      const previousStatus = task.status as ResearchTaskStatus;
      Object.assign(task, {
        status: nextStatus,
        recovered_from_status: previousStatus,
        recovered_at: now,
        scheduler_updated_at: now,
        ...(concluded ? {
          completed_at: child.state.conclusions?.completed_at || now,
          interpretation_path: child.state.interpretation?.path || child.state.conclusions?.path || join(child.runDir, "conclusions.json"),
          conclusions_path: child.state.conclusions?.path || join(child.runDir, "conclusions.json"),
          summary: child.state.conclusions?.summary || child.state.interpretation?.summary || "",
        } : {}),
      });
      if (nextStatus === "awaiting_plan_review") {
        const items = Array.isArray(reviewQueue.items) ? reviewQueue.items : [];
        const existing = items.find((item: WorkflowJson) => String(item.task_id) === String(task.task_id) && item.status === "waiting");
        if (!existing) {
          reviewQueue.items = [...items, {
            task_id: task.task_id,
            run_id: task.run_id,
            plan_path: task.plan_path || join(child.runDir, "plan.md"),
            plan_summary: child.state.plan?.review_summary || child.state.plan?.summary || task.plan_summary || "",
            plan_warnings: child.state.plan?.warnings || task.plan_warnings || [],
            plan_revision: Number(child.state.plan?.revision || 0),
            status: reviewQueue.approve_remaining === true ? "approved" : "waiting",
            enqueued_at: now,
          }];
          if (reviewQueue.approve_remaining === true) task.status = "approved";
        }
      }
      recovered.push({ task_id: task.task_id, from: previousStatus, to: task.status });
    }

    scheduler.status = schedulerStatus(scheduler.tasks || []);
    scheduler.updated_at = now;
    reviewQueue.updated_at = now;
    await this.dependencies.writeJson(paths.schedulerPath, scheduler);
    await this.dependencies.writeJson(paths.reviewQueuePath, reviewQueue);
    await this.persistParent(parent, scheduler, paths);
    for (const item of recovered) {
      await appendFile(paths.eventsPath, `${JSON.stringify({
        event_id: randomUUID(), parent_run_id: parent.runId, task_id: item.task_id,
        type: "task_recovered", payload: { from: item.from, to: item.to }, created_at: now, accepted: true,
      })}\n`, "utf8");
    }
    return { ...this.result(scheduler, paths, true), recovered_tasks: recovered };
  }

  async claimPlanningTasks(cwd: string, runId: string): Promise<WorkflowJson> {
    await this.drainEvents(cwd, runId);
    const parent = await this.parent(cwd, runId);
    const paths = schedulerPaths(parent);
    const scheduler = await this.requireScheduler(paths.schedulerPath);
    const tasks = scheduler.tasks as WorkflowJson[];
    const active = tasks.filter((task) => ACTIVE_PLANNING.has(task.status)).length;
    const capacity = Math.max(0, Number(scheduler.limits.planning_concurrency) - active);
    const claimedIds = tasks.filter((task) => task.status === "queued").slice(0, capacity).map((task) => String(task.task_id));
    const now = new Date().toISOString();
    scheduler.tasks = tasks.map((task) => claimedIds.includes(String(task.task_id))
      ? { ...task, status: "planning", planning_started_at: now, scheduler_updated_at: now }
      : task);
    scheduler.status = schedulerStatus(scheduler.tasks);
    scheduler.updated_at = now;
    await this.dependencies.writeJson(paths.schedulerPath, scheduler);
    await this.persistParent(parent, scheduler, paths);
    return { ...this.result(scheduler, paths, true), claimed_task_ids: claimedIds };
  }

  async claimExecutionTasks(cwd: string, runId: string): Promise<WorkflowJson> {
    await this.drainEvents(cwd, runId);
    const parent = await this.parent(cwd, runId);
    const paths = schedulerPaths(parent);
    const scheduler = await this.requireScheduler(paths.schedulerPath);
    const tasks = scheduler.tasks as WorkflowJson[];
    const active = tasks.filter((task) => ACTIVE_EXECUTION.has(task.status)).length;
    const capacity = Math.max(0, Number(scheduler.limits.execution_concurrency) - active);
    const claimedIds = tasks.filter((task) => task.status === "approved").slice(0, capacity).map((task) => String(task.task_id));
    const now = new Date().toISOString();
    scheduler.tasks = tasks.map((task) => claimedIds.includes(String(task.task_id))
      ? { ...task, status: "executing", execution_started_at: now, scheduler_updated_at: now }
      : task);
    scheduler.status = schedulerStatus(scheduler.tasks);
    scheduler.updated_at = now;
    await this.dependencies.writeJson(paths.schedulerPath, scheduler);
    await this.persistParent(parent, scheduler, paths);
    return { ...this.result(scheduler, paths, true), claimed_task_ids: claimedIds };
  }

  async publishEvent(input: {
    cwd: string;
    parentRunId: string;
    taskId: string;
    type: ResearchTaskEventType;
    payload?: WorkflowJson;
    eventId?: string;
  }): Promise<ResearchTaskEvent> {
    const parent = await this.parent(input.cwd, input.parentRunId);
    const paths = schedulerPaths(parent);
    await this.requireScheduler(paths.schedulerPath);
    await mkdir(paths.inboxDir, { recursive: true });
    const eventId = String(input.eventId || randomUUID()).replace(/[^a-zA-Z0-9_.-]/g, "_");
    const event: ResearchTaskEvent = {
      event_id: eventId,
      parent_run_id: parent.runId,
      task_id: String(input.taskId),
      type: input.type,
      payload: input.payload || {},
      created_at: new Date().toISOString(),
    };
    await this.dependencies.writeJson(join(paths.inboxDir, `${eventId}.json`), event as unknown as WorkflowJson);
    return event;
  }

  async nextPlanReview(cwd: string, runId: string): Promise<WorkflowJson> {
    await this.drainEvents(cwd, runId);
    const parent = await this.parent(cwd, runId);
    const paths = schedulerPaths(parent);
    const scheduler = await this.requireScheduler(paths.schedulerPath);
    const reviewQueue = await readJson(paths.reviewQueuePath) || { items: [] };
    const waiting = (Array.isArray(reviewQueue.items) ? reviewQueue.items : []).filter((item: WorkflowJson) => item.status === "waiting");
    const current = waiting[0];
    const task = current
      ? (scheduler.tasks as WorkflowJson[]).find((item) => String(item.task_id) === String(current.task_id))
      : undefined;
    return {
      ok: true,
      parent_run_id: parent.runId,
      queue_length: waiting.length,
      approve_remaining: reviewQueue.approve_remaining === true,
      current: current ? { ...current, task } : undefined,
    };
  }

  async recordPlanReview(input: {
    cwd: string;
    runId: string;
    taskId: string;
    decision: "approve" | "revise" | "approve_remaining";
    feedback?: string;
    planRevision?: number;
  }): Promise<WorkflowJson> {
    await this.drainEvents(input.cwd, input.runId);
    const parent = await this.parent(input.cwd, input.runId);
    const paths = schedulerPaths(parent);
    const queue = await readJson(paths.reviewQueuePath) || { items: [] };
    const waiting = (Array.isArray(queue.items) ? queue.items : []).filter((item: WorkflowJson) => item.status === "waiting");
    const currentReview = waiting.find((item: WorkflowJson) => String(item.task_id) === String(input.taskId));
    if (!currentReview) {
      throw new Error(`Analysis task '${input.taskId}' is not waiting for methodological-schema review.`);
    }
    if (input.planRevision !== undefined && Number(currentReview.plan_revision || 0) !== input.planRevision) {
      throw new Error(`Analysis task '${input.taskId}' review is stale; current Plan revision is ${Number(currentReview.plan_revision || 0)}.`);
    }
    if (input.decision === "revise" && !String(input.feedback || "").trim()) {
      throw new Error("Methodological-schema revision feedback is required.");
    }
    if (input.decision === "approve_remaining") {
      queue.approve_remaining = true;
      queue.approve_remaining_at = new Date().toISOString();
      await this.dependencies.writeJson(paths.reviewQueuePath, queue);
      for (const item of waiting) {
        await this.publishEvent({
          cwd: input.cwd,
          parentRunId: input.runId,
          taskId: String(item.task_id),
          type: "plan_approved",
          payload: { review_decision: "approve_remaining", approved_at: new Date().toISOString() },
        });
      }
    } else {
      await this.publishEvent({
        cwd: input.cwd,
        parentRunId: input.runId,
        taskId: input.taskId,
        type: input.decision === "approve" ? "plan_approved" : "plan_revision_requested",
        payload: input.decision === "approve"
          ? { review_decision: "approve", approved_at: new Date().toISOString() }
          : { review_decision: "revise", review_feedback: String(input.feedback).trim() },
      });
    }
    await this.drainEvents(input.cwd, input.runId);
    return {
      ok: true,
      parent_run_id: input.runId,
      task_id: input.taskId,
      decision: input.decision,
      ...(input.feedback ? { feedback: input.feedback } : {}),
      next_review: (await this.nextPlanReview(input.cwd, input.runId)).current,
    };
  }

  async controlTask(input: {
    cwd: string;
    runId: string;
    taskId: string;
    action: "retry_execution" | "restart_planning" | "cancel";
    reason?: string;
  }): Promise<WorkflowJson> {
    await this.publishEvent({
      cwd: input.cwd,
      parentRunId: input.runId,
      taskId: input.taskId,
      type: input.action === "cancel"
        ? "task_cancelled"
        : input.action === "retry_execution" ? "task_execution_retry_requested" : "task_retry_requested",
      payload: { control_action: input.action, control_reason: String(input.reason || ""), controlled_at: new Date().toISOString() },
    });
    const drained = await this.drainEvents(input.cwd, input.runId);
    const status = await this.status(input.cwd, input.runId, false);
    const task = status.tasks.find((item: WorkflowJson) => String(item.task_id) === String(input.taskId));
    return { ok: drained.accepted === 1, parent_run_id: input.runId, task_id: input.taskId, action: input.action, task, status: status.status };
  }

  async drainEvents(cwd: string, runId: string): Promise<WorkflowJson> {
    const parent = await this.parent(cwd, runId);
    const paths = schedulerPaths(parent);
    const scheduler = await this.requireScheduler(paths.schedulerPath);
    const reviewQueue = await readJson(paths.reviewQueuePath) || {
      schema_version: 1, parent_run_id: parent.runId, policy: "serialized", approve_remaining: false, items: [],
    };
    await mkdir(paths.inboxDir, { recursive: true });
    const files = (await readdir(paths.inboxDir)).filter((file) => file.endsWith(".json")).sort();
    if (!files.length) return { accepted: 0, rejected: 0, pending: 0 };

    const processed = new Set<string>(Array.isArray(scheduler.processed_event_ids) ? scheduler.processed_event_ids.map(String) : []);
    const accepted: ResearchTaskEvent[] = [];
    const rejected: WorkflowJson[] = [];
    const inboxEvents = (await Promise.all(files.map(async (file) => ({
      file,
      event: await readJson(join(paths.inboxDir, basename(file))) as ResearchTaskEvent | undefined,
    })))).sort((left, right) => {
      const time = String(left.event?.created_at || "").localeCompare(String(right.event?.created_at || ""));
      if (time !== 0) return time;
      const phase = (EVENT_ORDER[left.event?.type as ResearchTaskEventType] || 0) - (EVENT_ORDER[right.event?.type as ResearchTaskEventType] || 0);
      return phase || left.file.localeCompare(right.file);
    });
    for (const { event } of inboxEvents) {
      if (!event?.event_id || processed.has(String(event.event_id))) continue;
      const outcome = this.applyEvent(scheduler, reviewQueue, event);
      processed.add(String(event.event_id));
      if (outcome.ok) accepted.push(event);
      else rejected.push({ ...event, rejection_reason: outcome.error });
    }

    const now = new Date().toISOString();
    scheduler.processed_event_ids = [...processed].slice(-5000);
    scheduler.accepted_event_count = Number(scheduler.accepted_event_count || 0) + accepted.length;
    scheduler.rejected_event_count = Number(scheduler.rejected_event_count || 0) + rejected.length;
    scheduler.status = schedulerStatus(scheduler.tasks || []);
    scheduler.updated_at = now;
    reviewQueue.updated_at = now;
    await this.dependencies.writeJson(paths.schedulerPath, scheduler);
    await this.dependencies.writeJson(paths.reviewQueuePath, reviewQueue);
    await this.persistParent(parent, scheduler, paths);
    for (const event of accepted) await appendFile(paths.eventsPath, `${JSON.stringify({ ...event, accepted: true })}\n`, "utf8");
    for (const event of rejected) await appendFile(paths.eventsPath, `${JSON.stringify({ ...event, accepted: false })}\n`, "utf8");
    for (const file of files) await rm(join(paths.inboxDir, basename(file)), { force: true });
    return { accepted: accepted.length, rejected: rejected.length, pending: 0 };
  }

  private applyEvent(scheduler: WorkflowJson, reviewQueue: WorkflowJson, event: ResearchTaskEvent): { ok: boolean; error?: string } {
    if (event.parent_run_id !== scheduler.parent_run_id) return { ok: false, error: "parent_run_id does not match the scheduler" };
    const tasks = scheduler.tasks as WorkflowJson[];
    const index = tasks.findIndex((task) => String(task.task_id) === String(event.task_id));
    if (index < 0) return { ok: false, error: `unknown analysis task '${event.task_id}'` };
    const current = tasks[index];
    const currentStatus = current.status as ResearchTaskStatus;
    if (!ALLOWED_FROM[event.type]?.includes(currentStatus)) {
      return { ok: false, error: `invalid transition ${currentStatus} -> ${EVENT_TARGET[event.type]} (${event.type})` };
    }
    const now = new Date().toISOString();
    const autoApprove = event.type === "plan_ready" && reviewQueue.approve_remaining === true;
    const nextStatus = autoApprove ? "approved" : EVENT_TARGET[event.type];
    tasks[index] = {
      ...current,
      ...event.payload,
      status: nextStatus,
      last_event_id: event.event_id,
      last_event_type: event.type,
      scheduler_updated_at: now,
      ...(nextStatus === "complete" ? { completed_at: event.payload.completed_at || now } : {}),
    };
    scheduler.tasks = tasks;
    if (event.type === "plan_ready") {
      const items = Array.isArray(reviewQueue.items) ? reviewQueue.items : [];
      if (!items.some((item: WorkflowJson) => item.task_id === event.task_id && item.status === "waiting")) {
        reviewQueue.items = [...items, {
          task_id: event.task_id,
          run_id: current.run_id,
          plan_path: event.payload.plan_path,
          plan_summary: event.payload.plan_summary,
          plan_warnings: event.payload.plan_warnings || [],
          plan_revision: Number(event.payload.plan_revision || 0),
          rollback_available: event.payload.rollback_available === true,
          skill_summary: event.payload.skill_summary || current.skill_summary,
          deep_research_summary: event.payload.deep_research_summary || current.deep_research_summary,
          status: autoApprove ? "approved" : "waiting",
          enqueued_at: now,
          ...(autoApprove ? { resolved_at: now, decision: "approve_remaining" } : {}),
        }];
      }
    }
    if (event.type === "plan_ready") {
      reviewQueue.items = (Array.isArray(reviewQueue.items) ? reviewQueue.items : []).map((item: WorkflowJson) =>
        item.task_id === event.task_id && item.status === "revising" ? { ...item, status: "superseded", resolved_at: now } : item);
    }
    if (["plan_approved", "plan_revision_requested", "task_cancelled"].includes(event.type)) {
      reviewQueue.items = (Array.isArray(reviewQueue.items) ? reviewQueue.items : []).map((item: WorkflowJson) =>
        item.task_id === event.task_id && item.status === "waiting"
          ? { ...item, status: event.type === "plan_approved" ? "approved" : event.type === "plan_revision_requested" ? "revising" : "cancelled", resolved_at: event.type === "plan_revision_requested" ? undefined : now }
          : item);
    }
    return { ok: true };
  }

  private async persistParent(parent: WorkflowRunContext, scheduler: WorkflowJson, paths: ReturnType<typeof schedulerPaths>) {
    const planning = parent.state.research_planning || {};
    const schedulerTasks = scheduler.tasks as WorkflowJson[];
    const taskRuns = (Array.isArray(planning.task_runs) ? planning.task_runs : []).map((task: WorkflowJson) => {
      const scheduled = schedulerTasks.find((item) => String(item.task_id) === String(task.task_id));
      return scheduled ? { ...task, ...scheduled } : task;
    });
    const planningStatus = scheduler.status === "complete"
      ? "tasks_complete"
      : scheduler.status === "attention_required" ? "tasks_attention_required" : scheduler.status === "ready" ? "tasks_ready" : "tasks_running";
    await this.dependencies.lifecycle.updateState(parent, {
      research_planning: { ...planning, status: planningStatus, task_runs: taskRuns },
      research_execution: {
        ...(parent.state.research_execution || {}),
        status: scheduler.status,
        scheduler_path: paths.schedulerPath,
        review_queue_path: paths.reviewQueuePath,
        events_path: paths.eventsPath,
        planning_concurrency: scheduler.limits.planning_concurrency,
        execution_concurrency: scheduler.limits.execution_concurrency,
        updated_at: scheduler.updated_at,
      },
    });
    if (planning.task_manifest_path) {
      await this.dependencies.writeJson(String(planning.task_manifest_path), {
        parent_run_id: parent.runId,
        research_plan_path: planning.research_plan_path,
        updated_at: new Date().toISOString(),
        task_runs: taskRuns,
      });
    }
  }

  private async parent(cwd: string, runId: string) {
    const parent = await this.dependencies.lifecycle.resolveRun(cwd, runId);
    if (!parent.state.research_planning || parent.state.research_planning.enabled === false) {
      throw new Error("Analysis task scheduling is available only for a parent Research Planning run.");
    }
    return parent;
  }

  private async requireScheduler(path: string): Promise<WorkflowJson> {
    const scheduler = await readJson(path);
    if (!scheduler || scheduler.schema_version !== 1) {
      throw new Error("Analysis Execution is not initialized. Initialize the scheduler after materializing analysis tasks.");
    }
    return scheduler;
  }

  private result(scheduler: WorkflowJson, paths: ReturnType<typeof schedulerPaths>, reused: boolean): WorkflowJson {
    const tasks = Array.isArray(scheduler.tasks) ? scheduler.tasks : [];
    const completedTaskCount = tasks.filter((task: WorkflowJson) => task.status === "complete").length;
    const reportAvailable = tasks.length > 0 && completedTaskCount === tasks.length;
    return {
      ok: true,
      parent_run_id: scheduler.parent_run_id,
      status: scheduler.status,
      reused,
      limits: scheduler.limits,
      task_count: tasks.length,
      task_status_counts: Object.fromEntries([...new Set(tasks.map((task: WorkflowJson) => task.status))].map((status) => [status, tasks.filter((task: WorkflowJson) => task.status === status).length])),
      completed_task_count: completedTaskCount,
      report_available: reportAvailable,
      report_hint: reportAvailable
        ? `All ${completedTaskCount} Research Planning terminal tasks are complete. Run /seekbrain-report when you want the final academic report.`
        : undefined,
      tasks,
      scheduler_path: paths.schedulerPath,
      review_queue_path: paths.reviewQueuePath,
      events_path: paths.eventsPath,
    };
  }
}

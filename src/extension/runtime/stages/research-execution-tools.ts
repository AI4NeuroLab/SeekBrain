import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { basename } from "node:path";
import { Type } from "typebox";
import type {
  PlanWorkflow,
  ResearchSkillWorkflow,
  ResearchTaskExecutionCoordinator,
  ResearchTaskExecutionDependencies,
  ResearchTaskEventType,
  ResearchTaskScheduler,
  ReviewWorkflow,
  WorkflowRunContext,
} from "../../../workflows/index.ts";
import {
  createDependencyInstallToolResultHandler,
  type DependencyInstallApprovalQueue,
  SerializedReviewGate,
} from "../../dependency-install.ts";
import { renderSeekBrainResult } from "../../tui/compact-tool-results.ts";
import { selectTaskPlanReview, taskPlanReviewTitle } from "../../tui/review-selectors.ts";
import type { Json, SeekBrainToolDefinition } from "../runtime-types.ts";

export interface ResearchExecutionToolDependencies {
  projectRoot: string;
  scheduler: ResearchTaskScheduler;
  executionCoordinator: ResearchTaskExecutionCoordinator;
  executeTask: ResearchTaskExecutionDependencies["executeTask"];
  reviewWorkflow: ReviewWorkflow;
  researchSkillWorkflow: ResearchSkillWorkflow;
  planWorkflow: PlanWorkflow;
  loadConfig(cwd: string): Promise<Json>;
  workflowConfig(config: Json): Json & {
    targeted_skill_match: boolean;
    targeted_skill_generate: boolean;
    deep_research: boolean;
  };
  humanGateEnabled(config: Json, stage: string): boolean;
  readPrompt(name: string): Promise<string>;
  resolveRun(cwd: string, runId?: string): Promise<WorkflowRunContext>;
  pickAgentConfig(config: Json, name: string): Json;
  createDependencyApprovalQueue(
    context: Json,
    parentRunId?: string,
    reviewGate?: SerializedReviewGate,
  ): Promise<DependencyInstallApprovalQueue>;
  content(details: Json): any;
}

export function createResearchExecutionTools(
  deps: ResearchExecutionToolDependencies,
): SeekBrainToolDefinition[] {
  const collectedToolDefinitions: SeekBrainToolDefinition[] = [];
  const toolDefinitions = {
    push: ((definition: SeekBrainToolDefinition) => collectedToolDefinitions.push(definition)) as ExtensionAPI["registerTool"],
  };
  const {
    projectRoot: PROJECT_ROOT,
    scheduler: researchTaskScheduler,
    executionCoordinator: researchTaskExecution,
    executeTask: executeResearchTask,
    reviewWorkflow,
    researchSkillWorkflow,
    planWorkflow,
    loadConfig: loadConfigCached,
    workflowConfig: seekbrainWorkflowConfig,
    humanGateEnabled,
    readPrompt,
    resolveRun,
    pickAgentConfig,
    createDependencyApprovalQueue,
    content,
  } = deps;
toolDefinitions.push({
  name: "seekbrain_execution_initialize",
  label: "Initialize Analysis Execution",
  description: "Initialize the durable parallel scheduler for an approved, materialized hierarchical research plan. This is not used by the ordinary SeekBrain workflow.",
  parameters: Type.Object({ run_id: Type.String() }),
  async execute(_toolCallId, params, signal, _onUpdate, ctx) {
    const config = await loadConfigCached(PROJECT_ROOT);
    const execution = config.workflow.seekbrain.research_execution;
    return content(await researchTaskScheduler.initialize({
      cwd: ctx.cwd,
      runId: params.run_id,
      planningConcurrency: execution.planning_concurrency,
      executionConcurrency: execution.execution_concurrency,
    }));
  },
  renderResult: renderSeekBrainResult("seekbrain_execution_initialize"),
});

toolDefinitions.push({
  name: "seekbrain_execution_run",
  label: "Run Analysis Execution Engine",
  description: "Canonical start-or-resume entry point for the complete Analysis Execution Engine. Show every analysis task, reconcile interrupted child stages, prepare pending recipes, Deep Research context, and methodological schemas with bounded concurrency, serialize researcher review, and continue approved tasks through Code Generation & Execution, Validation, optional Figure Refinement, and Result Interpretation as slots become available.",
  parameters: Type.Object({ run_id: Type.String() }),
  async execute(_toolCallId, params, signal, onUpdate, ctx) {
    const config = await loadConfigCached(PROJECT_ROOT);
    const parentRun = await resolveRun(ctx.cwd, params.run_id);
    const agentFullAuto = parentRun.state.research_planning?.agent_full_auto === true;
    const reviewGate = new SerializedReviewGate();
    const dependencyQueue = await createDependencyApprovalQueue(ctx as Json, params.run_id, reviewGate);
    const execution = config.workflow.seekbrain.research_execution;
    const initialized = await researchTaskScheduler.initialize({
      cwd: ctx.cwd,
      runId: params.run_id,
      planningConcurrency: execution.planning_concurrency,
      executionConcurrency: execution.execution_concurrency,
    });
    if (initialized.reused === true) {
      await researchTaskScheduler.recoverInterruptedTasks(ctx.cwd, params.run_id);
    }
    const claimed = await researchTaskScheduler.claimPlanningTasks(ctx.cwd, params.run_id);
    const claimedIds = new Set((claimed.claimed_task_ids || []).map(String));
    const allTasks = (claimed.tasks || []) as Json[];
    const initiallyClaimedTasks = allTasks.filter((task: Json) => claimedIds.has(String(task.task_id)));
    const workflow = seekbrainWorkflowConfig(config);
    const reviewPolicy = await researchTaskScheduler.nextPlanReview(ctx.cwd, params.run_id);
    const planGateEnabled = humanGateEnabled(config, "plan");
    const initiallyAutoApprove = agentFullAuto || !planGateEnabled || reviewPolicy.approve_remaining === true;
    const [deepResearchPrompt, planPrompt] = await Promise.all([readPrompt("deep_research"), readPrompt("plan")]);
    const childStates = new Map<string, Json>();
    await Promise.all(allTasks.map(async (task: Json) => {
      const child = await resolveRun(ctx.cwd, task.run_id);
      childStates.set(String(task.task_id), child.state);
    }));
    const progress = new Map<string, Json>(allTasks.map((task: Json) => {
      const taskId = String(task.task_id);
      const state = childStates.get(taskId) || {};
      const validationCurrent = state.validation
        && Number(state.validation.validated_code_attempt ?? state.code_attempt) === Number(state.code_attempt || 0)
        && state.validation_invalidated_by_code_edit !== true;
      return [taskId, {
        task_id: taskId,
        skill: state.targeted_skill_path || state.targeted_skill_result ? "complete" : "waiting",
        deep_research: state.deep_research_context ? "complete" : "waiting",
        plan: state.plan ? "complete" : "waiting",
        review: state.human_reviews?.plan?.status === "approved" ? "approved" : state.plan ? "queued" : "waiting",
        code: state.code ? "complete" : "waiting",
        validate: validationCurrent ? "complete" : "waiting",
        refine: state.image_refinement || state.refinement ? "complete" : validationCurrent ? "skipped" : "waiting",
        interpret: state.interpretation && state.conclusions ? "complete" : "waiting",
      }];
    }));
    const reviewedTaskIds = new Set<string>(allTasks
      .filter((task: Json) => childStates.get(String(task.task_id))?.human_reviews?.plan?.status === "approved")
      .map((task: Json) => String(task.task_id)));
    const emitProgress = (message?: string) => onUpdate?.(content({
      ok: true,
      progress: true,
      parent_run_id: params.run_id,
      message,
      task_progress: [...progress.values()],
    }));
    const updateProgress = (taskId: string, patch: Json, message?: string) => {
      progress.set(taskId, { ...(progress.get(taskId) || { task_id: taskId }), ...patch });
      emitProgress(message);
    };
    const approveChildPlan = async (task: Json, reason: string) => {
      const taskId = String(task.task_id);
      if (reviewedTaskIds.has(taskId)) return;
      const child = await resolveRun(ctx.cwd, task.run_id);
      await reviewWorkflow.approve(child, "plan", reason, { source: "research_task_review_queue" });
      reviewedTaskIds.add(taskId);
    };
    const executionResults: Json[] = [];
    const activeExecutions = new Map<string, Promise<Json>>();
    const activeRevisions = new Map<string, Promise<Json>>();
    const updateExecutionProgress = (taskId: string, type: string, payload: Json) => {
      const patch: Json = {};
      if (type === "execution_started" || type === "code_started") {
        patch.code = "running";
        patch.code_attempt = payload.code_attempt;
      } else if (type === "code_completed") patch.code = "complete";
      else if (type === "validation_started") patch.validate = "running";
      else if (type === "validation_completed") patch.validate = payload.route === "retry_code" ? "revision_required" : "complete";
      else if (type === "refinement_started") patch.refine = "running";
      else if (type === "refinement_completed") patch.refine = payload.skipped ? "skipped" : payload.ok === false ? "failed" : "complete";
      else if (type === "interpretation_started") patch.interpret = "running";
      else if (type === "task_completed") patch.interpret = "complete";
      else if (type === "task_blocked") patch.blocked = true;
      else if (type === "task_failed") patch.failed = true;
      updateProgress(taskId, patch, `${taskId} · ${type.replaceAll("_", " ")}`);
    };
    const syncCompletedExecutionProgress = (scheduler: Json) => {
      let changed = false;
      for (const task of scheduler.tasks || []) {
        if (task.status !== "complete") continue;
        const taskId = String(task.task_id);
        const current: Json = progress.get(taskId) || { task_id: taskId };
        if (current.interpret === "complete") continue;
        progress.set(taskId, { ...current, interpret: "complete" });
        changed = true;
      }
      if (changed) emitProgress("Completed task released its execution slot");
    };
    const startApprovedTasks = async () => {
      const claimedExecution = await researchTaskScheduler.claimExecutionTasks(ctx.cwd, params.run_id);
      const executionIds = new Set((claimedExecution.claimed_task_ids || []).map(String));
      for (const task of (claimedExecution.tasks || []).filter((item: Json) => executionIds.has(String(item.task_id)))) {
        const taskId = String(task.task_id);
        if (activeExecutions.has(taskId)) continue;
        const running = (async () => {
          const publish = async (type: ResearchTaskEventType, payload: Json = {}) => {
            await researchTaskScheduler.publishEvent({
              cwd: ctx.cwd, parentRunId: params.run_id, taskId, type, payload,
            });
            updateExecutionProgress(taskId, type, payload);
          };
          try {
            const result = await executeResearchTask({
              cwd: ctx.cwd,
              parentRunId: params.run_id,
              task,
              publish,
              signal,
              afterCodeToolCall: createDependencyInstallToolResultHandler(dependencyQueue, {
                runId: task.run_id,
                parentRunId: params.run_id,
                taskId,
              }),
            });
            executionResults.push(result);
            return result;
          } catch (error) {
            await publish("task_failed", { failed_stage: "execution", error: String(error) });
            const result = { task_id: taskId, run_id: task.run_id, ok: false, error: String(error) };
            executionResults.push(result);
            return result;
          }
        })();
        activeExecutions.set(taskId, running);
        void running.then(() => activeExecutions.delete(taskId), () => activeExecutions.delete(taskId));
      }
    };
    const prepareTask = async (task: Json): Promise<Json> => {
      const taskId = String(task.task_id);
      try {
        updateProgress(taskId, { skill: "running", deep_research: "running" }, `${taskId} · retrieving analysis recipe and running Deep Research`);
        await Promise.all([
          researchTaskScheduler.publishEvent({ cwd: ctx.cwd, parentRunId: params.run_id, taskId, type: "skill_started" }),
          researchTaskScheduler.publishEvent({ cwd: ctx.cwd, parentRunId: params.run_id, taskId, type: "deep_research_started" }),
        ]);
        const skillPromise = researchSkillWorkflow.resolveTargetedSkill({
            cwd: ctx.cwd, workflowRoot: PROJECT_ROOT, runId: task.run_id,
            params: {}, config, flags: workflow, signal,
          }).then(async (skill) => {
            const names = (skill.skill_paths || []).map((path: unknown) => basename(String(path))).filter(Boolean);
            const skillSummary = skill.matched
              ? skill.source === "generated_from_rag"
                ? `Crystallized ${names.join(", ") || "analysis recipe"} from literature and code`
                : `Retrieved ${names.join(", ") || "analysis recipe"} from the Neuroscience Analysis Repertoire`
              : String(skill.warnings?.[0] || "No matching analysis recipe found");
            updateProgress(taskId, { skill: skill.matched ? "matched" : "not_found", skill_summary: skillSummary }, `${taskId} · Recipe ${skill.matched ? "ready" : "not found"}`);
            await researchTaskScheduler.publishEvent({
              cwd: ctx.cwd, parentRunId: params.run_id, taskId, type: "skill_resolved",
              payload: { skill_summary: skillSummary, skill_source: skill.source, skill_paths: skill.skill_paths || [] },
            });
            return { skill, skillSummary };
          });
        const researchPromise = researchSkillWorkflow.deepResearch({
            cwd: ctx.cwd, workflowRoot: PROJECT_ROOT, runId: task.run_id,
            params: {}, flags: workflow,
            agentConfig: pickAgentConfig(config, "seekbrain_deep_research"),
            rolePrompt: deepResearchPrompt,
            finalizeSchema: Type.Object({
              deep_research_context: Type.String(), summary: Type.String(), warnings: Type.Array(Type.String()),
            }),
            signal,
          }).then(async (research) => {
            const researchSummary = String(research.result?.summary || research.rag_error || `${Number(research.source_count || 0)} sources`);
            updateProgress(taskId, { deep_research: "complete", deep_research_summary: researchSummary, source_count: Number(research.source_count || 0) }, `${taskId} · Deep Research complete`);
            await researchTaskScheduler.publishEvent({
              cwd: ctx.cwd, parentRunId: params.run_id, taskId, type: "deep_research_completed",
              payload: { deep_research_summary: researchSummary, source_count: Number(research.source_count || 0), rag_ok: research.rag_ok },
            });
            return { research, researchSummary };
          });
        const [{ skill, skillSummary }, { research, researchSummary }] = await Promise.all([skillPromise, researchPromise]);
        updateProgress(taskId, { plan: "running" }, `${taskId} · generating methodological schema`);
        await researchTaskScheduler.publishEvent({ cwd: ctx.cwd, parentRunId: params.run_id, taskId, type: "plan_started" });
        const plan = await planWorkflow.execute({
          cwd: ctx.cwd,
          runId: task.run_id,
          rolePrompt: planPrompt,
          agentConfig: pickAgentConfig(config, "seekbrain_plan"),
          finalizeSchema: Type.Object({
            plan_markdown: Type.String(), review_summary: Type.String(), warnings: Type.Array(Type.String()),
          }),
          humanReviewRequired: false,
          signal,
        });
        if (!plan.ok) throw new Error(String(plan.error || "Methodological schema generation failed."));
        const planSummary = String(plan.result?.review_summary || "");
        if (initiallyAutoApprove) {
          await approveChildPlan(task, agentFullAuto
            ? "approved by Agent-Full-Auto"
            : planGateEnabled
            ? "approved by the current Research Planning approve-remaining policy"
            : "Methodological schema review gate is disabled");
        }
        await researchTaskScheduler.publishEvent({
          cwd: ctx.cwd, parentRunId: params.run_id, taskId, type: "plan_ready",
          payload: { plan_path: plan.plan_path, plan_summary: planSummary, plan_warnings: plan.result?.warnings || [], plan_revision: Number(plan.revision || 0), rollback_available: false, skill_summary: skillSummary, deep_research_summary: researchSummary },
        });
        updateProgress(taskId, { plan: "ready", plan_summary: planSummary, review: initiallyAutoApprove ? "approved" : "queued" }, `${taskId} · Methodological schema ready`);
        return { task_id: task.task_id, run_id: task.run_id, ok: true, plan_path: plan.plan_path, plan_summary: planSummary, skill_summary: skillSummary, deep_research_summary: researchSummary };
      } catch (error) {
        await researchTaskScheduler.publishEvent({
          cwd: ctx.cwd, parentRunId: params.run_id, taskId: task.task_id, type: "task_failed",
          payload: { failed_stage: "planning", error: String(error) },
        });
        updateProgress(taskId, { plan: "failed", error: String(error) }, `${taskId} · Analytical Formulation failed`);
        return { task_id: task.task_id, run_id: task.run_id, ok: false, error: String(error) };
      }
    };
    const startPlanRevision = (task: Json, feedback: string, expectedRevision: number, restorePrevious = false) => {
      const taskId = String(task.task_id);
      if (activeRevisions.has(taskId)) return;
      const running = (async () => {
        updateProgress(taskId, { plan: "revising", review: "revising" }, `${taskId} · revising methodological schema in background`);
        let revised: Json;
        try {
          revised = await planWorkflow.revise({
            cwd: ctx.cwd,
            runId: String(task.run_id),
            feedback,
            restorePrevious,
            expectedRevision,
            rolePrompt: planPrompt,
            agentConfig: pickAgentConfig(config, "seekbrain_plan"),
            finalizeSchema: Type.Object({
              plan_markdown: Type.String(), review_summary: Type.String(), warnings: Type.Array(Type.String()),
            }),
            signal,
          });
        } catch (error) {
          revised = { ok: false, error: String(error) };
        }
        const child = await resolveRun(ctx.cwd, task.run_id);
        const planPath = String(child.state.plan?.path || task.plan_path || "");
        const planSummary = String(child.state.plan?.review_summary || task.plan_summary || "");
        const planRevision = Number(child.state.plan?.revision || expectedRevision);
        await researchTaskScheduler.publishEvent({
          cwd: ctx.cwd,
          parentRunId: params.run_id,
          taskId,
          type: "plan_ready",
          payload: {
            plan_path: planPath,
            plan_summary: planSummary,
            plan_warnings: child.state.plan?.warnings || [],
            plan_revision: planRevision,
            rollback_available: Boolean(child.state.plan?.previous_path),
            skill_summary: task.skill_summary,
            deep_research_summary: task.deep_research_summary,
            ...(revised.ok ? {} : { revision_error: revised.error || "Plan revision failed" }),
          },
        });
        updateProgress(taskId, { plan: "ready", review: "queued", ...(revised.ok ? {} : { revision_error: revised.error }) }, `${taskId} · revised methodological schema ready for review`);
        return revised;
      })();
      activeRevisions.set(taskId, running);
    };
    const reviewReadyPlans = async () => {
      if (agentFullAuto || !planGateEnabled) return;
      while (true) {
        const queue = await researchTaskScheduler.nextPlanReview(ctx.cwd, params.run_id);
        if (!queue.current) return;
        const selection = await reviewGate.run(() => selectTaskPlanReview(ctx as any, {
          title: taskPlanReviewTitle(queue.current, queue.queue_length),
          feedbackTitle: `Changes for ${queue.current.task_id}`,
          feedbackPlaceholder: "Describe the scientific or analytical changes required before execution",
          rollbackAvailable: queue.current.rollback_available === true,
        }));
        if (["unavailable", "feedback_empty", "cancel"].includes(selection.decision)) return;
        const restorePrevious = selection.decision === "restore_previous";
        const decision = selection.decision === "feedback" || restorePrevious ? "revise" : selection.decision;
        const feedback = selection.decision === "feedback" ? selection.feedback : restorePrevious ? "Restore previous Plan version" : "";
        const scheduler = await researchTaskScheduler.status(ctx.cwd, params.run_id, true);
        const affected = decision === "approve_remaining"
          ? scheduler.tasks.filter((item: Json) => item.status === "awaiting_plan_review")
          : scheduler.tasks.filter((item: Json) => String(item.task_id) === String(queue.current.task_id));
        for (const affectedTask of affected) {
          const child = await resolveRun(ctx.cwd, affectedTask.run_id);
          if (decision === "revise") await reviewWorkflow.feedback(child, "plan", feedback, { source: "research_task_review_queue", action: "revise" });
          else await approveChildPlan(affectedTask, decision === "approve_remaining" ? "approved with all remaining methodological schemas" : "approved via Research Planning analysis-task queue");
          updateProgress(String(affectedTask.task_id), { review: decision === "revise" ? "revising" : "approved" });
        }
        await researchTaskScheduler.recordPlanReview({
          cwd: ctx.cwd, runId: params.run_id, taskId: String(queue.current.task_id),
          decision: decision as "approve" | "revise" | "approve_remaining", feedback,
          planRevision: Number(queue.current.plan_revision || 0),
        });
        if (decision === "revise" && affected[0]) startPlanRevision(affected[0], feedback, Number(queue.current.plan_revision || 0), restorePrevious);
        emitProgress(`${queue.current.task_id} · Methodological schema ${decision === "revise" ? "revision requested" : "approved"}`);
        if (decision !== "revise") await startApprovedTasks();
      }
    };
    const approveReadyPlansWithoutGate = async () => {
      if (planGateEnabled && !agentFullAuto) return;
      while (true) {
        const queue = await researchTaskScheduler.nextPlanReview(ctx.cwd, params.run_id);
        if (!queue.current) return;
        const scheduler = await researchTaskScheduler.status(ctx.cwd, params.run_id, true);
        const task = scheduler.tasks.find((item: Json) => String(item.task_id) === String(queue.current.task_id));
        if (task) await approveChildPlan(task, agentFullAuto ? "approved by Agent-Full-Auto" : "Methodological schema review gate is disabled");
        await researchTaskScheduler.recordPlanReview({
          cwd: ctx.cwd, runId: params.run_id, taskId: String(queue.current.task_id), decision: "approve",
        });
        updateProgress(String(queue.current.task_id), { review: "approved" }, `${queue.current.task_id} · Methodological schema approved`);
      }
    };
    const results: Json[] = [];
    let workerSequence = 0;
    const remaining = new Map<number, Promise<{ index: number; result: Json }>>();
    const enqueuePlanningTasks = (tasks: Json[]) => {
      for (const task of tasks) {
        const index = workerSequence++;
        remaining.set(index, prepareTask(task).then((result) => ({ index, result })));
      }
    };
    const claimAndEnqueuePlanningTasks = async () => {
      const next = await researchTaskScheduler.claimPlanningTasks(ctx.cwd, params.run_id);
      const nextIds = new Set((next.claimed_task_ids || []).map(String));
      enqueuePlanningTasks((next.tasks || []).filter((task: Json) => nextIds.has(String(task.task_id))));
    };
    enqueuePlanningTasks(initiallyClaimedTasks);
    emitProgress("Preparing analysis recipes, Deep Research, and methodological schemas in parallel");
    while (remaining.size || activeRevisions.size) {
      const completed = await Promise.race([
        ...[...remaining.entries()].map(([index, running]) => running.then((settled) => ({
          kind: "planning" as const,
          index,
          settled,
        }))),
        ...[...activeRevisions.entries()].map(([taskId, running]) => running.then(
          (result) => ({ kind: "revision" as const, taskId, result }),
          (error) => ({ kind: "revision" as const, taskId, result: { ok: false, error: String(error) } }),
        )),
      ]);
      if (completed.kind === "planning") {
        remaining.delete(completed.index);
        results.push(completed.settled.result);
        // A ready Plan frees one planning slot. Fill it immediately so queued
        // tasks are visible from the start but do not begin Recipe/Formulation work
        // until the configured planning concurrency allows it.
        await claimAndEnqueuePlanningTasks();
      } else {
        // Keep completed revisions registered until this coordination loop has
        // observed them. Otherwise a fast revision can disappear while another
        // task is still producing its initial Plan and never reach review.
        activeRevisions.delete(completed.taskId);
      }
      const scheduler = await researchTaskScheduler.status(ctx.cwd, params.run_id, true);
      for (const scheduled of scheduler.tasks.filter((item: Json) => item.status === "approved" && item.plan_path)) {
        const sourceTask = allTasks.find((item: Json) => String(item.task_id) === String(scheduled.task_id));
        if (sourceTask) await approveChildPlan(sourceTask, "approved by the current Research Planning approve-remaining policy");
      }
      await approveReadyPlansWithoutGate();
      await reviewReadyPlans();
      await startApprovedTasks();
    }
    await researchTaskScheduler.status(ctx.cwd, params.run_id, true);
    await approveReadyPlansWithoutGate();
    await reviewReadyPlans();
    await startApprovedTasks();
    while (activeExecutions.size) {
      // Consume completion events as soon as any worker settles. Waiting for
      // the whole active batch here leaves already-completed tasks marked as
      // executing, keeps their UI at Interpret ●, and prevents an approved
      // task from taking the newly available execution slot.
      const settledTaskId = await Promise.race(
        [...activeExecutions.entries()].map(([taskId, running]) => running.then(() => taskId, () => taskId)),
      );
      activeExecutions.delete(settledTaskId);
      const scheduler = await researchTaskScheduler.status(ctx.cwd, params.run_id, true);
      syncCompletedExecutionProgress(scheduler);
      await startApprovedTasks();
    }
    const finalStatus = await researchTaskScheduler.status(ctx.cwd, params.run_id, true);
    const queue = await researchTaskScheduler.nextPlanReview(ctx.cwd, params.run_id);
    return content({
      ok: results.every((result) => result.ok) && executionResults.every((result) => result.ok),
      parent_run_id: params.run_id,
      planned_count: results.filter((result) => result.ok).length,
      failed_count: results.filter((result) => !result.ok).length,
      results,
      executed_count: executionResults.filter((result) => result.ok).length,
      execution_failed_count: executionResults.filter((result) => !result.ok).length,
      execution_results: executionResults,
      status: finalStatus.status,
      task_status_counts: finalStatus.task_status_counts,
      next_review: queue.current,
      review_queue_length: queue.queue_length,
    });
  },
  renderResult: renderSeekBrainResult("seekbrain_execution_run"),
});

toolDefinitions.push({
  name: "seekbrain_execution_schema_review",
  label: "Review Methodological Schema",
  description: "Present one serialized methodological-schema review for an analysis task. Supports approval, revision feedback, or approval of this and all remaining valid methodological schemas.",
  parameters: Type.Object({
    run_id: Type.String(),
    decision: Type.Optional(Type.Union([Type.Literal("approve"), Type.Literal("revise"), Type.Literal("restore_previous"), Type.Literal("approve_remaining")])),
    feedback: Type.Optional(Type.String()),
  }),
  async execute(_toolCallId, params, signal, _onUpdate, ctx) {
    const queue = await researchTaskScheduler.nextPlanReview(ctx.cwd, params.run_id);
    if (!queue.current) return content({ ok: true, parent_run_id: params.run_id, queue_empty: true, message: "No methodological schema is waiting for review." });
    const parentRun = await resolveRun(ctx.cwd, params.run_id);
    const agentFullAuto = parentRun.state.research_planning?.agent_full_auto === true;
    let decision = agentFullAuto ? "approve" as const : params.decision;
    let feedback = String(params.feedback || "").trim();
    if (!decision) {
      const task = queue.current.task || {};
      const selection = await selectTaskPlanReview(ctx as any, {
        title: taskPlanReviewTitle(queue.current, queue.queue_length),
        feedbackTitle: `Changes for ${queue.current.task_id}`,
        feedbackPlaceholder: "Describe the scientific or analytical changes required before execution",
        rollbackAvailable: queue.current.rollback_available === true,
      });
      if (selection.decision === "unavailable") return content({ ok: false, parent_run_id: params.run_id, needs_text_review: true, message: "Interactive methodological-schema review is unavailable." });
      if (selection.decision === "feedback_empty") return content({ ok: false, parent_run_id: params.run_id, message: "No methodological-schema revision feedback was entered." });
      if (selection.decision === "cancel") return content({ ok: false, parent_run_id: params.run_id, message: "Methodological-schema review was cancelled." });
      decision = selection.decision === "feedback" ? "revise" : selection.decision;
      feedback = selection.decision === "feedback" ? selection.feedback : feedback;
    }
    const restorePrevious = decision === "restore_previous";
    if (restorePrevious) {
      decision = "revise";
      feedback = "Restore previous Plan version";
    }
    const scheduler = await researchTaskScheduler.status(ctx.cwd, params.run_id, true);
    const affected = decision === "approve_remaining"
      ? scheduler.tasks.filter((task: Json) => task.status === "awaiting_plan_review")
      : scheduler.tasks.filter((task: Json) => String(task.task_id) === String(queue.current.task_id));
    for (const task of affected) {
      const child = await resolveRun(ctx.cwd, task.run_id);
      if (decision === "revise") await reviewWorkflow.feedback(child, "plan", feedback, { source: "research_task_review_queue", action: "revise" });
      else await reviewWorkflow.approve(child, "plan", agentFullAuto ? "approved by Agent-Full-Auto" : decision === "approve_remaining" ? "approved with all remaining methodological schemas" : "approved via Research Planning analysis-task queue", { source: agentFullAuto ? "agent_full_auto" : "research_task_review_queue" });
    }
    const recorded = await researchTaskScheduler.recordPlanReview({
      cwd: ctx.cwd,
      runId: params.run_id,
      taskId: String(queue.current.task_id),
      decision: decision as "approve" | "revise" | "approve_remaining",
      feedback,
      planRevision: Number(queue.current.plan_revision || 0),
    });
    if (decision !== "revise" || !affected[0]) return content(recorded);
    const task = affected[0];
    const config = await loadConfigCached(PROJECT_ROOT);
    const revised = await planWorkflow.revise({
      cwd: ctx.cwd,
      runId: String(task.run_id),
      feedback,
      restorePrevious,
      expectedRevision: Number(queue.current.plan_revision || 0),
      rolePrompt: await readPrompt("plan"),
      agentConfig: pickAgentConfig(config, "seekbrain_plan"),
      finalizeSchema: Type.Object({ plan_markdown: Type.String(), review_summary: Type.String(), warnings: Type.Array(Type.String()) }),
      signal,
    });
    const child = await resolveRun(ctx.cwd, task.run_id);
    await researchTaskScheduler.publishEvent({
      cwd: ctx.cwd,
      parentRunId: params.run_id,
      taskId: String(task.task_id),
      type: "plan_ready",
      payload: {
        plan_path: child.state.plan?.path,
        plan_summary: child.state.plan?.review_summary || task.plan_summary,
        plan_revision: Number(child.state.plan?.revision || queue.current.plan_revision || 0),
        rollback_available: Boolean(child.state.plan?.previous_path),
        skill_summary: task.skill_summary,
        deep_research_summary: task.deep_research_summary,
        ...(revised.ok ? {} : { revision_error: revised.error }),
      },
    });
    await researchTaskScheduler.status(ctx.cwd, params.run_id, true);
    return content({ ...recorded, revision: revised, next_review: (await researchTaskScheduler.nextPlanReview(ctx.cwd, params.run_id)).current });
  },
  renderResult: renderSeekBrainResult("seekbrain_execution_schema_review"),
});

toolDefinitions.push({
  name: "seekbrain_execution_tasks_run",
  label: "Execute Analysis Tasks",
  description: "Low-level manual execution of one approved-task batch. Do not use this to start or resume the complete Research Planning pipeline; use seekbrain_execution_run, which restores and continues every task in one live view.",
  parameters: Type.Object({ run_id: Type.String() }),
  async execute(_toolCallId, params, signal, onUpdate, ctx) {
    const dependencyQueue = await createDependencyApprovalQueue(ctx as Json, params.run_id);
    await researchTaskScheduler.recoverInterruptedTasks(ctx.cwd, params.run_id);
    const initial = await researchTaskScheduler.status(ctx.cwd, params.run_id, true);
    const progress = new Map((initial.tasks || []).map((task: Json) => [String(task.task_id), {
      task_id: String(task.task_id), code: task.status === "complete" ? "complete" : "waiting",
      validate: task.status === "complete" ? "complete" : "waiting",
      refine: task.status === "complete" ? "skipped" : "waiting",
      interpret: task.status === "complete" ? "complete" : "waiting",
    }]));
    const emitProgress = (message?: string) => onUpdate?.(content({
      ok: true, progress: true, parent_run_id: params.run_id, message, task_progress: [...progress.values()],
    }));
    const result = await researchTaskExecution.execute({
      cwd: ctx.cwd,
      runId: params.run_id,
      signal,
      onProgress: (event) => {
        const current = progress.get(event.task_id) || { task_id: event.task_id, code: "waiting", validate: "waiting", refine: "waiting", interpret: "waiting" };
        const patch: Json = {};
        if (event.type === "execution_started" || event.type === "code_started") {
          patch.code = "running";
          patch.code_attempt = event.payload.code_attempt;
          patch.retry_reason = event.payload.retry_reason;
        } else if (event.type === "code_completed") {
          patch.code = "complete";
          patch.code_summary = event.payload.code_summary;
        } else if (event.type === "validation_started") patch.validate = "running";
        else if (event.type === "validation_completed") {
          patch.validate = event.payload.route === "retry_code" ? "revision_required" : "complete";
          patch.validation_summary = event.payload.summary;
        } else if (event.type === "refinement_started") patch.refine = "running";
        else if (event.type === "refinement_completed") patch.refine = event.payload.skipped ? "skipped" : event.payload.ok === false ? "failed" : "complete";
        else if (event.type === "interpretation_started") patch.interpret = "running";
        else if (event.type === "task_completed") patch.interpret = "complete";
        else if (event.type === "task_blocked") patch.blocked = true;
        else if (event.type === "task_failed") patch.failed = true;
        progress.set(event.task_id, { ...current, ...patch });
        emitProgress(`${event.task_id} · ${event.type.replaceAll("_", " ")}`);
      },
      afterCodeToolCallForTask: (task) => createDependencyInstallToolResultHandler(dependencyQueue, {
        runId: String(task.run_id || ""),
        parentRunId: params.run_id,
        taskId: String(task.task_id || ""),
      }),
    });
    return content({ ...result, task_progress: [...progress.values()] });
  },
  renderResult: renderSeekBrainResult("seekbrain_execution_tasks_run"),
});

toolDefinitions.push({
  name: "seekbrain_analysis_task_control",
  label: "Control Analysis Task",
  description: "Apply an explicit user decision to one failed, blocked, or unwanted Research Planning analysis task without affecting unrelated tasks.",
  parameters: Type.Object({
    run_id: Type.String(),
    task_id: Type.String(),
    action: Type.Union([Type.Literal("retry_execution"), Type.Literal("restart_planning"), Type.Literal("cancel")]),
    reason: Type.Optional(Type.String()),
  }),
  async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
    return content(await researchTaskScheduler.controlTask({
      cwd: ctx.cwd, runId: params.run_id, taskId: params.task_id, action: params.action, reason: params.reason,
    }));
  },
  renderResult: renderSeekBrainResult("seekbrain_analysis_task_control"),
});
  return collectedToolDefinitions;
}

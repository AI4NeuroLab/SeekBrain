import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Value } from "typebox/value";
import { ExecutionContractSchema, type ExecutionContract } from "../../core/index.ts";
import type { RunLifecycleWorkflow, WorkflowJson, WorkflowRunContext } from "./run-lifecycle.ts";

export interface ReviewWorkflowDependencies {
  lifecycle: RunLifecycleWorkflow;
  writeText(path: string, value: string): Promise<void>;
  writeJson(path: string, value: WorkflowJson): Promise<void>;
  appendEvent(event: WorkflowJson): Promise<void>;
}

export interface ReviewEventOptions {
  event?: string;
  source?: string;
  action?: string;
}

export function normalizeReviewStage(stage: unknown): string {
  return String(stage || "").trim().toLowerCase().replace(/[^a-z0-9_.-]+/g, "_");
}

export class ReviewWorkflow {
  constructor(readonly dependencies: ReviewWorkflowDependencies) {}

  entry(run: WorkflowRunContext, stage: string): WorkflowJson {
    const entry = run.state.human_reviews?.[stage] || {};
    return entry && typeof entry === "object" ? entry : {};
  }

  approved(run: WorkflowRunContext, stage: string): boolean {
    return this.entry(run, stage).status === "approved";
  }

  feedbackText(run: WorkflowRunContext, stage: string): string {
    const feedback = this.entry(run, stage).feedback;
    if (!Array.isArray(feedback) || !feedback.length) return "";
    return feedback.map((item: unknown, index: number) => {
      const text = typeof item === "string" ? item : String((item as WorkflowJson)?.text || "");
      return text.trim() ? `${index + 1}. ${text.trim()}` : "";
    }).filter(Boolean).join("\n");
  }

  async approve(run: WorkflowRunContext, stage: string, notes?: string, options: ReviewEventOptions = {}): Promise<WorkflowJson> {
    const reviews = run.state.human_reviews || {};
    const previous = reviews[stage] || {};
    const next = { ...previous, status: "approved", approved_at: new Date().toISOString(), notes: notes || previous.notes || "" };
    await this.dependencies.lifecycle.updateState(run, { human_reviews: { ...reviews, [stage]: next } });
    await this.dependencies.appendEvent({ run_id: run.runId, event: options.event || "seekbrain_review_approve", stage, ok: true, ...(options.source ? { source: options.source } : {}), ...(options.action ? { action: options.action } : {}) });
    return next;
  }

  async feedback(run: WorkflowRunContext, stage: string, text: string, options: ReviewEventOptions & { status?: string } = {}): Promise<WorkflowJson> {
    const reviews = run.state.human_reviews || {};
    const previous = reviews[stage] || {};
    const previousFeedback = Array.isArray(previous.feedback) ? previous.feedback : [];
    const next: WorkflowJson = { ...previous, status: options.status || "changes_requested", feedback: [...previousFeedback, { at: new Date().toISOString(), text, source: options.source || "tool" }], updated_at: new Date().toISOString() };
    delete next.approved_at;
    await this.dependencies.lifecycle.updateState(run, { human_reviews: { ...reviews, [stage]: next } });
    await this.dependencies.appendEvent({ run_id: run.runId, event: options.event || "seekbrain_review_feedback", stage, ok: true, ...(options.source ? { source: options.source } : {}), ...(options.action ? { action: options.action } : {}) });
    return next;
  }

  async stop(run: WorkflowRunContext, stage: string, reason = "stopped by researcher"): Promise<WorkflowJson> {
    const reviews = run.state.human_reviews || {};
    const previous = reviews[stage] || {};
    const stoppedAt = new Date().toISOString();
    const next = { ...previous, status: "cancelled_by_user", cancelled_at: stoppedAt, notes: reason };
    await this.dependencies.lifecycle.updateState(run, {
      human_reviews: { ...reviews, [stage]: next },
      workflow_status: "cancelled_by_user",
      cancelled_at: stoppedAt,
      cancellation: { stage, reason, source: "review_selector", at: stoppedAt },
    });
    await this.dependencies.appendEvent({ run_id: run.runId, event: "seekbrain_workflow_cancelled", stage, ok: true, source: "review_selector" });
    return next;
  }

  async approveStage(cwd: string, runId: string, rawStage: unknown, notes?: string): Promise<WorkflowJson> {
    const run = await this.dependencies.lifecycle.resolveRun(cwd, runId);
    const stage = normalizeReviewStage(rawStage);
    if (!stage) return { ok: false, run_id: run.runId, error: "stage is required" };
    const review = await this.approve(run, stage, notes);
    return { ok: true, run_id: run.runId, stage, review, message: `Researcher review approved '${stage}'. Downstream gated tools may proceed.` };
  }

  async recordStageFeedback(cwd: string, runId: string, rawStage: unknown, rawFeedback: unknown): Promise<WorkflowJson> {
    const run = await this.dependencies.lifecycle.resolveRun(cwd, runId);
    const stage = normalizeReviewStage(rawStage);
    const feedback = String(rawFeedback || "").trim();
    if (!stage) return { ok: false, run_id: run.runId, error: "stage is required" };
    if (!feedback) return { ok: false, run_id: run.runId, stage, error: "feedback is required" };
    const review = await this.feedback(run, stage, feedback, { source: "tool" });
    return { ok: true, run_id: run.runId, stage, review, message: stage === "plan" ? "Recorded researcher feedback for the methodological schema. For local schema edits, update the persisted schema with seekbrain_formulation_update before requesting approval again; rerun seekbrain_formulation_generate only for broad redesigns." : `Recorded researcher feedback for '${stage}'. Rerun or revise the relevant stage with this feedback before requesting approval again.` };
  }

  async updatePlan(input: { cwd: string; runId: string; planMarkdown: unknown; executionContract?: unknown; reviewSummary?: string; warnings?: string[]; revisionNote?: string }): Promise<WorkflowJson> {
    const run = await this.dependencies.lifecycle.resolveRun(input.cwd, input.runId);
    const planMarkdown = String(input.planMarkdown || "").trim();
    if (!planMarkdown) return { ok: false, run_id: run.runId, error: "plan_markdown is required" };
    const previous = run.state.plan || {};
    const previousRevision = Number(previous.revision || 1);
    const revision = Number.isFinite(previousRevision) ? previousRevision + 1 : 2;
    const planPath = join(run.runDir, "plan.md");
    const executionContractPath = String(run.state.execution_contract_path || join(run.runDir, "execution_contract.json"));
    const priorContract = Value.Check(ExecutionContractSchema, run.state.execution_contract)
      ? run.state.execution_contract as ExecutionContract
      : undefined;
    const nextContract = input.executionContract === undefined ? priorContract : input.executionContract;
    if (nextContract !== undefined && !Value.Check(ExecutionContractSchema, nextContract)) {
      return { ok: false, run_id: run.runId, error: "execution_contract must contain non-empty requirements and validation_checks arrays." };
    }
    const previousPath = join(run.runDir, "plan.previous.json");
    const next: WorkflowJson = {
      path: planPath,
      review_summary: input.reviewSummary || previous.review_summary || "Methodological schema updated from researcher feedback.",
      warnings: input.warnings || previous.warnings || [],
      revision,
      revision_note: input.revisionNote || "",
      updated_by: "main_agent",
      updated_at: new Date().toISOString(),
    };
    try {
      const currentPlan = (await readFile(planPath, "utf8")).trim();
      if (currentPlan) await this.dependencies.writeText(previousPath, JSON.stringify({
        plan_markdown: currentPlan,
        execution_contract: priorContract,
        review_summary: String(previous.review_summary || ""),
        warnings: Array.isArray(previous.warnings) ? previous.warnings : [],
        revision: previousRevision,
      }, null, 2));
    } catch { /* No prior Plan exists yet. */ }
    next.previous_path = previousPath;
    if (nextContract) next.execution_contract_path = executionContractPath;
    await this.dependencies.writeText(planPath, planMarkdown);
    if (nextContract) await this.dependencies.writeJson(executionContractPath, nextContract as unknown as WorkflowJson);
    await this.dependencies.lifecycle.updateState(run, {
      plan: next,
      ...(nextContract ? { execution_contract: nextContract, execution_contract_path: executionContractPath } : {}),
    });
    await this.dependencies.appendEvent({ run_id: run.runId, event: "seekbrain_formulation_update", ok: true, plan_path: planPath, revision });
    return { ok: true, run_id: run.runId, plan_path: planPath, execution_contract_path: nextContract ? executionContractPath : undefined, revision, result: { execution_contract: nextContract, review_summary: next.review_summary, warnings: next.warnings }, human_review: { required: true, approved: this.approved(run, "plan"), feedback: this.feedbackText(run, "plan"), needs_user_review: true }, message: "Updated plan.md. Show the concise review summary and ask the researcher to approve it before calling seekbrain_code_execute." };
  }

  pending(run: WorkflowRunContext): WorkflowJson[] {
    return Array.isArray(run.state.pending_code_edits) ? run.state.pending_code_edits : [];
  }

  findPending(run: WorkflowRunContext, editId?: string): WorkflowJson | undefined {
    return [...this.pending(run)].reverse().find((item) => (!editId || item.edit_id === editId) && (item.status === "proposed" || item.status === "changes_requested"));
  }

  async proposeCodeEdit(run: WorkflowRunContext, entry: WorkflowJson, event: string): Promise<void> {
    await this.dependencies.lifecycle.updateState(run, { pending_code_edits: [...this.pending(run), entry] });
    await this.dependencies.appendEvent({ run_id: run.runId, event, ok: true, edit_id: entry.edit_id, code_path: entry.code_path, ...(entry.change_scope ? { change_scope: entry.change_scope } : {}) });
  }

  async applyCodeEdit(run: WorkflowRunContext, editId: string, appliedEntry: WorkflowJson, invalidation: WorkflowJson, event: string): Promise<void> {
    const pending = this.pending(run).map((item) => item.edit_id === editId ? appliedEntry : item);
    await this.dependencies.lifecycle.updateState(run, { pending_code_edits: pending, applied_code_edits: [...(Array.isArray(run.state.applied_code_edits) ? run.state.applied_code_edits : []), appliedEntry], ...invalidation });
    await this.dependencies.appendEvent({ run_id: run.runId, event, ok: true, edit_id: editId, code_path: appliedEntry.code_path, ...(appliedEntry.change_scope ? { change_scope: appliedEntry.change_scope } : {}) });
  }

  async finalizeCodeEdit(run: WorkflowRunContext, editId: string, finalEntry: WorkflowJson, event: WorkflowJson): Promise<void> {
    const replace = (items: unknown) => (Array.isArray(items) ? items : []).map((item: WorkflowJson) => item.edit_id === editId ? finalEntry : item);
    await this.dependencies.lifecycle.updateState(run, { pending_code_edits: replace(run.state.pending_code_edits), applied_code_edits: replace(run.state.applied_code_edits) });
    await this.dependencies.appendEvent({ run_id: run.runId, ...event, edit_id: editId });
  }

  async requestCodeChanges(run: WorkflowRunContext, editId: string, feedback: string, source: string, event: string): Promise<void> {
    const pending = this.pending(run).map((item) => item.edit_id === editId ? { ...item, status: "changes_requested", feedback: [...(Array.isArray(item.feedback) ? item.feedback : []), { at: new Date().toISOString(), text: feedback, source }], updated_at: new Date().toISOString() } : item);
    await this.dependencies.lifecycle.updateState(run, { pending_code_edits: pending });
    await this.dependencies.appendEvent({ run_id: run.runId, event, ok: true, edit_id: editId });
  }
}

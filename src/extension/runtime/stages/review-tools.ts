import { join } from "node:path";
import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { ExecutionContractSchema } from "../../../core/index.ts";
import type { ReviewWorkflow, WorkflowRunContext } from "../../../workflows/index.ts";
import { renderSeekBrainResult } from "../../tui/compact-tool-results.ts";
import { selectBinaryReview } from "../../tui/review-selectors.ts";
import type { Json, SeekBrainToolDefinition } from "../runtime-types.ts";

export interface ReviewToolDependencies {
  workflow: ReviewWorkflow;
  resolveRun(cwd: string, runId?: string): Promise<WorkflowRunContext>;
  revisePlan(input: { cwd: string; runId: string; feedback?: string; restorePrevious?: boolean; expectedRevision: number; signal?: AbortSignal }): Promise<Json>;
  content(details: Json): any;
}

export function createReviewTools(deps: ReviewToolDependencies): SeekBrainToolDefinition[] {
  return [
    defineTool({
      name: "seekbrain_review_approve",
      label: "Approve Stage",
      description: "Record researcher approval for a SeekBrain workflow stage gate. Use only after the user explicitly approves the stage output.",
      parameters: Type.Object({
        run_id: Type.String(),
        stage: Type.String({ description: "Stage name to approve, e.g. plan." }),
        notes: Type.Optional(Type.String({ description: "Optional short researcher approval note." })),
      }),
      async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
        return deps.content(await deps.workflow.approveStage(ctx.cwd, params.run_id, params.stage, params.notes));
      },
      renderResult: renderSeekBrainResult("seekbrain_review_approve"),
    }),
    defineTool({
      name: "seekbrain_review_feedback",
      label: "Record Researcher Feedback",
      description: "Record researcher revision feedback for a SeekBrain workflow stage gate. Use when the user rejects or modifies a stage output.",
      parameters: Type.Object({
        run_id: Type.String(),
        stage: Type.String({ description: "Stage name receiving feedback, e.g. plan." }),
        feedback: Type.String({ description: "Researcher feedback or requested changes." }),
      }),
      async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
        return deps.content(await deps.workflow.recordStageFeedback(ctx.cwd, params.run_id, params.stage, params.feedback));
      },
      renderResult: renderSeekBrainResult("seekbrain_review_feedback"),
    }),
    defineTool({
      name: "seekbrain_formulation_researcher_review",
      label: "Review Methodological Schema",
      description: "Show the native two-option methodological-schema review selector after the main agent has summarized the current schema in chat.",
      parameters: Type.Object({
        run_id: Type.String(),
        summary: Type.Optional(Type.String({ description: "Short main-agent summary already shown to the user. Used only as compact selector context." })),
      }),
      async execute(_toolCallId, params, signal, _onUpdate, ctx) {
        try {
          while (true) {
            const run = await deps.resolveRun(ctx.cwd, params.run_id);
            const planPath = String(run.state.plan?.path || join(run.runDir, "plan.md"));
            const revision = Number(run.state.plan?.revision || 0);
            const reviewSummary = String(run.state.plan?.review_summary || params.summary || "").slice(0, 360);
          const title = [
            "Review the methodological schema?",
            `Schema: ${planPath}`,
            reviewSummary ? `Summary: ${reviewSummary}` : "",
          ].filter(Boolean).join("\n");
          const selection = await selectBinaryReview(ctx as any, {
            title,
            approveLabel: "Yes, code",
            restorePreviousLabel: run.state.plan?.previous_path ? "Restore previous Plan version" : undefined,
            feedbackTitle: "Feedback for methodological schema",
            feedbackPlaceholder: "Describe what should change before code generation",
          });
          if (selection.decision === "unavailable") {
            return deps.content({ ok: false, run_id: run.runId, plan_path: planPath, needs_text_review: true, message: "Interactive selector is unavailable. Ask the user to approve, reject, or provide feedback in chat." });
          }
          if (selection.decision === "approve") {
            const review = await deps.workflow.approve(run, "plan", "approved via plan review selector", { source: "plan_selector" });
            return deps.content({
              ok: true,
              run_id: run.runId,
              plan_path: planPath,
              decision: "approve",
              review,
              guidance: "Proceed to seekbrain_code_execute.",
            });
          }
          if (selection.decision === "feedback_empty") {
            return deps.content({
              ok: false,
              run_id: run.runId,
              plan_path: planPath,
              decision: "cancel",
              message: "No feedback was entered. Summarize the methodological schema again or call seekbrain_formulation_researcher_review again.",
            });
          }
          if (selection.decision === "feedback") {
            const review = await deps.workflow.feedback(run, "plan", selection.feedback, { source: "plan_selector", action: "revise" });
            const revised = await deps.revisePlan({ cwd: ctx.cwd, runId: run.runId, feedback: selection.feedback, expectedRevision: revision, signal });
            if (!revised.ok) return deps.content({ ...revised, review, decision: "feedback", feedback: selection.feedback });
            continue;
          }
          if (selection.decision === "restore_previous") {
            const revised = await deps.revisePlan({ cwd: ctx.cwd, runId: run.runId, restorePrevious: true, expectedRevision: revision, signal });
            if (!revised.ok) return deps.content({ ...revised, decision: "restore_previous" });
            continue;
          }
          return deps.content({
            ok: false,
            run_id: run.runId,
            plan_path: planPath,
            decision: "cancel",
            message: "Methodological-schema review was cancelled. Call seekbrain_formulation_researcher_review again when ready.",
          });
          }
        } catch (error) {
          return deps.content({
            ok: false,
            run_id: params.run_id,
            error: String(error),
            message: "Methodological-schema review selector failed. Ask the user to approve, reject, or provide feedback in chat.",
          });
        }
      },
      renderResult: renderSeekBrainResult("seekbrain_formulation_researcher_review"),
    }),
    defineTool({
      name: "seekbrain_formulation_update",
      label: "Update Methodological Schema",
      description: "Persist a researcher-feedback revision to the current methodological schema without rerunning the Formulation Agent. Supply execution_contract whenever the edit changes scientifically material requirements or validation checks; otherwise the prior contract is preserved.",
      parameters: Type.Object({
        run_id: Type.String(),
        plan_markdown: Type.String({ description: "Complete updated Markdown methodological schema to write to plan.md." }),
        execution_contract: Type.Optional(ExecutionContractSchema),
        review_summary: Type.Optional(Type.String({ description: "Concise researcher-facing summary of the updated schema." })),
        warnings: Type.Optional(Type.Array(Type.String({ description: "Optional updated warning list. Defaults to the prior warnings if omitted." }))),
        revision_note: Type.Optional(Type.String({ description: "Optional short note describing the user-requested edit." })),
      }),
      async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
        return deps.content(await deps.workflow.updatePlan({
          cwd: ctx.cwd,
          runId: params.run_id,
          planMarkdown: params.plan_markdown,
          executionContract: params.execution_contract,
          reviewSummary: params.review_summary,
          warnings: params.warnings,
          revisionNote: params.revision_note,
        }));
      },
      renderResult: renderSeekBrainResult("seekbrain_formulation_update"),
    }),
  ];
}

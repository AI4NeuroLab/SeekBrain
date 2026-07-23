import { join } from "node:path";
import type { StageAgentResult } from "./research-skill-workflow.ts";
import type { RunLifecycleWorkflow, WorkflowJson, WorkflowRunContext } from "./run-lifecycle.ts";

export interface PlanWorkflowDependencies {
  lifecycle: RunLifecycleWorkflow;
  runAgent(input: {
    runDir: string;
    prompt: string;
    agentConfig: WorkflowJson;
    finalizeSchema: unknown;
    signal?: AbortSignal;
  }): Promise<StageAgentResult>;
  writeText(path: string, value: string): Promise<void>;
  appendEvent(event: WorkflowJson): Promise<void>;
}

export interface PlanWorkflowInput {
  cwd: string;
  runId: string;
  question?: string;
  dataInfo?: string;
  extraPathInfo?: string;
  targetedSkill?: string;
  deepResearchContext?: string;
  additionalContext?: string;
  rolePrompt: string;
  agentConfig: WorkflowJson;
  finalizeSchema: unknown;
  humanReviewRequired: boolean;
  signal?: AbortSignal;
}

function resolveQuestion(run: WorkflowRunContext, requested?: string): string {
  const value = String(requested || run.state.question || "").trim();
  if (!value) {
    throw new Error("question is required. Pass it to the tool, or persist it first via neuro_start_run/neuro_resume_run.");
  }
  return value;
}

function effectiveMetadata(run: WorkflowRunContext, requestedData?: string, requestedPath?: string) {
  const locked = run.state.metadata_locked === true;
  return {
    data_info: locked ? String(run.state.data_info || "") : String(requestedData || run.state.data_info || ""),
    extra_path_info: locked ? String(run.state.extra_path_info || "") : String(requestedPath || run.state.extra_path_info || ""),
  };
}

function reviewEntry(run: WorkflowRunContext): WorkflowJson {
  const entry = run.state.human_reviews?.plan || {};
  return entry && typeof entry === "object" ? entry : {};
}

function feedbackText(run: WorkflowRunContext): string {
  const feedback = reviewEntry(run).feedback;
  if (!Array.isArray(feedback) || !feedback.length) return "";
  return feedback
    .map((entry: unknown, index: number) => {
      const text = typeof entry === "string" ? entry : String((entry as WorkflowJson)?.text || "");
      return text.trim() ? `${index + 1}. ${text.trim()}` : "";
    })
    .filter(Boolean)
    .join("\n");
}

function finalizationPrompt(rolePrompt: string, body: string): string {
  return [
    rolePrompt.trim(),
    "",
    "You are the isolated SeekBrain planner subagent.",
    "Return only by calling the finalize tool. Do not expose scratch reasoning.",
    "Required final tool: finalize_plan",
    "",
    body,
  ].join("\n");
}

function additionalContextBlock(value?: string): string {
  const text = String(value || "").trim();
  return text ? `Additional context from the main agent:\n${text}` : "";
}

export class PlanWorkflow {
  constructor(readonly dependencies: PlanWorkflowDependencies) {}

  async execute(input: PlanWorkflowInput): Promise<WorkflowJson> {
    const run = await this.dependencies.lifecycle.resolveRun(input.cwd, input.runId);
    const metadata = effectiveMetadata(run, input.dataInfo, input.extraPathInfo);
    const humanFeedback = feedbackText(run);
    const prompt = finalizationPrompt(input.rolePrompt, [
      `Question:\n${resolveQuestion(run, input.question)}`,
      `Data info:\n${metadata.data_info}`,
      `Extra path info:\n${metadata.extra_path_info}`,
      run.state.inherited_context ? `Prior-round reusable context (read-only):\n${JSON.stringify(run.state.inherited_context, null, 2)}` : "",
      `Targeted skill:\n${input.targetedSkill || run.state.targeted_skill || ""}`,
      `Deep research context:\n${input.deepResearchContext || run.state.deep_research_context || ""}`,
      humanFeedback ? `Human review feedback for the plan:\n${humanFeedback}` : "",
      additionalContextBlock(input.additionalContext),
      "Finalize with: { plan_markdown, review_summary, summary, confidence, warnings }. review_summary is the concise text shown to the human approval UI; do not make it a copy of the full plan.",
    ].join("\n\n"));
    const agent = await this.dependencies.runAgent({
      runDir: run.runDir,
      prompt,
      agentConfig: input.agentConfig,
      finalizeSchema: input.finalizeSchema,
      signal: input.signal,
    });
    const planPath = join(run.runDir, "plan.md");
    if (agent.ok && agent.result) {
      await this.dependencies.writeText(planPath, String(agent.result.plan_markdown));
      await this.dependencies.lifecycle.updateState(run, {
        plan: agent.result,
        data_info: metadata.data_info,
        extra_path_info: metadata.extra_path_info,
      });
    }
    await this.dependencies.appendEvent({ run_id: run.runId, event: "neuro_plan", ok: agent.ok });

    const feedbackAfter = feedbackText(run);
    const approvedAfter = reviewEntry(run).status === "approved";
    const needsUserReview = Boolean(agent.ok && input.humanReviewRequired && !approvedAfter);
    return {
      run_id: run.runId,
      ok: agent.ok,
      error: agent.error,
      plan_path: agent.ok ? planPath : undefined,
      plan_markdown: agent.ok ? agent.result?.plan_markdown : undefined,
      output_path: agent.output_path,
      result: agent.result ? {
        review_summary: agent.result.review_summary,
        summary: agent.result.summary,
        confidence: agent.result.confidence,
        warnings: agent.result.warnings,
      } : undefined,
      human_review: {
        required: input.humanReviewRequired,
        approved: approvedAfter,
        feedback: feedbackAfter,
        needs_user_review: needsUserReview,
        review_owner: "main_agent",
      },
      guidance: needsUserReview
        ? "Summarize plan_markdown yourself in chat, show plan_path, then call neuro_review_plan to present the native two-option selector. Do not replace the selector with a plain chat approval request. If feedback is returned, revise locally with neuro_update_plan when appropriate; rerun neuro_plan only for broad redesigns. Do not call neuro_code until plan approval is recorded."
        : undefined,
      debug: { subagent_dir: agent.subagent_dir, snapshot_dir: agent.snapshot_dir },
    };
  }
}

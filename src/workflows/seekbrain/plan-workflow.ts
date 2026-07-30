import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
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
  rolePrompt: string;
  agentConfig: WorkflowJson;
  finalizeSchema: unknown;
  humanReviewRequired: boolean;
  signal?: AbortSignal;
}

export interface RevisePlanWorkflowInput {
  cwd: string;
  runId: string;
  feedback?: string;
  restorePrevious?: boolean;
  rolePrompt: string;
  agentConfig: WorkflowJson;
  finalizeSchema: unknown;
  expectedRevision?: number;
  signal?: AbortSignal;
}

function resolveQuestion(run: WorkflowRunContext): string {
  const value = String(run.state.question || "").trim();
  if (!value) {
    throw new Error("question is required in state.json. Persist it via seekbrain_run_start/seekbrain_run_resume.");
  }
  return value;
}

function terminalTaskContract(run: WorkflowRunContext): string {
  const inherited = run.state.inherited_context;
  if (!inherited || typeof inherited !== "object") return "";
  const subquestion = inherited.subquestion;
  const task = inherited.task;
  if (!subquestion || typeof subquestion !== "object" || !task || typeof task !== "object") return "";
  const contract = {
    research_goal: String(inherited.research_goal || ""),
    subquestion: {
      id: String(subquestion.id || ""),
      question: String(subquestion.question || ""),
      hypothesis: String(subquestion.hypothesis || ""),
      role_in_overall_conclusion: String(subquestion.role_in_overall_conclusion || ""),
    },
    task: {
      id: String(task.id || ""),
      title: String(task.title || ""),
      analysis_question: String(task.analysis_question || ""),
      biological_hypothesis: String(task.biological_hypothesis || ""),
      analysis_strategy: String(task.analysis_strategy || ""),
      required_data: task.required_data ?? [],
      expected_evidence: String(task.expected_evidence || ""),
      supports_conclusion_if: String(task.supports_conclusion_if || ""),
      contradicts_conclusion_if: String(task.contradicts_conclusion_if || ""),
    },
  };
  return JSON.stringify(contract, null, 2);
}

async function canonicalMetadata(input: PlanWorkflowInput, run: WorkflowRunContext): Promise<string> {
  const storedPath = String(run.state.metadata_json_path || "").trim();
  if (storedPath) {
    const path = resolve(input.cwd, storedPath);
    try {
      const raw = await readFile(path, "utf8");
      try { return JSON.stringify(JSON.parse(raw)); } catch { return raw; }
    }
    catch (error) { throw new Error(`Unable to read canonical metadata '${path}': ${error instanceof Error ? error.message : String(error)}`); }
  }
  return String(run.state.data_info || "").trim() || "{}";
}

async function selectedRecipe(run: WorkflowRunContext): Promise<string> {
  const methodContract = String(run.state.targeted_skill_result?.method_contract || "").trim();
  if (methodContract) return methodContract;
  const path = String(run.state.targeted_skill_path || join(run.runDir, "targeted_skill.md"));
  if (existsSync(path)) return readFile(path, "utf8");
  return String(run.state.targeted_skill || "").trim();
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
    "You are the isolated SeekBrain Formulation Agent.",
    "Return only by calling the finalize tool. Do not expose scratch reasoning.",
    "Required final tool: finalize_plan",
    "",
    body,
  ].join("\n");
}

export class PlanWorkflow {
  constructor(readonly dependencies: PlanWorkflowDependencies) {}

  async execute(input: PlanWorkflowInput): Promise<WorkflowJson> {
    const run = await this.dependencies.lifecycle.resolveRun(input.cwd, input.runId);
    const researchQuestion = resolveQuestion(run);
    const metadata = await canonicalMetadata(input, run);
    const recipe = await selectedRecipe(run);
    const humanFeedback = feedbackText(run);
    const taskContract = terminalTaskContract(run);
    const prompt = finalizationPrompt(input.rolePrompt, [
      `Question:\n${researchQuestion}`,
      taskContract ? `Current terminal task contract:\n${taskContract}` : "",
      `Canonical metadata:\n${metadata}`,
      recipe ? `Selected recipe (already accepted; do not reassess relevance):\n${recipe}` : "Selected recipe: null",
      `Deliverables:\n${JSON.stringify(run.state.deliverables || [], null, 2)}`,
      humanFeedback ? `Researcher feedback for the methodological schema:\n${humanFeedback}` : "",
      "Finalize with: { plan_markdown, review_summary, warnings }. review_summary is the concise text shown to the researcher approval UI; do not copy the full plan.",
    ].filter(Boolean).join("\n\n"));
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
        plan: {
          path: planPath,
          review_summary: String(agent.result.review_summary || ""),
          warnings: Array.isArray(agent.result.warnings) ? agent.result.warnings : [],
          revision: Number(run.state.plan?.revision || 0) + 1,
        },
      });
    }
    await this.dependencies.appendEvent({ run_id: run.runId, event: "seekbrain_formulation_generate", ok: agent.ok });

    const feedbackAfter = feedbackText(run);
    const approvedAfter = reviewEntry(run).status === "approved";
    const needsUserReview = Boolean(agent.ok && input.humanReviewRequired && !approvedAfter);
    return {
      run_id: run.runId,
      ok: agent.ok,
      error: agent.error,
      plan_path: agent.ok ? planPath : undefined,
      revision: agent.ok ? Number(run.state.plan?.revision || 0) + 1 : Number(run.state.plan?.revision || 0),
      output_path: agent.output_path,
      result: agent.result ? {
        review_summary: agent.result.review_summary,
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
        ? "Show review_summary and plan_path, then call seekbrain_formulation_researcher_review. If feedback is returned, revise locally with seekbrain_formulation_update when appropriate; rerun generation only for broad redesigns. Do not call seekbrain_code_execute until approval is recorded."
        : undefined,
      debug: { subagent_dir: agent.subagent_dir, snapshot_dir: agent.snapshot_dir },
    };
  }

  async revise(input: RevisePlanWorkflowInput): Promise<WorkflowJson> {
    const run = await this.dependencies.lifecycle.resolveRun(input.cwd, input.runId);
    const planPath = String(run.state.plan?.path || join(run.runDir, "plan.md"));
    const revision = Number(run.state.plan?.revision || 0);
    if (input.expectedRevision !== undefined && revision !== input.expectedRevision) {
      return { ok: false, run_id: run.runId, stale_revision: true, expected_revision: input.expectedRevision, current_revision: revision, plan_path: planPath };
    }
    const feedback = String(input.feedback || "").trim();
    if (!feedback && input.restorePrevious !== true) return { ok: false, run_id: run.runId, error: "Plan revision feedback is required." };
    let currentPlan: string;
    try { currentPlan = (await readFile(planPath, "utf8")).trim(); }
    catch (error) { return { ok: false, run_id: run.runId, error: `Unable to read current plan '${planPath}': ${String(error)}` }; }
    const previousPath = join(run.runDir, "plan.previous.json");
    const currentSnapshot = {
      plan_markdown: currentPlan,
      review_summary: String(run.state.plan?.review_summary || ""),
      warnings: Array.isArray(run.state.plan?.warnings) ? run.state.plan.warnings : [],
      revision,
    };
    if (input.restorePrevious === true) {
      let previous: WorkflowJson;
      try { previous = JSON.parse(await readFile(previousPath, "utf8")); }
      catch { return { ok: false, run_id: run.runId, error: "No previous Plan version is available to restore.", plan_path: planPath }; }
      const previousMarkdown = String(previous.plan_markdown || "").trim();
      if (!previousMarkdown) return { ok: false, run_id: run.runId, error: "The previous Plan snapshot is invalid.", plan_path: planPath };
      const nextRevision = revision + 1;
      await this.dependencies.writeText(previousPath, JSON.stringify(currentSnapshot, null, 2));
      await this.dependencies.writeText(planPath, previousMarkdown);
      await this.dependencies.lifecycle.updateState(run, {
        plan: {
          path: planPath,
          review_summary: String(previous.review_summary || "Restored the previous methodological Plan."),
          warnings: Array.isArray(previous.warnings) ? previous.warnings : [],
          revision: nextRevision,
          previous_path: previousPath,
          restored_from_revision: Number(previous.revision || 0),
        },
      });
      await this.dependencies.appendEvent({ run_id: run.runId, event: "seekbrain_formulation_rollback", ok: true, base_revision: revision, revision: nextRevision });
      return {
        ok: true,
        run_id: run.runId,
        plan_path: planPath,
        previous_plan_path: previousPath,
        revision: nextRevision,
        rolled_back: true,
        result: { review_summary: String(previous.review_summary || "Restored the previous methodological Plan."), warnings: previous.warnings || [] },
        needs_user_review: true,
      };
    }
    const taskContract = terminalTaskContract(run);
    const prompt = finalizationPrompt(input.rolePrompt, [
      `Question:\n${resolveQuestion(run)}`,
      taskContract ? `Current terminal task contract:\n${taskContract}` : "",
      `Current authoritative methodological plan:\n${currentPlan}`,
      `Latest researcher feedback:\n${feedback}`,
      `Deliverables:\n${JSON.stringify(run.state.deliverables || [], null, 2)}`,
      "The current plan already contains every previously accepted change. Apply only the latest feedback, preserve all unrelated details, and do not add analyses the researcher did not request.",
      "Finalize with: { plan_markdown, review_summary, warnings }. Do not reassess Recipe relevance or redesign Statistics/Visualisation beyond the feedback.",
    ].filter(Boolean).join("\n\n"));
    const agent = await this.dependencies.runAgent({
      runDir: run.runDir,
      prompt,
      agentConfig: input.agentConfig,
      finalizeSchema: input.finalizeSchema,
      signal: input.signal,
    });
    if (!agent.ok || !agent.result) return { ok: false, run_id: run.runId, error: agent.error || "Plan revision did not complete." };
    const nextRevision = revision + 1;
    await this.dependencies.writeText(previousPath, JSON.stringify(currentSnapshot, null, 2));
    await this.dependencies.writeText(planPath, String(agent.result.plan_markdown));
    await this.dependencies.lifecycle.updateState(run, {
      plan: {
        path: planPath,
        review_summary: String(agent.result.review_summary || ""),
          warnings: Array.isArray(agent.result.warnings) ? agent.result.warnings : (run.state.plan?.warnings || []),
          revision: nextRevision,
          previous_path: previousPath,
      },
    });
    await this.dependencies.appendEvent({ run_id: run.runId, event: "seekbrain_formulation_revise", ok: true, base_revision: revision, revision: nextRevision });
    return {
      ok: true,
      run_id: run.runId,
      plan_path: planPath,
      previous_plan_path: previousPath,
      revision: nextRevision,
      result: { review_summary: String(agent.result.review_summary || ""), warnings: agent.result.warnings || [] },
      needs_user_review: true,
    };
  }
}

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import type { StageAgentResult } from "./research-skill-workflow.ts";
import type { RunLifecycleWorkflow, WorkflowJson } from "./run-lifecycle.ts";

export interface ResearchPlanningWorkflowDependencies {
  lifecycle: RunLifecycleWorkflow;
  runAgent(input: {
    runDir: string;
    prompt: string;
    finalizeTool: string;
    agentConfig: WorkflowJson;
    finalizeSchema: unknown;
    signal?: AbortSignal;
  }): Promise<StageAgentResult>;
  writeJson(path: string, value: WorkflowJson): Promise<void>;
  appendEvent(event: WorkflowJson): Promise<void>;
}

export interface AssessResearchInput {
  cwd: string;
  runId: string;
  literatureProvider?: string;
  background?: string;
  scientificGoal?: string;
  rolePrompt: string;
  agentConfig: WorkflowJson;
  finalizeSchema: unknown;
  signal?: AbortSignal;
}

export interface RecordResearchPlanningAssessmentInput {
  cwd: string;
  runId: string;
  assessment: WorkflowJson;
}

export interface PrepareSubquestionsInput {
  cwd: string;
  runId: string;
  rolePrompt: string;
  agentConfig: WorkflowJson;
  finalizeSchema: unknown;
  subquestionCount?: number;
  signal?: AbortSignal;
}

export interface ReviewResearchPlanInput {
  cwd: string;
  runId: string;
  reviewerRolePrompt: string;
  reviewerAgentConfig: WorkflowJson;
  reviewerFinalizeSchema: unknown;
  orchestratorRolePrompt: string;
  orchestratorAgentConfig: WorkflowJson;
  refinementFinalizeSchema: unknown;
  explicitUserRequest?: boolean;
  signal?: AbortSignal;
}

export interface RecordResearchPlanDecisionInput {
  cwd: string;
  runId: string;
  decision: "approve" | "revise" | "cancel";
  feedback?: string;
  source?: string;
  orchestratorRolePrompt: string;
  orchestratorAgentConfig: WorkflowJson;
  revisionFinalizeSchema: unknown;
  signal?: AbortSignal;
}

export interface MaterializeResearchTasksInput {
  cwd: string;
  runId: string;
}

function planningState(run: WorkflowJson): WorkflowJson {
  const value = run.state.research_planning;
  return value && typeof value === "object" ? value : {};
}

export function verifiedExplicitResearchPlanningRequest(question: unknown, evidenceQuote: unknown): string | undefined {
  const source = String(question || "");
  const quote = String(evidenceQuote || "").trim();
  if (!quote || !source.includes(quote) || !/research\s+planning/i.test(quote)) return undefined;
  return quote;
}

function surveyBackground(run: WorkflowJson): string {
  if (planningState(run).survey?.status === "disabled") return "";
  return String(
    planningState(run).survey?.literature_grounding_context
      || run.state.literature_grounding_context
      || "",
  ).trim();
}

function surveyPromptSection(run: WorkflowJson): string {
  const background = surveyBackground(run);
  return background
    ? `Global literature-grounded background from the parent Research Survey:\n${background}`
    : "Global literature-grounded background from the parent Research Survey:\nNot available. Do not infer that literature retrieval found supporting evidence.";
}

function prompt(rolePrompt: string, finalizeTool: string, body: string): string {
  return [
    rolePrompt.trim(),
    "",
    "Return only by calling the finalize tool. Do not expose scratch reasoning.",
    `Required final tool: ${finalizeTool}`,
    "",
    body,
  ].join("\n");
}

function requiredText(value: unknown, field: string): string {
  const text = String(value || "").trim();
  if (!text) throw new Error(`Research plan field '${field}' must not be empty.`);
  return text;
}

function textList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item || "").trim()).filter(Boolean) : [];
}

function normalizeResearchTree(value: WorkflowJson): WorkflowJson {
  const rawSubquestions = Array.isArray(value.subquestions) ? value.subquestions : [];
  if (rawSubquestions.length < 2 || rawSubquestions.length > 3) {
    throw new Error(`Research plan must contain 2 or 3 subquestions; received ${rawSubquestions.length}.`);
  }
  const subquestions = rawSubquestions.map((raw, subquestionIndex) => {
    const item = raw && typeof raw === "object" ? raw as WorkflowJson : {};
    const rawTasks = Array.isArray(item.tasks) ? item.tasks : [];
    if (rawTasks.length < 1 || rawTasks.length > 2) {
      throw new Error(`Research plan subquestion ${subquestionIndex + 1} must contain 1 or 2 tasks; received ${rawTasks.length}.`);
    }
    const id = `SQ${subquestionIndex + 1}`;
    return {
      id,
      question: requiredText(item.question, `${id}.question`),
      hypothesis: requiredText(item.hypothesis, `${id}.hypothesis`),
      role_in_overall_conclusion: requiredText(item.role_in_overall_conclusion, `${id}.role_in_overall_conclusion`),
      dataset_grounding: textList(item.dataset_grounding),
      tasks: rawTasks.map((rawTask, taskIndex) => {
        const task = rawTask && typeof rawTask === "object" ? rawTask as WorkflowJson : {};
        const taskId = `${id}-T${taskIndex + 1}`;
        return {
          id: taskId,
          title: requiredText(task.title, `${taskId}.title`),
          analysis_question: requiredText(task.analysis_question, `${taskId}.analysis_question`),
          biological_hypothesis: requiredText(task.biological_hypothesis, `${taskId}.biological_hypothesis`),
          analysis_strategy: requiredText(task.analysis_strategy, `${taskId}.analysis_strategy`),
          required_data: textList(task.required_data),
          expected_evidence: requiredText(task.expected_evidence, `${taskId}.expected_evidence`),
          supports_conclusion_if: requiredText(task.supports_conclusion_if, `${taskId}.supports_conclusion_if`),
          contradicts_conclusion_if: requiredText(task.contradicts_conclusion_if, `${taskId}.contradicts_conclusion_if`),
        };
      }),
    };
  });
  for (const subquestion of subquestions) {
    if (subquestion.dataset_grounding.length === 0) {
      throw new Error(`Research plan field '${subquestion.id}.dataset_grounding' must contain at least one metadata-grounded item.`);
    }
    for (const task of subquestion.tasks) {
      if (task.required_data.length === 0) {
        throw new Error(`Research plan field '${task.id}.required_data' must contain at least one item.`);
      }
    }
  }
  return {
    research_goal: requiredText(value.research_goal, "research_goal"),
    planning_rationale: requiredText(value.planning_rationale, "planning_rationale"),
    subquestions,
    synthesis_strategy: requiredText(value.synthesis_strategy, "synthesis_strategy"),
  };
}

function normalizeReviewerCritique(value: WorkflowJson): WorkflowJson {
  const verdict = value.verdict === "accept" || value.verdict === "blocked" ? value.verdict : "revise";
  const items = (key: string) => Array.isArray(value[key]) ? value[key] : [];
  return {
    verdict,
    summary: requiredText(value.summary, "review.summary"),
    blocking_issues: items("blocking_issues"),
    non_blocking_suggestions: items("non_blocking_suggestions"),
    missing_evidence: items("missing_evidence"),
    redundancies: items("redundancies"),
    unsupported_tasks: items("unsupported_tasks"),
    blocked_reason: String(value.blocked_reason || "").trim(),
    recommended_action: String(value.recommended_action || "").trim(),
  };
}

export class ResearchPlanningWorkflow {
  constructor(readonly dependencies: ResearchPlanningWorkflowDependencies) {}

  async recordAssessment(input: RecordResearchPlanningAssessmentInput): Promise<WorkflowJson> {
    const run = await this.dependencies.lifecycle.resolveRun(input.cwd, input.runId);
    const value = input.assessment || {};
    const route = value.route === "research_planning"
      ? "research_planning"
      : value.route === "needs_clarification" ? "needs_clarification" : "standard";
    const concise = (item: unknown, limit = 600) => String(item || "").replace(/\s+/g, " ").trim().slice(0, limit);
    const literatureQueries = Array.isArray(value.literature_queries)
      ? [...new Set(value.literature_queries.map((item: unknown) => concise(item, 120)).filter(Boolean))].slice(0, 3)
      : [];
    const assessment = {
      route,
      reason: concise(value.reason),
      dataset_summary: concise(value.dataset_summary),
      question_requirements: concise(value.question_requirements),
      recommended_action: concise(value.recommended_action),
      evidence_dimensions: textList(value.evidence_dimensions),
      inferred_background: concise(value.inferred_background),
      inferred_scientific_goal: concise(value.inferred_scientific_goal) || concise(run.state.question),
      ...(literatureQueries.length ? { literature_queries: literatureQueries } : {}),
    };
    const state = {
      assessment,
      status: route === "research_planning" ? "pending_review" : route === "needs_clarification" ? "blocked_input" : "not_required",
      assessed_at: new Date().toISOString(),
      assessment_source: "orchestrator",
    };
    const assessmentPath = join(run.runDir, "research_planning_assessment.json");
    await this.dependencies.writeJson(assessmentPath, assessment);
    await this.dependencies.lifecycle.updateState(run, {
      research_planning: state,
      ...(literatureQueries.length ? { literature_queries: literatureQueries } : {}),
    });
    await this.dependencies.appendEvent({ run_id: run.runId, event: "seekbrain_planning_assess", ok: true, route, source: "orchestrator" });
    return {
      run_id: run.runId,
      ok: true,
      ...assessment,
      assessment_path: assessmentPath,
      assessment_source: "orchestrator",
      needs_user_review: route === "research_planning",
      needs_user_clarification: route === "needs_clarification",
      message: route === "needs_clarification" ? assessment.reason : undefined,
      next_tool: route === "research_planning" ? "seekbrain_planning_decision_review" : route === "standard" ? "seekbrain_recipe_retrieve" : undefined,
    };
  }

  async assess(input: AssessResearchInput): Promise<WorkflowJson> {
    const run = await this.dependencies.lifecycle.resolveRun(input.cwd, input.runId);
    const question = String(run.state.question || "").trim();
    if (!question) throw new Error("A persisted research question is required before planning assessment.");
    const metadata = String(run.state.data_info || "").slice(0, 12_000);
    const externalLiterature = input.literatureProvider === "semantic_scholar" || input.literatureProvider === "pubmed";
    const literatureInstruction = externalLiterature
      ? [
          `Literature provider: ${input.literatureProvider}.`,
          "Generate 2 or 3 concise English literature search queries in literature_queries.",
          "Each query must contain only 2 to 6 scientific search terms or short phrases. Do not copy the full question or include plotting, output-format, file-handling, or workflow instructions.",
        ].join("\n")
      : "";
    const finalizeFields = externalLiterature
      ? "{ route, reason, dataset_summary, question_requirements, recommended_action, evidence_dimensions, inferred_background, inferred_scientific_goal, literature_queries }"
      : "{ route, reason, dataset_summary, question_requirements, recommended_action, evidence_dimensions, inferred_background, inferred_scientific_goal }";
    const agent = await this.dependencies.runAgent({
      runDir: run.runDir,
      finalizeTool: "finalize_research_route",
      prompt: prompt(input.rolePrompt, "finalize_research_route", [
        `Question:\n${question}`,
        `Background supplied by the user:\n${String(input.background || "")}`,
        `Scientific goal supplied by the user:\n${String(input.scientificGoal || "")}`,
        `Dataset metadata excerpt:\n${metadata}`,
        literatureInstruction,
        `Finalize with: ${finalizeFields}. route must be standard, research_planning, or needs_clarification.`,
      ].join("\n\n")),
      agentConfig: input.agentConfig,
      finalizeSchema: input.finalizeSchema,
      signal: input.signal,
    });
    if (!agent.ok || !agent.result) {
      const assessment = {
        route: "standard",
        reason: "Research Planning assessment was unavailable, so SeekBrain is continuing with the direct analysis workflow.",
        evidence_dimensions: [],
        inferred_background: "",
        inferred_scientific_goal: "",
        warning: agent.error || "Research planning assessment did not complete.",
      };
      const assessmentPath = join(run.runDir, "research_planning_assessment.json");
      await this.dependencies.writeJson(assessmentPath, assessment);
      await this.dependencies.lifecycle.updateState(run, { research_planning: { assessment, status: "not_required", assessed_at: new Date().toISOString() } });
      await this.dependencies.appendEvent({ run_id: run.runId, event: "seekbrain_planning_assess", ok: true, route: "standard", fallback: true });
      return { run_id: run.runId, ok: true, ...assessment, assessment_path: assessmentPath, needs_user_review: false, next_tool: "seekbrain_recipe_retrieve" };
    }
    const route = agent.result.route === "research_planning"
      ? "research_planning"
      : agent.result.route === "needs_clarification" ? "needs_clarification" : "standard";
    const concise = (value: unknown, limit = 600) => String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
    const reason = concise(agent.result.reason);
    const literatureQueries = externalLiterature && Array.isArray(agent.result.literature_queries)
      ? [...new Set(agent.result.literature_queries.map((value: unknown) => concise(value, 120)).filter(Boolean))].slice(0, 3)
      : [];
    const { literature_queries: _untrustedLiteratureQueries, ...normalizedAgentResult } = agent.result;
    const assessment = {
      ...normalizedAgentResult,
      route,
      reason,
      dataset_summary: concise(agent.result.dataset_summary),
      question_requirements: concise(agent.result.question_requirements),
      recommended_action: concise(agent.result.recommended_action),
      ...(externalLiterature ? { literature_queries: literatureQueries } : {}),
    };
    const state = {
      assessment,
      status: route === "research_planning" ? "pending_review" : route === "needs_clarification" ? "blocked_input" : "not_required",
      assessed_at: new Date().toISOString(),
    };
    const assessmentPath = join(run.runDir, "research_planning_assessment.json");
    await this.dependencies.writeJson(assessmentPath, assessment);
    await this.dependencies.lifecycle.updateState(run, {
      research_planning: state,
      ...(externalLiterature ? { literature_queries: literatureQueries } : {}),
    });
    await this.dependencies.appendEvent({ run_id: run.runId, event: "seekbrain_planning_assess", ok: true, route });
    return {
      run_id: run.runId,
      ok: true,
      ...assessment,
      assessment_path: assessmentPath,
      needs_user_review: route === "research_planning",
      needs_user_clarification: route === "needs_clarification",
      message: route === "needs_clarification" ? reason : undefined,
      next_tool: route === "research_planning" ? "seekbrain_planning_decision_review" : route === "standard" ? "seekbrain_recipe_retrieve" : undefined,
    };
  }

  async recordDecision(
    cwd: string,
    runId: string,
    decision: "yes" | "no",
    source = "planning_selector",
    consentEvidence?: string,
  ): Promise<WorkflowJson> {
    const run = await this.dependencies.lifecycle.resolveRun(cwd, runId);
    const current = planningState(run);
    if (current.assessment?.route !== "research_planning") {
      return { ok: false, run_id: run.runId, error: "This run was not routed to Research Planning." };
    }
    const accepted = decision === "yes";
    const next = {
      ...current,
      status: accepted ? "approved" : "declined",
      review: {
        decision,
        source,
        ...(consentEvidence ? { consent_evidence: consentEvidence } : {}),
        reviewed_at: new Date().toISOString(),
      },
      active_route: accepted ? "research_planning" : "standard",
    };
    await this.dependencies.lifecycle.updateState(run, { research_planning: next });
    await this.dependencies.appendEvent({
      run_id: run.runId,
      event: "seekbrain_planning_decision_review",
      ok: true,
      decision,
      source,
      ...(consentEvidence ? { consent_evidence: consentEvidence } : {}),
    });
    return {
      ok: true,
      run_id: run.runId,
      decision,
      decision_source: source,
      ...(consentEvidence ? { consent_evidence: consentEvidence } : {}),
      route: next.active_route,
      next_tool: accepted ? "seekbrain_planning_generate" : "seekbrain_recipe_retrieve",
      message: accepted
        ? "Research Planning approved. Generate the hierarchical research plan."
        : "Research Planning declined. Continue the direct analysis workflow.",
    };
  }

  async prepareSubquestions(input: PrepareSubquestionsInput): Promise<WorkflowJson> {
    const run = await this.dependencies.lifecycle.resolveRun(input.cwd, input.runId);
    const current = planningState(run);
    const legacySubquestionsReady = current.status === "subquestions_ready" && Boolean(current.subquestions);
    if (current.status !== "approved" && !legacySubquestionsReady) {
      return {
        ok: false,
        run_id: run.runId,
        blocked_by_human_review: true,
        required_stage: "research_planning",
        error: "Hierarchical research plan generation requires explicit user approval of Research Planning.",
      };
    }
    const assessment = current.assessment || {};
    const requestedCount = input.subquestionCount === undefined
      ? "Choose the smallest sufficient number: generate 2 or 3 subquestions."
      : `Generate exactly ${Math.max(2, Math.min(3, Math.trunc(input.subquestionCount)))} subquestions.`;
    const agent = await this.dependencies.runAgent({
      runDir: run.runDir,
      finalizeTool: "finalize_research_plan_draft",
      prompt: prompt(input.rolePrompt, "finalize_research_plan_draft", [
        `Main question:\n${String(run.state.question || "")}`,
        `Scientific goal:\n${String(assessment.inferred_scientific_goal || "")}`,
        `Background:\n${String(assessment.inferred_background || "")}`,
        surveyPromptSection(run),
        `Evidence dimensions identified by routing:\n${JSON.stringify(assessment.evidence_dimensions || [])}`,
        `Dataset metadata:\n${String(run.state.data_info || "")}`,
        requestedCount,
        "Finalize the complete hierarchical research plan with: { research_goal, planning_rationale, subquestions, synthesis_strategy }.",
        "Each subquestion must contain { id, question, hypothesis, role_in_overall_conclusion, dataset_grounding, tasks }.",
        "Each task must contain { id, title, analysis_question, biological_hypothesis, analysis_strategy, required_data, expected_evidence, supports_conclusion_if, contradicts_conclusion_if }.",
      ].join("\n\n")),
      agentConfig: input.agentConfig,
      finalizeSchema: input.finalizeSchema,
      signal: input.signal,
    });
    if (!agent.ok || !agent.result) {
      await this.dependencies.appendEvent({ run_id: run.runId, event: "seekbrain_planning_generate", ok: false });
      return { ok: false, run_id: run.runId, error: agent.error || "Research-tree preparation did not complete." };
    }
    let researchTree: WorkflowJson;
    try {
      researchTree = normalizeResearchTree(agent.result);
    } catch (error) {
      await this.dependencies.appendEvent({ run_id: run.runId, event: "seekbrain_planning_generate", ok: false, reason: "invalid_research_tree" });
      return { ok: false, run_id: run.runId, error: error instanceof Error ? error.message : String(error) };
    }
    const path = join(run.runDir, "research_plan", "draft_plan.json");
    await this.dependencies.writeJson(path, researchTree);
    const taskCount = researchTree.subquestions.reduce((total: number, subquestion: WorkflowJson) => total + subquestion.tasks.length, 0);
    await this.dependencies.lifecycle.updateState(run, {
      research_planning: {
        ...current,
        status: "draft_ready",
        draft_plan: researchTree,
        draft_plan_path: path,
        subquestion_count: researchTree.subquestions.length,
        task_count: taskCount,
        migrated_from_legacy_subquestions: legacySubquestionsReady,
      },
    });
    await this.dependencies.appendEvent({
      run_id: run.runId,
      event: "seekbrain_planning_generate",
      ok: true,
      subquestion_count: researchTree.subquestions.length,
      task_count: taskCount,
      migrated_from_legacy_subquestions: legacySubquestionsReady,
    });
    return {
      ok: true,
      run_id: run.runId,
      research_plan: researchTree,
      subquestions: researchTree.subquestions,
      subquestion_count: researchTree.subquestions.length,
      task_count: taskCount,
      migrated_from_legacy_subquestions: legacySubquestionsReady,
      draft_plan_path: path,
      needs_reviewer_review: true,
      next_tool: "seekbrain_planning_peer_review",
    };
  }

  async reviewResearchPlan(input: ReviewResearchPlanInput): Promise<WorkflowJson> {
    const run = await this.dependencies.lifecycle.resolveRun(input.cwd, input.runId);
    const current = planningState(run);
    const isInitialReview = current.status === "draft_ready" && Boolean(current.draft_plan);
    const isExplicitRereview = input.explicitUserRequest === true
      && current.status === "ready_for_user_review"
      && Boolean(current.final_plan);
    if (!isInitialReview && !isExplicitRereview) {
      return {
        ok: false,
        run_id: run.runId,
        error: current.status === "ready_for_user_review"
          ? "The hierarchical research plan was already reviewed. A second Reviewer Agent call requires an explicit user request."
          : "Hierarchical research plan review requires a persisted draft from seekbrain_planning_generate.",
      };
    }
    const candidatePlan = isInitialReview ? current.draft_plan as WorkflowJson : current.final_plan as WorkflowJson;
    const reviewNumber = Number(current.reviewer_call_count || 0) + 1;
    const assessment = current.assessment || {};
    const reviewAgent = await this.dependencies.runAgent({
      runDir: run.runDir,
      finalizeTool: "finalize_research_plan_review",
      prompt: prompt(input.reviewerRolePrompt, "finalize_research_plan_review", [
        `Main question:\n${String(run.state.question || "")}`,
        `Scientific goal:\n${String(assessment.inferred_scientific_goal || candidatePlan.research_goal || "")}`,
        `Scientific background:\n${String(assessment.inferred_background || "")}`,
        surveyPromptSection(run),
        `Locked dataset metadata:\n${String(run.state.data_info || "")}`,
        `Hierarchical research plan to review:\n${JSON.stringify(candidatePlan, null, 2)}`,
        "Review the complete hierarchical research plan once. Finalize with: { verdict, summary, blocking_issues, non_blocking_suggestions, missing_evidence, redundancies, unsupported_tasks, blocked_reason, recommended_action }.",
      ].join("\n\n")),
      agentConfig: input.reviewerAgentConfig,
      finalizeSchema: input.reviewerFinalizeSchema,
      signal: input.signal,
    });
    if (!reviewAgent.ok || !reviewAgent.result) {
      await this.dependencies.appendEvent({ run_id: run.runId, event: "seekbrain_planning_peer_review", ok: false });
      return { ok: false, run_id: run.runId, error: reviewAgent.error || "Hierarchical research plan review did not complete." };
    }
    let critique: WorkflowJson;
    try {
      critique = normalizeReviewerCritique(reviewAgent.result);
    } catch (error) {
      return { ok: false, run_id: run.runId, error: error instanceof Error ? error.message : String(error) };
    }
    const critiquePath = join(run.runDir, "research_plan", reviewNumber === 1 ? "reviewer_critique.json" : `reviewer_critique_${reviewNumber}.json`);
    await this.dependencies.writeJson(critiquePath, critique);

    if (critique.verdict === "blocked") {
      await this.dependencies.lifecycle.updateState(run, {
        research_planning: {
          ...current,
          status: "blocked_plan",
          reviewer_critique: critique,
          reviewer_critique_path: critiquePath,
          reviewer_call_count: reviewNumber,
        },
      });
      await this.dependencies.appendEvent({ run_id: run.runId, event: "seekbrain_planning_peer_review", ok: true, verdict: "blocked" });
      return {
        ok: true,
        run_id: run.runId,
        verdict: "blocked",
        summary: critique.summary,
        blocked_reason: critique.blocked_reason || critique.summary,
        recommended_action: critique.recommended_action,
        reviewer_critique_path: critiquePath,
        blocked: true,
      };
    }

    let finalPlan = candidatePlan;
    let response: WorkflowJson | undefined;
    let responsePath: string | undefined;
    if (critique.verdict === "revise") {
      const refinementAgent = await this.dependencies.runAgent({
        runDir: run.runDir,
        finalizeTool: "finalize_research_plan_refinement",
        prompt: prompt(input.orchestratorRolePrompt, "finalize_research_plan_refinement", [
          `Main question:\n${String(run.state.question || "")}`,
          `Locked dataset metadata:\n${String(run.state.data_info || "")}`,
          surveyPromptSection(run),
          `Hierarchical research plan before this review:\n${JSON.stringify(candidatePlan, null, 2)}`,
          `Reviewer critique:\n${JSON.stringify(critique, null, 2)}`,
          "Respond to every blocking issue exactly once. Accept and revise it, partially accept it with a scoped change, or defend the original choice with a scientific and metadata-grounded explanation.",
          "Finalize with: { review_response, final_plan, unresolved_issues }. Do not request another automatic Reviewer pass.",
        ].join("\n\n")),
        agentConfig: input.orchestratorAgentConfig,
        finalizeSchema: input.refinementFinalizeSchema,
        signal: input.signal,
      });
      if (!refinementAgent.ok || !refinementAgent.result) {
        return { ok: false, run_id: run.runId, error: refinementAgent.error || "Hierarchical research plan refinement did not complete." };
      }
      try {
        finalPlan = normalizeResearchTree(refinementAgent.result.final_plan || {});
      } catch (error) {
        return { ok: false, run_id: run.runId, error: error instanceof Error ? error.message : String(error) };
      }
      response = {
        review_response: Array.isArray(refinementAgent.result.review_response) ? refinementAgent.result.review_response : [],
        unresolved_issues: Array.isArray(refinementAgent.result.unresolved_issues) ? refinementAgent.result.unresolved_issues : [],
        final_plan: finalPlan,
      };
      responsePath = join(run.runDir, "research_plan", reviewNumber === 1 ? "orchestrator_response.json" : `orchestrator_response_${reviewNumber}.json`);
      await this.dependencies.writeJson(responsePath, response);
    }

    const finalPath = join(run.runDir, "research_plan", "research_plan.json");
    await this.dependencies.writeJson(finalPath, finalPlan);
    const unresolvedIssues = response?.unresolved_issues || [];
    await this.dependencies.lifecycle.updateState(run, {
      research_planning: {
        ...current,
        status: "ready_for_user_review",
        reviewer_critique: critique,
        reviewer_critique_path: critiquePath,
        reviewer_call_count: reviewNumber,
        automatic_refinement_count: Number(current.automatic_refinement_count || 0) + (critique.verdict === "revise" ? 1 : 0),
        orchestrator_response: response,
        orchestrator_response_path: responsePath,
        final_plan: finalPlan,
        final_plan_path: finalPath,
        unresolved_issues: unresolvedIssues,
      },
    });
    await this.dependencies.appendEvent({
      run_id: run.runId,
      event: "seekbrain_planning_peer_review",
      ok: true,
      verdict: critique.verdict,
      review_number: reviewNumber,
      explicit_user_request: isExplicitRereview,
      refined: critique.verdict === "revise",
      unresolved_issue_count: unresolvedIssues.length,
    });
    return {
      ok: true,
      run_id: run.runId,
      verdict: critique.verdict,
      summary: critique.summary,
      refined: critique.verdict === "revise",
      research_plan: finalPlan,
      subquestion_count: finalPlan.subquestions.length,
      task_count: finalPlan.subquestions.reduce((total: number, item: WorkflowJson) => total + item.tasks.length, 0),
      unresolved_issues: unresolvedIssues,
      unresolved_issue_count: unresolvedIssues.length,
      reviewer_critique_path: critiquePath,
      orchestrator_response_path: responsePath,
      final_plan_path: finalPath,
      needs_user_review: true,
      next_tool: "seekbrain_planning_researcher_review",
    };
  }

  async recordResearchPlanDecision(input: RecordResearchPlanDecisionInput): Promise<WorkflowJson> {
    const run = await this.dependencies.lifecycle.resolveRun(input.cwd, input.runId);
    const current = planningState(run);
    if (current.status !== "ready_for_user_review" || !current.final_plan) {
      return {
        ok: false,
        run_id: run.runId,
        error: "Researcher review requires a finalized hierarchical research plan from seekbrain_planning_peer_review.",
      };
    }
    const reviewedAt = new Date().toISOString();
    const history = Array.isArray(current.user_review_history) ? current.user_review_history : [];
    if (input.decision === "approve" || input.decision === "cancel") {
      const entry = {
        decision: input.decision,
        source: input.source || "research_tree_selector",
        reviewed_at: reviewedAt,
      };
      const nextHistory = [...history, entry];
      const decisionPath = join(run.runDir, "research_plan", "review_decision.json");
      await this.dependencies.writeJson(decisionPath, { latest: entry, history: nextHistory });
      await this.dependencies.lifecycle.updateState(run, {
        research_planning: {
          ...current,
          status: input.decision === "approve" ? "approved_for_execution" : "cancelled_by_user",
          user_review_history: nextHistory,
          review_decision_path: decisionPath,
        },
      });
      await this.dependencies.appendEvent({
        run_id: run.runId,
        event: "seekbrain_planning_researcher_review",
        ok: true,
        decision: input.decision,
      });
      return {
        ok: true,
        run_id: run.runId,
        decision: input.decision,
        status: input.decision === "approve" ? "approved_for_execution" : "cancelled_by_user",
        research_plan: current.final_plan,
        final_plan_path: current.final_plan_path,
        review_decision_path: decisionPath,
        next_tool: input.decision === "approve" ? "seekbrain_analysis_tasks_prepare" : undefined,
        message: input.decision === "approve"
          ? "Hierarchical research plan approved for analysis task execution."
          : "Hierarchical research plan retained without starting analysis task execution.",
      };
    }

    const feedback = String(input.feedback || "").trim();
    if (!feedback) {
      return { ok: false, run_id: run.runId, error: "Scientific feedback is required when revising the hierarchical research plan." };
    }
    const revisionNumber = Number(current.user_revision_count || 0) + 1;
    const revisionAgent = await this.dependencies.runAgent({
      runDir: run.runDir,
      finalizeTool: "finalize_research_plan_user_revision",
      prompt: prompt(input.orchestratorRolePrompt, "finalize_research_plan_user_revision", [
        `Main question:\n${String(run.state.question || "")}`,
        `Locked dataset metadata:\n${String(run.state.data_info || "")}`,
        surveyPromptSection(run),
        `Current final hierarchical research plan:\n${JSON.stringify(current.final_plan, null, 2)}`,
        `User scientific feedback (highest priority):\n${feedback}`,
        "Revise only what is necessary to satisfy the user feedback while preserving metadata grounding, stable hierarchy, and the 2–3 subquestion / 1–2 task constraints.",
        "Finalize with: { feedback_response, final_plan }. Do not call or simulate the Reviewer Agent.",
      ].join("\n\n")),
      agentConfig: input.orchestratorAgentConfig,
      finalizeSchema: input.revisionFinalizeSchema,
      signal: input.signal,
    });
    if (!revisionAgent.ok || !revisionAgent.result) {
      return { ok: false, run_id: run.runId, error: revisionAgent.error || "Researcher-requested hierarchical research plan revision did not complete." };
    }
    let revisedPlan: WorkflowJson;
    try {
      revisedPlan = normalizeResearchTree(revisionAgent.result.final_plan || {});
    } catch (error) {
      return { ok: false, run_id: run.runId, error: error instanceof Error ? error.message : String(error) };
    }
    const revisionEntry = {
      decision: "revise",
      feedback,
      feedback_response: String(revisionAgent.result.feedback_response || "").trim(),
      source: input.source || "research_tree_selector",
      revision_number: revisionNumber,
      reviewed_at: reviewedAt,
    };
    const nextHistory = [...history, revisionEntry];
    const revisionPath = join(run.runDir, "research_plan", `user_revision_${revisionNumber}.json`);
    const finalPath = join(run.runDir, "research_plan", "research_plan.json");
    const decisionPath = join(run.runDir, "research_plan", "review_decision.json");
    await this.dependencies.writeJson(revisionPath, { ...revisionEntry, final_plan: revisedPlan });
    await this.dependencies.writeJson(finalPath, revisedPlan);
    await this.dependencies.writeJson(decisionPath, { latest: revisionEntry, history: nextHistory });
    await this.dependencies.lifecycle.updateState(run, {
      research_planning: {
        ...current,
        status: "ready_for_user_review",
        final_plan: revisedPlan,
        final_plan_path: finalPath,
        user_revision_count: revisionNumber,
        user_review_history: nextHistory,
        latest_user_revision_path: revisionPath,
        review_decision_path: decisionPath,
      },
    });
    await this.dependencies.appendEvent({
      run_id: run.runId,
      event: "seekbrain_planning_researcher_review",
      ok: true,
      decision: "revise",
      revision_number: revisionNumber,
      reviewer_called: false,
    });
    return {
      ok: true,
      run_id: run.runId,
      decision: "revise",
      status: "ready_for_user_review",
      feedback,
      feedback_response: revisionEntry.feedback_response,
      research_plan: revisedPlan,
      final_plan_path: finalPath,
      revision_path: revisionPath,
      reviewer_called: false,
      reviewer_call_count: Number(current.reviewer_call_count || 0),
      needs_user_review: true,
      next_tool: "seekbrain_planning_researcher_review",
      message: "User feedback was applied. Review the revised hierarchical research plan again.",
    };
  }

  async materializeResearchTasks(input: MaterializeResearchTasksInput): Promise<WorkflowJson> {
    const run = await this.dependencies.lifecycle.resolveRun(input.cwd, input.runId);
    const current = planningState(run);
    if (current.status !== "approved_for_execution" && current.status !== "tasks_ready") {
      return {
        ok: false,
        run_id: run.runId,
        blocked_by_human_review: true,
        error: "Analysis tasks can be created only after the final hierarchical research plan is approved.",
      };
    }
    const parentProjectDir = String(run.state.project_dir || dirname(run.runDir));
    if (current.status === "tasks_ready" && Array.isArray(current.task_runs) && current.task_runs.length > 0) {
      const migratedTaskRuns: WorkflowJson[] = [];
      let migrated = false;
      for (const existing of current.task_runs as WorkflowJson[]) {
        if (existing.task_project_dir && existing.task_project_manifest_path) {
          migratedTaskRuns.push(existing);
          continue;
        }
        migrated = true;
        const taskId = String(existing.task_id || "task");
        const taskProjectDir = join(parentProjectDir, "research_tasks", taskId);
        const taskProjectManifestPath = join(taskProjectDir, "project.json");
        const child = await this.dependencies.lifecycle.resolveRun(input.cwd, String(existing.run_id));
        const metadata = {
          data_info: String(run.state.data_info || ""),
          extra_path_info: String(run.state.extra_path_info || ""),
          metadata_json_path: String(run.state.metadata_json_path || ""),
        };
        if (!existsSync(taskProjectManifestPath)) {
          await this.dependencies.writeJson(taskProjectManifestPath, {
            schema_version: 1,
            project_id: `${String(run.state.project_id || "research")}-${taskId}`,
            project_dir: taskProjectDir,
            created_at: new Date().toISOString(),
            metadata_locked: true,
            metadata,
            research_task: {
              task_id: taskId,
              subquestion_id: existing.subquestion_id,
              parent_run_id: run.runId,
              legacy_round_layout: true,
            },
            rounds: [{
              round_number: 1,
              round_name: "round1",
              run_id: existing.run_id,
              run_dir: existing.run_dir,
              question: existing.question,
              status: existing.status === "complete" ? "concluded" : "active",
              created_at: child.state.created_at || new Date().toISOString(),
              legacy_external_run_dir: true,
            }],
          });
        }
        await this.dependencies.lifecycle.updateState(child, {
          project_id: `${String(run.state.project_id || "research")}-${taskId}`,
          project_dir: taskProjectDir,
          round_number: 1,
          round_name: "round1",
          task_project_manifest_path: taskProjectManifestPath,
          legacy_round_layout: true,
        });
        const normalized = {
          ...existing,
          task_project_dir: taskProjectDir,
          task_project_manifest_path: taskProjectManifestPath,
          round_number: 1,
          round_name: "round1",
          legacy_round_layout: true,
        };
        migratedTaskRuns.push(normalized);
        await this.dependencies.lifecycle.registerResearchTaskProject(run, {
          task_id: taskId,
          subquestion_id: existing.subquestion_id,
          project_dir: taskProjectDir,
          project_manifest_path: taskProjectManifestPath,
          status: existing.status,
        });
      }
      if (migrated) {
        const manifestPath = String(current.task_manifest_path || join(run.runDir, "research_plan", "task_manifest.json"));
        await this.dependencies.writeJson(manifestPath, {
          parent_run_id: run.runId,
          research_plan_path: current.final_plan_path,
          migrated_at: new Date().toISOString(),
          task_runs: migratedTaskRuns,
        });
        await this.dependencies.lifecycle.updateState(run, {
          research_planning: { ...current, task_runs: migratedTaskRuns, task_manifest_path: manifestPath },
        });
      }
      return {
        ok: true,
        run_id: run.runId,
        reused: true,
        migrated_legacy_layout: migrated,
        task_runs: migratedTaskRuns,
        task_count: migratedTaskRuns.length,
        task_manifest_path: current.task_manifest_path,
        next_task: migratedTaskRuns.find((item: WorkflowJson) => item.status === "pending") || migratedTaskRuns[0],
        next_tool: "seekbrain_recipe_retrieve",
      };
    }
    const plan = current.final_plan as WorkflowJson;
    const taskRuns: WorkflowJson[] = [];
    for (const subquestion of plan.subquestions as WorkflowJson[]) {
      for (const task of subquestion.tasks as WorkflowJson[]) {
        const taskProjectDir = join(parentProjectDir, "research_tasks", String(task.id));
        const taskProjectManifestPath = join(taskProjectDir, "project.json");
        const created = existsSync(taskProjectManifestPath)
          ? {
              run: await this.dependencies.lifecycle.resumeRun(input.cwd, join(taskProjectDir, "round1")),
              projectDir: taskProjectDir,
              manifestPath: taskProjectManifestPath,
            }
          : await this.dependencies.lifecycle.startResearch({
              cwd: input.cwd,
              projectPath: taskProjectDir,
              question: String(task.analysis_question),
              metadata: {
                data_info: String(run.state.data_info || ""),
                extra_path_info: String(run.state.extra_path_info || ""),
                metadata_json_path: String(run.state.metadata_json_path || ""),
              },
            });
        const child = created.run;
        const inheritedContext = {
          source: "research_planning_engine",
          parent_run_id: run.runId,
          parent_run_dir: run.runDir,
          parent_question: String(run.state.question || ""),
          research_goal: String(plan.research_goal || ""),
          synthesis_strategy: String(plan.synthesis_strategy || ""),
          literature_grounding_context: surveyBackground(run),
          literature_grounding_sources: Array.isArray(current.survey?.sources) ? current.survey.sources : [],
          subquestion: {
            id: subquestion.id,
            question: subquestion.question,
            hypothesis: subquestion.hypothesis,
            role_in_overall_conclusion: subquestion.role_in_overall_conclusion,
          },
          task,
          note: "Execute only this terminal task. Preserve its biological hypothesis and return evidence that can be synthesized by the parent research plan.",
        };
        await this.dependencies.lifecycle.updateState(child, {
          parent_run_id: run.runId,
          parent_run_dir: run.runDir,
          research_task_id: task.id,
          research_subquestion_id: subquestion.id,
          task_project_manifest_path: taskProjectManifestPath,
          metadata_locked: true,
          data_info: String(run.state.data_info || ""),
          extra_path_info: String(run.state.extra_path_info || ""),
          metadata_json_path: String(run.state.metadata_json_path || ""),
          inherited_context: inheritedContext,
          research_planning: { status: "task_execution", enabled: false, parent_run_id: run.runId },
        });
        taskRuns.push({
          task_id: task.id,
          subquestion_id: subquestion.id,
          task_project_dir: taskProjectDir,
          task_project_manifest_path: taskProjectManifestPath,
          run_id: child.runId,
          run_dir: child.runDir,
          state_path: child.statePath,
          round_number: 1,
          round_name: "round1",
          title: task.title,
          question: task.analysis_question,
          biological_hypothesis: task.biological_hypothesis,
          analysis_strategy: task.analysis_strategy,
          expected_evidence: task.expected_evidence,
          status: "pending",
          next_tool: "seekbrain_recipe_retrieve",
        });
        await this.dependencies.lifecycle.registerResearchTaskProject(run, {
          task_id: task.id,
          subquestion_id: subquestion.id,
          project_dir: taskProjectDir,
          project_manifest_path: taskProjectManifestPath,
          status: "pending",
        });
      }
    }
    const manifestPath = join(run.runDir, "research_plan", "task_manifest.json");
    const manifest = {
      parent_run_id: run.runId,
      research_plan_path: current.final_plan_path,
      created_at: new Date().toISOString(),
      task_runs: taskRuns,
    };
    await this.dependencies.writeJson(manifestPath, manifest);
    await this.dependencies.lifecycle.updateState(run, {
      research_planning: {
        ...current,
        status: "tasks_ready",
        task_runs: taskRuns,
        task_manifest_path: manifestPath,
      },
    });
    await this.dependencies.appendEvent({
      run_id: run.runId,
      event: "seekbrain_analysis_tasks_prepare",
      ok: true,
      task_count: taskRuns.length,
      child_run_ids: taskRuns.map((item) => item.run_id),
    });
    return {
      ok: true,
      run_id: run.runId,
      reused: false,
      task_runs: taskRuns,
      task_count: taskRuns.length,
      task_manifest_path: manifestPath,
      next_task: taskRuns[0],
      next_tool: "seekbrain_recipe_retrieve",
      guidance: "Execute each analysis task independently through Recipe, Analytical Formulation, Code Generation & Execution, Validation, and Result Interpretation using its explicit run_id. Do not run Research Planning again inside child tasks.",
    };
  }
}

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { referenceContext } from "./reference-context.ts";
import type { ExecutionTopology, TaskBrief } from "../../core/index.ts";
import { normalizeTaskBriefDraft } from "./task-brief-workflow.ts";
import type { StageAgentResult } from "./research-skill-workflow.ts";
import { readCanonicalMetadata, type RunLifecycleWorkflow, type WorkflowJson } from "./run-lifecycle.ts";

export interface ResearchPlanningWorkflowDependencies {
  lifecycle: RunLifecycleWorkflow;
  runAgent(input: {
    runDir: string;
    prompt: string;
    finalizeTool: string;
    agentConfig: WorkflowJson;
    finalizeSchema: unknown;
    signal?: AbortSignal;
    tools?: string[];
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
  peerReviewRequired?: boolean;
  creativeCertificate?: WorkflowJson;
  creativeIdeasText?: string;
  automaticCreative?: boolean;
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
  decision: "approve" | "revise" | "restore_previous" | "cancel";
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

export interface ExtendResearchInput {
  cwd: string;
  projectPath: string;
  action: "new_sq" | "new_round";
  question?: string;
  taskId?: string;
}

function planningState(run: WorkflowJson): WorkflowJson {
  const value = run.state.research_planning;
  return value && typeof value === "object" ? value : {};
}

function canonicalResearchPlanPath(run: WorkflowJson): string {
  return join(run.runDir, "research_plan", "research_plan.json");
}

async function readJson(path: string): Promise<WorkflowJson | undefined> {
  try { return JSON.parse(await readFile(path, "utf8")) as WorkflowJson; }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

function metadataReference(run: WorkflowJson): WorkflowJson {
  const metadataPath = String(run.state.metadata_json_path || "").trim();
  return {
    ...(metadataPath ? { metadata_json_path: metadataPath } : { data_info: String(run.state.data_info || "") }),
    extra_path_info: String(run.state.extra_path_info || ""),
    ...(run.state.reference_paths ? { reference_paths: run.state.reference_paths } : {}),
    ...(run.state.request_cwd ? { request_cwd: run.state.request_cwd } : {}),
  };
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

function concise(value: unknown, limit = 600): string {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function normalizeRoutingAssessment(
  value: WorkflowJson,
  question: string,
  enforceDerivedRoute: boolean,
): WorkflowJson {
  const requestedRoute = value.route === "research_planning"
    ? "research_planning"
    : value.route === "needs_clarification" ? "needs_clarification" : "standard";
  const taskBriefSource = value.task_brief && typeof value.task_brief === "object"
    ? value.task_brief
    : undefined;
  const taskBrief = normalizeTaskBriefDraft(taskBriefSource, question) as TaskBrief;
  const reportedTopology = String(value.execution_topology || "");
  const executionTopology: ExecutionTopology = taskBrief.intent_mode === "open_discovery"
    ? "open_discovery"
    : reportedTopology === "single_pipeline" || reportedTopology === "independent_branches"
      ? reportedTopology
      : "single_pipeline";
  const route = !enforceDerivedRoute
    ? requestedRoute
    : requestedRoute === "needs_clarification"
      ? "needs_clarification"
      : taskBrief.intent_status === "ambiguous"
        ? "needs_clarification"
        : taskBrief.intent_mode === "open_discovery" || executionTopology === "open_discovery" || executionTopology === "independent_branches"
          ? "research_planning"
          : "standard";
  const planningMode = route === "research_planning"
    ? taskBrief.intent_mode === "open_discovery" || executionTopology === "open_discovery" ? "discovery" : "decomposition"
    : undefined;
  const requirementSummary = [
    ...taskBrief.requested_data,
    ...taskBrief.hard_constraints,
    ...taskBrief.output_preferences,
  ].map((item) => concise(item, 180)).join("; ");
  const normalizedReason = route === "needs_clarification"
    ? taskBrief.intent_status === "ambiguous"
      ? "The request does not yet provide an executable scientific objective or clear authorization for open-ended discovery."
      : concise(value.reason) || "The requested scientific analysis does not match the locked dataset metadata."
    : taskBrief.intent_mode === "open_discovery" || executionTopology === "open_discovery"
      ? "The request delegates scientific-direction discovery, so dataset-grounded hypotheses must be planned before Recipe retrieval."
      : route === "research_planning"
        ? "The requested evidence requires independent analytical branches before synthesis."
        : "The focused request can be executed as one shared analysis pipeline.";
  const recommendedAction = concise(value.recommended_action)
    || (route === "needs_clarification"
      ? "Provide a concrete scientific objective or explicitly authorize SeekBrain to identify research directions."
      : route === "research_planning"
        ? "Review the proposed use of Research Planning."
        : "Continue with Recipe retrieval for the focused analysis.");
  return {
    route,
    reason: requestedRoute === route ? concise(value.reason) || normalizedReason : normalizedReason,
    dataset_summary: concise(value.dataset_summary),
    question_requirements: concise(value.question_requirements) || concise(requirementSummary),
    recommended_action: recommendedAction,
    evidence_dimensions: textList(value.evidence_dimensions),
    inferred_background: concise(value.inferred_background),
    inferred_scientific_goal: concise(value.inferred_scientific_goal) || concise(taskBrief.scientific_goal) || concise(question),
    task_brief: taskBrief,
    execution_topology: executionTopology,
    ...(planningMode ? { planning_mode: planningMode } : {}),
    ...(requestedRoute !== route ? {
      route_normalized_from: requestedRoute,
      route_normalization_reason: normalizedReason,
    } : {}),
  };
}

function assertIndependentLeaf(task: WorkflowJson, taskId: string): void {
  for (const key of ["depends_on", "dependencies", "requires_task_outputs"]) {
    const dependency = task[key];
    if (dependency !== undefined && (!Array.isArray(dependency) || dependency.length > 0)) {
      throw new Error(`Independent leaf ${taskId} cannot declare ${key}.`);
    }
  }
  const inputs = [task.analysis_question, task.analysis_strategy, ...textList(task.required_data)].join("\n");
  if (/\bSQ\d+-T\d+\b|research_tasks[\\/]/i.test(inputs)) {
    throw new Error(`Independent leaf ${taskId} refers to another task or its output directory.`);
  }
}

function normalizeResearchTree(value: WorkflowJson, compact = false): WorkflowJson {
  const rawSubquestions = Array.isArray(value.subquestions) ? value.subquestions : [];
  if (rawSubquestions.length < (compact ? 1 : 2)) {
    throw new Error(`Research plan must contain at least ${compact ? 1 : 2} subquestions; received ${rawSubquestions.length}.`);
  }
  const subquestions = rawSubquestions.map((raw, subquestionIndex) => {
    const item = raw && typeof raw === "object" ? raw as WorkflowJson : {};
    const rawTasks = Array.isArray(item.tasks) ? item.tasks : [];
    if (rawTasks.length < 1 || (!compact && rawTasks.length > 2)) {
      throw new Error(`Research plan subquestion ${subquestionIndex + 1} must contain ${compact ? "at least 1 task" : "1 or 2 tasks"}; received ${rawTasks.length}.`);
    }
    const id = `SQ${subquestionIndex + 1}`;
    return {
      id,
      question: requiredText(item.question, `${id}.question`),
      hypothesis: compact ? String(item.hypothesis || "") : requiredText(item.hypothesis, `${id}.hypothesis`),
      role_in_overall_conclusion: compact ? String(item.role_in_overall_conclusion || "") : requiredText(item.role_in_overall_conclusion, `${id}.role_in_overall_conclusion`),
      dataset_grounding: textList(item.dataset_grounding),
      tasks: rawTasks.map((rawTask, taskIndex) => {
        const task = rawTask && typeof rawTask === "object" ? rawTask as WorkflowJson : {};
        const taskId = `${id}-T${taskIndex + 1}`;
        if (compact) assertIndependentLeaf(task, taskId);
        return {
          id: taskId,
          title: compact ? String(task.title || item.question || "") : requiredText(task.title, `${taskId}.title`),
          analysis_question: requiredText(task.analysis_question, `${taskId}.analysis_question`),
          biological_hypothesis: compact ? String(task.biological_hypothesis || "") : requiredText(task.biological_hypothesis, `${taskId}.biological_hypothesis`),
          analysis_strategy: requiredText(task.analysis_strategy, `${taskId}.analysis_strategy`),
          required_data: textList(task.required_data),
          expected_evidence: requiredText(task.expected_evidence, `${taskId}.expected_evidence`),
          supports_conclusion_if: compact ? String(task.supports_conclusion_if || "") : requiredText(task.supports_conclusion_if, `${taskId}.supports_conclusion_if`),
          contradicts_conclusion_if: compact ? String(task.contradicts_conclusion_if || "") : requiredText(task.contradicts_conclusion_if, `${taskId}.contradicts_conclusion_if`),
        };
      }),
    };
  });
  for (const subquestion of subquestions) {
    if (!compact && subquestion.dataset_grounding.length === 0) {
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
    ...(compact ? {} : { planning_rationale: requiredText(value.planning_rationale, "planning_rationale") }),
    subquestions: compact ? subquestions.map(({ id, question, tasks }) => ({
      id, question,
      tasks: tasks.map(({ id, title, analysis_question, required_data, analysis_strategy, expected_evidence }) => ({
        id, title, analysis_question, required_data, analysis_strategy, expected_evidence,
      })),
    })) : subquestions,
    synthesis_strategy: requiredText(value.synthesis_strategy, "synthesis_strategy"),
  };
}

function normalizeReviewerCritique(value: WorkflowJson): WorkflowJson {
  const scores = value.scores && typeof value.scores === "object" ? value.scores as WorkflowJson : {};
  const scoreLimits: Record<string, number> = {
    relevance: 15,
    completeness: 20,
    hierarchical_structure: 15,
    non_redundancy: 15,
    scientific_value: 15,
    dataset_feasibility: 20,
  };
  const normalizedScores: WorkflowJson = {};
  let scoreSum = 0;
  for (const [key, maximum] of Object.entries(scoreLimits)) {
    const score = Number(scores[key]);
    if (!Number.isInteger(score) || score < 0 || score > maximum) {
      throw new Error(`Research plan review score '${key}' must be an integer from 0 to ${maximum}.`);
    }
    normalizedScores[key] = score;
    scoreSum += score;
  }
  const totalScore = Number(value.total_score);
  if (!Number.isInteger(totalScore) || totalScore < 0 || totalScore > 100 || scoreSum !== totalScore) {
    throw new Error("Research plan review dimension scores must sum exactly to total_score.");
  }
  const reviewDecision = totalScore >= 80
    ? "Accept"
    : totalScore >= 70 ? "Weak Accept" : totalScore >= 40 ? "Revise" : "Reject";
  if (value.review_decision !== reviewDecision) {
    throw new Error(`Research plan review decision '${String(value.review_decision || "")}' is inconsistent with total_score ${totalScore}; expected '${reviewDecision}'.`);
  }
  const verdict = reviewDecision === "Accept" || reviewDecision === "Weak Accept"
    ? "accept"
    : reviewDecision === "Revise" ? "revise" : "blocked";
  const items = (key: string) => Array.isArray(value[key]) ? value[key] : [];
  return {
    verdict,
    review_decision: reviewDecision,
    total_score: totalScore,
    scores: normalizedScores,
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

  async getResearchPlan(cwd: string, runId: string): Promise<WorkflowJson> {
    const run = await this.dependencies.lifecycle.resolveRun(cwd, runId);
    const current = planningState(run);
    const path = String(current.research_plan_path || canonicalResearchPlanPath(run));
    const plan = await readJson(path);
    if (!plan) throw new Error("Canonical hierarchical research plan is missing.");
    const normalized = normalizeResearchTree(plan, current.creative_auto === true);
    return { plan: normalized, path, state: current };
  }

  async recordAssessment(input: RecordResearchPlanningAssessmentInput): Promise<WorkflowJson> {
    const run = await this.dependencies.lifecycle.resolveRun(input.cwd, input.runId);
    const value = input.assessment || {};
    const routeOverride = value.route_override === "explicit_user_request" || value.route_override === "cli_research_planning"
      ? String(value.route_override)
      : "";
    const assessment = normalizeRoutingAssessment(
      value,
      String(run.state.original_question || run.state.question || ""),
      !routeOverride && Boolean(
        value.task_brief
        || value.execution_topology,
      ),
    );
    if (routeOverride) assessment.route_override = routeOverride;
    const route = String(assessment.route);
    const literatureQueries = Array.isArray(value.literature_queries)
      ? [...new Set(value.literature_queries.map((item: unknown) => concise(item, 120)).filter(Boolean))].slice(0, 3)
      : [];
    if (literatureQueries.length) assessment.literature_queries = literatureQueries;
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
      next_tool: route === "research_planning" ? "seekbrain_planning_decision_review" : route === "standard" ? "seekbrain_formulation_generate" : undefined,
    };
  }

  async assess(input: AssessResearchInput): Promise<WorkflowJson> {
    const run = await this.dependencies.lifecycle.resolveRun(input.cwd, input.runId);
    const question = String(run.state.question || "").trim();
    if (!question) throw new Error("A persisted research question is required before planning assessment.");
    const metadata = (await readCanonicalMetadata(run)).slice(0, 12_000);
    const externalLiterature = input.literatureProvider === "semantic_scholar" || input.literatureProvider === "pubmed";
    const literatureInstruction = externalLiterature
      ? [
          `Literature provider: ${input.literatureProvider}.`,
          "Generate 2 or 3 concise English literature search queries in literature_queries.",
          "Each query must contain only 2 to 6 scientific search terms or short phrases. Do not copy the full question or include plotting, output-format, file-handling, or workflow instructions.",
        ].join("\n")
      : "";
    const finalizeFields = externalLiterature
      ? "{ route, reason, dataset_summary, question_requirements, recommended_action, evidence_dimensions, inferred_background, inferred_scientific_goal, task_brief, execution_topology, literature_queries }"
      : "{ route, reason, dataset_summary, question_requirements, recommended_action, evidence_dimensions, inferred_background, inferred_scientific_goal, task_brief, execution_topology }";
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
      const assessment = normalizeRoutingAssessment({
        route: "standard",
        reason: "Research Planning assessment was unavailable, so SeekBrain is continuing with the direct analysis workflow.",
        evidence_dimensions: [],
        inferred_background: "",
        inferred_scientific_goal: "",
        warning: agent.error || "Research planning assessment did not complete.",
      }, question, true);
      assessment.warning = agent.error || "Research planning assessment did not complete.";
      const assessmentPath = join(run.runDir, "research_planning_assessment.json");
      await this.dependencies.writeJson(assessmentPath, assessment);
      await this.dependencies.lifecycle.updateState(run, { research_planning: { assessment, status: "not_required", assessed_at: new Date().toISOString() } });
      await this.dependencies.appendEvent({ run_id: run.runId, event: "seekbrain_planning_assess", ok: true, route: "standard", fallback: true });
      return { run_id: run.runId, ok: true, ...assessment, assessment_path: assessmentPath, needs_user_review: false, next_tool: "seekbrain_formulation_generate" };
    }
    const assessment = normalizeRoutingAssessment(agent.result, question, true);
    const route = String(assessment.route);
    const reason = String(assessment.reason || "");
    const literatureQueries = externalLiterature && Array.isArray(agent.result.literature_queries)
      ? [...new Set(agent.result.literature_queries.map((value: unknown) => concise(value, 120)).filter(Boolean))].slice(0, 3)
      : [];
    if (externalLiterature) assessment.literature_queries = literatureQueries;
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
      next_tool: route === "research_planning" ? "seekbrain_planning_decision_review" : route === "standard" ? "seekbrain_formulation_generate" : undefined,
    };
  }

  async recordDecision(
    cwd: string,
    runId: string,
    decision: "yes" | "no" | "agent_full_auto",
    source = "planning_selector",
    consentEvidence?: string,
  ): Promise<WorkflowJson> {
    const run = await this.dependencies.lifecycle.resolveRun(cwd, runId);
    const current = planningState(run);
    if (current.assessment?.route !== "research_planning") {
      return { ok: false, run_id: run.runId, error: "This run was not routed to Research Planning." };
    }
    const accepted = decision !== "no";
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
      agent_full_auto: decision === "agent_full_auto",
    };
    await this.dependencies.lifecycle.updateState(run, { research_planning: next });
    await this.dependencies.appendEvent({
      run_id: run.runId,
      event: "seekbrain_planning_decision_review",
      ok: true,
      decision,
      source,
      agent_full_auto: decision === "agent_full_auto",
      ...(consentEvidence ? { consent_evidence: consentEvidence } : {}),
    });
    return {
      ok: true,
      run_id: run.runId,
      decision,
      decision_source: source,
      agent_full_auto: decision === "agent_full_auto",
      ...(consentEvidence ? { consent_evidence: consentEvidence } : {}),
      route: next.active_route,
      next_tool: accepted ? "seekbrain_planning_generate" : "seekbrain_formulation_generate",
      message: accepted
        ? "Research Planning approved. Generate the hierarchical research plan."
        : "Research Planning declined. Continue the direct analysis workflow.",
    };
  }

  async prepareSubquestions(input: PrepareSubquestionsInput): Promise<WorkflowJson> {
    const run = await this.dependencies.lifecycle.resolveRun(input.cwd, input.runId);
    const metadata = await readCanonicalMetadata(run);
    const current = planningState(run);
    if (input.automaticCreative && typeof input.creativeIdeasText !== "string") {
      return { ok: false, run_id: run.runId, error: "Automatic creative planning requires ideas text." };
    }
    if (current.status !== "approved" && !(input.automaticCreative && current.agent_full_auto === true)) {
      return {
        ok: false,
        run_id: run.runId,
        blocked_by_human_review: true,
        required_stage: "research_planning",
        error: "Hierarchical research plan generation requires explicit user approval of Research Planning.",
      };
    }
    const assessment = current.assessment || {};
    const planningMode = assessment.planning_mode === "discovery" ? "discovery" : "decomposition";
    const planningInstruction = planningMode === "discovery"
      ? [
          "Planning mode: discovery.",
          "The user explicitly authorized SeekBrain to identify scientific directions from the locked dataset.",
          "Propose 2 or 3 distinct, biologically meaningful, dataset-grounded hypotheses before defining their terminal tasks.",
          "Each terminal task must have a specific analysis question, strategy, expected evidence, and falsification condition suitable for independent Recipe retrieval.",
          "Do not copy the broad parent objective into every task and do not invent variables absent from the metadata.",
        ].join("\n")
      : [
          "Planning mode: decomposition.",
          "Decompose the already specified scientific objective into the smallest useful set of independent analytical branches.",
          "Preserve the TaskBrief constraints and do not introduce unrelated scientific directions.",
        ].join("\n");
    const requestedCount = input.subquestionCount === undefined
      ? "Choose the smallest sufficient number: generate 2 or 3 subquestions."
      : `Generate exactly ${Math.max(2, Math.min(3, Math.trunc(input.subquestionCount)))} subquestions.`;
    const automaticPrompt = input.automaticCreative ? [
      `Research request:\n${String(run.state.question || "")}`,
      `User constraints:\n${JSON.stringify(assessment.task_brief?.hard_constraints || [])}`,
      `Dataset metadata:\n${metadata}`,
      `Creative ideas (verbatim):\n${input.creativeIdeasText}`,
      referenceContext(run, input.cwd),
      "Organize these three directions into one research tree. Do not choose just one or generate a new idea collection.",
      "Finalize { research_goal, subquestions: [{ question, tasks: [{ analysis_question, required_data, analysis_strategy, expected_evidence }] }], synthesis_strategy }.",
    ].join("\n\n") : undefined;
    const agent = await this.dependencies.runAgent({
      runDir: run.runDir,
      finalizeTool: "finalize_research_plan",
      ...(input.automaticCreative ? { tools: ["read", "ls", "bash"] } : {}),
      prompt: prompt(input.rolePrompt, "finalize_research_plan", automaticPrompt ?? [
        `Main question:\n${String(run.state.question || "")}`,
        `Scientific goal:\n${String(assessment.inferred_scientific_goal || "")}`,
        `Background:\n${String(assessment.inferred_background || "")}`,
        planningInstruction,
        surveyPromptSection(run),
        `TaskBrief from research intake:\n${JSON.stringify(assessment.task_brief || {}, null, 2)}`,
        `Execution topology from research intake:\n${String(assessment.execution_topology || "single_pipeline")}`,
        `Evidence dimensions identified by routing:\n${JSON.stringify(assessment.evidence_dimensions || [])}`,
        `Dataset metadata:\n${metadata}`,
        ...(input.creativeCertificate ? [
          `Selected Creative Research Question Certificate:\n${JSON.stringify(input.creativeCertificate, null, 2)}`,
          "Treat the selected hypothesis, discriminating prediction, minimum decisive analysis, and frozen constraints as authoritative. Convert them into an executable hierarchy without adding unrelated creative branches.",
        ] : []),
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
      researchTree = normalizeResearchTree(agent.result, input.automaticCreative === true);
    } catch (error) {
      await this.dependencies.appendEvent({ run_id: run.runId, event: "seekbrain_planning_generate", ok: false, reason: "invalid_research_tree" });
      return { ok: false, run_id: run.runId, error: error instanceof Error ? error.message : String(error) };
    }
    const path = canonicalResearchPlanPath(run);
    await this.dependencies.writeJson(path, researchTree);
    const taskCount = researchTree.subquestions.reduce((total: number, subquestion: WorkflowJson) => total + subquestion.tasks.length, 0);
    await this.dependencies.lifecycle.updateState(run, {
      research_planning: {
        ...current,
        status: input.automaticCreative ? "approved_for_execution" : input.peerReviewRequired ? "ready_for_peer_review" : "ready_for_user_review",
        ...(input.automaticCreative ? { creative_auto: true, agent_full_auto: true,
          creative_status: "tree_ready", plan_review_disabled: true } : {}),
        research_plan_path: path,
        peer_review_required: !input.automaticCreative && input.peerReviewRequired === true,
        planning_mode: planningMode,
        subquestion_count: researchTree.subquestions.length,
        task_count: taskCount,
      },
    });
    await this.dependencies.appendEvent({
      run_id: run.runId,
      event: "seekbrain_planning_generate",
      ok: true,
      planning_mode: planningMode,
      subquestion_count: researchTree.subquestions.length,
      task_count: taskCount,
    });
    return {
      ok: true,
      run_id: run.runId,
      planning_mode: planningMode,
      ...(input.automaticCreative ? { creative_auto: true, research_planning_strategy: "creative" } : {}),
      research_plan: researchTree,
      ...(input.automaticCreative ? {} : { subquestions: researchTree.subquestions }),
      subquestion_count: researchTree.subquestions.length,
      task_count: taskCount,
      research_plan_path: path,
      needs_reviewer_review: !input.automaticCreative && input.peerReviewRequired === true,
      needs_user_review: !input.automaticCreative && input.peerReviewRequired !== true,
      next_tool: input.automaticCreative ? "seekbrain_analysis_tasks_prepare" : input.peerReviewRequired ? "seekbrain_planning_peer_review" : "seekbrain_planning_researcher_review",
    };
  }

  async reviewResearchPlan(input: ReviewResearchPlanInput): Promise<WorkflowJson> {
    const run = await this.dependencies.lifecycle.resolveRun(input.cwd, input.runId);
    const metadata = await readCanonicalMetadata(run);
    const current = planningState(run);
    const loaded = await this.getResearchPlan(input.cwd, input.runId);
    const isInitialReview = current.status === "ready_for_peer_review";
    const isExplicitRereview = input.explicitUserRequest === true
      && current.status === "ready_for_user_review";
    if (!isInitialReview && !isExplicitRereview) {
      return {
        ok: false,
        run_id: run.runId,
        error: current.status === "ready_for_user_review"
          ? "The hierarchical research plan was already reviewed. A second Reviewer Agent call requires an explicit user request."
          : "Hierarchical research plan review requires a canonical plan awaiting Peer Review.",
      };
    }
    const candidatePlan = loaded.plan as WorkflowJson;
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
        `Locked dataset metadata:\n${metadata}`,
        `Hierarchical research plan to review:\n${JSON.stringify(candidatePlan, null, 2)}`,
        "Review the complete hierarchical research plan once. Finalize with: { review_decision, total_score, scores, summary, blocking_issues, non_blocking_suggestions, missing_evidence, redundancies, unsupported_tasks, blocked_reason, recommended_action }.",
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
        review_decision: critique.review_decision,
        total_score: critique.total_score,
        scores: critique.scores,
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
          `Locked dataset metadata:\n${metadata}`,
          surveyPromptSection(run),
          `Hierarchical research plan before this review:\n${JSON.stringify(candidatePlan, null, 2)}`,
          `Reviewer critique:\n${JSON.stringify(critique, null, 2)}`,
          "Respond to every blocking issue exactly once. Accept and revise it, partially accept it with a scoped change, or defend the original choice with a scientific and metadata-grounded explanation.",
          "Finalize with: { review_response, research_plan, unresolved_issues }. Do not request another automatic Reviewer pass.",
        ].join("\n\n")),
        agentConfig: input.orchestratorAgentConfig,
        finalizeSchema: input.refinementFinalizeSchema,
        signal: input.signal,
      });
      if (!refinementAgent.ok || !refinementAgent.result) {
        return { ok: false, run_id: run.runId, error: refinementAgent.error || "Hierarchical research plan refinement did not complete." };
      }
      try {
        finalPlan = normalizeResearchTree(refinementAgent.result.research_plan || {});
      } catch (error) {
        return { ok: false, run_id: run.runId, error: error instanceof Error ? error.message : String(error) };
      }
      response = {
        review_response: Array.isArray(refinementAgent.result.review_response) ? refinementAgent.result.review_response : [],
        unresolved_issues: Array.isArray(refinementAgent.result.unresolved_issues) ? refinementAgent.result.unresolved_issues : [],
      };
      responsePath = join(run.runDir, "research_plan", reviewNumber === 1 ? "orchestrator_response.json" : `orchestrator_response_${reviewNumber}.json`);
      await this.dependencies.writeJson(responsePath, response);
    }

    const finalPath = String(loaded.path);
    if (critique.verdict === "revise") await this.dependencies.writeJson(finalPath, finalPlan);
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
        research_plan_path: finalPath,
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
      review_decision: critique.review_decision,
      total_score: critique.total_score,
      scores: critique.scores,
      summary: critique.summary,
      refined: critique.verdict === "revise",
      research_plan: finalPlan,
      subquestion_count: finalPlan.subquestions.length,
      task_count: finalPlan.subquestions.reduce((total: number, item: WorkflowJson) => total + item.tasks.length, 0),
      unresolved_issues: unresolvedIssues,
      unresolved_issue_count: unresolvedIssues.length,
      reviewer_critique_path: critiquePath,
      orchestrator_response_path: responsePath,
      research_plan_path: finalPath,
      needs_user_review: true,
      next_tool: "seekbrain_planning_researcher_review",
    };
  }

  async recordResearchPlanDecision(input: RecordResearchPlanDecisionInput): Promise<WorkflowJson> {
    const run = await this.dependencies.lifecycle.resolveRun(input.cwd, input.runId);
    const current = planningState(run);
    if (current.status !== "ready_for_user_review") {
      return {
        ok: false,
        run_id: run.runId,
        error: "Researcher review requires a canonical hierarchical research plan ready for user review.",
      };
    }
    const loaded = await this.getResearchPlan(input.cwd, input.runId);
    const currentPlan = loaded.plan as WorkflowJson;
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
        research_plan: currentPlan,
        research_plan_path: loaded.path,
        review_decision_path: decisionPath,
        next_tool: input.decision === "approve" ? "seekbrain_analysis_tasks_prepare" : undefined,
        message: input.decision === "approve"
          ? "Hierarchical research plan approved for analysis task execution."
          : "Hierarchical research plan retained without starting analysis task execution.",
      };
    }

    const feedback = String(input.feedback || "").trim();
    if (input.decision === "revise" && !feedback) {
      return { ok: false, run_id: run.runId, error: "Scientific feedback is required when revising the hierarchical research plan." };
    }
    const revisionNumber = Number(current.user_revision_count || 0) + 1;
    const finalPath = String(loaded.path);
    const previousPath = join(run.runDir, "research_plan", "research_plan.previous.json");
    if (input.decision === "restore_previous") {
      let previousPlan: WorkflowJson;
      try { previousPlan = normalizeResearchTree(JSON.parse(await readFile(previousPath, "utf8"))); }
      catch { return { ok: false, run_id: run.runId, error: "No previous Research Plan version is available to restore." }; }
      await this.dependencies.writeJson(previousPath, currentPlan);
      await this.dependencies.writeJson(finalPath, previousPlan);
      const revisionEntry = {
        decision: "revise",
        feedback: "Restore previous Plan version",
        feedback_response: "Restored the previous Research Plan version.",
        source: input.source || "research_tree_selector",
        revision_number: revisionNumber,
        changed_nodes: [],
        rollback: true,
        reviewed_at: reviewedAt,
      };
      const nextHistory = [...history, revisionEntry];
      const decisionPath = join(run.runDir, "research_plan", "review_decision.json");
      await this.dependencies.writeJson(decisionPath, { latest: revisionEntry, history: nextHistory });
      await this.dependencies.lifecycle.updateState(run, {
        research_planning: {
          ...current,
          status: "ready_for_user_review",
          research_plan_path: finalPath,
          previous_research_plan_path: previousPath,
          user_revision_count: revisionNumber,
          user_review_history: nextHistory,
          review_decision_path: decisionPath,
        },
      });
      await this.dependencies.appendEvent({ run_id: run.runId, event: "seekbrain_planning_researcher_review", ok: true, decision: "revise", rollback: true, revision_number: revisionNumber, reviewer_called: false });
      return {
        ok: true,
        run_id: run.runId,
        decision: "revise",
        status: "ready_for_user_review",
        feedback,
        feedback_response: revisionEntry.feedback_response,
        research_plan: previousPlan,
        research_plan_path: finalPath,
        previous_research_plan_path: previousPath,
        rolled_back: true,
        reviewer_called: false,
        reviewer_call_count: Number(current.reviewer_call_count || 0),
        needs_user_review: true,
        next_tool: "seekbrain_planning_researcher_review",
        message: "Restored the previous Research Plan. Review it again.",
      };
    }
    const metadata = await readCanonicalMetadata(run);
    const revisionAgent = await this.dependencies.runAgent({
      runDir: run.runDir,
      finalizeTool: "finalize_research_plan_user_revision",
      prompt: prompt(input.orchestratorRolePrompt, "finalize_research_plan_user_revision", [
        `Main question:\n${String(run.state.question || "")}`,
        `Locked dataset metadata:\n${metadata}`,
        surveyPromptSection(run),
        `Current authoritative hierarchical research plan:\n${JSON.stringify(currentPlan, null, 2)}`,
        `User scientific feedback (highest priority):\n${feedback}`,
        "The current plan already contains every previously accepted change. Apply only the latest feedback. Preserve every node and detail not implicated by this feedback while maintaining metadata grounding and the 2–3 subquestion / 1–2 task constraints.",
        "Finalize with: { feedback_response, changed_nodes, research_plan }. Do not call or simulate the Reviewer Agent.",
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
      revisedPlan = normalizeResearchTree(revisionAgent.result.research_plan || {});
    } catch (error) {
      return { ok: false, run_id: run.runId, error: error instanceof Error ? error.message : String(error) };
    }
    const revisionEntry = {
      decision: "revise",
      feedback,
      feedback_response: String(revisionAgent.result.feedback_response || "").trim(),
      source: input.source || "research_tree_selector",
      revision_number: revisionNumber,
      changed_nodes: Array.isArray(revisionAgent.result.changed_nodes) ? revisionAgent.result.changed_nodes.map(String) : [],
      reviewed_at: reviewedAt,
    };
    const nextHistory = [...history, revisionEntry];
    const revisionPath = join(run.runDir, "research_plan", `user_revision_${revisionNumber}.json`);
    const decisionPath = join(run.runDir, "research_plan", "review_decision.json");
    await this.dependencies.writeJson(previousPath, currentPlan);
    await this.dependencies.writeJson(revisionPath, revisionEntry);
    await this.dependencies.writeJson(finalPath, revisedPlan);
    await this.dependencies.writeJson(decisionPath, { latest: revisionEntry, history: nextHistory });
    await this.dependencies.lifecycle.updateState(run, {
      research_planning: {
        ...current,
        status: "ready_for_user_review",
        research_plan_path: finalPath,
        previous_research_plan_path: previousPath,
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
      research_plan_path: finalPath,
      previous_research_plan_path: previousPath,
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
    const loadedPlan = await this.getResearchPlan(input.cwd, input.runId);
    const researchPlanPath = String(loadedPlan.path);
    const parentProjectDir = String(run.state.project_dir || dirname(run.runDir));
    if (current.status === "tasks_ready" && Array.isArray(current.task_runs) && current.task_runs.length > 0) {
      const taskRuns = current.task_runs as WorkflowJson[];
      return {
        ok: true,
        run_id: run.runId,
        reused: true,
        task_runs: taskRuns,
        task_count: taskRuns.length,
        task_manifest_path: current.task_manifest_path,
        next_task: taskRuns.find((item: WorkflowJson) => item.status === "pending") || taskRuns[0],
        next_tool: "seekbrain_formulation_generate",
      };
    }
    const plan = loadedPlan.plan as WorkflowJson;
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
              metadata: metadataReference(run),
            });
        const child = created.run;
        const inheritedContext = {
          source: "research_planning_engine",
          parent_run_id: run.runId,
          parent_run_dir: run.runDir,
          research_task_id: task.id,
          research_subquestion_id: subquestion.id,
        };
        await this.dependencies.lifecycle.updateState(child, {
          parent_run_id: run.runId,
          parent_run_dir: run.runDir,
          research_task_id: task.id,
          research_subquestion_id: subquestion.id,
          task_project_manifest_path: taskProjectManifestPath,
          metadata_locked: true,
          ...metadataReference(run),
          inherited_context: inheritedContext,
          ...(current.creative_auto ? { independent_leaf: true,
            research_task_contract: { question: task.analysis_question, required_data: task.required_data,
              analysis_strategy: task.analysis_strategy, expected_evidence: task.expected_evidence } } : {}),
          research_planning: { status: "task_execution", enabled: false, parent_run_id: run.runId,
            ...(current.creative_auto ? { agent_full_auto: true, creative_auto: true } : {}) },
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
          next_tool: "seekbrain_formulation_generate",
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
      research_plan_path: researchPlanPath,
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
      next_tool: "seekbrain_formulation_generate",
      guidance: "Execute each analysis task independently through Analytical Formulation, Code Generation & Execution, Validation, and Result Interpretation using its explicit run_id. Do not run Research Planning again inside child tasks.",
    };
  }

  async extendResearch(input: ExtendResearchInput): Promise<WorkflowJson> {
    const projectDir = resolve(input.cwd, input.projectPath);
    const project = await readJson(join(projectDir, "project.json"));
    const planningRunDir = String(
      project?.planning_run?.run_dir
      || (Array.isArray(project?.rounds) ? project.rounds[0]?.run_dir : "")
      || join(projectDir, "planning"),
    );
    const parent = await this.dependencies.lifecycle.resumeRun(input.cwd, planningRunDir);
    const current = planningState(parent);
    if (!current.research_plan_path || !Array.isArray(current.task_runs)) {
      throw new Error("This project does not contain a materialized Research Planning plan.");
    }
    if (current.status !== "tasks_complete") {
      throw new Error("Finish the current Research Planning tasks before adding one extension.");
    }
    const loaded = await this.getResearchPlan(input.cwd, parent.runId);
    const plan = loaded.plan as WorkflowJson;
    const subquestions = plan.subquestions as WorkflowJson[];

    let subquestion: WorkflowJson;
    let task: WorkflowJson;
    let created: Awaited<ReturnType<RunLifecycleWorkflow["startResearch"]>> | Awaited<ReturnType<RunLifecycleWorkflow["continueResearch"]>>;

    if (input.action === "new_sq") {
      const question = String(input.question || "").trim();
      if (!question) throw new Error("question is required when adding a new subquestion.");
      const nextNumber = Math.max(0, ...subquestions.map((item) => Number(/^SQ(\d+)$/i.exec(String(item.id || ""))?.[1] || 0))) + 1;
      const subquestionId = `SQ${nextNumber}`;
      const taskId = `${subquestionId}-T1`;
      task = {
        id: taskId,
        title: question,
        analysis_question: question,
        biological_hypothesis: question,
        analysis_strategy: question,
        required_data: [String(parent.state.metadata_json_path || parent.state.data_info || "canonical dataset metadata")],
        expected_evidence: question,
        supports_conclusion_if: question,
        contradicts_conclusion_if: question,
      };
      subquestion = {
        id: subquestionId,
        question,
        hypothesis: question,
        role_in_overall_conclusion: question,
        dataset_grounding: [String(parent.state.metadata_json_path || parent.state.data_info || "canonical dataset metadata")],
        tasks: [task],
      };
      plan.subquestions = [...subquestions, subquestion];
      await this.dependencies.writeJson(String(loaded.path), plan);
      created = await this.dependencies.lifecycle.startResearch({
        cwd: input.cwd,
        projectPath: join(projectDir, "research_tasks", taskId),
        question,
        metadata: metadataReference(parent),
      });
    } else {
      const taskId = String(input.taskId || "").trim();
      if (!taskId) throw new Error("task_id is required when adding a new round.");
      subquestion = subquestions.find((item) => (item.tasks as WorkflowJson[]).some((candidate) => String(candidate.id) === taskId)) as WorkflowJson;
      task = (subquestion?.tasks as WorkflowJson[] | undefined)?.find((candidate) => String(candidate.id) === taskId) as WorkflowJson;
      if (!task || !subquestion) throw new Error(`Unknown Research Planning task '${taskId}'.`);
      const direction = String(input.question || task.analysis_question || task.title || "").trim();
      created = await this.dependencies.lifecycle.continueResearch(
        input.cwd,
        join(projectDir, "research_tasks", taskId),
        direction,
      );
    }

    const child = created.run;
    const taskProjectDir = String(created.projectDir);
    const taskProjectManifestPath = String(created.manifestPath);
    const inheritedContext = {
      source: "research_planning_extension",
      parent_run_id: parent.runId,
      parent_run_dir: parent.runDir,
      research_task_id: task.id,
      research_subquestion_id: subquestion.id,
    };
    await this.dependencies.lifecycle.updateState(child, {
      parent_run_id: parent.runId,
      parent_run_dir: parent.runDir,
      research_task_id: task.id,
      research_subquestion_id: subquestion.id,
      task_project_manifest_path: taskProjectManifestPath,
      metadata_locked: true,
      ...metadataReference(parent),
      inherited_context: inheritedContext,
      research_planning: { status: "task_execution", enabled: false, parent_run_id: parent.runId },
    });
    const taskRun = {
      task_id: task.id,
      subquestion_id: subquestion.id,
      task_project_dir: taskProjectDir,
      task_project_manifest_path: taskProjectManifestPath,
      run_id: child.runId,
      run_dir: child.runDir,
      state_path: child.statePath,
      round_number: created.roundNumber,
      round_name: created.roundName,
      title: task.title,
      question: child.state.question,
      biological_hypothesis: task.biological_hypothesis,
      analysis_strategy: task.analysis_strategy,
      expected_evidence: task.expected_evidence,
      status: "pending",
      next_tool: "seekbrain_formulation_generate",
    };
    const taskRuns = [
      ...(current.task_runs as WorkflowJson[]).filter((item) => String(item.task_id) !== String(task.id)),
      taskRun,
    ];
    await this.dependencies.lifecycle.registerResearchTaskProject(parent, {
      task_id: task.id,
      subquestion_id: subquestion.id,
      project_dir: taskProjectDir,
      project_manifest_path: taskProjectManifestPath,
      status: "pending",
    });
    await this.dependencies.writeJson(String(current.task_manifest_path), {
      parent_run_id: parent.runId,
      research_plan_path: loaded.path,
      updated_at: new Date().toISOString(),
      task_runs: taskRuns,
    });
    await this.dependencies.lifecycle.updateState(parent, {
      research_planning: {
        ...current,
        status: "tasks_ready",
        subquestion_count: (plan.subquestions as WorkflowJson[]).length,
        task_count: taskRuns.length,
        task_runs: taskRuns,
      },
    });
    await this.dependencies.appendEvent({
      run_id: parent.runId,
      event: "seekbrain_research_extend",
      ok: true,
      action: input.action,
      task_id: task.id,
      child_run_id: child.runId,
      round_number: created.roundNumber,
    });
    return {
      ok: true,
      parent_run_id: parent.runId,
      action: input.action,
      task_id: task.id,
      subquestion_id: subquestion.id,
      run_id: child.runId,
      run_dir: child.runDir,
      round_number: created.roundNumber,
      round_name: created.roundName,
      task_run: taskRun,
      agent_full_auto: current.agent_full_auto === true,
      next_tool: "seekbrain_execution_run",
    };
  }
}

import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import {
  ExecutionTopologySchema,
  TaskBriefDraftSchema,
  type ResearchPlanningStrategy,
} from "../../../core/index.ts";
import type {
  CreativeResearchPlanningWorkflow,
  CreativeScientificSearchWorkflow,
  TaskBriefWorkflow,
  ResearchPlanningWorkflow,
  ResearchSurveyWorkflow,
  ResearchTaskScheduler,
  RunLifecycleWorkflow,
} from "../../../workflows/index.ts";
import {
  researchPlanningReviewTitle,
  researchTreeReviewTitle,
  selectResearchTreeReview,
  selectYesNoReview,
} from "../../tui/review-selectors.ts";
import { renderSeekBrainResult } from "../../tui/compact-tool-results.ts";
import type { Json, SeekBrainToolDefinition } from "../runtime-types.ts";

export interface ResearchPlanningToolDependencies {
  projectRoot: string;
  lifecycle: RunLifecycleWorkflow;
  taskBriefWorkflow: TaskBriefWorkflow;
  planningWorkflow: ResearchPlanningWorkflow;
  creativeWorkflow: CreativeResearchPlanningWorkflow;
  creativeSearchWorkflow: CreativeScientificSearchWorkflow;
  scheduler: ResearchTaskScheduler;
  surveyWorkflow: ResearchSurveyWorkflow;
  loadConfig(cwd: string): Promise<Json>;
  workflowConfig(config: Json): {
    research_planning_strategy: ResearchPlanningStrategy;
    research_survey: boolean;
    research_planning_peer_review: boolean;
    has_literature_provider: boolean;
    literature_provider?: string;
  };
  readPrompt(name: string): Promise<string>;
  pickAgentConfig(config: Json, name: string): Json;
  pickLiteratureAgentConfig(config: Json, name: string): Json;
  resolveRun(cwd: string, runId?: string): Promise<any>;
  setActiveRunDir(path: string): void;
  content(details: Json, text?: string): any;
}

function pickResearchPlanningConfig(deps: ResearchPlanningToolDependencies, config: Json) {
  return {
    ...deps.pickAgentConfig(config, "seekbrain_plan"),
    ...(config.agents?.seekbrain_research_planning || {}),
  };
}

function researchTreeSchema() {
  return Type.Object({
    research_goal: Type.String(),
    planning_rationale: Type.String(),
    subquestions: Type.Array(Type.Object({
      id: Type.String(),
      question: Type.String(),
      hypothesis: Type.String(),
      role_in_overall_conclusion: Type.String(),
      dataset_grounding: Type.Array(Type.String(), { minItems: 1 }),
      tasks: Type.Array(Type.Object({
        id: Type.String(),
        title: Type.String(),
        analysis_question: Type.String(),
        biological_hypothesis: Type.String(),
        analysis_strategy: Type.String(),
        required_data: Type.Array(Type.String(), { minItems: 1 }),
        expected_evidence: Type.String(),
        supports_conclusion_if: Type.String(),
        contradicts_conclusion_if: Type.String(),
      }), { minItems: 1, maxItems: 2 }),
    }), { minItems: 2, maxItems: 3 }),
    synthesis_strategy: Type.String(),
  });
}

function automaticCreativeTreeSchema() {
  return Type.Object({
    research_goal: Type.String(),
    subquestions: Type.Array(Type.Object({
      question: Type.String(),
      tasks: Type.Array(Type.Object({
        analysis_question: Type.String(),
        required_data: Type.Array(Type.String(), { minItems: 1 }),
        analysis_strategy: Type.String(),
        expected_evidence: Type.String(),
      }), { minItems: 1 }),
    }), { minItems: 1 }),
    synthesis_strategy: Type.String(),
  });
}

function creativeAutomatic(planning: Json): boolean {
  return planning.creative_auto === true || planning.agent_full_auto === true
    || process.env.SEEKBRAIN_RUN_MODE === "research_planning_auto";
}

function creativeIdeasSchema() {
  return Type.Object({
    session_summary: Type.String(),
    target_abstraction: Type.Object({
      observed_pattern: Type.String(),
      entities: Type.String(),
      relation: Type.String(),
      candidate_dynamics: Type.Array(Type.String()),
      observable_signature: Type.String(),
    }),
    frozen_constraints: Type.Array(Type.String()),
    ideas: Type.Array(Type.Object({
      idea_id: Type.String(),
      temperature: Type.Union([Type.Literal("low"), Type.Literal("medium"), Type.Literal("high")]),
      parent_ids: Type.Array(Type.String()),
      title: Type.String(),
      research_question: Type.String(),
      core_anomaly: Type.String(),
      hypothesis: Type.String(),
      mechanism: Type.String(),
      remote_transfer: Type.Object({
        source_domain: Type.String(),
        transferred_mechanism: Type.String(),
      }),
      why_data_can_test: Type.String(),
      discriminating_prediction: Type.String(),
      nearest_prior_boundary: Type.String(),
      strongest_counterevidence: Type.String(),
      minimal_decisive_analysis: Type.String(),
      evidence_ids: Type.Array(Type.String()),
      method_ids: Type.Array(Type.String()),
      lineage: Type.Object({
        user: Type.Array(Type.String()),
        retrieval: Type.Array(Type.String()),
        seekbrain: Type.Array(Type.String()),
      }),
    }), { minItems: 3, maxItems: 3 }),
  });
}

function creativeSearchSchema() {
  return Type.Object({
    request_summary: Type.String(),
    status: Type.Union([Type.Literal("sufficient"), Type.Literal("partial"), Type.Literal("exhausted")]),
    unresolved_gap: Type.String(),
    attempt_assessments: Type.Array(Type.Object({
      evidence_id: Type.String(),
      assessment: Type.String(),
      next_gap: Type.String(),
    }), { maxItems: 3 }),
    methods: Type.Array(Type.Object({
      component_type: Type.Union([
        Type.Literal("mechanism"),
        Type.Literal("analysis"),
        Type.Literal("validation"),
        Type.Literal("counterevidence"),
        Type.Literal("prior_boundary"),
      ]),
      label: Type.String(),
      reusable_component: Type.String(),
      application_to_current_problem: Type.String(),
      limitation: Type.String(),
      evidence_ids: Type.Array(Type.String(), { minItems: 1 }),
    })),
  });
}

function researchPlanReviewSchema() {
  const issue = Type.Object({
    target_id: Type.String(),
    dimension: Type.String(),
    issue: Type.String(),
    required_change: Type.String(),
  });
  return Type.Object({
    review_decision: Type.Union([
      Type.Literal("Accept"),
      Type.Literal("Weak Accept"),
      Type.Literal("Revise"),
      Type.Literal("Reject"),
    ]),
    total_score: Type.Integer({ minimum: 0, maximum: 100 }),
    scores: Type.Object({
      relevance: Type.Integer({ minimum: 0, maximum: 15 }),
      completeness: Type.Integer({ minimum: 0, maximum: 20 }),
      hierarchical_structure: Type.Integer({ minimum: 0, maximum: 15 }),
      non_redundancy: Type.Integer({ minimum: 0, maximum: 15 }),
      scientific_value: Type.Integer({ minimum: 0, maximum: 15 }),
      dataset_feasibility: Type.Integer({ minimum: 0, maximum: 20 }),
    }),
    summary: Type.String(),
    blocking_issues: Type.Array(issue),
    non_blocking_suggestions: Type.Array(Type.String()),
    missing_evidence: Type.Array(Type.String()),
    redundancies: Type.Array(Type.String()),
    unsupported_tasks: Type.Array(Type.String()),
    blocked_reason: Type.String(),
    recommended_action: Type.String(),
  });
}

export function researchRouteSchema(literatureProvider?: string) {
  const fields: Json = {
    route: Type.Union([Type.Literal("standard"), Type.Literal("research_planning"), Type.Literal("needs_clarification")]),
    reason: Type.String(),
    dataset_summary: Type.String(),
    question_requirements: Type.String(),
    recommended_action: Type.String(),
    evidence_dimensions: Type.Array(Type.String()),
    inferred_background: Type.String(),
    inferred_scientific_goal: Type.String(),
    task_brief: TaskBriefDraftSchema,
    execution_topology: ExecutionTopologySchema,
  };
  if (literatureProvider === "semantic_scholar" || literatureProvider === "pubmed") {
    fields.literature_queries = Type.Array(Type.String(), { minItems: 2, maxItems: 3 });
  }
  return Type.Object(fields);
}

export function createResearchPlanningTools(
  deps: ResearchPlanningToolDependencies,
): SeekBrainToolDefinition[] {
  async function resolveDirectTaskBrief(cwd: string, runId: string, signal?: AbortSignal): Promise<Json> {
    const config = await deps.loadConfig(deps.projectRoot);
    return await deps.taskBriefWorkflow.resolveDirect({
      cwd,
      runId,
      rolePrompt: await deps.readPrompt("task_brief"),
      agentConfig: deps.pickAgentConfig(config, "seekbrain_task_brief"),
      signal,
    });
  }

  async function resolveStandardTaskBriefFromPlanning(
    cwd: string,
    planningRunId: string,
    standardRunId: string,
    signal?: AbortSignal,
  ): Promise<Json> {
    const planningRun = await deps.lifecycle.resolveRun(cwd, planningRunId);
    const assessment = planningRun.state.research_planning?.assessment || {};
    const routedBrief = assessment.task_brief;
    const hasRoutedBrief = Boolean(routedBrief && typeof routedBrief === "object");
    if (hasRoutedBrief) {
      return await deps.taskBriefWorkflow.resolveRoute({
        cwd,
        runId: standardRunId,
        taskBrief: routedBrief,
        originalQuestion: String(planningRun.state.original_question || planningRun.state.question || ""),
      });
    }
    return await resolveDirectTaskBrief(cwd, standardRunId, signal);
  }

  async function applyResearchTreeDecision(
    runId: string,
    decision: "approve" | "revise" | "restore_previous" | "cancel",
    feedback: string | undefined,
    source: string,
    signal: AbortSignal | undefined,
    ctx: Json,
  ) {
    const config = await deps.loadConfig(deps.projectRoot);
    return await deps.planningWorkflow.recordResearchPlanDecision({
      cwd: ctx.cwd,
      runId,
      decision,
      feedback,
      source,
      orchestratorRolePrompt: await deps.readPrompt("research_subquestions"),
      orchestratorAgentConfig: pickResearchPlanningConfig(deps, config),
      revisionFinalizeSchema: Type.Object({
        feedback_response: Type.String(),
        changed_nodes: Type.Array(Type.String()),
        research_plan: researchTreeSchema(),
      }),
      signal,
    });
  }

  async function presentResearchTreeReview(runId: string, signal: AbortSignal | undefined, ctx: Json) {
    const run = await deps.resolveRun(ctx.cwd, runId);
    const planning = run.state.research_planning || {};
    if (planning.creative_auto === true) {
      return { ok: true, run_id: runId, skipped: true, skip_reason: "creative_automatic",
        needs_user_review: false, next_tool: "seekbrain_analysis_tasks_prepare" };
    }
    if (planning.status === "cancelled_by_user") {
      return {
        ok: true,
        run_id: runId,
        decision: "cancel",
        status: "cancelled_by_user",
        needs_user_review: false,
        message: "Hierarchical research plan is retained and execution remains cancelled.",
      };
    }
    if (planning.agent_full_auto === true) {
      return await applyResearchTreeDecision(runId, "approve", undefined, "agent_full_auto", signal, ctx);
    }
    const canonical = await deps.planningWorkflow.getResearchPlan(ctx.cwd, runId);
    const selection = await selectResearchTreeReview(ctx, {
      title: researchTreeReviewTitle(canonical.plan || {}, planning),
      feedbackTitle: "",
      feedbackPlaceholder: "",
      rollbackAvailable: Boolean(planning.previous_research_plan_path),
    });
    if (selection.decision === "unavailable") {
      await deps.lifecycle.updateState(run, {
        research_planning: { ...planning, text_review_pending: true },
      });
      return {
        ok: false,
        run_id: runId,
        needs_text_review: true,
        next_tool: "seekbrain_planning_researcher_decision_record",
        message: "Interactive selector is unavailable. Ask the user to approve, revise with feedback, or cancel task execution.",
      };
    }
    if (planning.text_review_pending === true) {
      await deps.lifecycle.updateState(run, {
        research_planning: { ...planning, text_review_pending: false },
      });
    }
    if (selection.decision === "feedback_empty") {
      return { ok: false, run_id: runId, message: "No scientific feedback was entered. Review the plan again." };
    }
    return await applyResearchTreeDecision(
      runId,
      selection.decision === "feedback" ? "revise" : selection.decision,
      selection.decision === "feedback" ? selection.feedback : undefined,
      "research_tree_selector",
      signal,
      ctx,
    );
  }

  return [
    defineTool({
      name: "seekbrain_planning_assess",
      label: "Assess Research Planning",
      description: "Diagnostic and compatibility entry for rerunning the lightweight Planning assessment on an existing run. Normal new research is assessed internally by seekbrain_research_start when Research Planning is enabled.",
      parameters: Type.Object({
        run_id: Type.String(),
        background: Type.Optional(Type.String({ description: "Optional scientific background already supplied by the user." })),
        scientific_goal: Type.Optional(Type.String({ description: "Optional high-level scientific goal already supplied by the user." })),
      }),
      async execute(_toolCallId, params, signal, _onUpdate, ctx) {
        const config = await deps.loadConfig(deps.projectRoot);
        const workflowFlags = deps.workflowConfig(config);
        const assessed = await deps.planningWorkflow.assess({
          cwd: ctx.cwd,
          runId: params.run_id,
          literatureProvider: workflowFlags.literature_provider,
          background: params.background,
          scientificGoal: params.scientific_goal,
          rolePrompt: await deps.readPrompt("research_route"),
          agentConfig: deps.pickAgentConfig(config, "seekbrain_research_route"),
          finalizeSchema: researchRouteSchema(workflowFlags.literature_provider),
          signal,
        });
        const taskBrief = assessed.task_brief && typeof assessed.task_brief === "object"
          ? await deps.taskBriefWorkflow.resolveRoute({
            cwd: ctx.cwd,
            runId: params.run_id,
            taskBrief: assessed.task_brief,
          })
          : undefined;
        return deps.content({
          ...assessed,
          ...(taskBrief ? {
            question: taskBrief.question,
            task_brief: taskBrief.task_brief,
            task_brief_path: taskBrief.task_brief_path,
          } : {}),
        });
      },
      renderResult: renderSeekBrainResult("seekbrain_planning_assess"),
    }),
    defineTool({
      name: "seekbrain_planning_decision_review",
      label: "Review Research Planning",
      description: "Show the native Yes/No decision for a Research Planning recommendation. No continues the direct analysis workflow and is not treated as an error.",
      parameters: Type.Object({
        run_id: Type.String(),
        summary: Type.Optional(Type.String({ description: "Short explanation of why Research Planning was recommended." })),
      }),
      async execute(_toolCallId, params, signal, _onUpdate, ctx) {
        const run = await deps.resolveRun(ctx.cwd, params.run_id);
        const assessment = run.state.research_planning?.assessment || {};
        const yesLabel = "Yes — initiate structured research decomposition";
        const autoLabel = "Agent-Full-Auto — approve all later workflow gates";
        const noLabel = "No — proceed with the standard SeekBrain workflow";
        const selection = await selectYesNoReview(ctx, {
          title: researchPlanningReviewTitle(assessment, params.summary),
          yesLabel,
          autoLabel,
          noLabel,
        });
        if (selection.decision === "unavailable") {
          await deps.lifecycle.updateState(run, {
            research_planning: {
              ...(run.state.research_planning || {}),
              status: "awaiting_text_review",
            },
          });
          return deps.content({
            ok: false,
            run_id: params.run_id,
            needs_text_review: true,
            next_tool: "seekbrain_planning_decision_record",
            message: "Interactive selector is unavailable. Ask the user to answer Yes, Agent-Full-Auto, or No, then record that response.",
          });
        }
        if (selection.decision === "cancel") {
          return deps.content({ ok: false, run_id: params.run_id, decision: "cancel", message: "Research Planning decision was cancelled." });
        }
        const decision = selection.decision;
        const reviewed = await deps.planningWorkflow.recordDecision(
          ctx.cwd,
          params.run_id,
          decision,
          "native_selector",
          decision === "yes" ? yesLabel : decision === "agent_full_auto" ? autoLabel : noLabel,
        );
        if (reviewed.ok && decision === "no") {
          const standard = await deps.lifecycle.materializeInitialRound(ctx.cwd, params.run_id);
          const taskBrief = await resolveStandardTaskBriefFromPlanning(ctx.cwd, params.run_id, standard.run.runId, signal);
          deps.setActiveRunDir(standard.run.runDir);
          return deps.content({
            ...reviewed,
            planning_run_id: params.run_id,
            run_id: standard.run.runId,
            run_dir: standard.run.runDir,
            state_path: standard.run.statePath,
            round_number: standard.roundNumber,
            round_name: standard.roundName,
            deliverables: standard.run.state.deliverables,
            question: taskBrief.question || standard.run.state.question,
            task_brief: taskBrief.task_brief,
            task_brief_path: taskBrief.task_brief_path,
          });
        }
        return deps.content(reviewed);
      },
      renderResult: renderSeekBrainResult("seekbrain_planning_decision_review"),
    }),
    defineTool({
      name: "seekbrain_planning_decision_record",
      label: "Record Research Planning Response",
      description: "Record the user's short Research Planning choice when the native selector is unavailable.",
      parameters: Type.Object({
        run_id: Type.String(),
        decision: Type.Union([Type.Literal("yes"), Type.Literal("agent_full_auto"), Type.Literal("no")]),
        response_quote: Type.String({ description: "Exact short quote of the user's latest chat response." }),
      }),
      async execute(_toolCallId, params, signal, _onUpdate, ctx) {
        const run = await deps.resolveRun(ctx.cwd, params.run_id);
        if (run.state.research_planning?.status !== "awaiting_text_review") {
          return deps.content({
            ok: false,
            run_id: params.run_id,
            message: "No text-based Research Planning decision is currently pending.",
          });
        }
        const decision = params.decision as "yes" | "agent_full_auto" | "no";
        const reviewed = await deps.planningWorkflow.recordDecision(
          ctx.cwd,
          params.run_id,
          decision,
          "chat_response",
          String(params.response_quote).trim(),
        );
        if (reviewed.ok && decision === "no") {
          const standard = await deps.lifecycle.materializeInitialRound(ctx.cwd, params.run_id);
          const taskBrief = await resolveStandardTaskBriefFromPlanning(ctx.cwd, params.run_id, standard.run.runId, signal);
          deps.setActiveRunDir(standard.run.runDir);
          return deps.content({
            ...reviewed,
            planning_run_id: params.run_id,
            run_id: standard.run.runId,
            run_dir: standard.run.runDir,
            state_path: standard.run.statePath,
            round_number: standard.roundNumber,
            round_name: standard.roundName,
            deliverables: standard.run.state.deliverables,
            question: taskBrief.question || standard.run.state.question,
            task_brief: taskBrief.task_brief,
            task_brief_path: taskBrief.task_brief_path,
          });
        }
        return deps.content(reviewed);
      },
      renderResult: renderSeekBrainResult("seekbrain_planning_decision_record"),
    }),
    defineTool({
      name: "seekbrain_planning_generate",
      label: "Generate Hierarchical Research Plan",
      description: "Creative automatic mode generates three idea sections as text, then an executable research tree without selection or review. Interactive Creative mode starts with three Idea Cards. Standard mode creates the hierarchy after approval.",
      parameters: Type.Object({
        run_id: Type.String(),
        subquestion_count: Type.Optional(Type.Integer({ minimum: 2, maximum: 3 })),
      }),
      async execute(_toolCallId, params, signal, onUpdate, ctx) {
        const config = await deps.loadConfig(deps.projectRoot);
        const workflow = deps.workflowConfig(config);
        if (workflow.research_planning_strategy === "creative") {
          const run = await deps.resolveRun(ctx.cwd, params.run_id);
          const planning = run.state.research_planning || {};
          if (creativeAutomatic(planning)) {
            if (["approved_for_execution", "tasks_ready", "tasks_running", "tasks_complete"].includes(planning.status)) {
              const canonical = await deps.planningWorkflow.getResearchPlan(ctx.cwd, params.run_id);
              return deps.content({ ok: true, run_id: params.run_id, reused: true,
                research_plan: canonical.plan, research_plan_path: canonical.path,
                needs_user_review: false, needs_reviewer_review: false,
                next_tool: planning.status === "approved_for_execution" ? "seekbrain_analysis_tasks_prepare" : "seekbrain_execution_run" });
            }
            if (planning.status !== "approved" && planning.agent_full_auto !== true) {
              const accepted = await deps.planningWorkflow.recordDecision(ctx.cwd, params.run_id,
                "agent_full_auto", "cli_research_planning", "--research-planning");
              if (!accepted.ok) return deps.content(accepted);
            }
            onUpdate?.(deps.content({ progress: true, stage: "creative_ideas",
              message: "Generating low-, medium-, and high-creativity ideas as text." }));
            const creative = await deps.creativeWorkflow.generateText({
              cwd: ctx.cwd, runId: params.run_id,
              rolePrompt: await deps.readPrompt("creative_research_auto"),
              agentConfig: pickResearchPlanningConfig(deps, config),
              finalizeSchema: Type.Object({ text: Type.String() }), signal,
            });
            if (!creative.ok) return deps.content(creative);
            onUpdate?.(deps.content({ progress: true, stage: "research_tree",
              message: "Turning the three ideas into a research tree of independent analysis tasks." }));
            const prepared = await deps.planningWorkflow.prepareSubquestions({
              cwd: ctx.cwd, runId: params.run_id,
              rolePrompt: await deps.readPrompt("research_subquestions_auto"),
              agentConfig: pickResearchPlanningConfig(deps, config),
              finalizeSchema: automaticCreativeTreeSchema(),
              creativeIdeasText: creative.text, automaticCreative: true,
              peerReviewRequired: false, signal,
            });
            return deps.content({ ...prepared, ideas_text: creative.text, ideas_path: creative.ideas_path });
          }
          if (planning.creative_status === "idea_selected") {
            if (planning.status !== "approved") {
              return deps.content({
                ok: false,
                run_id: params.run_id,
                needs_user_review: true,
                next_tool: "seekbrain_planning_decision_review",
                message: "An Idea Card has been selected. Ask the researcher whether to continue with Research Planning before generating the hierarchy.",
              });
            }
            const certificate = planning.research_question_certificate;
            if (!certificate || typeof certificate !== "object") {
              return deps.content({ ok: false, run_id: params.run_id, error: "The selected Creative Research Question Certificate is missing." });
            }
            onUpdate?.(deps.content({
              progress: true,
              stage: "research_tree",
              message: "Research Planning approved; converting the selected Idea Card into the formal hierarchical Research Plan.",
            }));
            const prepared = await deps.planningWorkflow.prepareSubquestions({
              cwd: ctx.cwd,
              runId: params.run_id,
              subquestionCount: params.subquestion_count,
              rolePrompt: await deps.readPrompt("research_subquestions"),
              agentConfig: pickResearchPlanningConfig(deps, config),
              finalizeSchema: researchTreeSchema(),
              peerReviewRequired: workflow.research_planning_peer_review,
              creativeCertificate: certificate,
              signal,
            });
            return deps.content(prepared);
          }
          onUpdate?.(deps.content({
            progress: true,
            stage: "creative_ideas",
            message: "Building three dataset-grounded hypotheses and searching only the evidence gaps that distinguish them.",
          }));
          const initialSearch = await deps.creativeSearchWorkflow.search({
            cwd: ctx.cwd,
            runId: params.run_id,
            instruction: "Find useful scientific mechanisms, analysis or validation methods, nearby precedents, and serious counterevidence that could improve hypotheses for the current question.",
            trigger: "initial",
            rolePrompt: await deps.readPrompt("creative_search"),
            agentConfig: pickResearchPlanningConfig(deps, config),
            finalizeSchema: creativeSearchSchema(),
            signal,
          });
          const creative = await deps.creativeWorkflow.start({
            cwd: ctx.cwd,
            runId: params.run_id,
            rolePrompt: await deps.readPrompt("creative_research"),
            agentConfig: pickResearchPlanningConfig(deps, config),
            finalizeSchema: creativeIdeasSchema(),
            signal,
          });
          return deps.content({ ...creative, initial_search: initialSearch });
        }
        onUpdate?.(deps.content({
          progress: true,
          stage: "research_survey",
          message: workflow.research_survey
            ? "Retrieving and synthesizing global literature background before generating the hierarchical research plan."
            : "Research Survey is unavailable; continuing to generate the hierarchical research plan without literature grounding.",
        }));
        const survey = await deps.surveyWorkflow.execute({
          cwd: ctx.cwd,
          runId: params.run_id,
          enabled: workflow.research_survey,
          disabledReason: workflow.has_literature_provider ? "disabled_by_user_config" : "no_literature_provider",
          rolePrompt: await deps.readPrompt("research_survey"),
          agentConfig: deps.pickLiteratureAgentConfig(config, "seekbrain_survey"),
          finalizeSchema: Type.Object({ literature_grounding_context: Type.String() }),
          signal,
        });
        if (!survey.ok) return deps.content({ ...survey, stage: "research_survey", next_tool: "seekbrain_planning_generate" });
        onUpdate?.(deps.content({
          progress: true,
          stage: "research_tree",
          message: survey.skipped
            ? "Research Survey is disabled; generating the hierarchical research plan from the question and dataset metadata."
            : `Research Survey ${survey.reused ? "reused" : "complete"} with ${Number(survey.source_count || 0)} sources; generating the hierarchical research plan.`,
        }));
        const prepared = await deps.planningWorkflow.prepareSubquestions({
          cwd: ctx.cwd,
          runId: params.run_id,
          subquestionCount: params.subquestion_count,
          rolePrompt: await deps.readPrompt("research_subquestions"),
          agentConfig: pickResearchPlanningConfig(deps, config),
          finalizeSchema: researchTreeSchema(),
          peerReviewRequired: workflow.research_planning_peer_review,
          signal,
        });
        if (!prepared.ok || workflow.research_planning_peer_review) {
          return deps.content({
            ...prepared,
            research_survey: {
              status: survey.status || (survey.skipped ? "disabled" : "ready"),
              reused: survey.reused === true,
              source_count: Number(survey.source_count || 0),
              context_path: survey.context_path,
              sources_path: survey.sources_path,
              result_path: survey.result_path,
            },
          });
        }
        let researcherReview = await presentResearchTreeReview(params.run_id, signal, ctx);
        while (researcherReview.ok && researcherReview.decision === "revise" && researcherReview.needs_user_review === true) {
          researcherReview = await presentResearchTreeReview(params.run_id, signal, ctx);
        }
        return deps.content({
          ...prepared,
          researcher_review: researcherReview,
          ...(researcherReview.decision ? { decision: researcherReview.decision } : {}),
          ...(researcherReview.status ? { status: researcherReview.status } : {}),
          next_tool: researcherReview.next_tool,
          ...(researcherReview.needs_text_review ? { needs_text_review: true } : {}),
          needs_user_review: researcherReview.needs_user_review === true,
          research_survey: {
            status: survey.status || (survey.skipped ? "disabled" : "ready"),
            reused: survey.reused === true,
            source_count: Number(survey.source_count || 0),
            context_path: survey.context_path,
            sources_path: survey.sources_path,
            result_path: survey.result_path,
          },
        });
      },
      renderResult: renderSeekBrainResult("seekbrain_planning_generate"),
    }),
    defineTool({
      name: "seekbrain_creative_search",
      label: "Search Creative Research Literature",
      description: "Search, read, and iteratively refine up to three literature queries, append useful methods to the persistent Creative paper pool, and present method briefs without changing any Idea Card.",
      parameters: Type.Object({
        run_id: Type.String(),
        instruction: Type.String({ description: "The researcher's natural-language request for additional literature, mechanisms, methods, precedents, or counterevidence." }),
      }),
      async execute(_toolCallId, params, signal, onUpdate, ctx) {
        const config = await deps.loadConfig(deps.projectRoot);
        const workflow = deps.workflowConfig(config);
        if (workflow.research_planning_strategy !== "creative") {
          return deps.content({ ok: false, run_id: params.run_id, error: "Creative literature search is available only in Creative Research Planning." });
        }
        onUpdate?.(deps.content({
          progress: true,
          stage: "creative_search",
          message: "Searching, reading results, and revising the query when the first attempt is not useful.",
        }));
        return deps.content(await deps.creativeSearchWorkflow.search({
          cwd: ctx.cwd,
          runId: params.run_id,
          instruction: params.instruction,
          trigger: "user",
          rolePrompt: await deps.readPrompt("creative_search"),
          agentConfig: pickResearchPlanningConfig(deps, config),
          finalizeSchema: creativeSearchSchema(),
          signal,
        }));
      },
      renderResult: renderSeekBrainResult("seekbrain_creative_search"),
    }),
    defineTool({
      name: "seekbrain_creative_update",
      label: "Update Creative Research Ideas",
      description: "Apply one researcher-directed operation to the three active Creative Research Idea Cards while preserving their lineage, evidence ledger, and frozen constraints.",
      parameters: Type.Object({
        run_id: Type.String(),
        operation: Type.Union([
          Type.Literal("increase_temperature"),
          Type.Literal("replace_validation"),
          Type.Literal("freeze_constraint"),
          Type.Literal("crossover"),
          Type.Literal("challenge"),
          Type.Literal("apply_method"),
          Type.Literal("continue"),
        ]),
        instruction: Type.String({ description: "The researcher's natural-language instruction, preserved without reinterpretation." }),
        source_idea_ids: Type.Optional(Type.Array(Type.String(), { maxItems: 3 })),
        source_method_ids: Type.Optional(Type.Array(Type.String(), { maxItems: 5 })),
      }),
      async execute(_toolCallId, params, signal, onUpdate, ctx) {
        const config = await deps.loadConfig(deps.projectRoot);
        const workflow = deps.workflowConfig(config);
        if (workflow.research_planning_strategy !== "creative") {
          return deps.content({
            ok: false,
            run_id: params.run_id,
            error: "Creative Idea operations are available only when research_planning_strategy is creative.",
          });
        }
        onUpdate?.(deps.content({
          progress: true,
          stage: "creative_update",
          message: `Applying the researcher-directed Creative operation: ${params.operation}.`,
        }));
        return deps.content(await deps.creativeWorkflow.update({
          cwd: ctx.cwd,
          runId: params.run_id,
          operation: params.operation,
          instruction: params.instruction,
          sourceIdeaIds: params.source_idea_ids,
          sourceMethodIds: params.source_method_ids,
          rolePrompt: await deps.readPrompt("creative_research"),
          agentConfig: pickResearchPlanningConfig(deps, config),
          finalizeSchema: creativeIdeasSchema(),
          signal,
        }));
      },
      renderResult: renderSeekBrainResult("seekbrain_creative_update"),
    }),
    defineTool({
      name: "seekbrain_creative_select",
      label: "Select Creative Research Idea",
      description: "Freeze one researcher-selected Idea Card into a Research Question Certificate, then hand off to the Yes / Agent-Full-Auto / No Research Planning decision.",
      parameters: Type.Object({
        run_id: Type.String(),
        idea_id: Type.String(),
        subquestion_count: Type.Optional(Type.Integer({ minimum: 2, maximum: 3 })),
      }),
      async execute(_toolCallId, params, signal, onUpdate, ctx) {
        const config = await deps.loadConfig(deps.projectRoot);
        const workflow = deps.workflowConfig(config);
        if (workflow.research_planning_strategy !== "creative") {
          return deps.content({
            ok: false,
            run_id: params.run_id,
            error: "Creative Idea selection is available only when research_planning_strategy is creative.",
          });
        }
        const selected = await deps.creativeWorkflow.select({
          cwd: ctx.cwd,
          runId: params.run_id,
          ideaId: params.idea_id,
        });
        if (!selected.ok) return deps.content(selected);
        return deps.content(selected);
      },
      renderResult: renderSeekBrainResult("seekbrain_creative_select"),
    }),
    defineTool({
      name: "seekbrain_planning_peer_review",
      label: "Run Reviewer Agent",
      description: "Run the single automatic Reviewer Agent critique over the complete hierarchical research plan and, only when required, one Orchestrator Agent refinement.",
      parameters: Type.Object({
        run_id: Type.String(),
        explicit_user_request: Type.Optional(Type.Boolean({ description: "Set true only when the user explicitly asks for another scientific Reviewer pass." })),
      }),
      async execute(_toolCallId, params, signal, _onUpdate, ctx) {
        const config = await deps.loadConfig(deps.projectRoot);
        const workflow = deps.workflowConfig(config);
        const run = await deps.resolveRun(ctx.cwd, params.run_id);
        if (run.state.research_planning?.creative_auto === true) {
          return deps.content({ ok: true, run_id: params.run_id, skipped: true,
            skip_reason: "creative_automatic", needs_user_review: false,
            next_tool: "seekbrain_analysis_tasks_prepare" });
        }
        if (!workflow.research_planning_peer_review && params.explicit_user_request !== true) {
          const canonical = await deps.planningWorkflow.getResearchPlan(ctx.cwd, params.run_id);
          return deps.content({
            ok: true,
            run_id: params.run_id,
            skipped: true,
            skip_reason: "disabled_by_user_config",
            research_plan_path: canonical.path,
            needs_user_review: true,
            next_tool: "seekbrain_planning_researcher_review",
          });
        }
        const peerReview = await deps.planningWorkflow.reviewResearchPlan({
          cwd: ctx.cwd,
          runId: params.run_id,
          reviewerRolePrompt: await deps.readPrompt("research_plan_review"),
          reviewerAgentConfig: deps.pickAgentConfig(config, "seekbrain_research_reviewer"),
          reviewerFinalizeSchema: researchPlanReviewSchema(),
          orchestratorRolePrompt: await deps.readPrompt("research_subquestions"),
          orchestratorAgentConfig: pickResearchPlanningConfig(deps, config),
          refinementFinalizeSchema: Type.Object({
            review_response: Type.Array(Type.Object({
              target_id: Type.String(),
              resolution: Type.Union([Type.Literal("accepted"), Type.Literal("partially_accepted"), Type.Literal("defended")]),
              explanation: Type.String(),
              changed_nodes: Type.Array(Type.String()),
            })),
            research_plan: researchTreeSchema(),
            unresolved_issues: Type.Array(Type.String()),
          }),
          explicitUserRequest: params.explicit_user_request === true,
          signal,
        });
        if (!peerReview.ok || peerReview.needs_user_review !== true) return deps.content(peerReview);
        let researcherReview = await presentResearchTreeReview(params.run_id, signal, ctx);
        while (researcherReview.ok && researcherReview.decision === "revise" && researcherReview.needs_user_review === true) {
          researcherReview = await presentResearchTreeReview(params.run_id, signal, ctx);
        }
        return deps.content({
          ...peerReview,
          researcher_review: researcherReview,
          ...(researcherReview.decision ? { decision: researcherReview.decision } : {}),
          ...(researcherReview.status ? { status: researcherReview.status } : {}),
          next_tool: researcherReview.next_tool,
          ...(researcherReview.needs_text_review ? { needs_text_review: true } : {}),
          needs_user_review: researcherReview.needs_user_review === true,
        });
      },
      renderResult: renderSeekBrainResult("seekbrain_planning_peer_review"),
    }),
    defineTool({
      name: "seekbrain_planning_researcher_review",
      label: "Review Research Plan",
      description: "Show the final hierarchical research plan review selector. User revisions are applied by the Orchestrator Agent without automatically calling the Reviewer Agent again.",
      parameters: Type.Object({ run_id: Type.String() }),
      async execute(_toolCallId, params, signal, _onUpdate, ctx) {
        return deps.content(await presentResearchTreeReview(params.run_id, signal, ctx));
      },
      renderResult: renderSeekBrainResult("seekbrain_planning_researcher_review"),
    }),
    defineTool({
      name: "seekbrain_planning_researcher_decision_record",
      label: "Record Research Plan Review Response",
      description: "Record an approve, revise, or cancel chat response when the native final research-plan selector is unavailable.",
      parameters: Type.Object({
        run_id: Type.String(),
        decision: Type.Union([Type.Literal("approve"), Type.Literal("revise"), Type.Literal("restore_previous"), Type.Literal("cancel")]),
        response_quote: Type.String({ description: "Exact quote of the user's latest chat response." }),
        feedback: Type.Optional(Type.String()),
      }),
      async execute(_toolCallId, params, signal, _onUpdate, ctx) {
        const run = await deps.resolveRun(ctx.cwd, params.run_id);
        if (run.state.research_planning?.text_review_pending !== true) {
          return deps.content({ ok: false, run_id: params.run_id, message: "No text-based research-plan review is currently pending." });
        }
        const responseQuote = String(params.response_quote || "").trim();
        if (!responseQuote) {
          return deps.content({ ok: false, run_id: params.run_id, message: "The user's exact review response is required." });
        }
        if (params.decision === "revise" && !String(params.feedback || "").trim()) {
          return deps.content({ ok: false, run_id: params.run_id, message: "Scientific feedback is required when revising the research plan." });
        }
        await deps.lifecycle.updateState(run, {
          research_planning: {
            ...(run.state.research_planning || {}),
            text_review_pending: false,
            text_review_response_quote: responseQuote,
          },
        });
        return deps.content(await applyResearchTreeDecision(
          params.run_id,
          params.decision as "approve" | "revise" | "restore_previous" | "cancel",
          params.feedback,
          "chat_response",
          signal,
          ctx,
        ));
      },
      renderResult: renderSeekBrainResult("seekbrain_planning_researcher_decision_record"),
    }),
    defineTool({
      name: "seekbrain_analysis_tasks_prepare",
      label: "Prepare Analysis Tasks",
      description: "Create independently traceable child runs for every approved terminal analysis task, using each self-contained analysis question with the locked metadata.",
      parameters: Type.Object({ run_id: Type.String() }),
      async execute(_toolCallId, params, signal, _onUpdate, ctx) {
        const prepared = await deps.planningWorkflow.materializeResearchTasks({ cwd: ctx.cwd, runId: params.run_id });
        if (!prepared.ok || !Array.isArray(prepared.task_runs)) return deps.content(prepared);
        const briefs = await Promise.all(prepared.task_runs.map((task: Json) => (
          resolveDirectTaskBrief(ctx.cwd, String(task.run_id), signal)
        )));
        const briefByRun = new Map(briefs.map((brief) => [String(brief.run_id), brief]));
        const taskRuns = prepared.task_runs.map((task: Json) => {
          const brief = briefByRun.get(String(task.run_id));
          return {
            ...task,
            question: brief?.question || task.question,
            task_brief_path: brief?.task_brief_path,
          };
        });
        const nextTaskRunId = String(prepared.next_task?.run_id || "");
        return deps.content({
          ...prepared,
          task_runs: taskRuns,
          next_task: taskRuns.find((task: Json) => String(task.run_id) === nextTaskRunId) || taskRuns[0],
        });
      },
      renderResult: renderSeekBrainResult("seekbrain_analysis_tasks_prepare"),
    }),
    defineTool({
      name: "seekbrain_research_extend",
      label: "Extend Research Planning Project",
      description: "Add one new single-task subquestion or one new round to a completed Research Planning project, then queue only that extension for the ordinary terminal-task pipeline.",
      parameters: Type.Object({
        project_path: Type.String(),
        action: Type.Union([Type.Literal("new_sq"), Type.Literal("new_round")]),
        question: Type.Optional(Type.String()),
        task_id: Type.Optional(Type.String()),
      }),
      async execute(_toolCallId, params, signal, _onUpdate, ctx) {
        const extended = await deps.planningWorkflow.extendResearch({
          cwd: ctx.cwd,
          projectPath: params.project_path,
          action: params.action,
          question: params.question,
          taskId: params.task_id,
        });
        const taskBrief = extended.task_run?.run_id
          ? await resolveDirectTaskBrief(ctx.cwd, String(extended.task_run.run_id), signal)
          : undefined;
        const taskRun = {
          ...(extended.task_run || {}),
          ...(taskBrief ? {
            question: taskBrief.question,
            task_brief_path: taskBrief.task_brief_path,
          } : {}),
        };
        await deps.scheduler.upsertExtensionTask(ctx.cwd, String(extended.parent_run_id), taskRun);
        return deps.content({ ...extended, task_run: taskRun });
      },
      renderResult: renderSeekBrainResult("seekbrain_research_extend"),
    }),
  ];
}

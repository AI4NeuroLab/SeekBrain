import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type {
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
  planningWorkflow: ResearchPlanningWorkflow;
  scheduler: ResearchTaskScheduler;
  surveyWorkflow: ResearchSurveyWorkflow;
  loadConfig(cwd: string): Promise<Json>;
  workflowConfig(config: Json): {
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

function researchPlanReviewSchema() {
  const issue = Type.Object({
    target_id: Type.String(),
    dimension: Type.String(),
    issue: Type.String(),
    required_change: Type.String(),
  });
  return Type.Object({
    verdict: Type.Union([Type.Literal("accept"), Type.Literal("revise"), Type.Literal("blocked")]),
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
  };
  if (literatureProvider === "semantic_scholar" || literatureProvider === "pubmed") {
    fields.literature_queries = Type.Array(Type.String(), { minItems: 2, maxItems: 3 });
  }
  return Type.Object(fields);
}

export function createResearchPlanningTools(
  deps: ResearchPlanningToolDependencies,
): SeekBrainToolDefinition[] {
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
        return deps.content(await deps.planningWorkflow.assess({
          cwd: ctx.cwd,
          runId: params.run_id,
          literatureProvider: workflowFlags.literature_provider,
          background: params.background,
          scientificGoal: params.scientific_goal,
          rolePrompt: await deps.readPrompt("research_route"),
          agentConfig: deps.pickAgentConfig(config, "seekbrain_research_route"),
          finalizeSchema: researchRouteSchema(workflowFlags.literature_provider),
          signal,
        }));
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
      async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
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
            question: standard.run.state.question,
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
      async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
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
            question: standard.run.state.question,
          });
        }
        return deps.content(reviewed);
      },
      renderResult: renderSeekBrainResult("seekbrain_planning_decision_record"),
    }),
    defineTool({
      name: "seekbrain_planning_generate",
      label: "Generate Hierarchical Research Plan",
      description: "Create a dataset-grounded hierarchical research plan with 2–3 scientific subquestions and 1–2 hypothesis-linked analysis tasks per subquestion after the user approves Research Planning.",
      parameters: Type.Object({
        run_id: Type.String(),
        subquestion_count: Type.Optional(Type.Integer({ minimum: 2, maximum: 3 })),
      }),
      async execute(_toolCallId, params, signal, onUpdate, ctx) {
        const config = await deps.loadConfig(deps.projectRoot);
        const workflow = deps.workflowConfig(config);
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
      description: "Create independently traceable child runs for every approved terminal analysis task, inheriting locked metadata and parent scientific context.",
      parameters: Type.Object({ run_id: Type.String() }),
      async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
        return deps.content(await deps.planningWorkflow.materializeResearchTasks({ cwd: ctx.cwd, runId: params.run_id }));
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
      async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
        const extended = await deps.planningWorkflow.extendResearch({
          cwd: ctx.cwd,
          projectPath: params.project_path,
          action: params.action,
          question: params.question,
          taskId: params.task_id,
        });
        await deps.scheduler.upsertExtensionTask(ctx.cwd, String(extended.parent_run_id), extended.task_run || {});
        return deps.content(extended);
      },
      renderResult: renderSeekBrainResult("seekbrain_research_extend"),
    }),
  ];
}

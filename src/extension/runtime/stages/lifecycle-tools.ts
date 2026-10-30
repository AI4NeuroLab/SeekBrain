import { defineTool } from "@earendil-works/pi-coding-agent";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { Type } from "typebox";
import {
  verifiedExplicitResearchPlanningRequest,
  workflowConfigResult,
  type TaskBriefWorkflow,
  type ResearchPlanningWorkflow,
  type RunLifecycleWorkflow,
  type WorkflowRunContext,
} from "../../../workflows/index.ts";
import { renderResumeRunResult, renderSeekBrainResult } from "../../tui/compact-tool-results.ts";
import type { Json, SeekBrainToolDefinition } from "../runtime-types.ts";

export interface LifecycleToolDependencies {
  lifecycle: RunLifecycleWorkflow;
  taskBriefWorkflow: TaskBriefWorkflow;
  planningWorkflow: ResearchPlanningWorkflow;
  loadConfig(cwd: string): Promise<Json>;
  workflowConfig(config: Json): {
    research_planning: boolean;
    literature_provider?: string;
    [key: string]: any;
  };
  readPrompt(name: string): Promise<string>;
  pickAgentConfig(config: Json, name: string): Json;
  researchRouteSchema(literatureProvider?: string): any;
  startRun(cwd: string, workDir: string, deliverables?: any[], question?: string): Promise<WorkflowRunContext>;
  resumeRun(cwd: string, workDir: string, question?: string): Promise<WorkflowRunContext>;
  writeJson(path: string, value: Json): Promise<void>;
  setActiveRunDir(path: string): void;
  content(details: Json, text?: string): any;
}

const deliverablesSchema = Type.Optional(Type.Array(Type.Object({
  path: Type.String(),
  kind: Type.Union([Type.Literal("figure"), Type.Literal("statistics"), Type.Literal("data"), Type.Literal("code"), Type.Literal("other")]),
  role: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  optional: Type.Optional(Type.Boolean()),
  produced_by: Type.Optional(Type.String()),
})));

function effectiveWorkflowConfigResult(config: Json): Json {
  const result = workflowConfigResult(config as any) as Json;
  const runMode = process.env.SEEKBRAIN_RUN_MODE;
  if (runMode !== "standard" && runMode !== "research_planning_auto") return result;
  return {
    ...result,
    optional: {
      ...(result.optional || {}),
      research_planning: runMode === "standard" ? "disabled_by_run_mode" : "enabled",
    },
  };
}

export function createLifecycleTools(deps: LifecycleToolDependencies): SeekBrainToolDefinition[] {
  async function resolveDirectTaskBrief(
    cwd: string,
    runId: string,
    config: Json,
    signal?: AbortSignal,
  ): Promise<Json> {
    return await deps.taskBriefWorkflow.resolveDirect({
      cwd,
      runId,
      rolePrompt: await deps.readPrompt("task_brief"),
      agentConfig: deps.pickAgentConfig(config, "seekbrain_task_brief"),
      signal,
    });
  }

  async function resolveRoutedTaskBrief(
    cwd: string,
    runId: string,
    researchRoute: Json,
    originalQuestion: string,
    config: Json,
    signal?: AbortSignal,
  ): Promise<Json | undefined> {
    if (researchRoute.task_brief && typeof researchRoute.task_brief === "object") {
      return await deps.taskBriefWorkflow.resolveRoute({
        cwd,
        runId,
        taskBrief: researchRoute.task_brief,
        originalQuestion,
      });
    }
    if (researchRoute.route === "standard") {
      return await resolveDirectTaskBrief(cwd, runId, config, signal);
    }
    return undefined;
  }

  return [
    defineTool({
      name: "seekbrain_research_start",
      label: "Start Research",
      description: "Start a multi-round SeekBrain project. The Research Route Agent creates a lightweight TaskBrief, checks dataset fit, classifies broad execution topology, and selects the standard or Research Planning route in one call. The direct analysis workflow materializes project_dir/round1; Research Planning keeps parent state under project_dir/planning and creates only child analysis-task rounds. Pass metadata_json_path when metadata already exists; the tool reads and locks its content internally.",
      parameters: Type.Object({
        project_dir: Type.String({ description: "Stable project-ID directory. Round outputs are created below it as round1, round2, ..." }),
        question: Type.String({ description: "Research question for round1." }),
        background: Type.Optional(Type.String({ description: "Optional scientific background supplied by the user. It is incorporated into the Research Survey and downstream Research Planning context." })),
        data_info: Type.Optional(Type.String({ description: "Inline canonical metadata content. Omit this when metadata_json_path is available; it is inherited unchanged by later rounds." })),
        extra_path_info: Type.Optional(Type.String({ description: "Canonical path/access notes. They are inherited unchanged by later rounds." })),
        reference_paths: Type.Optional(Type.Array(Type.String({ description: "Reference file or directory explicitly supplied in the user's natural-language request. Any material type; relative to the user working directory. Omit if none supplied." }))),
        metadata_json_path: Type.Optional(Type.String({ description: "Canonical metadata JSON path for this project. The tool reads and locks the file content internally." })),
        research_planning_request_quote: Type.Optional(Type.String({ description: "Exact quote from the current user request that explicitly asks for Research Planning by name. This records consent without bypassing the Research Route Agent." })),
        deliverables: deliverablesSchema,
      }),
      async execute(_toolCallId, params, signal, _onUpdate, ctx) {
        const config = await deps.loadConfig(ctx.cwd);
        const workflowFlags = deps.workflowConfig(config);
        let canonicalMetadataPath = params.metadata_json_path ? resolve(ctx.cwd, params.metadata_json_path) : undefined;
        let canonicalDataInfo = String(params.data_info || "");
        if (!canonicalDataInfo.trim() && canonicalMetadataPath) {
          try {
            canonicalDataInfo = await readFile(canonicalMetadataPath, "utf8");
          } catch (error) {
            throw new Error(`Unable to read metadata_json_path '${canonicalMetadataPath}': ${error instanceof Error ? error.message : String(error)}`);
          }
        }
        if (!canonicalMetadataPath && canonicalDataInfo.trim()) {
          const projectDir = resolve(ctx.cwd, params.project_dir);
          if (existsSync(join(projectDir, "project.json"))) {
            throw new Error(`Research project already exists at '${projectDir}'. Use seekbrain_research_continue to create the next round.`);
          }
          canonicalMetadataPath = join(projectDir, "metadata.json");
          let metadataContent: Json;
          try { metadataContent = JSON.parse(canonicalDataInfo); }
          catch { metadataContent = { description: canonicalDataInfo, data_type: "user-provided metadata" }; }
          if (existsSync(canonicalMetadataPath)) {
            const existing = await readFile(canonicalMetadataPath, "utf8");
            if (JSON.stringify(JSON.parse(existing)) !== JSON.stringify(metadataContent)) {
              throw new Error(`Refusing to overwrite existing canonical metadata '${canonicalMetadataPath}'.`);
            }
          } else {
            await deps.writeJson(canonicalMetadataPath, metadataContent);
          }
          canonicalDataInfo = JSON.stringify(metadataContent);
        }
        const created = await deps.lifecycle.startResearch({
          cwd: ctx.cwd,
          projectPath: params.project_dir,
          question: params.question,
          deliverables: params.deliverables,
          metadata: {
            data_info: canonicalMetadataPath ? undefined : canonicalDataInfo || undefined,
            extra_path_info: params.extra_path_info,
            metadata_json_path: canonicalMetadataPath,
            user_background: params.background,
            reference_paths: params.reference_paths,
          },
          deferInitialRound: workflowFlags.research_planning,
        });
        // metadata.json is the single canonical metadata artifact. A second round-local
        // snapshot duplicated the same content without adding execution value.
        const researchPlanningAuto = process.env.SEEKBRAIN_RUN_MODE === "research_planning_auto";
        const explicitPlanningEvidence = verifiedExplicitResearchPlanningRequest(
          params.question,
          params.research_planning_request_quote,
        );
        let researchRoute = workflowFlags.research_planning
          ? await deps.planningWorkflow.assess({
            cwd: ctx.cwd,
            runId: created.run.runId,
            literatureProvider: workflowFlags.literature_provider,
            background: params.background,
            rolePrompt: await deps.readPrompt("research_route"),
            agentConfig: deps.pickAgentConfig(config, "seekbrain_research_route"),
            finalizeSchema: deps.researchRouteSchema(workflowFlags.literature_provider),
            signal,
          })
          : { enabled: false, route: "standard", needs_user_review: false, needs_user_clarification: false, next_tool: "seekbrain_formulation_generate" };
        if (workflowFlags.research_planning && explicitPlanningEvidence && researchRoute.route !== "research_planning") {
          researchRoute = await deps.planningWorkflow.recordAssessment({
            cwd: ctx.cwd,
            runId: created.run.runId,
            assessment: {
              ...researchRoute,
              route: "research_planning",
              route_override: "explicit_user_request",
              reason: researchRoute.reason || "Research Planning was explicitly requested by the user.",
              recommended_action: "Generate the hierarchical research plan after recording the explicit request.",
            },
          });
        }
        if (workflowFlags.research_planning && researchPlanningAuto && researchRoute.route !== "research_planning") {
          researchRoute = await deps.planningWorkflow.recordAssessment({
            cwd: ctx.cwd,
            runId: created.run.runId,
            assessment: {
              ...researchRoute,
              route: "research_planning",
              route_override: "cli_research_planning",
              reason: "Research Planning was selected by the seekbrain run command.",
              recommended_action: "Run the hierarchical workflow in Agent-Full-Auto mode.",
            },
          });
        }
        const creativePlanning = workflowFlags.research_planning_strategy === "creative";
        if (researchRoute.route === "research_planning" && (researchPlanningAuto || (!creativePlanning && explicitPlanningEvidence))) {
          const decision = researchPlanningAuto ? "agent_full_auto" : "yes";
          const source = researchPlanningAuto ? "cli_research_planning" : "explicit_user_request";
          const consentEvidence = researchPlanningAuto ? "--research-planning" : explicitPlanningEvidence;
          const reviewed = await deps.planningWorkflow.recordDecision(ctx.cwd, created.run.runId, decision, source, consentEvidence);
          researchRoute = {
            ...researchRoute,
            ...reviewed,
            needs_user_review: false,
            planning_consent: researchPlanningAuto ? "agent_full_auto" : "explicit_request",
          };
        }
        if (creativePlanning && !researchPlanningAuto && researchRoute.route === "research_planning") {
          researchRoute = {
            ...researchRoute,
            needs_user_review: false,
            planning_consent: "creative_idea_selection_first",
            next_tool: "seekbrain_planning_generate",
          };
        }
        const active = workflowFlags.research_planning && researchRoute.route === "standard"
          ? await deps.lifecycle.materializeInitialRound(ctx.cwd, created.run.runId)
          : created;
        const taskBrief = await resolveRoutedTaskBrief(
          ctx.cwd,
          active.run.runId,
          researchRoute,
          params.question,
          config,
          signal,
        );
        deps.setActiveRunDir(active.run.runDir);
        const startResult = {
          ok: true,
          extension: "seekbrain",
          project_id: active.projectId,
          project_dir: active.projectDir,
          project_manifest_path: active.manifestPath,
          round_number: active.roundNumber,
          round_name: active.roundName,
          run_id: active.run.runId,
          run_dir: active.run.runDir,
          state_path: active.run.statePath,
          ...(active.run.runId !== created.run.runId ? { planning_run_id: created.run.runId, planning_dir: created.run.runDir } : {}),
          metadata_locked: true,
          metadata_json_path: canonicalMetadataPath,
          deliverables: active.run.state.deliverables,
          question: taskBrief?.question || active.run.state.question,
          ...(taskBrief ? {
            task_brief: taskBrief.task_brief,
            task_brief_path: taskBrief.task_brief_path,
            task_brief_reused: taskBrief.reused,
          } : {}),
          workflow_config: effectiveWorkflowConfigResult(config),
          research_route: researchRoute,
          next_tool: researchRoute.next_tool,
        };
        const mismatchAction = researchRoute.route === "needs_clarification"
          ? String(researchRoute.recommended_action || "Verify that the supplied dataset and metadata match the research question, or revise the question.").trim()
          : "";
        return deps.content(startResult, mismatchAction ? [
          "Input clarification is required; stop the workflow before Recipe.",
          `Assessment: ${String(researchRoute.reason || researchRoute.message || "").trim()}`,
          `Required user action: ${mismatchAction}`,
          "End the workflow here. In the assistant response, state the assessment once and then the required user action once, as two concise natural-language sentences. Do not mention internal route names, tools, run IDs, or artifact paths.",
        ].join("\n") : undefined);
      },
      renderResult: renderSeekBrainResult("seekbrain_research_start"),
    }),
    defineTool({
      name: "seekbrain_research_continue",
      label: "Continue Research",
      description: "Create the next independent round in an existing multi-round SeekBrain project. Accepts a project directory or any round directory, works across sessions/days, inherits locked metadata, and exposes prior conclusions/data/code as read-only reusable context.",
      parameters: Type.Object({
        source_path: Type.String({ description: "Existing project directory or a roundN directory supplied by the user." }),
        direction: Type.String({ description: "Accepted suggested direction or the user's own next research question." }),
        deliverables: deliverablesSchema,
      }),
      async execute(_toolCallId, params, signal, _onUpdate, ctx) {
        const config = await deps.loadConfig(ctx.cwd);
        const created = await deps.lifecycle.continueResearch(ctx.cwd, params.source_path, params.direction, params.deliverables);
        const taskBrief = await resolveDirectTaskBrief(ctx.cwd, created.run.runId, config, signal);
        deps.setActiveRunDir(created.run.runDir);
        return deps.content({
          ok: true,
          extension: "seekbrain",
          project_id: created.projectId,
          project_dir: created.projectDir,
          project_manifest_path: created.manifestPath,
          round_number: created.roundNumber,
          round_name: created.roundName,
          parent_round: created.sourceRound.round_number,
          parent_run_id: created.sourceRound.run_id,
          run_id: created.run.runId,
          run_dir: created.run.runDir,
          state_path: created.run.statePath,
          metadata_locked: true,
          inherited_context: created.run.state.inherited_context,
          deliverables: created.run.state.deliverables,
          question: taskBrief.question || created.run.state.question,
          task_brief: taskBrief.task_brief,
          task_brief_path: taskBrief.task_brief_path,
          task_brief_reused: taskBrief.reused,
          workflow_config: workflowConfigResult(config as any),
          guidance: "Continue the normal SeekBrain stages using this new run_id. Reuse prior round artifacts only through inherited_context; write every new output inside the new round directory.",
        });
      },
      renderResult: renderSeekBrainResult("seekbrain_research_continue"),
    }),
    defineTool({
      name: "seekbrain_run_start",
      label: "Start Analysis Run",
      description: "Create a new SeekBrain run at the required work_dir. The main agent must choose fallback paths such as results/default/{timestamp}. Returns run_id for all subsequent tools. Optionally pass question to persist the task text in state.json. Optionally pass deliverables to declare expected output artifacts (path/kind/role); if omitted, a default set (generated_code.py, figure.png, figure.pdf, statistics.json) is injected. code and statistics infrastructure artifacts are always ensured.",
      parameters: Type.Object({
        work_dir: Type.String({ description: "Run directory. Prefer relative fallback paths such as results/default/{timestamp}; preserve explicit user-provided absolute paths." }),
        question: Type.Optional(Type.String({ description: "Research question or task text to persist in state.json." })),
        deliverables: deliverablesSchema,
      }),
      async execute(_toolCallId, params, signal, _onUpdate, ctx) {
        const config = await deps.loadConfig(ctx.cwd);
        const run = await deps.startRun(ctx.cwd, params.work_dir, params.deliverables, params.question);
        const taskBrief = await resolveDirectTaskBrief(ctx.cwd, run.runId, config, signal);
        deps.setActiveRunDir(run.runDir);
        return deps.content({
          ok: true,
          extension: "seekbrain",
          run_id: run.runId,
          run_dir: run.runDir,
          deliverables: run.state.deliverables,
          question: taskBrief.question || run.state.question,
          task_brief: taskBrief.task_brief,
          task_brief_path: taskBrief.task_brief_path,
          task_brief_reused: taskBrief.reused,
          workflow_config: workflowConfigResult(config as any),
        });
      },
      renderResult: renderSeekBrainResult("seekbrain_run_start"),
    }),
    defineTool({
      name: "seekbrain_run_resume",
      label: "Resume Analysis Run",
      description: "Resume an existing SeekBrain run without creating a new run. Reads run_id from work_dir/state.json. Optionally pass question to replace the persisted task text; the previous question is appended to question_history. After resuming, read state.json for full run status. Use for recovery/continuation or interactive follow-up on an existing work_dir.",
      parameters: Type.Object({
        work_dir: Type.String({ description: "Existing run directory to resume. Preserve explicit absolute paths." }),
        question: Type.Optional(Type.String({ description: "Updated research question or follow-up instruction to persist in state.json." })),
      }),
      async execute(_toolCallId, params, signal, _onUpdate, ctx) {
        const config = await deps.loadConfig(ctx.cwd);
        const run = await deps.resumeRun(ctx.cwd, params.work_dir, params.question);
        const taskBrief = await resolveDirectTaskBrief(ctx.cwd, run.runId, config, signal);
        deps.setActiveRunDir(run.runDir);
        return deps.content({
          ok: true,
          extension: "seekbrain",
          run_id: run.runId,
          run_dir: run.runDir,
          question: taskBrief.question || run.state.question,
          state_path: run.statePath,
          task_brief: taskBrief.task_brief,
          task_brief_path: taskBrief.task_brief_path,
          task_brief_reused: taskBrief.reused,
          workflow_config: workflowConfigResult(config as any),
        });
      },
      renderResult: renderResumeRunResult,
    }),
  ];
}

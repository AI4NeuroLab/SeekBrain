import { defineTool } from "@earendil-works/pi-coding-agent";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { Type } from "typebox";
import {
  verifiedExplicitResearchPlanningRequest,
  workflowConfigResult,
  type ResearchPlanningWorkflow,
  type RunLifecycleWorkflow,
  type WorkflowRunContext,
} from "../../../workflows/index.ts";
import { renderResumeRunResult, renderSeekBrainResult } from "../../tui/compact-tool-results.ts";
import type { Json, SeekBrainToolDefinition } from "../runtime-types.ts";

export interface LifecycleToolDependencies {
  lifecycle: RunLifecycleWorkflow;
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

export function createLifecycleTools(deps: LifecycleToolDependencies): SeekBrainToolDefinition[] {
  return [
    defineTool({
      name: "seekbrain_research_start",
      label: "Start Research",
      description: "Start a multi-round SeekBrain project and record the main Orchestrator's lightweight Planning assessment, with an internal compatibility fallback when no assessment is supplied. The direct analysis workflow materializes project_dir/round1; Research Planning keeps parent state under project_dir/planning and creates only child analysis-task rounds. Pass metadata_json_path when metadata already exists; the tool reads and locks its content internally.",
      parameters: Type.Object({
        project_dir: Type.String({ description: "Stable project-ID directory. Round outputs are created below it as round1, round2, ..." }),
        question: Type.String({ description: "Research question for round1." }),
        background: Type.Optional(Type.String({ description: "Optional scientific background supplied by the user. It is incorporated into the Research Survey and downstream Research Planning context." })),
        data_info: Type.Optional(Type.String({ description: "Inline canonical metadata content. Omit this when metadata_json_path is available; it is inherited unchanged by later rounds." })),
        extra_path_info: Type.Optional(Type.String({ description: "Canonical path/access notes. They are inherited unchanged by later rounds." })),
        metadata_json_path: Type.Optional(Type.String({ description: "Canonical metadata JSON path for this project. The tool reads and locks the file content internally." })),
        planning_assessment: Type.Optional(Type.Object({
          route: Type.Union([Type.Literal("standard"), Type.Literal("research_planning"), Type.Literal("needs_clarification")]),
          reason: Type.String(),
          dataset_summary: Type.Optional(Type.String()),
          question_requirements: Type.Optional(Type.String()),
          recommended_action: Type.Optional(Type.String()),
          evidence_dimensions: Type.Optional(Type.Array(Type.String())),
          inferred_background: Type.Optional(Type.String()),
          inferred_scientific_goal: Type.Optional(Type.String()),
          literature_queries: Type.Optional(Type.Array(Type.String(), { maxItems: 3 })),
          explicit_request_quote: Type.Optional(Type.String({ description: "Exact quote from the current user request that explicitly asks for Research Planning by name. Omit when Research Planning is only recommended or discussed." })),
        }, { description: "Compact Planning assessment prepared by the main Orchestrator from the current question and resolved dataset metadata. Supplying it avoids a separate routing-agent call." })),
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
          },
          deferInitialRound: workflowFlags.research_planning,
        });
        // metadata.json is the single canonical metadata artifact. A second round-local
        // snapshot duplicated the same content without adding execution value.
        const suppliedAssessment = params.planning_assessment as Json | undefined;
        const explicitPlanningEvidence = verifiedExplicitResearchPlanningRequest(params.question, suppliedAssessment?.explicit_request_quote);
        let researchRoute = workflowFlags.research_planning
          ? suppliedAssessment
            ? await deps.planningWorkflow.recordAssessment({
              cwd: ctx.cwd,
              runId: created.run.runId,
              assessment: { ...suppliedAssessment, route: explicitPlanningEvidence ? "research_planning" : suppliedAssessment.route },
            })
            : await deps.planningWorkflow.assess({
              cwd: ctx.cwd,
              runId: created.run.runId,
              literatureProvider: workflowFlags.literature_provider,
              background: params.background,
              rolePrompt: await deps.readPrompt("research_route"),
              agentConfig: deps.pickAgentConfig(config, "seekbrain_research_route"),
              finalizeSchema: deps.researchRouteSchema(workflowFlags.literature_provider),
              signal,
            })
          : { enabled: false, route: "standard", needs_user_review: false, needs_user_clarification: false, next_tool: "seekbrain_recipe_retrieve" };
        if (researchRoute.route === "research_planning" && explicitPlanningEvidence) {
          const reviewed = await deps.planningWorkflow.recordDecision(ctx.cwd, created.run.runId, "yes", "explicit_user_request", explicitPlanningEvidence);
          researchRoute = { ...researchRoute, ...reviewed, needs_user_review: false, planning_consent: "explicit_request" };
        }
        const active = workflowFlags.research_planning && researchRoute.route === "standard"
          ? await deps.lifecycle.materializeInitialRound(ctx.cwd, created.run.runId)
          : created;
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
          question: active.run.state.question,
          workflow_config: workflowConfigResult(config as any),
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
      async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
        const config = await deps.loadConfig(ctx.cwd);
        const created = await deps.lifecycle.continueResearch(ctx.cwd, params.source_path, params.direction, params.deliverables);
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
          question: created.run.state.question,
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
      async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
        const config = await deps.loadConfig(ctx.cwd);
        const run = await deps.startRun(ctx.cwd, params.work_dir, params.deliverables, params.question);
        deps.setActiveRunDir(run.runDir);
        return deps.content({ ok: true, extension: "seekbrain", run_id: run.runId, run_dir: run.runDir, deliverables: run.state.deliverables, question: run.state.question, workflow_config: workflowConfigResult(config as any) });
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
      async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
        const config = await deps.loadConfig(ctx.cwd);
        const run = await deps.resumeRun(ctx.cwd, params.work_dir, params.question);
        deps.setActiveRunDir(run.runDir);
        return deps.content({ ok: true, extension: "seekbrain", run_id: run.runId, run_dir: run.runDir, question: run.state.question, state_path: run.statePath, workflow_config: workflowConfigResult(config as any) });
      },
      renderResult: renderResumeRunResult,
    }),
  ];
}

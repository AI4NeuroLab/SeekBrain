import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { Value } from "typebox/value";
import { ArtifactService, ExecutionContractSchema, type Artifact } from "../../core/index.ts";
import type { StageAgentResult } from "./research-skill-workflow.ts";
import type { RunLifecycleWorkflow, WorkflowJson, WorkflowRunContext } from "./run-lifecycle.ts";

const VISION_IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

export interface ValidateWorkflowDependencies {
  lifecycle: RunLifecycleWorkflow;
  loadImages(paths: string[]): Promise<{ images: WorkflowJson[]; warnings: string[] }>;
  runAgent(input: {
    runDir: string;
    prompt: string;
    agentConfig: WorkflowJson;
    finalizeSchema: unknown;
    images: WorkflowJson[];
    signal?: AbortSignal;
  }): Promise<StageAgentResult>;
  normalize(result: WorkflowJson | undefined, context: WorkflowJson): WorkflowJson;
  nextStep(validation: WorkflowJson, runId: string, figurePath: string): WorkflowJson;
  writeJson(path: string, value: WorkflowJson): Promise<void>;
  snapshot(run: WorkflowRunContext, label: string): Promise<unknown>;
  appendEvent(event: WorkflowJson): Promise<void>;
  handleRecipeFeedback?(input: {
    runDir: string;
    state: WorkflowJson;
    validation: WorkflowJson;
    enabled: boolean;
    budget: number;
    generatedOnly: boolean;
    signal?: AbortSignal;
  }): Promise<{ state_patch: WorkflowJson; validation_patch: WorkflowJson } | undefined>;
}

export interface ValidateWorkflowInput {
  cwd: string;
  runId: string;
  rolePrompt: string;
  agentConfig: WorkflowJson;
  finalizeSchema: unknown;
  maxCodeAttempts: number;
  imageRefineEnabled: boolean;
  recipeRevision?: { enabled?: boolean; budget?: number; generated_only?: boolean };
  signal?: AbortSignal;
}

function resolveQuestion(run: WorkflowRunContext): string {
  const value = String(run.state.question || "").trim();
  if (!value) throw new Error("question is missing from state.json");
  return value;
}

function finalizationPrompt(rolePrompt: string, body: string): string {
  return [
    rolePrompt.trim(),
    "",
    "You are the isolated SeekBrain Validation Agent.",
    "Return only by calling the finalize tool. Do not expose scratch reasoning.",
    "Required final tool: finalize_validation",
    "",
    body,
  ].join("\n");
}

function statisticsPath(run: WorkflowRunContext): string {
  return String(run.state.code?.statistics_path || join(run.runDir, "statistics.json"));
}

async function readExecutionContract(run: WorkflowRunContext): Promise<WorkflowJson | undefined> {
  if (Value.Check(ExecutionContractSchema, run.state.execution_contract)) {
    return run.state.execution_contract as WorkflowJson;
  }
  const path = String(run.state.execution_contract_path || join(run.runDir, "execution_contract.json"));
  try {
    const parsed = JSON.parse(await readFile(path, "utf8"));
    return Value.Check(ExecutionContractSchema, parsed) ? parsed as WorkflowJson : undefined;
  } catch {
    return undefined;
  }
}

function codeFilePaths(run: WorkflowRunContext, artifacts: ArtifactService): string[] {
  const declared: string[] = Array.isArray(run.state.code?.code_files)
    ? run.state.code.code_files.map((entry: WorkflowJson) => String(entry?.path || "")).filter(Boolean)
    : [];
  const fallback: string[] = artifacts.normalizeMany(run.state.artifacts || [])
    .filter((artifact) => artifact.kind === "code")
    .map((artifact) => String(artifact.path));
  return [...new Set((declared.length ? declared : fallback).map((path: string) => artifacts.paths.resolve(path)))];
}

function visionFigures(run: WorkflowRunContext, artifacts: ArtifactService): Artifact[] {
  const isActualVisionFigure = (artifact: Artifact) => artifact.kind === "figure"
    && VISION_IMAGE_EXTENSIONS.has(extname(artifact.path).toLowerCase())
    && existsSync(artifacts.paths.resolve(artifact.path));
  const indexed = artifacts.normalizeMany(run.state.artifacts || []).filter(isActualVisionFigure);
  if (indexed.length) return indexed;
  return artifacts.normalizeMany(run.state.deliverables || []).filter(isActualVisionFigure);
}

export class ValidateWorkflow {
  constructor(readonly dependencies: ValidateWorkflowDependencies) {}

  async execute(input: ValidateWorkflowInput): Promise<WorkflowJson> {
    const run = await this.dependencies.lifecycle.resolveRun(input.cwd, input.runId);
    const planPath = String(run.state.plan?.path || join(run.runDir, "plan.md"));
    const question = resolveQuestion(run);
    const artifacts = new ArtifactService(run.runDir);
    const codePaths = codeFilePaths(run, artifacts);
    const statsPath = statisticsPath(run);
    const codeWarnings = Array.isArray(run.state.code?.warnings) ? run.state.code.warnings.map(String).filter(Boolean) : [];
    const codeContext = {
      warnings: codeWarnings,
      confidence: run.state.code?.confidence ?? null,
    };
    const recipeContext = {
      source: run.state.targeted_skill_result?.source || "none",
      recipe_path: run.state.targeted_skill_path || "",
      recipe_ids: Array.isArray(run.state.targeted_skill_result?.recipe_set?.selected)
        ? run.state.targeted_skill_result.recipe_set.selected.map((item: WorkflowJson) => String(item.recipe_id || "")).filter(Boolean)
        : [],
      recipe_status: run.state.targeted_skill_result?.recipe_status || null,
      method_contract: String(run.state.targeted_skill_result?.method_contract || "").slice(0, 5000),
    };
    const figures = visionFigures(run, artifacts);
    if (input.agentConfig.vision !== true && (figures.length > 0 || run.state.flow_version !== "0.1.4")) {
      return {
        ok: false,
        run_id: run.runId,
        error: "configuration issue: seekbrain_validation_run requires vision=true. Report this to the user; do not edit seekbrain.config.yaml unless explicitly asked.",
        figure_paths: figures.map((artifact) => artifact.path),
      };
    }
    if (!figures.length && run.state.flow_version !== "0.1.4") {
      return { ok: false, run_id: run.runId, error: "seekbrain_validation_run requires at least one actual vision figure artifact from seekbrain_code_execute" };
    }
    const vision = await this.dependencies.loadImages(figures.map((artifact) => artifact.path));
    if (figures.length && !vision.images.length) return { ok: false, run_id: run.runId, error: "failed to load validation images", warnings: vision.warnings };

    const figuresText = figures.map((artifact, index) => `(${index + 1}) ${artifact.path}${artifact.role ? ` [${artifact.role}]` : ""}${artifact.description ? ` — ${artifact.description}` : ""}`).join("\n");
    const executionContract = await readExecutionContract(run);
    const prompt = finalizationPrompt(input.rolePrompt, [
      `Question:\n${question}`,
      run.state.task_brief ? `TaskBrief:\n${JSON.stringify(run.state.task_brief, null, 2)}` : "",
      executionContract
        ? `Execution contract (authoritative validation target):\n${JSON.stringify(executionContract, null, 2)}`
        : "Execution contract: unavailable for this legacy run; use the approved Plan as the validation target.",
      `Figures (${figures.length}):\n${figuresText}`,
      `Approved plan path:\n${planPath}`,
      `Generated code paths:\n${codePaths.length ? codePaths.join("\n") : "None recorded."}`,
      `Statistics file:\n${statsPath}`,
      `Code warnings and confidence:\n${JSON.stringify(codeContext, null, 2)}`,
      `Recipe selection and contract:\n${JSON.stringify(recipeContext, null, 2)}`,
      `Presentation refinement available: ${input.imageRefineEnabled ? "yes" : "no"}`,
      "Finalize with facts only. figure_observations records concise, directly visible scientific patterns for the text-only Interpretation stage. When presentation refinement is unavailable, record material ambiguity as a methodological caveat and leave visual_issues empty. The extension selects the next action.",
      "Evaluate every execution_contract requirement and validation_check against the readable code, statistics, and figures. Recipe selection is provenance for method feedback only; never fail or pass the analysis based on Recipe R coverage or the number of selected repositories.",
      "When a Recipe was selected, optionally emit recipe_feedback. Distinguish recipe_defect, retrieval_mismatch, implementation_defect, data_mismatch, environment, and inconclusive. Attribute recipe_defect only when an exact Recipe instruction or omission causally contributed; code that ignored correct Recipe guidance is implementation_defect. Name one recipe_id, cite observable evidence, and record already-passing checks in preserve. Do not rewrite the Recipe yourself.",
      "Finalize with: { pass, per_figure: [{ path, pass, issues }], overall_mismatches, blocking_issues, methodological_caveats, figure_observations, visual_issues: [{ figure_path, feedback }], confidence, summary }. Include every required field. Use empty arrays when there are no findings.",
    ].filter(Boolean).join("\n\n"));
    const agent = await this.dependencies.runAgent({
      runDir: run.runDir,
      prompt,
      agentConfig: input.agentConfig,
      finalizeSchema: input.finalizeSchema,
      images: vision.images,
      signal: input.signal,
    });
    let validationResult = agent.result;
    let nextStep: WorkflowJson | undefined;
    let revisionStatePatch: WorkflowJson = {};
    const validationPath = join(run.runDir, "validation.json");
    if (agent.ok) {
      validationResult = this.dependencies.normalize(agent.result, {
        codeAttempt: Number(run.state.code_attempt || 0),
        refinementCount: Number(run.state.image_refinement_count || 0),
        maxCodeAttempts: input.maxCodeAttempts,
        imageRefineEnabled: input.imageRefineEnabled,
      });
      const revision = await this.dependencies.handleRecipeFeedback?.({
        runDir: run.runDir,
        state: run.state,
        validation: validationResult,
        enabled: input.recipeRevision?.enabled === true,
        budget: Number(input.recipeRevision?.budget ?? 1),
        generatedOnly: input.recipeRevision?.generated_only !== false,
        signal: input.signal,
      });
      if (revision) {
        validationResult = { ...validationResult, ...revision.validation_patch };
        revisionStatePatch = revision.state_patch;
      }
      nextStep = this.dependencies.nextStep(validationResult, run.runId, figures[0]?.path || "");
      await this.dependencies.writeJson(validationPath, validationResult);
      const recipeFeedbackPath = validationResult.recipe_feedback ? join(run.runDir, "recipe_feedback.json") : undefined;
      if (recipeFeedbackPath) await this.dependencies.writeJson(recipeFeedbackPath, validationResult.recipe_feedback);
      await this.dependencies.lifecycle.updateState(run, {
        validation: validationResult,
        validations: validationResult.per_figure,
        ...(validationResult.recipe_feedback ? { recipe_feedback: validationResult.recipe_feedback, recipe_feedback_path: recipeFeedbackPath } : {}),
        ...revisionStatePatch,
        validation_invalidated_by_code_edit: false,
        refinement_pending_validation: false,
      });
      await this.dependencies.snapshot(run, "after_validate");
    }
    await this.dependencies.appendEvent({ run_id: run.runId, event: "seekbrain_validation_run", ok: agent.ok, pass: validationResult?.pass, route: validationResult?.route });
    return {
      run_id: run.runId,
      ok: agent.ok,
      error: agent.error,
      result: validationResult,
      next_step: nextStep,
      validation_path: agent.ok ? validationPath : undefined,
      output_path: agent.output_path,
      debug: { subagent_dir: agent.subagent_dir, snapshot_dir: agent.snapshot_dir },
    };
  }
}

import { extname, join } from "node:path";
import { ArtifactService, type Artifact } from "../../core/index.ts";
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
}

export interface ValidateWorkflowInput {
  cwd: string;
  runId: string;
  question?: string;
  figurePath?: string;
  statistics?: unknown;
  additionalContext?: string;
  rolePrompt: string;
  agentConfig: WorkflowJson;
  finalizeSchema: unknown;
  maxCodeAttempts: number;
  signal?: AbortSignal;
}

function resolveQuestion(run: WorkflowRunContext, requested?: string): string {
  const value = String(requested || run.state.question || "").trim();
  if (!value) throw new Error("question is required. Pass it to the tool, or persist it first via neuro_start_run/neuro_resume_run.");
  return value;
}

function finalizationPrompt(rolePrompt: string, body: string): string {
  return [
    rolePrompt.trim(),
    "",
    "You are the isolated SeekBrain validator subagent.",
    "Return only by calling the finalize tool. Do not expose scratch reasoning.",
    "Required final tool: finalize_validation",
    "",
    body,
  ].join("\n");
}

function additionalContextBlock(value?: string): string {
  const text = String(value || "").trim();
  return text ? `Additional context from the main agent:\n${text}` : "";
}

function visionFigures(run: WorkflowRunContext, artifacts: ArtifactService): Artifact[] {
  return artifacts.normalizeMany(run.state.artifacts || [])
    .filter((artifact) => artifact.kind === "figure" && VISION_IMAGE_EXTENSIONS.has(extname(artifact.path).toLowerCase()));
}

export class ValidateWorkflow {
  constructor(readonly dependencies: ValidateWorkflowDependencies) {}

  async execute(input: ValidateWorkflowInput): Promise<WorkflowJson> {
    const run = await this.dependencies.lifecycle.resolveRun(input.cwd, input.runId);
    const question = resolveQuestion(run, input.question);
    const artifacts = new ArtifactService(run.runDir);
    let figures = visionFigures(run, artifacts);
    if (input.figurePath) {
      const requested = artifacts.paths.resolve(input.figurePath);
      figures = figures.filter((artifact) => artifact.path === requested);
    }
    if (input.agentConfig.vision !== true) {
      return {
        ok: false,
        run_id: run.runId,
        error: "configuration issue: neuro_validate requires vision=true. Report this to the user; do not edit seekbrain.config.yaml unless explicitly asked.",
        figure_paths: figures.map((artifact) => artifact.path),
      };
    }
    if (!figures.length) {
      if (!input.figurePath) return { ok: false, run_id: run.runId, error: "neuro_validate requires at least one actual vision figure artifact from neuro_code" };
      figures = [artifacts.make("figure", input.figurePath, "figure")];
    }
    const vision = await this.dependencies.loadImages(figures.map((artifact) => artifact.path));
    if (!vision.images.length) return { ok: false, run_id: run.runId, error: "failed to load validation images", warnings: vision.warnings };

    const figuresText = figures.map((artifact, index) => `(${index + 1}) ${artifact.path}${artifact.role ? ` [${artifact.role}]` : ""}${artifact.description ? ` — ${artifact.description}` : ""}`).join("\n");
    const prompt = finalizationPrompt(input.rolePrompt, [
      `Question:\n${question}`,
      `Figures (${figures.length}):\n${figuresText}`,
      `Plan:\n${run.state.plan?.plan_markdown || ""}`,
      `Deep research context:\n${run.state.deep_research_context || ""}`,
      `Statistics:\n${JSON.stringify(input.statistics || run.state.code?.statistics || {}, null, 2)}`,
      additionalContextBlock(input.additionalContext),
      "Finalize with facts only: { pass, per_figure, overall_mismatches, blocking_issues, methodological_caveats, visual_issues, confidence, summary }. per_figure must contain { path, pass, issues } for every figure. visual_issues contains at most one highest-priority { figure_path, feedback }. The extension, not the validator, selects the next workflow action.",
    ].join("\n\n"));
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
    const validationPath = join(run.runDir, "validation.json");
    if (agent.ok) {
      validationResult = this.dependencies.normalize(agent.result, {
        codeAttempt: Number(run.state.code_attempt || 0),
        refinementCount: Number(run.state.image_refinement_count || 0),
        maxCodeAttempts: input.maxCodeAttempts,
      });
      nextStep = this.dependencies.nextStep(validationResult, run.runId, figures[0]?.path || "");
      await this.dependencies.writeJson(validationPath, validationResult);
      await this.dependencies.lifecycle.updateState(run, {
        validation: validationResult,
        validations: validationResult.per_figure,
        validation_invalidated_by_code_edit: false,
        refinement_pending_validation: false,
      });
      await this.dependencies.snapshot(run, "after_validate");
    }
    await this.dependencies.appendEvent({ run_id: run.runId, event: "neuro_validate", ok: agent.ok, pass: validationResult?.pass, route: validationResult?.route });
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

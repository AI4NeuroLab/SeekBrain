import { extname, join } from "node:path";
import { ArtifactService, type Artifact } from "../../core/index.ts";
import type { StageAgentResult } from "./research-skill-workflow.ts";
import type { RunLifecycleWorkflow, WorkflowJson, WorkflowRunContext } from "./run-lifecycle.ts";

const VISION_IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

export interface RefinementIntegrity {
  accepted: boolean;
  violations: string[];
}

export interface ImageWorkflowDependencies {
  lifecycle: RunLifecycleWorkflow;
  loadImages(paths: string[]): Promise<{ images: WorkflowJson[]; warnings: string[] }>;
  runRefiner(input: AgentInput): Promise<StageAgentResult>;
  createGuard(run: WorkflowRunContext): Promise<unknown>;
  finalizeGuard(guard: unknown, succeeded: boolean): Promise<RefinementIntegrity>;
  fastPass(validation: WorkflowJson, refinement: WorkflowJson | undefined, context: WorkflowJson): { allowed: boolean; validation: WorkflowJson };
  nextStep(validation: WorkflowJson, runId: string, figurePath: string): WorkflowJson;
  writeJson(path: string, value: WorkflowJson): Promise<void>;
  snapshot(run: WorkflowRunContext, label: string): Promise<unknown>;
  appendEvent(event: WorkflowJson): Promise<void>;
}

interface AgentInput {
  runDir: string;
  prompt: string;
  agentConfig: WorkflowJson;
  finalizeSchema: unknown;
  images: WorkflowJson[];
  signal?: AbortSignal;
}

export interface RefineImageInput {
  cwd: string;
  runId: string;
  question?: string;
  figurePath?: string;
  feedback?: string;
  additionalContext?: string;
  rolePrompt: string;
  agentConfig: WorkflowJson;
  finalizeSchema: unknown;
  enabled: boolean;
  signal?: AbortSignal;
}

function resolveQuestion(run: WorkflowRunContext, requested?: string): string {
  const value = String(requested || run.state.question || "").trim();
  if (!value) throw new Error("question is required. Pass it to the tool, or persist it first via seekbrain_run_start/seekbrain_run_resume.");
  return value;
}

function finalizationPrompt(agentName: string, finalizeTool: string, rolePrompt: string, body: string): string {
  return [rolePrompt.trim(), "", `You are the isolated SeekBrain ${agentName}.`, "Return only by calling the finalize tool. Do not expose scratch reasoning.", `Required final tool: ${finalizeTool}`, "", body].join("\n");
}

function additionalContextBlock(value?: string): string {
  const text = String(value || "").trim();
  return text ? `Additional context from the main agent:\n${text}` : "";
}

function skipped(runId: string, tool: string, key: string): WorkflowJson {
  return { ok: true, skipped: true, skipped_by_config: true, reason: "disabled_by_user_config", message: `${tool} is disabled by user configuration workflow.seekbrain.${key}; this is not a tool failure.`, run_id: runId, config_key: `workflow.seekbrain.${key}` };
}

function figures(run: WorkflowRunContext, service: ArtifactService): Artifact[] {
  return service.normalizeMany(run.state.artifacts || []).filter((artifact) => artifact.kind === "figure" && VISION_IMAGE_EXTENSIONS.has(extname(artifact.path).toLowerCase()));
}

function codeForFigure(service: ArtifactService, artifacts: Artifact[], figurePath: string): { codePath: string; ambiguous: boolean } {
  const targetPath = service.paths.resolve(figurePath);
  const target = artifacts.find((artifact) => artifact.path === targetPath || artifact.path === figurePath);
  if (target?.produced_by) return { codePath: target.produced_by, ambiguous: false };
  const codeArtifacts = artifacts.filter((artifact) => artifact.kind === "code");
  if (codeArtifacts.length === 1) return { codePath: codeArtifacts[0].path, ambiguous: false };
  return { codePath: codeArtifacts.map((artifact) => artifact.path).join(", "), ambiguous: codeArtifacts.length > 1 };
}

export class ImageWorkflow {
  constructor(readonly dependencies: ImageWorkflowDependencies) {}

  async refine(input: RefineImageInput): Promise<WorkflowJson> {
    const run = await this.dependencies.lifecycle.resolveRun(input.cwd, input.runId);
    const question = resolveQuestion(run, input.question);
    if (!input.enabled) return skipped(run.runId, "seekbrain_figure_refine", "image_refine");
    const validation = run.state.validation || null;
    const refinementCount = Number(run.state.image_refinement_count || 0);
    if (validation?.pass !== true || validation?.route !== "refine_image") return { ok: false, run_id: run.runId, blocked_by_validation_policy: true, error: "Figure Refinement is allowed only after a passing Validation selects one presentation-only target." };
    if (refinementCount >= 1) return { ok: false, run_id: run.runId, blocked_by_validation_policy: true, error: "The single Figure Refinement allowance for this round has already been used.", guidance: "Continue to Result Interpretation and report any remaining visual issue as a limitation." };
    const authorizedFigure = String(validation.refine_target?.figure_path || "").trim();
    const requestedFigure = String(input.figurePath || authorizedFigure).trim();
    const feedback = String(input.feedback || validation.refinement_feedback || "").trim();
    if (!requestedFigure || !feedback) return { ok: false, run_id: run.runId, blocked_by_validation_policy: true, error: "Validation must provide a concrete figure path and non-empty visual feedback." };
    const service = new ArtifactService(run.runDir);
    if (authorizedFigure && service.paths.resolve(authorizedFigure) !== service.paths.resolve(requestedFigure)) return { ok: false, run_id: run.runId, blocked_by_validation_policy: true, error: "The requested figure does not match the visual target authorized by Validation.", authorized_figure_path: authorizedFigure };
    if (input.agentConfig.vision !== true) return { ok: false, run_id: run.runId, error: "configuration issue: seekbrain_figure_refine requires vision=true. Report this to the user; do not edit seekbrain.config.yaml unless explicitly asked.", figure_path: requestedFigure };
    const figurePath = service.paths.resolve(requestedFigure);
    const vision = await this.dependencies.loadImages([figurePath]);
    if (!vision.images.length) return { ok: false, run_id: run.runId, error: "failed to load refinement image", warnings: vision.warnings };
    const allFigures = figures(run, service);
    const index = allFigures.findIndex((artifact) => artifact.path === figurePath);
    const otherFigures = allFigures.filter((_, itemIndex) => itemIndex !== index).map((artifact) => artifact.path);
    const multiFigureContext = allFigures.length > 1 ? `Multi-figure context: This run produced ${allFigures.length} figures. Refine only figure ${(index < 0 ? 0 : index) + 1}: ${requestedFigure}. Other figures: ${otherFigures.join(", ")}. Cross-figure synthesis remains the responsibility of downstream stages.` : "";
    const stateArtifacts = service.normalizeMany(run.state.artifacts || []);
    const { codePath, ambiguous } = codeForFigure(service, stateArtifacts, figurePath);
    const codePathNote = ambiguous ? `The code that generates this figure is in one of these scripts: ${codePath}. Read the candidates, identify the producing script, and modify only the script that generates ${requestedFigure}.` : `Code that generates this figure: ${codePath}`;
    const prompt = finalizationPrompt("Figure Refinement stage agent", "finalize_refinement", input.rolePrompt, [
      `Question:\n${question}`,
      `Figure path:\n${requestedFigure}`,
      multiFigureContext,
      codePathNote,
      `Feedback:\n${feedback}`,
      additionalContextBlock(input.additionalContext),
      "Read the code identified above and modify only the rendering function or plotting section that generates this figure. Permitted changes are limited to presentation defects such as layout, clipping, overlap, spacing, typography, labels, and legends. Do not alter data, statistics, analysis methods, model parameters, thresholds, or scientific selection criteria. Prefer existing analysis artifacts or naturally persisted intermediate results, and use the least computationally expensive safe redraw path supported by the code. Avoid reloading large source datasets or rerunning the complete analysis. If safe redraw from existing outputs is not possible, rerun the complete analysis only when its cost is reasonable and no narrower path exists; otherwise record the limitation in remaining_issues and stop. Overwrite figure_path in place and do not create figure_refine.png.",
      "Finalize with: { refined_code_patch, refined_figure_path, summary, remaining_issues, stop }. refined_figure_path must equal the original figure_path.",
    ].join("\n\n"));
    const guard = await this.dependencies.createGuard(run);
    const agent = await this.dependencies.runRefiner({ runDir: run.runDir, prompt, agentConfig: input.agentConfig, finalizeSchema: input.finalizeSchema, images: vision.images, signal: input.signal });
    const integrity = await this.dependencies.finalizeGuard(guard, agent.ok);
    const ok = agent.ok && integrity.accepted;
    const attemptedCount = refinementCount + 1;
    let fastValidation: WorkflowJson | undefined;
    let nextStep: WorkflowJson | undefined;
    if (ok) {
      const fastPass = this.dependencies.fastPass(validation, agent.result, { integrityAccepted: integrity.accepted, codeAttempt: Number(run.state.code_attempt || 0) });
      if (!fastPass.allowed) return { ok: false, run_id: run.runId, error: "Figure Refinement completed but did not meet the narrow fast-pass policy.", guidance: "Run seekbrain_validation_run before Result Interpretation." };
      fastValidation = { ...fastPass.validation, refined_fast_pass_at: new Date().toISOString() };
      nextStep = this.dependencies.nextStep(fastValidation, run.runId, figurePath);
      const refinements = Array.isArray(run.state.refinements) ? run.state.refinements : [];
      await this.dependencies.writeJson(join(run.runDir, "validation.json"), fastValidation);
      await this.dependencies.lifecycle.updateState(run, { refinement: agent.result, refinements: [...refinements, agent.result], image_refinement_count: attemptedCount, pre_refinement_validation: validation, validation: fastValidation, validations: fastValidation.per_figure, validation_invalidated_by_code_edit: false, refinement_pending_validation: false, refinement_fast_pass: true });
      await this.dependencies.snapshot(run, "after_refine");
    } else {
      const reason = integrity.violations.length
        ? `The presentation-only refinement changed immutable artifacts and was rolled back: ${integrity.violations.join(", ")}`
        : agent.error || "The presentation-only refinement did not complete; guarded artifacts were rolled back.";
      const caveat = `Presentation-only refinement was attempted once but failed and was rolled back. The original validated artifacts were retained. Remaining presentation issue: ${feedback}`;
      const failedValidation = {
        ...validation,
        route: "proceed",
        refinement_feedback: "",
        refine_target: null,
        methodological_caveats: [...new Set([
          ...(Array.isArray(validation?.methodological_caveats) ? validation.methodological_caveats.map(String) : []),
          caveat,
        ])],
        refinement_attempted: true,
        refinement_failed: true,
        refinement_failure: {
          reason,
          rolled_back: true,
          integrity_violations: integrity.violations,
          attempted_at: new Date().toISOString(),
        },
      };
      const attempts = Array.isArray(run.state.refinement_attempts) ? run.state.refinement_attempts : [];
      await this.dependencies.writeJson(join(run.runDir, "validation.json"), failedValidation);
      await this.dependencies.lifecycle.updateState(run, {
        image_refinement_count: attemptedCount,
        refinement_attempts: [...attempts, { ok: false, result: agent.result, ...failedValidation.refinement_failure }],
        pre_refinement_validation: validation,
        validation: failedValidation,
        validations: failedValidation.per_figure,
        validation_invalidated_by_code_edit: false,
        refinement_pending_validation: false,
        refinement_fast_pass: false,
      });
      await this.dependencies.snapshot(run, "after_refine_failure");
      fastValidation = failedValidation;
      nextStep = this.dependencies.nextStep(failedValidation, run.runId, figurePath);
    }
    await this.dependencies.appendEvent({ run_id: run.runId, event: "seekbrain_figure_refine", ok, fast_pass: ok, integrity_violations: integrity.violations, image_refinement_count: attemptedCount, next_step: nextStep });
    return {
      run_id: run.runId,
      ok,
      error: integrity.violations.length ? `Figure Refinement changed immutable data/statistics artifacts and was rolled back: ${integrity.violations.join(", ")}` : agent.error,
      result: agent.result,
      validation: fastValidation,
      fast_pass: ok,
      integrity_violations: integrity.violations,
      refined_figure_path: ok ? agent.result?.refined_figure_path || figurePath : undefined,
      next_step: nextStep,
      guidance: ok
        ? "Presentation-only Figure Refinement passed the immutable-artifact guard. Scientific validation was reused; no diff review or second Validation is required."
        : "The one allowed Figure Refinement attempt was consumed and rolled back. The original artifacts remain scientifically validated; continue directly to seekbrain_interpretation_run and report the remaining presentation issue as a limitation. Do not run Validation or Figure Refinement again.",
      output_path: agent.output_path,
      debug: { subagent_dir: agent.subagent_dir, snapshot_dir: agent.snapshot_dir },
    };
  }
}

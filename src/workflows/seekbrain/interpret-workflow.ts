import { basename, extname, join } from "node:path";
import { ArtifactService, type Artifact } from "../../core/index.ts";
import type { StageAgentResult } from "./research-skill-workflow.ts";
import type { RunLifecycleWorkflow, WorkflowJson, WorkflowRunContext } from "./run-lifecycle.ts";

const VISION_IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

export interface InterpretWorkflowDependencies {
  lifecycle: RunLifecycleWorkflow;
  currentArtifactsValidated(state: WorkflowJson): boolean;
  nextStep(validation: WorkflowJson, runId: string, figurePath: string): WorkflowJson;
  loadImages(paths: string[]): Promise<{ images: WorkflowJson[]; warnings: string[] }>;
  runAgent(input: {
    runDir: string;
    prompt: string;
    agentConfig: WorkflowJson;
    finalizeSchema: unknown;
    images: WorkflowJson[];
    signal?: AbortSignal;
  }): Promise<StageAgentResult>;
  writeJson(path: string, value: WorkflowJson): Promise<void>;
  writeText(path: string, value: string): Promise<void>;
  snapshot(run: WorkflowRunContext, label: string): Promise<unknown>;
  appendEvent(event: WorkflowJson): Promise<void>;
  publishTaskEvent?(event: {
    cwd: string;
    parentRunId: string;
    taskId: string;
    payload: WorkflowJson;
  }): Promise<boolean>;
}

export interface InterpretWorkflowInput {
  cwd: string;
  runId: string;
  additionalContext?: string;
  rolePrompt: string;
  agentConfig: WorkflowJson;
  finalizeSchema: unknown;
  signal?: AbortSignal;
}

function resolveQuestion(run: WorkflowRunContext): string {
  const value = String(run.state.question || "").trim();
  if (!value) throw new Error("question is missing from state.json");
  return value;
}

function additionalContextBlock(value?: string): string {
  const text = String(value || "").trim();
  return text ? `Additional context from the main agent:\n${text}` : "";
}

function visionFigures(run: WorkflowRunContext, service: ArtifactService): Artifact[] {
  return service.normalizeMany(run.state.artifacts || [])
    .filter((artifact) => artifact.kind === "figure" && VISION_IMAGE_EXTENSIONS.has(extname(artifact.path).toLowerCase()));
}

function selectMainFigure(figures: Artifact[]): Artifact | undefined {
  return figures.find((artifact) => artifact.role === "main")
    || figures.find((artifact) => basename(artifact.path).toLowerCase() === "figure.png")
    || (figures.length === 1 ? figures[0] : undefined);
}

function codePathsForFigure(run: WorkflowRunContext, service: ArtifactService, figure: Artifact): string[] {
  if (figure.produced_by) return [service.paths.resolve(figure.produced_by)];
  return service.normalizeMany(run.state.artifacts || [])
    .filter((artifact) => artifact.kind === "code")
    .map((artifact) => artifact.path);
}

function imageAnalysisMarkdown(analysis: WorkflowJson): string {
  const section = (title: string, values: unknown) => {
    const items = Array.isArray(values) ? values.map(String).filter(Boolean) : [];
    return [`## ${title}`, "", ...(items.length ? items.map((item) => `- ${item}`) : ["_None recorded._"])].join("\n");
  };
  return [
    "# Figure analysis",
    "",
    analysis.figure_type ? `**Figure type:** ${analysis.figure_type}` : "",
    section("Observations", analysis.observations),
    section("Quantitative evidence", analysis.quantitative_evidence),
    section("Biological interpretation", analysis.biological_interpretation),
    section("Alternative explanations", analysis.alternative_explanations),
    section("Figure-level limitations", analysis.limitations),
  ].filter(Boolean).join("\n\n") + "\n";
}

function finalizationPrompt(rolePrompt: string, body: string): string {
  return [
    rolePrompt.trim(),
    "",
    "You are the isolated SeekBrain interpretation subagent.",
    "Return only by calling the finalize tool. Do not expose scratch reasoning.",
    "Required final tool: finalize_interpretation",
    "",
    body,
  ].join("\n");
}

export class InterpretWorkflow {
  constructor(readonly dependencies: InterpretWorkflowDependencies) {}

  async execute(input: InterpretWorkflowInput): Promise<WorkflowJson> {
    const run = await this.dependencies.lifecycle.resolveRun(input.cwd, input.runId);
    const service = new ArtifactService(run.runDir);
    const figures = visionFigures(run, service);
    const figure = selectMainFigure(figures);
    let reportAvailability: WorkflowJson = { available: false, completed_round_count: 0 };

    if (!this.dependencies.currentArtifactsValidated(run.state)) {
      return {
        ok: false,
        run_id: run.runId,
        blocked_by_validation_policy: true,
        error: "The latest Code/refinement artifacts must be validated before interpretation.",
        next_step: { tool: "neuro_validate", args: { run_id: run.runId } },
      };
    }
    if (run.state.validation?.route === "retry_code") {
      return {
        ok: false,
        run_id: run.runId,
        blocked_by_validation_policy: true,
        error: "Blocking validation issues must be repaired before interpretation.",
        next_step: this.dependencies.nextStep(run.state.validation, run.runId, figure?.path || ""),
      };
    }
    if (input.agentConfig.vision !== true) {
      return { ok: false, run_id: run.runId, error: "configuration issue: neuro_interpret requires vision=true. Report this to the user; do not edit seekbrain.config.yaml unless explicitly asked." };
    }
    if (!figure) {
      return {
        ok: false,
        run_id: run.runId,
        error: figures.length > 1
          ? "neuro_interpret found multiple figures but no canonical role=main or figure.png artifact"
          : "neuro_interpret requires one canonical vision figure artifact",
        figure_paths: figures.map((artifact) => artifact.path),
      };
    }

    const vision = await this.dependencies.loadImages([figure.path]);
    if (!vision.images.length) return { ok: false, run_id: run.runId, error: "failed to load the canonical interpretation figure", figure_path: figure.path, warnings: vision.warnings };

    const question = resolveQuestion(run);
    const codePaths = codePathsForFigure(run, service, figure);
    const dataArtifacts = service.normalizeMany(run.state.artifacts || []).filter((artifact) => artifact.kind === "data");
    const ignoredFigures = figures.filter((artifact) => artifact.path !== figure.path).map((artifact) => artifact.path);
    const checks = run.state.checks || {};
    const prompt = finalizationPrompt(input.rolePrompt, [
      `Question:\n${question}`,
      `Canonical figure:\n${JSON.stringify({ path: figure.path, role: figure.role, description: figure.description, produced_by: figure.produced_by }, null, 2)}`,
      `Plan:\n${run.state.plan?.plan_markdown || ""}`,
      `Statistics:\n${JSON.stringify(run.state.code?.statistics || {}, null, 2)}`,
      `Validation:\n${JSON.stringify(run.state.validation || {}, null, 2)}`,
      `Deterministic checks:\n${JSON.stringify(checks, null, 2)}`,
      `Deep research context:\n${run.state.deep_research_context || ""}`,
      `Execution log:\n${run.state.code?.exec_log || ""}`,
      `Producing code paths (read only if useful):\n${codePaths.length ? codePaths.map((path) => `- ${path}`).join("\n") : "(none recorded)"}`,
      `Data artifacts:\n${dataArtifacts.length ? dataArtifacts.map((artifact) => `- ${artifact.path}${artifact.description ? ` — ${artifact.description}` : ""}`).join("\n") : "(none recorded)"}`,
      ignoredFigures.length ? `Non-canonical image artifacts intentionally ignored by this single-figure workflow:\n${ignoredFigures.map((path) => `- ${path}`).join("\n")}` : "",
      additionalContextBlock(input.additionalContext),
      "First complete image_analysis from the supplied figure and evidence. Then derive conclusions, summary, limitations, confidence, and next_research_directions from that analysis plus the supplied statistics and validation. Do not repeat the same prose in image_analysis and conclusions. Finalize only after both parts are complete.",
    ].filter(Boolean).join("\n\n"));

    const agent = await this.dependencies.runAgent({
      runDir: run.runDir,
      prompt,
      agentConfig: input.agentConfig,
      finalizeSchema: input.finalizeSchema,
      images: vision.images,
      signal: input.signal,
    });

    const interpretationPath = join(run.runDir, "interpretation.json");
    const imageAnalysisPath = join(run.runDir, "image_analysis.md");
    const conclusionsPath = join(run.runDir, "conclusions.json");
    if (agent.ok && agent.result) {
      const validationCaveats = Array.isArray(run.state.validation?.methodological_caveats)
        ? run.state.validation.methodological_caveats.map(String).filter(Boolean)
        : [];
      const unresolvedBlocking = run.state.validation?.route === "conclude_with_limitations" && Array.isArray(run.state.validation?.blocking_issues)
        ? run.state.validation.blocking_issues.map((issue: unknown) => `Unresolved validation issue: ${String(issue)}`)
        : [];
      const dummySignals = Array.isArray(checks.dummy_data_signals) ? checks.dummy_data_signals.map(String) : [];
      const dataWarnings = dummySignals.length ? [`Dummy/synthetic data signals were detected: ${dummySignals.join(", ")}`] : [];
      agent.result.limitations = [...new Set([
        ...(Array.isArray(agent.result.limitations) ? agent.result.limitations.map(String) : []),
        ...validationCaveats,
        ...unresolvedBlocking,
        ...dataWarnings,
      ])];
      const imageAnalysis = agent.result.image_analysis || {};
      const conclusion = {
        conclusions: agent.result.conclusions || [],
        summary: agent.result.summary || "",
        limitations: agent.result.limitations,
        confidence: agent.result.confidence,
        next_research_directions: agent.result.next_research_directions || [],
      };
      const compatibilityAnalysis = {
        path: figure.path,
        image_analysis_text: imageAnalysisMarkdown(imageAnalysis),
        ...imageAnalysis,
      };
      await this.dependencies.writeJson(interpretationPath, agent.result);
      await this.dependencies.writeText(imageAnalysisPath, compatibilityAnalysis.image_analysis_text);
      await this.dependencies.writeJson(conclusionsPath, conclusion);
      await this.dependencies.lifecycle.updateState(run, {
        interpretation: agent.result,
        image_analysis: compatibilityAnalysis,
        image_analyses: [compatibilityAnalysis],
        conclusions: conclusion,
        conclusion_warnings: { dummy_data_limited: dummySignals.length > 0, dummy_data_signals: dummySignals },
      });
      if (run.state.parent_run_id && run.state.research_task_id) {
        const publishedToScheduler = await this.dependencies.publishTaskEvent?.({
            cwd: input.cwd,
            parentRunId: String(run.state.parent_run_id),
            taskId: String(run.state.research_task_id),
            payload: {
              child_run_id: run.runId,
              completed_at: new Date().toISOString(),
              interpretation_path: interpretationPath,
              conclusions_path: conclusionsPath,
              summary: conclusion.summary,
            },
          }) === true;
        if (!publishedToScheduler) {
          try {
            const parent = await this.dependencies.lifecycle.resolveRun(input.cwd, String(run.state.parent_run_id));
            const planning = parent.state.research_planning || {};
            const taskRuns = Array.isArray(planning.task_runs) ? planning.task_runs : [];
            const updatedTaskRuns = taskRuns.map((item: WorkflowJson) => item.run_id === run.runId
              ? {
                  ...item,
                  status: "complete",
                  completed_at: new Date().toISOString(),
                  interpretation_path: interpretationPath,
                  conclusions_path: conclusionsPath,
                  summary: conclusion.summary,
                }
              : item);
            const allComplete = updatedTaskRuns.length > 0 && updatedTaskRuns.every((item: WorkflowJson) => item.status === "complete");
            await this.dependencies.lifecycle.updateState(parent, {
              research_planning: {
                ...planning,
                status: allComplete ? "tasks_complete" : "tasks_running",
                task_runs: updatedTaskRuns,
              },
            });
            if (planning.task_manifest_path) {
              await this.dependencies.writeJson(String(planning.task_manifest_path), {
                parent_run_id: parent.runId,
                research_plan_path: planning.final_plan_path,
                updated_at: new Date().toISOString(),
                task_runs: updatedTaskRuns,
              });
            }
          } catch {
            // Child conclusions remain durable even if legacy parent mirroring fails.
          }
        }
      }
      await this.dependencies.lifecycle.updateResearchRoundManifest(run, {
        status: "concluded",
        completed_at: new Date().toISOString(),
        interpretation_path: interpretationPath,
        conclusions_path: conclusionsPath,
        summary: conclusion.summary,
        next_research_directions: conclusion.next_research_directions,
      });
      reportAvailability = await this.dependencies.lifecycle.reportAvailability(run);
      await this.dependencies.snapshot(run, "after_interpret");
    }
    await this.dependencies.appendEvent({ run_id: run.runId, event: "neuro_interpret", ok: agent.ok, figure_path: figure.path });
    return {
      run_id: run.runId,
      ok: agent.ok,
      error: agent.error,
      result: agent.result ? {
        image_analysis: agent.result.image_analysis,
        conclusions: agent.result.conclusions,
        summary: agent.result.summary,
        limitations: agent.result.limitations,
        confidence: agent.result.confidence,
      } : undefined,
      interpretation_path: agent.ok ? interpretationPath : undefined,
      image_analysis_path: agent.ok ? imageAnalysisPath : undefined,
      conclusions_path: agent.ok ? conclusionsPath : undefined,
      next_research_directions: agent.ok ? agent.result?.next_research_directions : undefined,
      report_available: agent.ok ? reportAvailability.available : false,
      completed_round_count: agent.ok ? reportAvailability.completed_round_count : undefined,
      report_hint: agent.ok ? reportAvailability.hint : undefined,
      ignored_figure_paths: ignoredFigures,
      guidance: agent.ok ? "Summarize the interpretation and next research directions for the user. Do not create another round until the user accepts a direction or supplies their own." : undefined,
      output_path: agent.output_path,
      debug: { subagent_dir: agent.subagent_dir, snapshot_dir: agent.snapshot_dir },
    };
  }
}

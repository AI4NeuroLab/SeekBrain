import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ArtifactService } from "../../core/index.ts";
import type { StageAgentResult } from "./research-skill-workflow.ts";
import type { RunLifecycleWorkflow, WorkflowJson, WorkflowRunContext } from "./run-lifecycle.ts";

export interface InterpretWorkflowDependencies {
  lifecycle: RunLifecycleWorkflow;
  currentArtifactsValidated(state: WorkflowJson): boolean;
  nextStep(validation: WorkflowJson, runId: string, figurePath: string): WorkflowJson;
  runAgent(input: {
    runDir: string;
    prompt: string;
    agentConfig: WorkflowJson;
    finalizeSchema: unknown;
    signal?: AbortSignal;
  }): Promise<StageAgentResult>;
  writeJson(path: string, value: WorkflowJson): Promise<void>;
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

function compactArrays(value: unknown): unknown {
  if (Array.isArray(value)) {
    if (value.length > 12) return { count: value.length, sample: value.slice(0, 5).map(compactArrays) };
    return value.map(compactArrays);
  }
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, compactArrays(child)]));
  return value;
}

async function readStatistics(run: WorkflowRunContext): Promise<unknown> {
  const inline = run.state.code?.statistics;
  if (inline && typeof inline === "object") return inline;
  const path = String(run.state.code?.statistics_path || join(run.runDir, "statistics.json"));
  try { return JSON.parse(await readFile(path, "utf8")); } catch { return {}; }
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

function finalizationPrompt(rolePrompt: string, body: string): string {
  return [
    rolePrompt.trim(),
    "",
    "You are the isolated SeekBrain Interpretation Agent.",
    "Return only by calling finalize_interpretation. Do not expose scratch reasoning.",
    "",
    body,
  ].join("\n");
}

export class InterpretWorkflow {
  constructor(readonly dependencies: InterpretWorkflowDependencies) {}

  async execute(input: InterpretWorkflowInput): Promise<WorkflowJson> {
    const run = await this.dependencies.lifecycle.resolveRun(input.cwd, input.runId);
    let reportAvailability: WorkflowJson = { available: false, completed_round_count: 0 };
    if (!this.dependencies.currentArtifactsValidated(run.state)) {
      return {
        ok: false,
        run_id: run.runId,
        blocked_by_validation_policy: true,
        error: "The latest Code/refinement artifacts must be validated before interpretation.",
        next_step: { tool: "seekbrain_validation_run", args: { run_id: run.runId } },
      };
    }
    if (run.state.validation?.route === "retry_code") {
      return {
        ok: false,
        run_id: run.runId,
        blocked_by_validation_policy: true,
        error: "Blocking validation issues must be repaired before interpretation.",
        next_step: this.dependencies.nextStep(run.state.validation, run.runId, ""),
      };
    }

    const validation = run.state.validation || {};
    const planPath = String(run.state.plan?.path || join(run.runDir, "plan.md"));
    const codePaths = codeFilePaths(run, new ArtifactService(run.runDir));
    const statistics = compactArrays(await readStatistics(run));
    const codeWarnings = Array.isArray(run.state.code?.warnings) ? run.state.code.warnings.map(String).filter(Boolean) : [];
    const prompt = finalizationPrompt(input.rolePrompt, [
      `Question:\n${resolveQuestion(run)}`,
      `Approved plan path:\n${planPath}`,
      `Generated code paths:\n${codePaths.length ? codePaths.join("\n") : "None recorded."}`,
      `Essential statistics:\n${JSON.stringify(statistics, null, 2)}`,
      `Validated visual evidence:\n${JSON.stringify({
        summary: validation.summary || "",
        figure_observations: validation.figure_observations || [],
        methodological_caveats: validation.methodological_caveats || [],
        blocking_issues: validation.blocking_issues || [],
      }, null, 2)}`,
      codeWarnings.length ? `Code execution limitations:\n${JSON.stringify(codeWarnings, null, 2)}` : "",
      run.state.deep_research_context ? `Scientific background:\n${run.state.deep_research_context}` : "",
      "Synthesize the scientific result without re-reviewing image quality, inventing new analyses, or repeating validation caveats. Directions are optional.",
    ].filter(Boolean).join("\n\n"));

    const agent = await this.dependencies.runAgent({
      runDir: run.runDir,
      prompt,
      agentConfig: input.agentConfig,
      finalizeSchema: input.finalizeSchema,
      signal: input.signal,
    });

    const conclusionsPath = join(run.runDir, "conclusions.json");
    if (agent.ok && agent.result) {
      const validationCaveats = Array.isArray(validation.methodological_caveats) ? validation.methodological_caveats.map(String).filter(Boolean) : [];
      const unresolvedBlocking = validation.route === "conclude_with_limitations" && Array.isArray(validation.blocking_issues)
        ? validation.blocking_issues.map((issue: unknown) => `Unresolved validation issue: ${String(issue)}`)
        : [];
      const dummySignals = Array.isArray(run.state.checks?.dummy_data_signals) ? run.state.checks.dummy_data_signals.map(String) : [];
      const limitations = [...new Set([
        ...(Array.isArray(agent.result.limitations) ? agent.result.limitations.map(String) : []),
        ...validationCaveats,
        ...unresolvedBlocking,
        ...codeWarnings,
        ...(dummySignals.length ? [`Possible real-input substitution signals require caution: ${dummySignals.join(", ")}`] : []),
      ])];
      const completedAt = new Date().toISOString();
      const conclusion = {
        conclusions: Array.isArray(agent.result.conclusions) ? agent.result.conclusions : [],
        summary: String(agent.result.summary || ""),
        limitations,
        next_research_directions: Array.isArray(agent.result.next_research_directions) ? agent.result.next_research_directions : [],
        completed_at: completedAt,
      };
      await this.dependencies.writeJson(conclusionsPath, conclusion);
      const compactReference = { path: conclusionsPath, summary: conclusion.summary, status: "complete", completed_at: completedAt };
      await this.dependencies.lifecycle.updateState(run, {
        interpretation: compactReference,
        conclusions: compactReference,
        conclusion_warnings: { dummy_data_limited: dummySignals.length > 0, dummy_data_signals: dummySignals },
      });
      if (run.state.parent_run_id && run.state.research_task_id) {
        const payload = {
          child_run_id: run.runId,
          completed_at: completedAt,
          interpretation_path: conclusionsPath,
          conclusions_path: conclusionsPath,
          summary: conclusion.summary,
        };
        const publishedToScheduler = await this.dependencies.publishTaskEvent?.({
          cwd: input.cwd,
          parentRunId: String(run.state.parent_run_id),
          taskId: String(run.state.research_task_id),
          payload,
        }) === true;
        if (!publishedToScheduler) {
          try {
            const parent = await this.dependencies.lifecycle.resolveRun(input.cwd, String(run.state.parent_run_id));
            const planning = parent.state.research_planning || {};
            const taskRuns = Array.isArray(planning.task_runs) ? planning.task_runs : [];
            const updatedTaskRuns = taskRuns.map((item: WorkflowJson) => item.run_id === run.runId
              ? { ...item, status: "complete", ...payload }
              : item);
            const allComplete = updatedTaskRuns.length > 0 && updatedTaskRuns.every((item: WorkflowJson) => item.status === "complete");
            await this.dependencies.lifecycle.updateState(parent, {
              research_planning: { ...planning, status: allComplete ? "tasks_complete" : "tasks_running", task_runs: updatedTaskRuns },
            });
            if (planning.task_manifest_path) {
              await this.dependencies.writeJson(String(planning.task_manifest_path), {
                parent_run_id: parent.runId,
                research_plan_path: planning.research_plan_path,
                updated_at: completedAt,
                task_runs: updatedTaskRuns,
              });
            }
          } catch { /* conclusions remain durable */ }
        }
      }
      await this.dependencies.lifecycle.updateResearchRoundManifest(run, {
        status: "concluded",
        completed_at: completedAt,
        interpretation_path: conclusionsPath,
        conclusions_path: conclusionsPath,
        summary: conclusion.summary,
        next_research_directions: conclusion.next_research_directions,
      });
      reportAvailability = await this.dependencies.lifecycle.reportAvailability(run);
      await this.dependencies.snapshot(run, "after_interpret");
      agent.result = conclusion;
    }
    await this.dependencies.appendEvent({ run_id: run.runId, event: "seekbrain_interpretation_run", ok: agent.ok });
    return {
      run_id: run.runId,
      ok: agent.ok,
      error: agent.error,
      result: agent.result ? { conclusions: agent.result.conclusions, summary: agent.result.summary, limitations: agent.result.limitations } : undefined,
      interpretation_path: agent.ok ? conclusionsPath : undefined,
      conclusions_path: agent.ok ? conclusionsPath : undefined,
      next_research_directions: agent.ok ? agent.result?.next_research_directions : undefined,
      report_available: agent.ok ? reportAvailability.available : false,
      completed_round_count: agent.ok ? reportAvailability.completed_round_count : undefined,
      report_hint: agent.ok ? reportAvailability.hint : undefined,
      guidance: agent.ok ? "Summarize the conclusions for the user. Start no new round until the user accepts or supplies a direction." : undefined,
      output_path: agent.output_path,
      debug: { subagent_dir: agent.subagent_dir, snapshot_dir: agent.snapshot_dir },
    };
  }
}

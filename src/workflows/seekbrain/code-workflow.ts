import { existsSync } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import { extname, join } from "node:path";
import { ArtifactService, type Artifact } from "../../core/index.ts";
import type { StageAgentResult } from "./research-skill-workflow.ts";
import { DEFAULT_DELIVERABLES, type RunLifecycleWorkflow, type WorkflowArtifact, type WorkflowJson, type WorkflowRunContext } from "./run-lifecycle.ts";

export interface CodeRetryDecision {
  allowed: boolean;
  reason: string;
  previousAttempt: number;
  validatedAttempt?: number;
  feedback: string;
}

export interface CodeAgentToolResultEvent {
  toolName: string;
  toolCallId?: string;
  args: unknown;
  content: unknown[];
  details?: unknown;
  isError: boolean;
}

export interface CodeAgentToolResultOverride {
  content?: unknown[];
  details?: unknown;
  isError?: boolean;
  terminate?: boolean;
}

export type CodeAgentToolResultHandler = (
  event: CodeAgentToolResultEvent,
  signal?: AbortSignal,
) => Promise<CodeAgentToolResultOverride | undefined>;

export interface CodeWorkflowDependencies {
  lifecycle: RunLifecycleWorkflow;
  retryPolicy(state: WorkflowJson, feedback: string | undefined, maxAttempts: number): CodeRetryDecision;
  runAgent(input: {
    runDir: string;
    prompt: string;
    agentConfig: WorkflowJson;
    finalizeSchema: unknown;
    signal?: AbortSignal;
    afterToolCall?: CodeAgentToolResultHandler;
  }): Promise<StageAgentResult>;
  writeText(path: string, value: string): Promise<void>;
  writeJson(path: string, value: WorkflowJson): Promise<void>;
  snapshot(run: WorkflowRunContext, label: string): Promise<unknown>;
  appendEvent(event: WorkflowJson): Promise<void>;
}

export interface CodeWorkflowInput {
  cwd: string;
  runId: string;
  validationFeedback?: string;
  rolePrompt: string;
  agentConfig: WorkflowJson;
  finalizeSchema: unknown;
  planReviewRequired: boolean;
  maxAttempts: number;
  signal?: AbortSignal;
  afterToolCall?: CodeAgentToolResultHandler;
}

async function readPlan(run: WorkflowRunContext): Promise<string> {
  const path = String(run.state.plan?.path || join(run.runDir, "plan.md"));
  try {
    const plan = (await readFile(path, "utf8")).trim();
    if (!plan) throw new Error("file is empty");
    return plan;
  } catch (error) {
    throw new Error(`Unable to read the approved methodological plan '${path}': ${error instanceof Error ? error.message : String(error)}`);
  }
}

const RECOVERY_CONTEXT_EXCLUDES = new Set([
  "plan.md",
  "project.json",
  "state.json",
  "targeted_skill.md",
]);

async function existingRecoveryFiles(runDir: string): Promise<Array<{ path: string; bytes: number }>> {
  try {
    const entries = await readdir(runDir, { withFileTypes: true });
    const files = await Promise.all(entries
      .filter((entry) => entry.isFile() && !RECOVERY_CONTEXT_EXCLUDES.has(entry.name))
      .map(async (entry) => {
        try {
          const details = await stat(join(runDir, entry.name));
          return details.size > 0 ? { path: entry.name, bytes: details.size } : undefined;
        } catch {
          return undefined;
        }
      }));
    return files.filter((entry): entry is { path: string; bytes: number } => Boolean(entry)).sort((left, right) => left.path.localeCompare(right.path)).slice(0, 40);
  } catch {
    return [];
  }
}

function finalizationPrompt(rolePrompt: string, body: string): string {
  return [
    rolePrompt.trim(),
    "",
    "You are the isolated SeekBrain Code Agent.",
    "Return only by calling the finalize tool. Do not expose scratch reasoning.",
    "Required final tool: finalize_code_result",
    "",
    body,
  ].join("\n");
}

function deliverablesToPromptText(deliverables: WorkflowArtifact[]): string {
  return deliverables.map((artifact) => {
    const parts = [artifact.path, artifact.kind as string];
    if (artifact.role) parts.push(`role=${artifact.role}`);
    if (artifact.optional) parts.push("optional");
    if (artifact.description) parts.push(`desc="${artifact.description}"`);
    if (artifact.produced_by) parts.push(`produced_by=${artifact.produced_by}`);
    return parts.join(", ");
  }).join("\n");
}

function dummyDataSignals(code: string, plan: string): string[] {
  const realInputRequired = /(?:\/[^\s`'"*]+|\.npy|\.csv|\.tsv|\.json|\.h5|\.mat|data(?:set)?\s+(?:root|path|file))/i.test(plan);
  const randomMainData = /\b(?:np\.random\.(?:rand|randn|normal|uniform|poisson)|random\.(?:random|randint|choice|uniform))\b/.test(code);
  const readsInput = /\b(?:np\.load|read_csv|read_table|read_parquet|loadmat|nib\.load|h5py\.File|open)\s*\(/.test(code);
  const explicitReplacement = /(?:TODO:?\s*replace|placeholder\s+(?:data|input)|use_dummy_data\s*=\s*True)/i.test(code);
  return [
    ...(explicitReplacement ? ["explicit placeholder or dummy-input replacement"] : []),
    ...(realInputRequired && randomMainData && !readsInput ? ["random data generation without any recorded real-input read"] : []),
  ];
}

function statisticsWarnings(statistics: unknown): string[] {
  const warnings: string[] = [];
  if (!statistics || typeof statistics !== "object") return ["statistics is missing or not an object"];
  if ("note" in statistics || "error" in statistics) return ["statistics.json was not generated — results cannot be validated"];
  function visit(value: unknown, path: string) {
    if (typeof value === "number" && !Number.isFinite(value)) warnings.push(`${path} is not finite`);
    if (Array.isArray(value)) value.forEach((item, index) => visit(item, `${path}[${index}]`));
    if (value && typeof value === "object" && !Array.isArray(value)) {
      for (const [key, child] of Object.entries(value)) visit(child, `${path}.${key}`);
    }
  }
  visit(statistics, "statistics");
  return warnings;
}

function toolText(content: unknown[]): string {
  return content.flatMap((item: any) => typeof item === "string" ? [item] : typeof item?.text === "string" ? [item.text] : []).join("\n").trim();
}

const SOURCE_CODE_EXTENSIONS = new Set([".py", ".r", ".jl", ".m", ".sh", ".bash", ".zsh", ".js", ".mjs", ".cjs", ".ts", ".tsx", ".rs"]);

function finalizedCodeFiles(result: WorkflowJson | undefined, deliverables: WorkflowArtifact[], artifacts: ArtifactService): Array<{ path: string }> {
  const declaredKinds = new Map(deliverables.map((artifact) => [artifacts.paths.resolve(artifact.path), artifact.kind]));
  const seen = new Set<string>();
  return (Array.isArray(result?.code_files) ? result.code_files : [])
    .filter((entry: WorkflowJson) => entry?.path)
    .map((entry: WorkflowJson) => ({ path: String(entry.path) }))
    .filter((entry) => {
      const resolved = artifacts.paths.resolve(entry.path);
      if (seen.has(resolved)) return false;
      const declaredKind = declaredKinds.get(resolved);
      if (declaredKind && declaredKind !== "code") return false;
      if (declaredKind !== "code" && !SOURCE_CODE_EXTENSIONS.has(extname(entry.path).toLowerCase())) return false;
      seen.add(resolved);
      return true;
    });
}

function policyBlock(run: WorkflowRunContext, decision: CodeRetryDecision, maxAttempts: number): WorkflowJson {
  if (decision.reason === "attempt_limit") return { ok: false, run_id: run.runId, blocked_by_validation_policy: true, error: `Code retry limit reached (${maxAttempts} total attempts).`, guidance: "Continue with tentative evidence and explicit limitations, or start a new research round." };
  if (decision.reason === "validation_required") return { ok: false, run_id: run.runId, blocked_by_validation_policy: true, error: "The existing Code attempt must be validated before seekbrain_code_execute can run again.", next_step: { tool: "seekbrain_validation_run", args: { run_id: run.runId } } };
  if (decision.reason === "stale_validation") return { ok: false, run_id: run.runId, blocked_by_validation_policy: true, error: `Validation covers Code attempt ${decision.validatedAttempt}, but the latest attempt is ${decision.previousAttempt}.`, next_step: { tool: "seekbrain_validation_run", args: { run_id: run.runId } } };
  if (decision.reason === "already_passed") return { ok: false, run_id: run.runId, blocked_by_validation_policy: true, error: "Validation already passed; automatic seekbrain_code_execute retry is not allowed.", methodological_caveats: run.state.validation?.methodological_caveats || [], guidance: "Continue to Result Interpretation. A scientific redesign requires explicit user approval through the post-run review flow or a new round." };
  return { ok: false, run_id: run.runId, blocked_by_validation_policy: true, error: "A failed Validation with non-empty repair feedback is required for a Code retry." };
}

export class CodeWorkflow {
  constructor(readonly dependencies: CodeWorkflowDependencies) {}

  async execute(input: CodeWorkflowInput): Promise<WorkflowJson> {
    const run = await this.dependencies.lifecycle.resolveRun(input.cwd, input.runId);
    const planReview = run.state.human_reviews?.plan || {};
    if (input.planReviewRequired && planReview.status !== "approved") {
      return { ok: false, blocked_by_human_review: true, required_stage: "plan", next_tool: "seekbrain_code_execute", run_id: run.runId, status: planReview.status || "pending_review", message: "seekbrain_code_execute is blocked until researcher review approves the methodological schema. Ask the user to review the latest schema, then call seekbrain_review_approve or seekbrain_review_feedback." };
    }
    const plan = await readPlan(run);
    const decision = this.dependencies.retryPolicy(run.state, input.validationFeedback, input.maxAttempts);
    if (!decision.allowed) return policyBlock(run, decision, input.maxAttempts);

    const previousAttempt = Number(run.state.code_attempt || 0);
    const deliverables: WorkflowArtifact[] = run.state.deliverables || DEFAULT_DELIVERABLES;
    const artifacts = new ArtifactService(run.runDir);
    const currentArtifacts = artifacts.normalizeMany(run.state.artifacts || []);
    const statsPath = deliverables.find((artifact) => artifact.kind === "statistics")?.path || "statistics.json";
    const currentExecLog = currentArtifacts.find((artifact) => artifact.name === "exec_log" || artifact.kind === "log")?.path || join(run.runDir, "exec.log");
    const recoveryFiles = await existingRecoveryFiles(run.runDir);
    const recoveryContext = recoveryFiles.length ? [
      "Recovery context:",
      "Non-empty files from a prior incomplete or interrupted execution already exist in the run directory.",
      "Inspect them before running the full analysis. Reuse scientifically complete statistics or intermediate results, and prefer a narrow rendering or resume path when possible.",
      `Existing files:\n${JSON.stringify(recoveryFiles, null, 2)}`,
    ].join("\n") : "";
    const retryContext = previousAttempt > 0 ? [
      "Retry context:",
      "This is a follow-up code attempt in the same run.",
      "Before changing code, inspect existing artifacts when present.",
      "Prefer patching the existing code files instead of rewriting from scratch, unless a full rewrite is clearly necessary.",
      "Use validation_feedback as the primary correction target when provided.",
      "Preserve correct parts of the previous implementation.",
      `Existing artifacts:\n${JSON.stringify({ deliverables: deliverables.map((artifact) => ({ ...artifact })), artifacts: currentArtifacts, exec_log: currentExecLog }, null, 2)}`,
    ].join("\n") : "";
    const prompt = finalizationPrompt(input.rolePrompt, [
      `Detailed methodological plan:\n${plan}`,
      `Deliverables (read-only contract; produce every file listed):\n${deliverablesToPromptText(deliverables)}`,
      decision.feedback ? `Retry feedback:\n${decision.feedback}` : "",
      recoveryContext,
      retryContext,
      "Generate, write, and execute the analysis code. After the first successful execution, do one compact non-visual verification and finalize immediately with only { code_files, summary, warnings }. Do not edit or rerun for warning wording, style, richer statistics, provenance, or presentation. CodeWorkflow reads statistics.json and constructs artifacts from the deliverables contract.",
    ].filter(Boolean).join("\n\n"));
    const executionOutput: string[] = [];
    const afterToolCall: CodeAgentToolResultHandler = async (event, signal) => {
      if (event.toolName === "bash" && !event.isError) {
        const value = toolText(event.content);
        if (value) executionOutput.push(value);
      }
      return input.afterToolCall?.(event, signal);
    };
    const agent = await this.dependencies.runAgent({
      runDir: run.runDir,
      prompt,
      agentConfig: input.agentConfig,
      finalizeSchema: input.finalizeSchema,
      signal: input.signal,
      afterToolCall,
    });
    const codeFiles = finalizedCodeFiles(agent.result, deliverables, artifacts);
    const codeReadWarnings: WorkflowJson[] = [];
    const returnedCodeParts: string[] = [];
    for (const codeFile of codeFiles) {
      const path = artifacts.paths.resolve(codeFile.path);
      try { returnedCodeParts.push(await readFile(path, "utf8")); }
      catch (error) { codeReadWarnings.push({ path, warning: "Unable to read finalized code artifact for deterministic checks.", error: String(error) }); }
    }
    let checks: WorkflowJson = { dummy_data_signals: dummyDataSignals(returnedCodeParts.join("\n"), plan), code_read_warnings: codeReadWarnings };
    let resultArtifacts: Artifact[] = [];
    let persistedStatistics: WorkflowJson = {};
    let substantiveSuccess = false;
    if (agent.ok && agent.result) {
      const statsPhysicalPath = artifacts.paths.resolve(statsPath);
      const execLogPath = join(run.runDir, "exec.log");
      await this.dependencies.writeText(execLogPath, executionOutput.join("\n\n") || String(agent.result.summary || "Code execution completed."));
      if (existsSync(statsPhysicalPath)) {
        try {
          persistedStatistics = JSON.parse(await readFile(statsPhysicalPath, "utf8"));
        } catch { persistedStatistics = {}; }
      }
      checks = { ...checks, statistics_warnings: statisticsWarnings(persistedStatistics) };
      const declaredPaths = new Set(deliverables.map((artifact) => artifacts.paths.resolve(artifact.path)));
      const supplementalCodeFiles = codeFiles.filter((file) => !declaredPaths.has(artifacts.paths.resolve(file.path)));
      const codeArtifacts = supplementalCodeFiles.map((file, index) => artifacts.make(`code_${index + 1}`, file.path, "code", { role: "support_script" }));
      const primaryCodePath = codeFiles[0] ? artifacts.paths.resolve(codeFiles[0].path) : undefined;
      const declaredArtifacts = artifacts.normalizeMany(deliverables.map((artifact) => ({
        ...artifact,
        produced_by: artifact.kind === "code" ? undefined : artifact.produced_by && artifact.produced_by !== "code" ? artifact.produced_by : primaryCodePath,
      })));
      resultArtifacts = artifacts.merge([], [
        ...declaredArtifacts,
        ...codeArtifacts,
        artifacts.make("exec_log", execLogPath, "log"),
        artifacts.make("statistics", statsPhysicalPath, "statistics"),
      ]);
      checks = { ...checks, artifact_warnings: resultArtifacts.filter((artifact) => !artifact.optional && !existsSync(artifacts.paths.resolve(artifact.path))).map((artifact) => `declared ${artifact.kind} artifact is missing: ${artifact.path} (resolved: ${artifacts.paths.resolve(artifact.path)})`) };
      substantiveSuccess = codeFiles.length > 0
        && checks.code_read_warnings.length === 0
        && checks.statistics_warnings.length === 0
        && checks.artifact_warnings.length === 0
        && checks.dummy_data_signals.length === 0;
      if (substantiveSuccess) {
        await this.dependencies.lifecycle.updateState(run, {
          code_attempt: previousAttempt + 1,
          code: {
            code_files: codeFiles,
            statistics_path: statsPhysicalPath,
            exec_log_path: execLogPath,
            summary: String(agent.result.summary || ""),
            warnings: Array.isArray(agent.result.warnings) ? agent.result.warnings : [],
          },
          checks,
          artifacts: resultArtifacts,
        });
        await this.dependencies.snapshot(run, `after_code_attempt_${previousAttempt + 1}`);
      }
    }
    const ok = agent.ok && substantiveSuccess;
    await this.dependencies.appendEvent({ run_id: run.runId, event: "seekbrain_code_execute", ok, blocked_by_dummy_data: checks.dummy_data_signals.length > 0, code_attempt: ok ? previousAttempt + 1 : previousAttempt });
    return {
      run_id: run.runId,
      ok,
      error: agent.error || (!substantiveSuccess && agent.ok ? "Code execution did not satisfy the deterministic success contract." : undefined),
      result: agent.result ? { summary: agent.result.summary, warnings: agent.result.warnings } : undefined,
      artifacts: resultArtifacts,
      checks,
      blocked_by_dummy_data: checks.dummy_data_signals.length > 0,
      code_attempt: ok ? previousAttempt + 1 : previousAttempt,
      retryable: agent.ok && !substantiveSuccess,
      next_step: ok ? { tool: "seekbrain_validation_run", args: { run_id: run.runId } } : undefined,
      output_path: agent.output_path,
      debug: { subagent_dir: agent.subagent_dir, snapshot_dir: agent.snapshot_dir },
    };
  }
}

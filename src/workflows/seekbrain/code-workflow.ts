import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
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

export interface CodeWorkflowDependencies {
  lifecycle: RunLifecycleWorkflow;
  retryPolicy(state: WorkflowJson, feedback: string | undefined, maxAttempts: number): CodeRetryDecision;
  runAgent(input: {
    runDir: string;
    prompt: string;
    agentConfig: WorkflowJson;
    finalizeSchema: unknown;
    signal?: AbortSignal;
  }): Promise<StageAgentResult>;
  writeText(path: string, value: string): Promise<void>;
  writeJson(path: string, value: WorkflowJson): Promise<void>;
  snapshot(run: WorkflowRunContext, label: string): Promise<unknown>;
  appendEvent(event: WorkflowJson): Promise<void>;
}

export interface CodeWorkflowInput {
  cwd: string;
  runId: string;
  question?: string;
  plan?: string;
  dataInfo?: string;
  extraPathInfo?: string;
  targetedSkill?: string;
  validationFeedback?: string;
  additionalContext?: string;
  rolePrompt: string;
  agentConfig: WorkflowJson;
  finalizeSchema: unknown;
  planReviewRequired: boolean;
  maxAttempts: number;
  signal?: AbortSignal;
}

function resolveQuestion(run: WorkflowRunContext, requested?: string): string {
  const value = String(requested || run.state.question || "").trim();
  if (!value) throw new Error("question is required. Pass it to the tool, or persist it first via seekbrain_run_start/seekbrain_run_resume.");
  return value;
}

function effectiveMetadata(run: WorkflowRunContext, requestedData?: string, requestedPath?: string) {
  const locked = run.state.metadata_locked === true;
  return {
    data_info: locked ? String(run.state.data_info || "") : String(requestedData || run.state.data_info || ""),
    extra_path_info: locked ? String(run.state.extra_path_info || "") : String(requestedPath || run.state.extra_path_info || ""),
  };
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

function additionalContextBlock(value?: string): string {
  const text = String(value || "").trim();
  return text ? `Additional context from the main agent:\n${text}` : "";
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

function dummyDataSignals(text: string): string[] {
  const patterns = [
    /\b(dummy|toy|mock|synthetic|simulated|randomly generated)\b/i,
    /\bnp\.random\.(rand|randn|normal|uniform|poisson)\b/,
    /\brandom\.(random|randint|choice|uniform)\b/,
    /\bplaceholder\b/i,
    /\bTODO:?\s*replace\b/i,
  ];
  return patterns.filter((pattern) => pattern.test(text)).map((pattern) => pattern.source);
}

function statisticsWarnings(statistics: unknown, question = ""): string[] {
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
  if (warnings.length) return warnings;
  function* nums(value: unknown, path = ""): Generator<[string, number]> {
    if (typeof value === "number") yield [path, value];
    else if (Array.isArray(value)) for (let index = 0; index < value.length; index++) yield* nums(value[index], `${path}[${index}]`);
    else if (value && typeof value === "object") {
      for (const [key, child] of Object.entries(value)) yield* nums(child, path ? `${path}.${key}` : key);
    }
  }
  const numericValues = [...nums(statistics)];
  const correlations = numericValues.filter(([path]) => /corr|pearson|r_val|r_value|rho|spearman/i.test(path));
  const nearZero = correlations.filter(([, value]) => Math.abs(value) < 0.05);
  if (correlations.length && nearZero.length === correlations.length) {
    warnings.push("All correlation values are near zero (" + nearZero.slice(0, 3).map(([path, value]) => `${path}=${value.toFixed(3)}`).join(", ") + "). Possible missing preprocessing (e.g. log10 transform) or wrong data source.");
  }
  const groups = numericValues.filter(([path, value]) => /mean|median|fraction|frac|ratio|proportion|pct|percent/i.test(path) && !Number.isNaN(value));
  if (groups.length >= 2) {
    const values = groups.map(([, value]) => value);
    const maximum = Math.max(...values);
    if (maximum > 1e-6) {
      const spread = (maximum - Math.min(...values)) / maximum;
      if (spread < 0.1) warnings.push(`Group summary values are nearly identical (relative spread ${(spread * 100).toFixed(1)}%). If a contrast between conditions is expected, data preprocessing may be wrong.`);
    }
  }
  const questionNumbers = (question.match(/\b(\d{2,5})\b/g) || []).map(Number);
  const sampleSizes = numericValues.filter(([path, value]) => /\bn\b|n_sample|n_fish|n_cell|n_neuron|sample_size|num_/i.test(path) && value === Math.floor(value) && value > 1);
  for (const [path, sampleSize] of sampleSizes) {
    if (questionNumbers.length && questionNumbers.every((number) => Math.abs(sampleSize - number) / Math.max(number, 1) > 0.5)) {
      warnings.push(`Sample size ${path}=${sampleSize} seems inconsistent with numbers in the question ([${questionNumbers}]). Verify the correct dataset is being loaded.`);
      break;
    }
  }
  return warnings;
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
    const question = resolveQuestion(run, input.question);
    const metadata = effectiveMetadata(run, input.dataInfo, input.extraPathInfo);
    const decision = this.dependencies.retryPolicy(run.state, input.validationFeedback, input.maxAttempts);
    if (!decision.allowed) return policyBlock(run, decision, input.maxAttempts);

    const previousAttempt = Number(run.state.code_attempt || 0);
    const deliverables: WorkflowArtifact[] = run.state.deliverables || DEFAULT_DELIVERABLES;
    const artifacts = new ArtifactService(run.runDir);
    const currentArtifacts = artifacts.normalizeMany(run.state.artifacts || []);
    const statsPath = deliverables.find((artifact) => artifact.kind === "statistics")?.path || "statistics.json";
    const currentExecLog = currentArtifacts.find((artifact) => artifact.name === "exec_log" || artifact.kind === "log")?.path || join(run.runDir, "exec.log");
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
      `Question:\n${question}`,
      `Methodological schema:\n${input.plan || run.state.plan?.plan_markdown || ""}`,
      `Data info:\n${metadata.data_info}`,
      `Extra path info:\n${metadata.extra_path_info}`,
      run.state.inherited_context ? `Prior-round reusable context (read-only; do not overwrite earlier rounds):\n${JSON.stringify(run.state.inherited_context, null, 2)}` : "",
      `Analysis recipe:\n${input.targetedSkill || run.state.targeted_skill || ""}`,
      `Deep research context:\n${run.state.deep_research_context || ""}`,
      `Validation feedback:\n${decision.feedback}`,
      `Deliverables (read-only contract; produce every file listed):\n${deliverablesToPromptText(deliverables)}`,
      additionalContextBlock(input.additionalContext),
      retryContext,
      "Generate, write, and execute the analysis code. After one compact non-visual verification, finalize with: { code_files, exec_log, statistics, artifacts, summary, warnings }. code_files must list every code artifact you wrote as { path } only; do not copy source code into the finalize payload. Do not open/read generated images because seekbrain_validation_run owns visual review. artifacts must list every artifact actually generated, with name/path/kind/role/description; each figure/data artifact must include produced_by pointing to its code artifact. For every pdf figure, also produce a same-stem png.",
    ].join("\n\n"));
    const agent = await this.dependencies.runAgent({ runDir: run.runDir, prompt, agentConfig: input.agentConfig, finalizeSchema: input.finalizeSchema, signal: input.signal });
    const codeFiles = (Array.isArray(agent.result?.code_files) ? agent.result.code_files : []).filter((entry: WorkflowJson) => entry?.path).map((entry: WorkflowJson) => ({ path: String(entry.path) }));
    const codeReadWarnings: WorkflowJson[] = [];
    const returnedCodeParts: string[] = [];
    for (const codeFile of codeFiles) {
      const path = artifacts.paths.resolve(codeFile.path);
      try { returnedCodeParts.push(await readFile(path, "utf8")); }
      catch (error) { codeReadWarnings.push({ path, warning: "Unable to read finalized code artifact for deterministic checks.", error: String(error) }); }
    }
    let checks: WorkflowJson = {
      dummy_data_signals: dummyDataSignals([returnedCodeParts.join("\n"), agent.result?.exec_log || ""].join("\n")),
      statistics_warnings: statisticsWarnings(agent.result?.statistics, question),
      code_read_warnings: codeReadWarnings,
    };
    const blocked = checks.dummy_data_signals.length > 0;
    let resultArtifacts: Artifact[] = [];
    let persistedStatistics = agent.result?.statistics || {};
    if (agent.ok && agent.result) {
      const statsPhysicalPath = artifacts.paths.resolve(statsPath);
      await this.dependencies.writeText(join(run.runDir, "exec.log"), String(agent.result.exec_log || ""));
      if (existsSync(statsPhysicalPath)) {
        try {
          persistedStatistics = JSON.parse(await readFile(statsPhysicalPath, "utf8"));
        } catch {
          await this.dependencies.writeJson(statsPhysicalPath, persistedStatistics);
        }
      } else {
        await this.dependencies.writeJson(statsPhysicalPath, persistedStatistics);
      }
      checks = { ...checks, statistics_warnings: statisticsWarnings(persistedStatistics, question) };
      const codeArtifacts = codeFiles.map((file, index) => artifacts.make(index === 0 ? "generated_code" : `code_${index + 1}`, file.path, "code", { role: index === 0 ? "analysis_script" : "support_script" }));
      resultArtifacts = artifacts.merge([], [
        ...artifacts.normalizeMany(agent.result.artifacts || []),
        ...codeArtifacts,
        artifacts.make("exec_log", join(run.runDir, "exec.log"), "log"),
        artifacts.make("statistics", statsPhysicalPath, "statistics"),
      ]);
      if (!resultArtifacts.some((artifact) => artifact.kind === "figure")) resultArtifacts = artifacts.merge(resultArtifacts, deliverables.filter((artifact) => artifact.kind === "figure"));
      checks = { ...checks, artifact_warnings: resultArtifacts.filter((artifact) => !artifact.optional && !existsSync(artifacts.paths.resolve(artifact.path))).map((artifact) => `declared ${artifact.kind} artifact is missing: ${artifact.path} (resolved: ${artifacts.paths.resolve(artifact.path)})`) };
      await this.dependencies.lifecycle.updateState(run, { code_attempt: previousAttempt + 1, code: { ...agent.result, statistics: persistedStatistics, code_files: codeFiles, artifacts: resultArtifacts }, checks, artifacts: resultArtifacts });
      await this.dependencies.snapshot(run, `after_code_attempt_${previousAttempt + 1}`);
    }
    await this.dependencies.appendEvent({ run_id: run.runId, event: "seekbrain_code_execute", ok: agent.ok, blocked_by_dummy_data: blocked, code_attempt: previousAttempt + 1 });
    return {
      run_id: run.runId,
      ok: agent.ok,
      error: agent.error,
      result: agent.result ? { summary: agent.result.summary, warnings: agent.result.warnings, statistics: persistedStatistics } : undefined,
      artifacts: resultArtifacts,
      checks,
      blocked_by_dummy_data: blocked,
      code_attempt: previousAttempt + 1,
      next_step: agent.ok ? { tool: "seekbrain_validation_run", args: { run_id: run.runId } } : undefined,
      output_path: agent.output_path,
      debug: { subagent_dir: agent.subagent_dir, snapshot_dir: agent.snapshot_dir },
    };
  }
}

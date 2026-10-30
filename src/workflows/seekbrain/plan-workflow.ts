import { existsSync } from "node:fs";
import { referenceContext } from "./reference-context.ts";
import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { Value } from "typebox/value";
import { ExecutionContractSchema, type ExecutionContract } from "../../core/index.ts";
import type { ExistingPiCustomTool } from "../../extension/existing-pi-agent-adapter.ts";
import { inferRecipeAccepts } from "../../targeted-skill/recipe-card.ts";
import type { StageAgentResult } from "./research-skill-workflow.ts";
import type { RunLifecycleWorkflow, WorkflowJson, WorkflowRunContext } from "./run-lifecycle.ts";

export interface PlanWorkflowDependencies {
  lifecycle: RunLifecycleWorkflow;
  runAgent(input: {
    runDir: string;
    prompt: string;
    agentConfig: WorkflowJson;
    finalizeSchema: unknown;
    customTools?: ExistingPiCustomTool[];
    signal?: AbortSignal;
    beforeToolCall?: (event: { toolName: string; toolCallId?: string; args: unknown }) => Promise<void> | void;
  }): Promise<StageAgentResult>;
  createCustomTools?(runDir: string): ExistingPiCustomTool[];
  writeText(path: string, value: string): Promise<void>;
  writeJson(path: string, value: WorkflowJson): Promise<void>;
  appendEvent(event: WorkflowJson): Promise<void>;
}

export interface PlanWorkflowInput {
  cwd: string;
  runId: string;
  rolePrompt: string;
  agentConfig: WorkflowJson;
  finalizeSchema: unknown;
  humanReviewRequired: boolean;
  signal?: AbortSignal;
  onToolCall?: (event: { toolName: string; toolCallId?: string; args: unknown }) => void;
}

export interface RevisePlanWorkflowInput {
  cwd: string;
  runId: string;
  feedback?: string;
  restorePrevious?: boolean;
  rolePrompt: string;
  agentConfig: WorkflowJson;
  finalizeSchema: unknown;
  expectedRevision?: number;
  signal?: AbortSignal;
}

function resolveQuestion(run: WorkflowRunContext): string {
  const value = String(run.state.question || "").trim();
  if (!value) {
    throw new Error("question is required in state.json. Persist it via seekbrain_run_start/seekbrain_run_resume.");
  }
  return value;
}

interface DatasetReferences {
  metadataPath?: string;
  datasetRoot?: string;
  legacyInlineMetadata?: string;
}

interface BasicContext {
  species?: string[];
  primary_modalities?: string[];
  observation_units?: string[];
  cohort?: string[];
  available_annotations?: string[];
}

function basicContext(question: string): BasicContext | undefined {
  const accepts = inferRecipeAccepts({ text: question });
  const hasNeuron = /\b(?:per[- ]|single[- ])?neurons?\b/i.test(question);
  let primaryModalities = accepts.modalities.filter((modality) => !(
    modality === "atlas"
    && accepts.modalities.length > 1
    && /\bbrain[- ]region (?:annotation|identity|label)s?\b/i.test(question)
  ));
  if (/\b(?:rna|mrna)\s+(?:transcript\s+)?spot[- ]counts?\b/i.test(question)) {
    primaryModalities = ["RNA transcript spot counts", ...primaryModalities.filter((modality) => modality !== "omics")];
  }
  const observationUnits = [
    hasNeuron ? "neuron" : "",
    !hasNeuron && /\b(?:per[- ]|single[- ])?cells?\b/i.test(question) ? "cell" : "",
    /\btrials?\b/i.test(question) ? "trial" : "",
    /\bsessions?\b/i.test(question) ? "session" : "",
  ].filter(Boolean);
  const cohort = [...new Set([
    ...(question.match(/\b(?:fish|mouse|rat|subject|animal|sample|session)\s*[-_]?\d+(?:\s*[-–]\s*\d+)?\b/gi) || []),
    ...(question.match(/\b(?:fish|mouse|rat|subject|animal|sample|session)\s*[-_]?\d+(?:\s*,\s*(?:and\s+)?(?:fish|mouse|rat|subject|animal|sample|session)?\s*[-_]?\d+)+\b/gi) || []),
  ].map((value) => value.replace(/\s+/g, " ").trim()))];
  const annotations = [
    /\bgene identit(?:y|ies)\b/i.test(question) ? "gene identity" : "",
    /\bfish identit(?:y|ies)\b/i.test(question) ? "fish identity" : "",
    /\bbrain[- ]region (?:annotation|identity|label)s?\b/i.test(question) ? "brain region" : "",
    /\bspatial (?:annotation|coordinate|location)s?\b/i.test(question) ? "spatial location" : "",
    /\bcell[- ]type (?:annotation|identity|label)s?\b/i.test(question) ? "cell type" : "",
  ].filter(Boolean);
  const context: BasicContext = {
    ...(accepts.species.length ? { species: accepts.species } : {}),
    ...(primaryModalities.length ? { primary_modalities: primaryModalities } : {}),
    ...(observationUnits.length ? { observation_units: [...new Set(observationUnits)] } : {}),
    ...(cohort.length ? { cohort } : {}),
    ...(annotations.length ? { available_annotations: [...new Set(annotations)] } : {}),
  };
  return Object.keys(context).length ? context : undefined;
}

function declaredDatasetRoot(metadata: WorkflowJson): string {
  const dataset = metadata.dataset && typeof metadata.dataset === "object" ? metadata.dataset as WorkflowJson : {};
  const paths = metadata.paths && typeof metadata.paths === "object" ? metadata.paths as WorkflowJson : {};
  return String(
    metadata.root_dir
    || metadata.data_dir
    || dataset.root_dir
    || dataset.data_dir
    || paths.root_dir
    || paths.data_dir
    || "",
  ).trim();
}

function resolvedDatasetRoot(value: string, metadataPath: string | undefined, cwd: string): string | undefined {
  if (!value) return undefined;
  if (isAbsolute(value)) return resolve(value);
  const candidates = [
    ...(metadataPath ? [resolve(dirname(metadataPath), value)] : []),
    resolve(cwd, value),
  ];
  return candidates.find((candidate) => existsSync(candidate)) || candidates[0];
}

async function datasetReferences(input: { cwd: string }, run: WorkflowRunContext): Promise<DatasetReferences> {
  const storedPath = String(run.state.metadata_json_path || "").trim();
  if (storedPath) {
    const candidates = [...new Set([
      isAbsolute(storedPath) ? resolve(storedPath) : resolve(input.cwd, storedPath),
      resolve(run.runDir, storedPath),
    ])];
    for (const path of candidates) {
      try {
        const raw = await readFile(path, "utf8");
        let metadata: WorkflowJson = {};
        try { metadata = JSON.parse(raw) as WorkflowJson; } catch { /* The Plan Agent can inspect non-JSON legacy metadata directly. */ }
        return {
          metadataPath: path,
          datasetRoot: resolvedDatasetRoot(declaredDatasetRoot(metadata), path, input.cwd),
        };
      } catch { /* try the next legacy-relative location */ }
    }
    throw new Error(`Unable to read dataset metadata '${storedPath}'.`);
  }
  const legacyInlineMetadata = String(run.state.data_info || "").trim();
  let metadata: WorkflowJson = {};
  if (legacyInlineMetadata) {
    try { metadata = JSON.parse(legacyInlineMetadata) as WorkflowJson; } catch { /* preserve legacy text below */ }
  }
  return {
    datasetRoot: resolvedDatasetRoot(declaredDatasetRoot(metadata), undefined, input.cwd),
    legacyInlineMetadata: legacyInlineMetadata || undefined,
  };
}

function datasetReferencePrompt(references: DatasetReferences): string {
  return [
    references.metadataPath ? `Dataset metadata JSON path:\n${references.metadataPath}` : "",
    references.datasetRoot ? `Dataset root:\n${references.datasetRoot}` : "",
    references.legacyInlineMetadata ? `Legacy inline dataset metadata:\n${references.legacyInlineMetadata}` : "",
    references.metadataPath || references.datasetRoot
      ? "Use the metadata as a navigation aid and inspect the dataset read-only when exact files, shapes, axes, cohorts, or alignments materially affect the Plan."
      : "",
  ].filter(Boolean).join("\n\n");
}

async function acceptedMethodGuidance(run: WorkflowRunContext): Promise<string> {
  const methodContract = String(run.state.targeted_skill_result?.method_contract || "").trim();
  if (methodContract) return methodContract;
  const path = String(run.state.targeted_skill_path || join(run.runDir, "targeted_skill.md"));
  if (existsSync(path)) return readFile(path, "utf8");
  return String(run.state.targeted_skill || "").trim();
}

function normalizedExecutionContract(value: unknown): ExecutionContract {
  const source = value && typeof value === "object" ? value as WorkflowJson : {};
  const uniqueStrings = (items: unknown, limit: number) => Array.isArray(items)
    ? [...new Set(items.map((item) => String(item || "").replace(/\s+/g, " ").trim()).filter(Boolean))].slice(0, limit)
    : [];
  const contract = {
    requirements: uniqueStrings(source.requirements, 24),
    validation_checks: uniqueStrings(source.validation_checks, 24),
  };
  if (!Value.Check(ExecutionContractSchema, contract)) {
    throw new Error("Formulation Agent returned an invalid execution_contract; requirements and validation_checks must both be non-empty.");
  }
  return contract;
}

async function existingExecutionContract(run: WorkflowRunContext): Promise<ExecutionContract | undefined> {
  if (Value.Check(ExecutionContractSchema, run.state.execution_contract)) {
    return normalizedExecutionContract(run.state.execution_contract);
  }
  const path = String(run.state.execution_contract_path || join(run.runDir, "execution_contract.json"));
  try { return normalizedExecutionContract(JSON.parse(await readFile(path, "utf8"))); }
  catch { return undefined; }
}

function reviewEntry(run: WorkflowRunContext): WorkflowJson {
  const entry = run.state.human_reviews?.plan || {};
  return entry && typeof entry === "object" ? entry : {};
}

function feedbackText(run: WorkflowRunContext): string {
  const feedback = reviewEntry(run).feedback;
  if (!Array.isArray(feedback) || !feedback.length) return "";
  return feedback
    .map((entry: unknown, index: number) => {
      const text = typeof entry === "string" ? entry : String((entry as WorkflowJson)?.text || "");
      return text.trim() ? `${index + 1}. ${text.trim()}` : "";
    })
    .filter(Boolean)
    .join("\n");
}

function finalizationPrompt(rolePrompt: string, body: string): string {
  return [
    rolePrompt.trim(),
    "",
    "Return only by calling the finalize tool. Do not expose scratch reasoning.",
    "Required final tool: finalize_plan",
    "",
    body,
  ].join("\n");
}

export class PlanWorkflow {
  constructor(readonly dependencies: PlanWorkflowDependencies) {}

  async execute(input: PlanWorkflowInput): Promise<WorkflowJson> {
    const run = await this.dependencies.lifecycle.resolveRun(input.cwd, input.runId);
    const researchQuestion = resolveQuestion(run);
    const dataset = await datasetReferences(input, run);
    const methodGuidance = await acceptedMethodGuidance(run);
    const humanFeedback = feedbackText(run);
    const context = basicContext(researchQuestion);
    const prompt = finalizationPrompt(input.rolePrompt, [
      `Question:\n${researchQuestion}`,
      context ? `Basic context (atomic facts copied from the Question; convenience only, never a method contract):\n${JSON.stringify(context, null, 2)}` : "",
      datasetReferencePrompt(dataset),
      ...(run.state.reference_paths?.length ? [referenceContext(run, input.cwd)] : []),
      methodGuidance ? `Accepted method guidance:\n${methodGuidance}` : "Accepted method guidance: null",
      `Deliverables:\n${JSON.stringify(run.state.deliverables || [], null, 2)}`,
      humanFeedback ? `Researcher feedback for the methodological schema:\n${humanFeedback}` : "",
      "Finalize with: { plan_markdown, execution_contract: { requirements, validation_checks }, review_summary, warnings }. execution_contract must contain only scientifically material, executable requirements and concrete checks that Validation can verify from code, statistics, and figures. review_summary is the concise text shown to the researcher approval UI; do not copy the full plan.",
    ].filter(Boolean).join("\n\n"));
    const agent = await this.dependencies.runAgent({
      runDir: run.runDir,
      prompt,
      agentConfig: input.agentConfig,
      finalizeSchema: input.finalizeSchema,
      customTools: this.dependencies.createCustomTools?.(run.runDir),
      signal: input.signal,
      beforeToolCall: input.onToolCall,
    });
    const planPath = join(run.runDir, "plan.md");
    const executionContractPath = join(run.runDir, "execution_contract.json");
    const currentRevision = Number(run.state.plan?.revision || 0);
    const nextRevision = currentRevision + 1;
    let executionContract: ExecutionContract | undefined;
    if (agent.ok && agent.result) {
      try {
        executionContract = normalizedExecutionContract(agent.result.execution_contract);
      } catch (error) {
        await this.dependencies.appendEvent({ run_id: run.runId, event: "seekbrain_formulation_generate", ok: false, reason: "invalid_execution_contract" });
        return {
          run_id: run.runId,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
          output_path: agent.output_path,
          debug: { subagent_dir: agent.subagent_dir, snapshot_dir: agent.snapshot_dir },
        };
      }
      await this.dependencies.writeText(planPath, String(agent.result.plan_markdown));
      await this.dependencies.writeJson(executionContractPath, executionContract as unknown as WorkflowJson);
      await this.dependencies.lifecycle.updateState(run, {
        execution_contract: executionContract,
        execution_contract_path: executionContractPath,
        plan: {
          path: planPath,
          execution_contract_path: executionContractPath,
          review_summary: String(agent.result.review_summary || ""),
          warnings: Array.isArray(agent.result.warnings) ? agent.result.warnings : [],
          revision: nextRevision,
        },
      });
    }
    await this.dependencies.appendEvent({ run_id: run.runId, event: "seekbrain_formulation_generate", ok: agent.ok });

    const feedbackAfter = feedbackText(run);
    const approvedAfter = reviewEntry(run).status === "approved";
    const needsUserReview = Boolean(agent.ok && input.humanReviewRequired && !approvedAfter);
    return {
      run_id: run.runId,
      ok: agent.ok,
      error: agent.error,
      plan_path: agent.ok ? planPath : undefined,
      execution_contract_path: agent.ok ? executionContractPath : undefined,
      revision: agent.ok ? nextRevision : currentRevision,
      output_path: agent.output_path,
      result: agent.result ? {
        execution_contract: executionContract,
        review_summary: agent.result.review_summary,
        warnings: agent.result.warnings,
      } : undefined,
      human_review: {
        required: input.humanReviewRequired,
        approved: approvedAfter,
        feedback: feedbackAfter,
        needs_user_review: needsUserReview,
        review_owner: "main_agent",
      },
      guidance: needsUserReview
        ? "Show review_summary and plan_path, then call seekbrain_formulation_researcher_review. If feedback is returned, revise locally with seekbrain_formulation_update when appropriate; rerun generation only for broad redesigns. Do not call seekbrain_code_execute until approval is recorded."
        : undefined,
      debug: { subagent_dir: agent.subagent_dir, snapshot_dir: agent.snapshot_dir },
    };
  }

  async revise(input: RevisePlanWorkflowInput): Promise<WorkflowJson> {
    const run = await this.dependencies.lifecycle.resolveRun(input.cwd, input.runId);
    const planPath = String(run.state.plan?.path || join(run.runDir, "plan.md"));
    const revision = Number(run.state.plan?.revision || 0);
    if (input.expectedRevision !== undefined && revision !== input.expectedRevision) {
      return { ok: false, run_id: run.runId, stale_revision: true, expected_revision: input.expectedRevision, current_revision: revision, plan_path: planPath };
    }
    const feedback = String(input.feedback || "").trim();
    if (!feedback && input.restorePrevious !== true) return { ok: false, run_id: run.runId, error: "Plan revision feedback is required." };
    let currentPlan: string;
    try { currentPlan = (await readFile(planPath, "utf8")).trim(); }
    catch (error) { return { ok: false, run_id: run.runId, error: `Unable to read current plan '${planPath}': ${String(error)}` }; }
    const executionContractPath = String(run.state.execution_contract_path || join(run.runDir, "execution_contract.json"));
    const currentContract = await existingExecutionContract(run);
    const previousPath = join(run.runDir, "plan.previous.json");
    const currentSnapshot = {
      plan_markdown: currentPlan,
      execution_contract: currentContract,
      review_summary: String(run.state.plan?.review_summary || ""),
      warnings: Array.isArray(run.state.plan?.warnings) ? run.state.plan.warnings : [],
      revision,
    };
    if (input.restorePrevious === true) {
      let previous: WorkflowJson;
      try { previous = JSON.parse(await readFile(previousPath, "utf8")); }
      catch { return { ok: false, run_id: run.runId, error: "No previous Plan version is available to restore.", plan_path: planPath }; }
      const previousMarkdown = String(previous.plan_markdown || "").trim();
      if (!previousMarkdown) return { ok: false, run_id: run.runId, error: "The previous Plan snapshot is invalid.", plan_path: planPath };
      let restoredContract: ExecutionContract;
      try { restoredContract = normalizedExecutionContract(previous.execution_contract || currentContract); }
      catch (error) {
        return { ok: false, run_id: run.runId, error: error instanceof Error ? error.message : String(error), plan_path: planPath };
      }
      const nextRevision = revision + 1;
      await this.dependencies.writeText(previousPath, JSON.stringify(currentSnapshot, null, 2));
      await this.dependencies.writeText(planPath, previousMarkdown);
      await this.dependencies.writeJson(executionContractPath, restoredContract as unknown as WorkflowJson);
      await this.dependencies.lifecycle.updateState(run, {
        execution_contract: restoredContract,
        execution_contract_path: executionContractPath,
        plan: {
          path: planPath,
          execution_contract_path: executionContractPath,
          review_summary: String(previous.review_summary || "Restored the previous methodological Plan."),
          warnings: Array.isArray(previous.warnings) ? previous.warnings : [],
          revision: nextRevision,
          previous_path: previousPath,
          restored_from_revision: Number(previous.revision || 0),
        },
      });
      await this.dependencies.appendEvent({ run_id: run.runId, event: "seekbrain_formulation_rollback", ok: true, base_revision: revision, revision: nextRevision });
      return {
        ok: true,
        run_id: run.runId,
        plan_path: planPath,
        execution_contract_path: executionContractPath,
        previous_plan_path: previousPath,
        revision: nextRevision,
        rolled_back: true,
        result: { execution_contract: restoredContract, review_summary: String(previous.review_summary || "Restored the previous methodological Plan."), warnings: previous.warnings || [] },
        needs_user_review: true,
      };
    }
    const question = resolveQuestion(run);
    const context = basicContext(question);
    const dataset = await datasetReferences(input, run);
    const prompt = finalizationPrompt(input.rolePrompt, [
      `Question:\n${question}`,
      context ? `Basic context (atomic facts copied from the Question; convenience only, never a method contract):\n${JSON.stringify(context, null, 2)}` : "",
      datasetReferencePrompt(dataset),
      `Current authoritative methodological plan:\n${currentPlan}`,
      currentContract ? `Current execution contract:\n${JSON.stringify(currentContract, null, 2)}` : "",
      `Latest researcher feedback:\n${feedback}`,
      `Deliverables:\n${JSON.stringify(run.state.deliverables || [], null, 2)}`,
      "The current plan already contains every previously accepted change. Apply only the latest feedback, preserve all unrelated details, and do not add analyses the researcher did not request.",
      "Finalize with: { plan_markdown, execution_contract: { requirements, validation_checks }, review_summary, warnings }. Update the execution contract only where the feedback changes scientifically material requirements or their validation checks. Do not reassess Recipe relevance or redesign Statistics/Visualisation beyond the feedback.",
    ].filter(Boolean).join("\n\n"));
    const agent = await this.dependencies.runAgent({
      runDir: run.runDir,
      prompt,
      agentConfig: input.agentConfig,
      finalizeSchema: input.finalizeSchema,
      customTools: this.dependencies.createCustomTools?.(run.runDir),
      signal: input.signal,
    });
    if (!agent.ok || !agent.result) return { ok: false, run_id: run.runId, error: agent.error || "Plan revision did not complete." };
    let revisedContract: ExecutionContract;
    try { revisedContract = normalizedExecutionContract(agent.result.execution_contract); }
    catch (error) { return { ok: false, run_id: run.runId, error: error instanceof Error ? error.message : String(error) }; }
    const nextRevision = revision + 1;
    await this.dependencies.writeText(previousPath, JSON.stringify(currentSnapshot, null, 2));
    await this.dependencies.writeText(planPath, String(agent.result.plan_markdown));
    await this.dependencies.writeJson(executionContractPath, revisedContract as unknown as WorkflowJson);
    await this.dependencies.lifecycle.updateState(run, {
      execution_contract: revisedContract,
      execution_contract_path: executionContractPath,
      plan: {
        path: planPath,
        execution_contract_path: executionContractPath,
        review_summary: String(agent.result.review_summary || ""),
        warnings: Array.isArray(agent.result.warnings) ? agent.result.warnings : (run.state.plan?.warnings || []),
        revision: nextRevision,
        previous_path: previousPath,
      },
    });
    await this.dependencies.appendEvent({ run_id: run.runId, event: "seekbrain_formulation_revise", ok: true, base_revision: revision, revision: nextRevision });
    return {
      ok: true,
      run_id: run.runId,
      plan_path: planPath,
      execution_contract_path: executionContractPath,
      previous_plan_path: previousPath,
      revision: nextRevision,
      result: { execution_contract: revisedContract, review_summary: String(agent.result.review_summary || ""), warnings: agent.result.warnings || [] },
      needs_user_review: true,
    };
  }
}

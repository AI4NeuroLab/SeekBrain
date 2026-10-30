import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { referenceContext } from "./reference-context.ts";
import type { StageAgentResult } from "./research-skill-workflow.ts";
import { readCanonicalMetadata, type RunLifecycleWorkflow, type WorkflowJson } from "./run-lifecycle.ts";

export type CreativeOperation =
  | "increase_temperature"
  | "replace_validation"
  | "freeze_constraint"
  | "crossover"
  | "challenge"
  | "apply_method"
  | "continue";

export interface CreativeResearchPlanningDependencies {
  lifecycle: RunLifecycleWorkflow;
  runAgent(input: {
    runDir: string;
    prompt: string;
    finalizeTool: string;
    agentConfig: WorkflowJson;
    finalizeSchema: unknown;
    signal?: AbortSignal;
    tools?: string[];
  }): Promise<StageAgentResult>;
  writeJson(path: string, value: WorkflowJson): Promise<void>;
  appendEvent(event: WorkflowJson): Promise<void>;
}

export interface StartCreativeSessionInput {
  cwd: string;
  runId: string;
  rolePrompt: string;
  agentConfig: WorkflowJson;
  finalizeSchema: unknown;
  signal?: AbortSignal;
}

export interface UpdateCreativeSessionInput extends StartCreativeSessionInput {
  operation: CreativeOperation;
  instruction: string;
  sourceIdeaIds?: string[];
  sourceMethodIds?: string[];
}

export interface SelectCreativeIdeaInput {
  cwd: string;
  runId: string;
  ideaId: string;
}

function creativeDir(run: WorkflowJson): string {
  return join(run.runDir, "creative_research");
}

function sessionPath(run: WorkflowJson): string {
  return join(creativeDir(run), "creative_session.json");
}

function searchPoolPath(run: WorkflowJson): string {
  return join(creativeDir(run), "creative_search_pool.json");
}

async function readJson(path: string): Promise<WorkflowJson | undefined> {
  try { return JSON.parse(await readFile(path, "utf8")) as WorkflowJson; }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

function clean(value: unknown, limit = 2_000): string {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function stringList(value: unknown, limit = 20): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => clean(item, 500)).filter(Boolean))].slice(0, limit);
}

function prompt(rolePrompt: string, finalizeTool: string, body: string): string {
  return [
    rolePrompt.trim(),
    "",
    "Return only by calling the finalize tool. Do not expose scratch reasoning.",
    `Required final tool: ${finalizeTool}`,
    "",
    body,
  ].join("\n");
}

function normalizeAbstraction(value: unknown): WorkflowJson {
  const item = value && typeof value === "object" ? value as WorkflowJson : {};
  return {
    observed_pattern: clean(item.observed_pattern),
    entities: clean(item.entities),
    relation: clean(item.relation),
    candidate_dynamics: stringList(item.candidate_dynamics, 8),
    observable_signature: clean(item.observable_signature),
  };
}

function evidenceIndex(ledger: WorkflowJson | undefined): Map<string, string> {
  return new Map(
    (Array.isArray(ledger?.entries) ? ledger.entries : [])
      .map((entry: WorkflowJson) => [clean(entry?.evidence_id, 100), clean(entry?.intent, 100)] as const)
      .filter(([id]) => Boolean(id)),
  );
}

function normalizeIdea(
  value: unknown,
  index: number,
  allowedEvidence: Map<string, string>,
  allowedMethods: Set<string>,
): WorkflowJson {
  const item = value && typeof value === "object" ? value as WorkflowJson : {};
  const temperature = index === 0 ? "low" : index === 1 ? "medium" : "high";
  const transfer = item.remote_transfer && typeof item.remote_transfer === "object"
    ? item.remote_transfer as WorkflowJson
    : {};
  const lineage = item.lineage && typeof item.lineage === "object"
    ? item.lineage as WorkflowJson
    : {};
  const evidenceIds = stringList(item.evidence_ids, 20).filter((id) => allowedEvidence.has(id));
  const evidenceByIntent = {
    remote_analogy: evidenceIds.filter((id) => allowedEvidence.get(id) === "remote_analogy"),
    nearest_prior: evidenceIds.filter((id) => allowedEvidence.get(id) === "nearest_prior"),
    counterevidence: evidenceIds.filter((id) => allowedEvidence.get(id) === "counterevidence"),
  };
  return {
    idea_id: clean(item.idea_id, 100) || `H${index + 1}`,
    temperature,
    status: "active",
    parent_ids: stringList(item.parent_ids, 8),
    title: clean(item.title, 300),
    research_question: clean(item.research_question),
    core_anomaly: clean(item.core_anomaly),
    hypothesis: clean(item.hypothesis),
    mechanism: clean(item.mechanism),
    remote_transfer: {
      source_domain: clean(transfer.source_domain, 500),
      transferred_mechanism: clean(transfer.transferred_mechanism),
    },
    why_data_can_test: clean(item.why_data_can_test),
    discriminating_prediction: clean(item.discriminating_prediction),
    nearest_prior_boundary: evidenceByIntent.nearest_prior.length
      ? clean(item.nearest_prior_boundary)
      : "Not assessed by scientific inspiration search in this session.",
    strongest_counterevidence: clean(item.strongest_counterevidence),
    minimal_decisive_analysis: clean(item.minimal_decisive_analysis),
    evidence_ids: evidenceIds,
    evidence_by_intent: evidenceByIntent,
    method_ids: stringList(item.method_ids, 10).filter((id) => allowedMethods.has(id)),
    lineage: {
      user: stringList(lineage.user, 8),
      retrieval: stringList(lineage.retrieval, 8),
      seekbrain: stringList(lineage.seekbrain, 8),
    },
  };
}

function normalizeSession(
  value: WorkflowJson,
  allowedEvidence: Map<string, string>,
  allowedMethods: Set<string>,
  previous?: WorkflowJson,
): WorkflowJson {
  const rawIdeas = Array.isArray(value.ideas) ? value.ideas : [];
  if (rawIdeas.length !== 3) throw new Error(`Creative Research must return exactly 3 active Idea Cards; received ${rawIdeas.length}.`);
  const ideas = rawIdeas.map((item, index) => normalizeIdea(item, index, allowedEvidence, allowedMethods));
  const ids = ideas.map((idea) => idea.idea_id);
  if (new Set(ids).size !== ids.length) throw new Error("Creative Idea Card IDs must be unique.");
  for (const idea of ideas) {
    for (const field of ["title", "research_question", "hypothesis", "mechanism", "why_data_can_test", "discriminating_prediction", "minimal_decisive_analysis"]) {
      if (!idea[field]) throw new Error(`Creative Idea Card '${idea.idea_id}' is missing '${field}'.`);
    }
  }
  const now = new Date().toISOString();
  return {
    version: 1,
    status: "awaiting_selection",
    created_at: clean(previous?.created_at, 100) || now,
    updated_at: now,
    revision: Number(previous?.revision || 0) + (previous ? 1 : 0),
    session_summary: clean(value.session_summary),
    target_abstraction: normalizeAbstraction(value.target_abstraction),
    frozen_constraints: stringList(value.frozen_constraints, 20),
    ideas,
  };
}

async function loadSession(run: WorkflowJson): Promise<WorkflowJson> {
  const session = await readJson(sessionPath(run));
  if (!session) throw new Error("Creative Research session is missing. Generate Idea Cards first.");
  return session;
}

function response(run: WorkflowJson, session: WorkflowJson, reused = false): WorkflowJson {
  return {
    ok: true,
    run_id: run.runId,
    research_planning_strategy: "creative",
    creative_status: session.status,
    session_summary: session.session_summary,
    target_abstraction: session.target_abstraction,
    frozen_constraints: session.frozen_constraints,
    idea_cards: session.ideas,
    idea_count: session.ideas.length,
    creative_session_path: sessionPath(run),
    creative_search_pool_path: searchPoolPath(run),
    reused,
    needs_idea_selection: true,
    next_tool: "seekbrain_creative_update",
  };
}

export class CreativeResearchPlanningWorkflow {
  constructor(readonly dependencies: CreativeResearchPlanningDependencies) {}

  async generateText(input: StartCreativeSessionInput): Promise<WorkflowJson> {
    const run = await this.dependencies.lifecycle.resolveRun(input.cwd, input.runId);
    const path = join(creativeDir(run), "automatic_ideas.json");
    const existing = await readJson(path);
    if (typeof existing?.text === "string" && existing.text.trim()) {
      return { ok: true, run_id: run.runId, text: existing.text, ideas_path: path, reused: true };
    }
    const assessment = run.state.research_planning?.assessment || {};
    const agent = await this.dependencies.runAgent({
      runDir: run.runDir,
      finalizeTool: "finalize_creative_ideas_text",
      finalizeSchema: input.finalizeSchema,
      agentConfig: input.agentConfig,
      tools: ["read", "ls", "bash"],
      signal: input.signal,
      prompt: prompt(input.rolePrompt, "finalize_creative_ideas_text", [
        `Research request:\n${String(run.state.question || "")}`,
        `User constraints:\n${JSON.stringify(assessment.task_brief?.hard_constraints || [])}`,
        `Dataset metadata:\n${await readCanonicalMetadata(run)}`,
        referenceContext(run, input.cwd),
        "Return the three ideas together as natural text in { text }. Preserve low, medium, high order.",
      ].join("\n\n")),
    });
    if (!agent.ok || typeof agent.result?.text !== "string" || !agent.result.text.trim()) {
      return { ok: false, run_id: run.runId, error: agent.error || "Creative ideas text is empty." };
    }
    // Preserve the text verbatim: no card normalization, certificate, or ID ledger.
    const text = agent.result.text;
    await this.dependencies.writeJson(path, { text });
    await this.dependencies.appendEvent({ run_id: run.runId, event: "seekbrain_creative_generate_text", ok: true });
    return { ok: true, run_id: run.runId, text, ideas_path: path, reused: false };
  }

  async start(input: StartCreativeSessionInput): Promise<WorkflowJson> {
    const run = await this.dependencies.lifecycle.resolveRun(input.cwd, input.runId);
    const planning = run.state.research_planning || {};
    if (planning.status !== "approved" && planning.status !== "pending_review") {
      return {
        ok: false,
        run_id: run.runId,
        blocked_by_human_review: true,
        error: "Creative Research Idea Cards require a run awaiting or approved for Research Planning.",
      };
    }
    const existing = await readJson(sessionPath(run));
    if (existing?.status === "awaiting_selection" && Array.isArray(existing.ideas) && existing.ideas.length === 3) {
      return response(run, existing, true);
    }
    const metadata = (await readCanonicalMetadata(run)).slice(0, 16_000);
    const assessment = planning.assessment || {};
    const pool = await readJson(searchPoolPath(run));
    const methods = (Array.isArray(pool?.methods) ? pool.methods : []).filter((method: WorkflowJson) => method.status !== "rejected");
    const agent = await this.dependencies.runAgent({
      runDir: run.runDir,
      finalizeTool: "finalize_creative_ideas",
      prompt: prompt(input.rolePrompt, "finalize_creative_ideas", [
        `Researcher's question or intuition:\n${String(run.state.question || "")}`,
        `Scientific goal from intake:\n${String(assessment.inferred_scientific_goal || "")}`,
        `Background from intake:\n${String(assessment.inferred_background || "")}`,
        `TaskBrief constraints:\n${JSON.stringify(assessment.task_brief || {}, null, 2)}`,
        `Dataset metadata:\n${metadata}`,
        `Reusable methods already admitted to the Creative paper pool:\n${JSON.stringify(methods, null, 2)}`,
        "Create the initial low-, medium-, and high-temperature Idea Cards. Keep exactly three active cards ordered low, medium, high.",
        "Use admitted methods only when they materially improve a mechanism or decisive test. Record their M-IDs in method_ids. Do not search from this step.",
        "Finalize with { session_summary, target_abstraction, frozen_constraints, ideas }.",
      ].join("\n\n")),
      agentConfig: input.agentConfig,
      finalizeSchema: input.finalizeSchema,
      signal: input.signal,
    });
    if (!agent.ok || !agent.result) {
      await this.dependencies.appendEvent({ run_id: run.runId, event: "seekbrain_creative_generate", ok: false });
      return { ok: false, run_id: run.runId, error: agent.error || "Creative Idea generation did not complete." };
    }
    const allowedMethods = new Set(methods.map((method: WorkflowJson) => String(method.method_id)));
    let session: WorkflowJson;
    try { session = normalizeSession(agent.result, evidenceIndex(pool), allowedMethods); }
    catch (error) { return { ok: false, run_id: run.runId, error: error instanceof Error ? error.message : String(error) }; }
    await this.dependencies.writeJson(sessionPath(run), session);
    await this.dependencies.lifecycle.updateState(run, {
      research_planning: {
        ...planning,
        research_planning_strategy: "creative",
        creative_status: "ideas_ready",
        creative_session_path: sessionPath(run),
        creative_search_pool_path: searchPoolPath(run),
      },
    });
    await this.dependencies.appendEvent({ run_id: run.runId, event: "seekbrain_creative_generate", ok: true, idea_count: 3 });
    return response(run, session);
  }

  async update(input: UpdateCreativeSessionInput): Promise<WorkflowJson> {
    const run = await this.dependencies.lifecycle.resolveRun(input.cwd, input.runId);
    const current = await loadSession(run);
    if (current.status !== "awaiting_selection") {
      return { ok: false, run_id: run.runId, error: "The Creative Research session already has a selected Idea Card." };
    }
    const instruction = clean(input.instruction, 4_000);
    if (!instruction) return { ok: false, run_id: run.runId, error: "A researcher instruction is required for a Creative update." };
    const pool = await readJson(searchPoolPath(run));
    const availableMethods = (Array.isArray(pool?.methods) ? pool.methods : []).filter((method: WorkflowJson) => method.status !== "rejected");
    const requestedMethodIds = new Set(input.sourceMethodIds || []);
    const selectedMethods = availableMethods.filter((method: WorkflowJson) => requestedMethodIds.has(String(method.method_id)));
    if (requestedMethodIds.size && selectedMethods.length !== requestedMethodIds.size) {
      return { ok: false, run_id: run.runId, error: "One or more requested Creative method IDs are unavailable." };
    }
    const agent = await this.dependencies.runAgent({
      runDir: run.runDir,
      finalizeTool: "finalize_creative_ideas",
      prompt: prompt(input.rolePrompt, "finalize_creative_ideas", [
        `Current Creative Session:\n${JSON.stringify(current, null, 2)}`,
        `Requested operation: ${input.operation}`,
        `Researcher instruction (highest priority):\n${instruction}`,
        `Source Idea IDs when applicable:\n${JSON.stringify(input.sourceIdeaIds || [])}`,
        `Selected paper-pool methods to apply or combine:\n${JSON.stringify(selectedMethods, null, 2)}`,
        "Apply only this operation. Preserve unaffected cards, IDs, evidence links, and frozen constraints. A material mechanism or decisive-test change creates a new ID with parent_ids.",
        "Return exactly three active cards ordered low, medium, high. Do not search in this step. Record every adopted method in method_ids.",
        "Finalize with { session_summary, target_abstraction, frozen_constraints, ideas }.",
      ].join("\n\n")),
      agentConfig: input.agentConfig,
      finalizeSchema: input.finalizeSchema,
      signal: input.signal,
    });
    if (!agent.ok || !agent.result) {
      await this.dependencies.appendEvent({ run_id: run.runId, event: "seekbrain_creative_update", ok: false, operation: input.operation });
      return { ok: false, run_id: run.runId, error: agent.error || "Creative session update did not complete." };
    }
    const allowedMethods = new Set(availableMethods.map((method: WorkflowJson) => String(method.method_id)));
    let next: WorkflowJson;
    try { next = normalizeSession(agent.result, evidenceIndex(pool), allowedMethods, current); }
    catch (error) { return { ok: false, run_id: run.runId, error: error instanceof Error ? error.message : String(error) }; }
    const historyPath = join(creativeDir(run), `creative_session.revision_${Number(next.revision)}.previous.json`);
    await this.dependencies.writeJson(historyPath, current);
    await this.dependencies.writeJson(sessionPath(run), next);
    const planning = run.state.research_planning || {};
    await this.dependencies.lifecycle.updateState(run, {
      research_planning: {
        ...planning,
        creative_status: "ideas_ready",
        creative_session_path: sessionPath(run),
        creative_revision: next.revision,
      },
    });
    await this.dependencies.appendEvent({
      run_id: run.runId,
      event: "seekbrain_creative_update",
      ok: true,
      operation: input.operation,
      revision: next.revision,
    });
    return { ...response(run, next), operation: input.operation, history_path: historyPath };
  }

  async select(input: SelectCreativeIdeaInput): Promise<WorkflowJson> {
    const run = await this.dependencies.lifecycle.resolveRun(input.cwd, input.runId);
    const session = await loadSession(run);
    const idea = (session.ideas as WorkflowJson[]).find((item) => item.idea_id === input.ideaId);
    if (!idea) return { ok: false, run_id: run.runId, error: `Unknown active Idea Card '${input.ideaId}'.` };
    const certificate = {
      version: 1,
      selected_at: new Date().toISOString(),
      idea_id: idea.idea_id,
      temperature: idea.temperature,
      scientific_question: idea.research_question,
      selected_hypothesis: idea.hypothesis,
      mechanism: idea.mechanism,
      dataset_grounding: idea.why_data_can_test,
      alternative_explanation: idea.strongest_counterevidence,
      discriminating_prediction: idea.discriminating_prediction,
      minimal_decisive_analysis: idea.minimal_decisive_analysis,
      hard_constraints: session.frozen_constraints,
      evidence_ids: idea.evidence_ids,
      evidence_by_intent: idea.evidence_by_intent,
      method_ids: idea.method_ids,
      lineage: idea.lineage,
    };
    const certificatePath = join(creativeDir(run), "research_question_certificate.json");
    const selectedSession = { ...session, status: "selected", selected_idea_id: idea.idea_id, updated_at: new Date().toISOString() };
    await this.dependencies.writeJson(certificatePath, certificate);
    await this.dependencies.writeJson(sessionPath(run), selectedSession);
    const planning = run.state.research_planning || {};
    await this.dependencies.lifecycle.updateState(run, {
      research_planning: {
        ...planning,
        creative_status: "idea_selected",
        selected_idea_id: idea.idea_id,
        research_question_certificate: certificate,
        research_question_certificate_path: certificatePath,
      },
    });
    await this.dependencies.appendEvent({ run_id: run.runId, event: "seekbrain_creative_select", ok: true, idea_id: idea.idea_id });
    return {
      ok: true,
      run_id: run.runId,
      research_planning_strategy: "creative",
      selected_idea: idea,
      research_question_certificate: certificate,
      research_question_certificate_path: certificatePath,
      creative_session_path: sessionPath(run),
      needs_planning_decision: true,
      next_tool: "seekbrain_planning_decision_review",
    };
  }
}

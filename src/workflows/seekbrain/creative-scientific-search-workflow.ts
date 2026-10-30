import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { StageAgentResult } from "./research-skill-workflow.ts";
import { readCanonicalMetadata, type RunLifecycleWorkflow, type WorkflowJson } from "./run-lifecycle.ts";

export interface CreativeSearchAgentTool {
  name: string;
}

export interface CreativeScientificSearchDependencies {
  lifecycle: RunLifecycleWorkflow;
  runAgent(input: {
    runDir: string;
    prompt: string;
    finalizeTool: string;
    agentConfig: WorkflowJson;
    finalizeSchema: unknown;
    customTools?: CreativeSearchAgentTool[];
    signal?: AbortSignal;
  }): Promise<StageAgentResult>;
  createSearchTool(runDir: string): CreativeSearchAgentTool;
  writeJson(path: string, value: WorkflowJson): Promise<void>;
  appendEvent(event: WorkflowJson): Promise<void>;
}

export interface SearchCreativeLiteratureInput {
  cwd: string;
  runId: string;
  instruction: string;
  trigger: "initial" | "user";
  rolePrompt: string;
  agentConfig: WorkflowJson;
  finalizeSchema: unknown;
  signal?: AbortSignal;
}

function poolPath(run: WorkflowJson): string {
  return join(run.runDir, "creative_research", "creative_search_pool.json");
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

function initialPool(): WorkflowJson {
  const now = new Date().toISOString();
  return {
    version: 1,
    created_at: now,
    updated_at: now,
    max_distinct_queries: 9,
    provider_calls: 0,
    entries: [],
    sources: [],
    search_requests: [],
    methods: [],
  };
}

function prompt(rolePrompt: string, body: string): string {
  return [
    rolePrompt.trim(),
    "",
    "Return only by calling the finalize tool. Do not expose scratch reasoning.",
    "Required final tool: finalize_creative_search",
    "",
    body,
  ].join("\n");
}

function nextNumber(items: WorkflowJson[], key: string, prefix: string): number {
  return items.reduce((maximum, item) => {
    const match = String(item?.[key] || "").match(new RegExp(`^${prefix}(\\d+)$`));
    return match ? Math.max(maximum, Number(match[1])) : maximum;
  }, 0) + 1;
}

function compactPoolContext(pool: WorkflowJson): WorkflowJson {
  return {
    previous_requests: (Array.isArray(pool.search_requests) ? pool.search_requests : []).slice(-5).map((request: WorkflowJson) => ({
      request_id: request.request_id,
      instruction: request.instruction,
      status: request.status,
      unresolved_gap: request.unresolved_gap,
      method_ids: request.method_ids,
    })),
    available_methods: (Array.isArray(pool.methods) ? pool.methods : []).filter((method: WorkflowJson) => method.status !== "rejected").map((method: WorkflowJson) => ({
      method_id: method.method_id,
      component_type: method.component_type,
      reusable_component: method.reusable_component,
      application_to_current_problem: method.application_to_current_problem,
      limitation: method.limitation,
    })),
  };
}

export class CreativeScientificSearchWorkflow {
  constructor(readonly dependencies: CreativeScientificSearchDependencies) {}

  async getPool(cwd: string, runId: string): Promise<WorkflowJson> {
    const run = await this.dependencies.lifecycle.resolveRun(cwd, runId);
    return await readJson(poolPath(run)) || initialPool();
  }

  async search(input: SearchCreativeLiteratureInput): Promise<WorkflowJson> {
    const run = await this.dependencies.lifecycle.resolveRun(input.cwd, input.runId);
    const instruction = clean(input.instruction, 4_000);
    if (!instruction) return { ok: false, run_id: run.runId, error: "A scientific search instruction is required." };
    const before = await readJson(poolPath(run)) || initialPool();
    const existingEntryIds = new Set((Array.isArray(before.entries) ? before.entries : []).map((entry: WorkflowJson) => String(entry.evidence_id)));
    const metadata = (await readCanonicalMetadata(run)).slice(0, 12_000);
    const tool = this.dependencies.createSearchTool(run.runDir);
    const agent = await this.dependencies.runAgent({
      runDir: run.runDir,
      finalizeTool: "finalize_creative_search",
      prompt: prompt(input.rolePrompt, [
        `Research question:\n${String(run.state.question || "")}`,
        `Current dataset metadata:\n${metadata}`,
        `Researcher's search request:\n${instruction}`,
        `Search trigger: ${input.trigger}`,
        `Existing paper-pool index:\n${JSON.stringify(compactPoolContext(before), null, 2)}`,
        "Try up to three progressively improved searches. Return { request_summary, status, unresolved_gap, attempt_assessments, methods }.",
        "Each attempt_assessment contains { evidence_id, assessment, next_gap }. Each method contains { component_type, label, reusable_component, application_to_current_problem, limitation, evidence_ids }.",
      ].join("\n\n")),
      agentConfig: input.agentConfig,
      finalizeSchema: input.finalizeSchema,
      customTools: [tool],
      signal: input.signal,
    });
    if (!agent.ok || !agent.result) {
      await this.dependencies.appendEvent({ run_id: run.runId, event: "seekbrain_creative_search", ok: false });
      return { ok: false, run_id: run.runId, error: agent.error || "Creative scientific search did not complete." };
    }

    const pool = await readJson(poolPath(run)) || before;
    const entries = Array.isArray(pool.entries) ? pool.entries : [];
    const assessmentsById = new Map(
      (Array.isArray(agent.result.attempt_assessments) ? agent.result.attempt_assessments : [])
        .map((item: WorkflowJson) => [clean(item.evidence_id, 100), item] as const),
    );
    const entryById = new Map(entries.map((entry: WorkflowJson) => [String(entry.evidence_id), entry] as const));
    const currentEvidenceIds = new Set([
      ...entries
        .filter((entry: WorkflowJson) => !existingEntryIds.has(String(entry.evidence_id)))
        .map((entry: WorkflowJson) => String(entry.evidence_id)),
      ...[...assessmentsById.keys()].filter((id) => entryById.has(id)),
    ]);
    const attempts = [...currentEvidenceIds].flatMap((evidenceId) => {
      const entry = entryById.get(evidenceId);
      if (!entry) return [];
      const assessment = assessmentsById.get(String(entry.evidence_id)) || {};
      return [{
        evidence_id: entry.evidence_id,
        intent: entry.intent,
        source_strategy: entry.source_strategy || "rag_first",
        query: entry.query,
        source_ids: entry.source_ids,
        ok: entry.ok,
        assessment: clean(assessment.assessment),
        next_gap: clean(assessment.next_gap),
      }];
    });

    const existingMethods = Array.isArray(pool.methods) ? pool.methods : [];
    let methodNumber = nextNumber(existingMethods, "method_id", "M");
    const methods = (Array.isArray(agent.result.methods) ? agent.result.methods : []).flatMap((raw: WorkflowJson) => {
      const evidenceIds = stringList(raw.evidence_ids, 10).filter((id) => currentEvidenceIds.has(id));
      const reusable = clean(raw.reusable_component);
      const application = clean(raw.application_to_current_problem);
      if (!evidenceIds.length || !reusable || !application) return [];
      const duplicate = existingMethods.find((method: WorkflowJson) =>
        clean(method.reusable_component).toLocaleLowerCase() === reusable.toLocaleLowerCase()
        && clean(method.application_to_current_problem).toLocaleLowerCase() === application.toLocaleLowerCase());
      if (duplicate) return [duplicate];
      return [{
        method_id: `M${methodNumber++}`,
        status: "available",
        component_type: ["mechanism", "analysis", "validation", "counterevidence", "prior_boundary"].includes(String(raw.component_type))
          ? String(raw.component_type)
          : "analysis",
        label: clean(raw.label, 300),
        reusable_component: reusable,
        application_to_current_problem: application,
        limitation: clean(raw.limitation),
        evidence_ids: evidenceIds,
        created_at: new Date().toISOString(),
      }];
    });
    const uniqueMethods = [...new Map(methods.map((method: WorkflowJson) => [method.method_id, method])).values()];
    const requests = Array.isArray(pool.search_requests) ? pool.search_requests : [];
    const requestId = `SR${nextNumber(requests, "request_id", "SR")}`;
    const status = agent.result.status === "sufficient" || agent.result.status === "partial"
      ? agent.result.status
      : "exhausted";
    const request = {
      request_id: requestId,
      trigger: input.trigger,
      instruction,
      request_summary: clean(agent.result.request_summary),
      status,
      unresolved_gap: clean(agent.result.unresolved_gap),
      evidence_ids: [...currentEvidenceIds],
      method_ids: uniqueMethods.map((method: WorkflowJson) => method.method_id),
      attempts,
      created_at: new Date().toISOString(),
    };
    const nextPool = {
      ...pool,
      version: 1,
      updated_at: new Date().toISOString(),
      search_requests: [...requests, request],
      methods: [...existingMethods, ...uniqueMethods.filter((method: WorkflowJson) => !existingMethods.some((existing: WorkflowJson) => existing.method_id === method.method_id))],
    };
    await this.dependencies.writeJson(poolPath(run), nextPool);
    const planning = run.state.research_planning || {};
    await this.dependencies.lifecycle.updateState(run, {
      research_planning: { ...planning, creative_search_pool_path: poolPath(run), latest_search_request_id: requestId },
    });
    await this.dependencies.appendEvent({
      run_id: run.runId,
      event: "seekbrain_creative_search",
      ok: true,
      request_id: requestId,
      attempt_count: attempts.length,
      method_count: uniqueMethods.length,
    });
    return {
      ok: true,
      run_id: run.runId,
      request_id: requestId,
      search_status: status,
      request_summary: request.request_summary,
      unresolved_gap: request.unresolved_gap,
      attempts,
      method_briefs: uniqueMethods,
      method_count: uniqueMethods.length,
      creative_search_pool_path: poolPath(run),
      next_tool: "seekbrain_creative_update",
    };
  }
}

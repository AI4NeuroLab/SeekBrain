import { join, resolve } from "node:path";
import { literatureQueryConfig } from "../../core/index.ts";
import type { RunLifecycleWorkflow, WorkflowJson, WorkflowRunContext } from "./run-lifecycle.ts";

export interface ResearchSkillFlags {
  targeted_skill_match: boolean;
  targeted_skill_generate: boolean;
  rag_recipe_crystallization?: boolean;
  deep_research: boolean;
  literature_provider?: string;
  has_literature_provider?: boolean;
}

export interface StageAgentResult {
  ok: boolean;
  result?: WorkflowJson;
  error?: string;
  output_path?: string;
  subagent_dir?: string;
  snapshot_dir?: string;
}

export interface ResearchSkillDependencies {
  lifecycle: RunLifecycleWorkflow;
  resolveSkill(input: WorkflowJson, cwd: string, signal?: AbortSignal): Promise<WorkflowJson>;
  retrievePapers(input: WorkflowJson, cwd: string, signal?: AbortSignal): Promise<WorkflowJson>;
  runAgent(input: {
    runDir: string;
    prompt: string;
    agentConfig: WorkflowJson;
    finalizeSchema: unknown;
    signal?: AbortSignal;
  }): Promise<StageAgentResult>;
  writeJson(path: string, value: WorkflowJson): Promise<void>;
  writeText(path: string, value: string): Promise<void>;
  appendEvent(event: WorkflowJson): Promise<void>;
  summarize(value: WorkflowJson): WorkflowJson;
}

export interface TargetedSkillInput {
  cwd: string;
  workflowRoot: string;
  runId: string;
  question?: string;
  params: WorkflowJson;
  config: WorkflowJson;
  flags: ResearchSkillFlags;
  signal?: AbortSignal;
}

export interface DeepResearchInput {
  cwd: string;
  workflowRoot: string;
  runId: string;
  question?: string;
  additionalContext?: string;
  params: WorkflowJson;
  flags: ResearchSkillFlags;
  agentConfig: WorkflowJson;
  rolePrompt: string;
  finalizeSchema: unknown;
  signal?: AbortSignal;
}

function skipped(runId: string, tool: string, key: string): WorkflowJson {
  return {
    ok: true,
    skipped: true,
    skipped_by_config: true,
    reason: "disabled_by_user_config",
    message: `${tool} is disabled by user configuration workflow.seekbrain.${key}; this is not a tool failure.`,
    run_id: runId,
    config_key: `workflow.seekbrain.${key}`,
  };
}

function skippedWithoutLiterature(runId: string, tool: string): WorkflowJson {
  return {
    ok: true,
    skipped: true,
    skipped_by_config: true,
    reason: "no_literature_provider",
    message: `${tool} requires a configured literature provider; this is not a tool failure.`,
    run_id: runId,
    config_key: "literature.paper_source",
  };
}

function question(run: WorkflowRunContext, requested?: string): string {
  const value = String(requested || run.state.question || "").trim();
  if (!value) {
    throw new Error("question is required. Pass it to the tool, or persist it first via seekbrain_run_start/seekbrain_run_resume.");
  }
  return value;
}

function fromCwd(cwd: string, value: unknown, fallback: string): string {
  return resolve(cwd, String(value || fallback));
}

function usesPlannedLiteratureQueries(provider: unknown): boolean {
  return provider === "semantic_scholar" || provider === "pubmed";
}

function finalizationPrompt(rolePrompt: string, body: string): string {
  return [
    rolePrompt.trim(),
    "",
    "You are the isolated SeekBrain Deep Research agent.",
    "Return only by calling the finalize tool. Do not expose scratch reasoning.",
    "Required final tool: finalize_deep_research",
    "",
    body,
  ].join("\n");
}

export function compactRecipeMethodContract(recipe: unknown): string {
  const text = String(recipe || "").replace(/\r\n/g, "\n");
  if (!text.trim()) return "";
  const skillStart = text.indexOf("[SKILL.md]");
  const source = skillStart >= 0 ? text.slice(skillStart + "[SKILL.md]".length) : text;
  const title = source.match(/^#\s+(.+)$/m)?.[0] || "";
  const wanted = new Set(["preconditions", "inputs and outputs", "procedure", "key parameters", "pitfalls"]);
  const headings = [...source.matchAll(/^##\s+(.+)$/gm)];
  const sections: string[] = [];
  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index];
    if (!wanted.has(String(heading[1] || "").trim().toLowerCase())) continue;
    const start = Number(heading.index);
    const end = index + 1 < headings.length ? Number(headings[index + 1].index) : source.length;
    sections.push(source.slice(start, end).trim());
  }
  if (sections.length) return [title, ...sections].filter(Boolean).join("\n\n");
  const withoutBundledFiles = source.split(/^##\s+Bundled files\s*$/m)[0];
  return withoutBundledFiles.trim();
}

export class ResearchSkillWorkflow {
  constructor(readonly dependencies: ResearchSkillDependencies) {}

  async resolveTargetedSkill(input: TargetedSkillInput): Promise<WorkflowJson> {
    const run = await this.dependencies.lifecycle.resolveRun(input.cwd, input.runId);
    if (!input.flags.targeted_skill_match && !input.flags.targeted_skill_generate) {
      return skipped(run.runId, "seekbrain_recipe_retrieve", "targeted_skill_match/targeted_skill_generate");
    }
    const configured = literatureQueryConfig(
      input.config,
      input.config.modules?.targeted_skill || input.config.targeted_skill || {},
    );
    const paths = input.config.paths || {};
    const traceDir = join(run.runDir, "targeted_skill_trace");
    const projectDir = input.params.project_dir || paths.project_dir
      ? fromCwd(input.cwd, input.params.project_dir || paths.project_dir, ".")
      : undefined;
    const rootDir = input.params.root_dir || paths.root_dir
      ? fromCwd(input.cwd, input.params.root_dir || paths.root_dir, ".")
      : input.workflowRoot;
    const literatureQueries = usesPlannedLiteratureQueries(configured.literature_provider) && Array.isArray(run.state.literature_queries)
      ? run.state.literature_queries
      : undefined;
    const result = await this.dependencies.resolveSkill({
      ...configured,
      ...input.params,
      question: question(run, input.question),
      ...(literatureQueries ? { literature_queries: literatureQueries } : {}),
      skill_enable: true,
      match_skill_enable: input.flags.targeted_skill_match,
      generate_skill_enable: input.flags.targeted_skill_generate,
      repository_recipe_crystallization_enabled: input.params.repository_recipe_crystallization_enabled
        ?? (input.flags.rag_recipe_crystallization === true),
      ...(projectDir ? { project_dir: projectDir } : {}),
      root_dir: rootDir,
      trace_dir: traceDir,
    }, input.cwd, input.signal);
    const targetedSkillPath = join(run.runDir, "targeted_skill.md");
    if (result.targeted_skill) await this.dependencies.writeText(targetedSkillPath, String(result.targeted_skill));
    const { targeted_skill: _fullSkill, targeted_skill_preview: _skillPreview, ...resultWithoutSkill } = result;
    const summarized = this.dependencies.summarize(resultWithoutSkill);
    const methodContract = compactRecipeMethodContract(result.targeted_skill);
    const recipeSummary = (methodContract || String(result.targeted_skill || "")).trim().slice(0, 500);
    await this.dependencies.lifecycle.updateState(run, {
      targeted_skill_path: result.targeted_skill ? targetedSkillPath : "",
      targeted_skill_result: { ...summarized, summary: recipeSummary, method_contract: methodContract },
      ...(result.repository_reference ? { repository_reference: result.repository_reference } : {}),
    });
    await this.dependencies.appendEvent({
      run_id: run.runId,
      event: "seekbrain_recipe_retrieve",
      ok: result.ok,
      matched: result.matched,
      source: result.source,
      trace_id: result.trace_id,
    });
    return {
      ...summarized,
      summary: recipeSummary,
      run_id: run.runId,
      targeted_skill_path: result.targeted_skill ? targetedSkillPath : undefined,
      trace_dir: traceDir,
    };
  }

  async deepResearch(input: DeepResearchInput): Promise<WorkflowJson> {
    const run = await this.dependencies.lifecycle.resolveRun(input.cwd, input.runId);
    if (!input.flags.deep_research) {
      return input.flags.has_literature_provider === false
        ? skippedWithoutLiterature(run.runId, "seekbrain_deep_research")
        : skipped(run.runId, "seekbrain_deep_research", "deep_research");
    }
    const researchQuestion = question(run, input.question);
    const rag = input.agentConfig.rag || {};
    const provider = input.flags.literature_provider || rag.literature_provider || rag.paper_source;
    const literatureQueries = usesPlannedLiteratureQueries(provider) && Array.isArray(run.state.literature_queries)
      ? run.state.literature_queries
      : undefined;
    const ragResult = await this.dependencies.retrievePapers({
      ...rag,
      ...(rag.base_url ? { rag_base_url: rag.base_url } : {}),
      ...(rag.timeout ? { rag_timeout: rag.timeout } : {}),
      ...input.params,
      question: researchQuestion,
      ...(literatureQueries ? { literature_queries: literatureQueries } : {}),
    }, input.cwd, input.signal);
    const sources = Array.isArray(ragResult.sources) ? ragResult.sources : [];
    const sourcesPath = join(run.runDir, "deep_research_sources.json");
    const contextPath = join(run.runDir, "deep_research_context.md");
    await this.dependencies.writeJson(sourcesPath, ragResult);
    if (!ragResult.ok || !sources.length) {
      const context = "[Deep Research Background]\nPaper RAG returned no usable background evidence for this question.";
      await this.dependencies.writeText(contextPath, context);
      await this.dependencies.lifecycle.updateState(run, { deep_research_context: context, deep_research_sources: sources });
      return {
        ok: true,
        run_id: run.runId,
        rag_ok: ragResult.ok,
        source_count: 0,
        deep_research_context: context,
        context_path: contextPath,
        sources_path: sourcesPath,
        warnings: ragResult.warnings || [],
        rag_error: ragResult.error,
      };
    }
    const additional = String(input.additionalContext || "").trim();
    const prompt = finalizationPrompt(input.rolePrompt, [
      `Question:\n${researchQuestion}`,
      `Retrieved sources:\n${JSON.stringify(sources, null, 2)}`,
      additional ? `Additional context from the main agent:\n${additional}` : "",
      "Finalize with: { deep_research_context, summary, warnings }.",
    ].join("\n\n"));
    const agent = await this.dependencies.runAgent({
      runDir: run.runDir,
      prompt,
      agentConfig: input.agentConfig,
      finalizeSchema: input.finalizeSchema,
      signal: input.signal,
    });
    if (agent.ok && agent.result) {
      await this.dependencies.writeText(contextPath, String(agent.result.deep_research_context));
      await this.dependencies.lifecycle.updateState(run, {
        deep_research_context: agent.result.deep_research_context,
        deep_research_sources: sources,
        deep_research: { summary: agent.result.summary, warnings: agent.result.warnings },
      });
    }
    await this.dependencies.appendEvent({
      run_id: run.runId,
      event: "seekbrain_deep_research",
      ok: agent.ok,
      source_count: sources.length,
    });
    return {
      run_id: run.runId,
      ok: agent.ok,
      error: agent.error,
      result: agent.result ? {
        summary: agent.result.summary,
        warnings: agent.result.warnings,
        deep_research_context_preview: String(agent.result.deep_research_context || "").slice(0, 1200),
      } : undefined,
      context_path: agent.ok ? contextPath : undefined,
      sources_path: sourcesPath,
      output_path: agent.output_path,
      debug: { subagent_dir: agent.subagent_dir, snapshot_dir: agent.snapshot_dir },
      rag: { ok: ragResult.ok, source_count: sources.length, warnings: ragResult.warnings || [] },
    };
  }
}

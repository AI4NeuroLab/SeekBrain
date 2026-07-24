import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { StageAgentResult } from "./research-skill-workflow.ts";
import type { RunLifecycleWorkflow, WorkflowJson } from "./run-lifecycle.ts";

export interface ResearchSurveyWorkflowDependencies {
  lifecycle: RunLifecycleWorkflow;
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
}

export interface ResearchSurveyInput {
  cwd: string;
  runId: string;
  enabled: boolean;
  disabledReason?: "disabled_by_user_config" | "no_literature_provider";
  agentConfig: WorkflowJson;
  rolePrompt: string;
  finalizeSchema: unknown;
  signal?: AbortSignal;
}

function planningState(run: WorkflowJson): WorkflowJson {
  const value = run.state.research_planning;
  return value && typeof value === "object" ? value : {};
}

function sourceMetadata(sources: WorkflowJson[]): WorkflowJson[] {
  return sources.map((source) => ({
    source_id: String(source.source_id || ""),
    title: String(source.title || ""),
    pub_time: source.pub_time ?? "",
    magazine: source.magazine ?? "",
    github_links: Array.isArray(source.github_links) ? source.github_links.map(String) : [],
  }));
}

function fingerprint(value: WorkflowJson): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function surveyQuestion(run: WorkflowJson): string {
  const question = String(run.state.question || "").trim();
  if (!question) throw new Error("Research Survey requires a persisted scientific question.");
  const background = String(run.state.user_background || "").trim().slice(0, 8_000);
  const metadata = String(run.state.data_info || "").trim().slice(0, 12_000);
  const extra = String(run.state.extra_path_info || "").trim().slice(0, 4_000);
  return [
    `[Scientific Question]\n${question}`,
    background ? `[User-provided Background]\n${background}` : "",
    metadata ? `[Dataset Metadata]\n${metadata}` : "",
    extra ? `[Additional Dataset Metadata]\n${extra}` : "",
  ].filter(Boolean).join("\n\n");
}

function fallbackBackground(run: WorkflowJson, paperSource: string): string {
  const userBackground = String(run.state.user_background || "").trim().slice(0, 3_000);
  return [
    "[Literature Grounding Background]",
    "",
    "## Established Findings",
    `Paper retrieval (${paperSource}) returned no usable literature evidence for this question.`,
    userBackground ? `\nUser-provided background (not independently supported by the retrieved literature):\n${userBackground}` : "",
    "",
    "## Unresolved Gaps",
    "No literature-grounded gaps could be established from the retrieved corpus.",
    "",
    "## Research Planning Context",
    userBackground
      ? "The user-provided background may inform planning, but it should not be treated as literature-verified evidence."
      : "No literature-grounded background is available to condition planning.",
  ].filter((line) => line !== "").join("\n");
}

function synthesisPrompt(rolePrompt: string, question: string, sources: WorkflowJson[]): string {
  const sourceText = sources.map((source, index) => [
    `Paper ${index + 1}: ${String(source.title || "(untitled paper)")}`,
    `Text:\n${String(source.text || "")}`,
  ].join("\n")).join("\n\n");
  return [
    rolePrompt.trim(),
    "",
    "You are the isolated SeekBrain Research Survey agent.",
    "Return only by calling the finalize tool. Do not expose scratch reasoning.",
    "Required final tool: finalize_research_survey",
    "",
    "Construct the scientific background required by downstream Research Planning agents from the retrieved literature and any user-provided background.",
    "",
    "The output should start with:\n[Literature Grounding Background]",
    "",
    "Write a concise literature-grounded summary using these headings:",
    "- Established Findings: synthesize the key findings relevant to the scientific question.",
    "- Unresolved Gaps: identify unresolved questions, conflicting evidence, or important limitations in prior work.",
    "- Research Planning Context: briefly explain how those findings and gaps scientifically motivate the research question and subsequent planning.",
    "",
    "If user-provided background is present, incorporate relevant facts while clearly distinguishing it from findings supported by the retrieved literature.",
    "Do not include source ids, citation markers, paper labels, or a line that labels or restates the original user query.",
    "Do not invent findings, mechanisms, controversies, or gaps. If the retrieved evidence is insufficient, say so concisely.",
    "",
    `Original question and dataset metadata for retrieval context only:\n${question}`,
    "",
    `Retrieved sources:\n${sourceText}`,
    "",
    "Finalize with: { literature_grounding_context }.",
  ].join("\n");
}

export class ResearchSurveyWorkflow {
  constructor(readonly dependencies: ResearchSurveyWorkflowDependencies) {}

  async execute(input: ResearchSurveyInput): Promise<WorkflowJson> {
    const run = await this.dependencies.lifecycle.resolveRun(input.cwd, input.runId);
    const current = planningState(run);
    const legacySubquestionsReady = current.status === "subquestions_ready" && Boolean(current.subquestions);
    if (current.status !== "approved" && !legacySubquestionsReady) {
      return {
        ok: false,
        run_id: run.runId,
        blocked_by_human_review: true,
        required_stage: "research_planning",
        error: "Research Survey requires explicit user approval of Research Planning before literature retrieval.",
      };
    }
    if (!input.enabled) {
      const reason = input.disabledReason || "disabled_by_user_config";
      const survey = { status: "disabled", enabled: false, updated_at: new Date().toISOString() };
      await this.dependencies.lifecycle.updateState(run, {
        literature_grounding_context: "",
        literature_grounding_sources: [],
        research_planning: { ...current, survey },
      });
      await this.dependencies.appendEvent({ run_id: run.runId, event: "seekbrain_research_survey", ok: true, skipped: true, reason });
      return { ok: true, run_id: run.runId, skipped: true, reason, survey };
    }

    const question = surveyQuestion(run);
    const rag = input.agentConfig.rag && typeof input.agentConfig.rag === "object" ? input.agentConfig.rag : {};
    const paperSource = String(rag.paper_source || "ailab_rag");
    const literatureQueries = (paperSource === "semantic_scholar" || paperSource === "pubmed") && Array.isArray(run.state.literature_queries)
      ? run.state.literature_queries
      : undefined;
    const inputFingerprint = fingerprint({
      schema_version: 1,
      question,
      rag,
      role_prompt: input.rolePrompt,
    });
    const surveyDir = join(run.runDir, "research_plan");
    const sourcesPath = join(surveyDir, "research_survey_sources.json");
    const contextPath = join(surveyDir, "research_survey_context.md");
    const resultPath = join(surveyDir, "research_survey_result.json");
    const previous = current.survey && typeof current.survey === "object" ? current.survey : {};
    if (
      previous.input_fingerprint === inputFingerprint
      && (previous.status === "ready" || previous.status === "fallback")
      && existsSync(sourcesPath)
      && existsSync(contextPath)
      && existsSync(resultPath)
    ) {
      return {
        ok: true,
        run_id: run.runId,
        reused: true,
        literature_grounding_context: String(previous.literature_grounding_context || ""),
        sources: Array.isArray(previous.sources) ? previous.sources : [],
        paper_source: String(previous.paper_source || paperSource),
        source_count: Number(previous.source_count || 0),
        context_path: contextPath,
        sources_path: sourcesPath,
        result_path: resultPath,
      };
    }

    await this.dependencies.lifecycle.updateState(run, {
      research_planning: {
        ...current,
        survey: { status: "retrieving", enabled: true, input_fingerprint: inputFingerprint, started_at: new Date().toISOString() },
      },
    });
    const ragResult = await this.dependencies.retrievePapers({
      ...rag,
      ...(rag.base_url ? { rag_base_url: rag.base_url } : {}),
      ...(rag.timeout ? { rag_timeout: rag.timeout } : {}),
      question,
      ...(literatureQueries ? { literature_queries: literatureQueries } : {}),
      top_k: Number(rag.top_k ?? 4),
      require_github: rag.require_github === true,
      source_char_limit: Number(rag.source_char_limit ?? 5000),
    }, input.cwd, input.signal);
    const sources = Array.isArray(ragResult.sources) ? ragResult.sources as WorkflowJson[] : [];
    await this.dependencies.writeJson(sourcesPath, ragResult);

    let background: string;
    let status: "ready" | "fallback";
    let agent: StageAgentResult | undefined;
    if (!sources.length) {
      status = "fallback";
      background = fallbackBackground(run, paperSource);
    } else {
      agent = await this.dependencies.runAgent({
        runDir: run.runDir,
        prompt: synthesisPrompt(input.rolePrompt, question, sources),
        agentConfig: input.agentConfig,
        finalizeSchema: input.finalizeSchema,
        signal: input.signal,
      });
      if (!agent.ok || !agent.result) {
        await this.dependencies.lifecycle.updateState(run, {
          research_planning: {
            ...planningState(run),
            survey: {
              status: "failed",
              enabled: true,
              input_fingerprint: inputFingerprint,
              source_count: sources.length,
              error: agent.error || "Research Survey synthesis did not complete.",
              sources_path: sourcesPath,
              updated_at: new Date().toISOString(),
            },
          },
        });
        await this.dependencies.appendEvent({ run_id: run.runId, event: "seekbrain_research_survey", ok: false, source_count: sources.length });
        return { ok: false, run_id: run.runId, error: agent.error || "Research Survey synthesis did not complete.", sources_path: sourcesPath };
      }
      status = "ready";
      background = String(agent.result.literature_grounding_context || "").trim();
      if (!background) {
        await this.dependencies.lifecycle.updateState(run, {
          research_planning: {
            ...planningState(run),
            survey: {
              status: "failed",
              enabled: true,
              input_fingerprint: inputFingerprint,
              source_count: sources.length,
              error: "Research Survey returned an empty literature_grounding_context.",
              sources_path: sourcesPath,
              updated_at: new Date().toISOString(),
            },
          },
        });
        await this.dependencies.appendEvent({ run_id: run.runId, event: "seekbrain_research_survey", ok: false, source_count: sources.length, reason: "empty_context" });
        return { ok: false, run_id: run.runId, error: "Research Survey returned an empty literature_grounding_context.", sources_path: sourcesPath };
      }
      if (!background.startsWith("[Literature Grounding Background]")) {
        background = `[Literature Grounding Background]\n${background}`;
      }
    }

    const metadata = sourceMetadata(sources);
    const result = {
      literature_grounding_context: background,
      sources: metadata,
      paper_source: paperSource,
    };
    await this.dependencies.writeText(contextPath, background);
    await this.dependencies.writeJson(resultPath, result);
    const survey = {
      status,
      enabled: true,
      input_fingerprint: inputFingerprint,
      ...result,
      source_count: metadata.length,
      rag_ok: ragResult.ok === true,
      warnings: Array.isArray(ragResult.warnings) ? ragResult.warnings : [],
      rag_error: ragResult.error,
      context_path: contextPath,
      sources_path: sourcesPath,
      result_path: resultPath,
      output_path: agent?.output_path,
      updated_at: new Date().toISOString(),
    };
    await this.dependencies.lifecycle.updateState(run, {
      literature_grounding_context: background,
      literature_grounding_sources: metadata,
      research_planning: { ...planningState(run), survey },
    });
    await this.dependencies.appendEvent({
      run_id: run.runId,
      event: "seekbrain_research_survey",
      ok: true,
      status,
      source_count: metadata.length,
      paper_source: paperSource,
    });
    return { ok: true, run_id: run.runId, reused: false, ...result, source_count: metadata.length, status, context_path: contextPath, sources_path: sourcesPath, result_path: resultPath };
  }
}

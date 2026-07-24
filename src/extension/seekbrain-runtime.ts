import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { createTwoFilesPatch } from "diff";
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, watch, type FSWatcher } from "node:fs";
import { copyFile, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ArtifactService, ConfigLoader, FileDiagnosticSink, FileRunRepository, FileUsageSink, atomicWriteJson, literatureCapabilities, literatureQueryConfig, resolveAgentConfig, type DiagnosticWarning, type SeekBrainConfig } from "../core/index.ts";
import { ExistingPiAgentAdapter } from "./existing-pi-agent-adapter.ts";
import { registerSeekBrainRuntimeHooks } from "./runtime-hooks.ts";
import { registerSystemCommands } from "./commands/system-commands.ts";
import { registerShowCommand } from "./commands/show-command.ts";
import { registerSaveSkillCommand } from "./commands/save-skill-command.ts";
import { registerReportCommand } from "./commands/report-command.ts";
import {
  createCodeReviewDetails,
  preloadDiffComponent,
  renderCodeEditCall,
  renderCodeEditResult,
  renderCodeUpdateCall,
  renderCodeUpdateResult,
} from "./tui/code-review-tui.ts";
import { researchPlanningReviewTitle, researchTreeReviewTitle, selectBinaryReview, selectResearchTreeReview, selectTaskPlanReview, selectYesNoReview, taskPlanReviewTitle } from "./tui/review-selectors.ts";
import { registerTransparencyCardRenderers } from "./tui/transparency-card.ts";
import { renderCapabilitiesResult, renderResumeRunResult, renderSeekBrainResult } from "./tui/compact-tool-results.ts";
import { toPiToolResult } from "./tool-adapter.ts";
import {
  RunLifecycleWorkflow,
  ResearchPlanningWorkflow,
  verifiedExplicitResearchPlanningRequest,
  ResearchSurveyWorkflow,
  ResearchTaskScheduler,
  ResearchTaskExecutionCoordinator,
  type ResearchTaskExecutionDependencies,
  type ResearchTaskEventType,
  ReportEvidenceCompiler,
  ReporterWorkflow,
  exportReportPdf,
  ResearchSkillWorkflow,
  PlanWorkflow,
  CodeWorkflow,
  ValidateWorkflow,
  ImageWorkflow,
  InterpretWorkflow,
  ReviewWorkflow,
  capabilitiesResult,
  pingResult,
  workflowConfigResult,
  type WorkflowRunContext,
} from "../workflows/index.ts";
import {
  DEFAULT_MAX_CODE_ATTEMPTS,
  codeRetryPolicy,
  currentArtifactsValidated,
  fastPassRefinedValidation,
  normalizeValidation,
  validationNextStep,
} from "../workflows/seekbrain/validation-policy.js";
import { applyExactCodeEdits, validationInvalidationForScope } from "../workflows/seekbrain/code-edit-policy.js";
import { PaperRagClient, RagSkillGenerator, SkillLibraryManager, TargetedSkillResolver, writeSkill } from "../targeted-skill/index.ts";
import { LiteratureProviderRouter, PubMedRetriever, SemanticScholarRetriever } from "../literature-compat/index.ts";
import { DatasetMetadataStore } from "../data-resolve/index.ts";

type Json = Record<string, any>;

function seekbrainReportFinalizeSchema() {
  return Type.Object({
    report_markdown: Type.String(),
    title: Type.String(),
    abstract: Type.String(),
    sections: Type.Array(Type.Object({ heading: Type.String(), body: Type.String() })),
    figure_legends: Type.Array(Type.Object({
      figure_id: Type.String(),
      figure_number: Type.Number(),
      title: Type.String(),
      caption: Type.String(),
      panels: Type.Array(Type.Object({ label: Type.String(), description: Type.String() })),
    })),
    key_claims: Type.Array(Type.Object({
      claim: Type.String(),
      evidence_ids: Type.Array(Type.String(), { minItems: 1 }),
      figure_refs: Type.Array(Type.Object({
        figure_id: Type.String(),
        panels: Type.Array(Type.String()),
      })),
      data_source: Type.String(),
      reasoning: Type.String(),
    })),
    limitations: Type.Array(Type.String()),
  });
}

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const PROJECT_ROOT = resolve(process.env.SEEKBRAIN_PROJECT_ROOT || process.env.SEEKBRAIN_ROOT || process.cwd());
const PROMPT_DIR = join(PACKAGE_ROOT, "prompts");
const DEFAULT_CONFIG_PATH = join(PACKAGE_ROOT, "config", "default.yaml");
const RUN_INDEX_FILE = ".pi/seekbrain/run_index.json";
const CONFIG_FILE = "seekbrain.config.yaml";

let mergedConfig: Json = {};
const runRepository = new FileRunRepository();
const runLifecycle = new RunLifecycleWorkflow(runRepository);
const paperRagClient = new PaperRagClient();
const semanticScholarRetriever = new SemanticScholarRetriever();
const pubMedRetriever = new PubMedRetriever();
const literatureProviderRouter = new LiteratureProviderRouter(paperRagClient, {
  semantic_scholar: semanticScholarRetriever,
  pubmed: pubMedRetriever,
});

const usageSink = new FileUsageSink(() => debugDiskWritesEnabled(), 300);
const piAgentAdapter = new ExistingPiAgentAdapter({
  prepareEnvironment: async () => ensureProcessEnvFromDotenv(PROJECT_ROOT),
});
// --- Config cache (A1) ---------------------------------------------------
// Parse and validate config once per cache window. fs.watch invalidates on
// project config changes, and concurrent callers share one in-flight load.
const CONFIG_CACHE_TTL_MS = 30_000;
let configCache: Json | undefined;
let configLoadedAt = 0;
let configLoadedFromCwd: string | undefined;
let configInflight: Promise<Json> | undefined;

function invalidateConfigCache() {
  configCache = undefined;
  configLoadedAt = 0;
  configLoadedFromCwd = undefined;
  configInflight = undefined;
}

async function loadConfigCached(cwd: string): Promise<Json> {
  const now = Date.now();
  const fresh = configCache
    && configLoadedFromCwd === cwd
    && now - configLoadedAt < CONFIG_CACHE_TTL_MS;
  if (fresh) return configCache!;
  if (configInflight) return configInflight;
  configInflight = (async () => {
    try {
      const next = await loadConfig(cwd);
      configCache = next;
      configLoadedAt = Date.now();
      configLoadedFromCwd = cwd;
      mergedConfig = next;
      return next;
    } finally {
      configInflight = undefined;
    }
  })();
  return configInflight;
}

function debugDiskWritesEnabled(): boolean {
  return mergedConfig.workflow?.debug_disk_writes === true;
}

async function syncWorkflowWritePolicy(cwd: string) {
  mergedConfig = await loadConfigCached(cwd);
}

function content(details: Json, text?: string) {
  return toPiToolResult(details, limitForMain, text);
}

function limitForMain(details: Json) {
  const copy = { ...details };
  if (typeof copy.analysis_recipe === "string" && copy.analysis_recipe.length > 1200) {
    copy.analysis_recipe_preview = copy.analysis_recipe.slice(0, 1200);
    delete copy.analysis_recipe;
  }
  if (typeof copy.targeted_skill === "string" && copy.targeted_skill.length > 1200) {
    copy.targeted_skill_preview = copy.targeted_skill.slice(0, 1200);
    delete copy.targeted_skill;
  }
  if (typeof copy.subagent_transcript === "string") {
    delete copy.subagent_transcript;
  }
  return copy;
}

function publicRecipeResult(details: Json): Json {
  const copy = { ...details };
  const aliases: Record<string, string> = {
    targeted_skill: "analysis_recipe",
    targeted_skill_preview: "analysis_recipe_preview",
    targeted_skill_path: "analysis_recipe_path",
    skill_paths: "recipe_paths",
  };
  for (const [legacy, current] of Object.entries(aliases)) {
    if (Object.prototype.hasOwnProperty.call(copy, legacy)) copy[current] = copy[legacy];
    delete copy[legacy];
  }
  if (copy.source === "generated_from_rag") copy.source = "crystallized";
  else if (copy.source === "existing_skill") copy.source = "repertoire";
  else if (copy.source === "none") copy.source = "no_match";
  if (copy.details && typeof copy.details === "object") {
    const nested = { ...copy.details };
    if (Object.prototype.hasOwnProperty.call(nested, "generated_skill_output_dir")) nested.generated_recipe_output_dir = nested.generated_skill_output_dir;
    if (Object.prototype.hasOwnProperty.call(nested, "reused_skill_paths")) nested.reused_recipe_paths = nested.reused_skill_paths;
    delete nested.generated_skill_output_dir;
    delete nested.reused_skill_paths;
    copy.details = nested;
  }
  return copy;
}

const LOG_TEXT_LIMIT = 4000;

function truncateText(value: any, limit = LOG_TEXT_LIMIT) {
  if (typeof value !== "string") return "";
  if (value.length <= limit) return value;
  return `${value.slice(0, limit)}... [truncated ${value.length - limit} chars]`;
}

function isoTimestamp(value?: any) {
  const time = typeof value === "number" ? value : Date.now();
  return new Date(time).toISOString();
}

function usageSummaryFromMessage(message: Json) {
  const usage = message?.usage || {};
  const input = numberValue(usage.input);
  const output = numberValue(usage.output);
  const cacheRead = numberValue(usage.cacheRead);
  const cacheWrite = numberValue(usage.cacheWrite);
  const total = numberValue(usage.totalTokens) || input + output + cacheRead + cacheWrite;
  const cache = cacheRead + cacheWrite;
  const cost = numberValue(usage.cost?.total);
  if (!total && !cost) return undefined;
  return { input, output, cacheRead, cacheWrite, cache, total, cost };
}

function summarizeLogValue(value: any): any {
  if (typeof value === "string") {
    if (/^data:image\//.test(value) || value.length > LOG_TEXT_LIMIT) {
      return { chars: value.length, preview: truncateText(value, 600) };
    }
    return value;
  }
  if (Array.isArray(value)) return value.slice(0, 8).map(summarizeLogValue);
  if (!value || typeof value !== "object") return value;
  const out: Json = {};
  const preferred = [
    "ok", "pass", "error", "summary", "warnings", "issues", "limitations",
    "confidence", "path", "output_path", "validation_path", "conclusions_path",
    "image_analysis_path", "refined_figure_path", "run_id",
  ];
  for (const key of preferred) {
    if (Object.prototype.hasOwnProperty.call(value, key)) out[key] = summarizeLogValue(value[key]);
  }
  if (!Object.keys(out).length) {
    for (const [key, item] of Object.entries(value).slice(0, 12)) {
      if (key === "code" || key === "thinkingSignature") {
        out[key] = typeof item === "string" ? { chars: item.length } : summarizeLogValue(item);
      } else {
        out[key] = summarizeLogValue(item);
      }
    }
  }
  return out;
}

function textFromContent(content: any[]) {
  return content
    .filter((item: any) => item?.type === "text" && typeof item.text === "string")
    .map((item: any) => item.text)
    .join("\n\n");
}

function readableLogEntriesFromEvent(event: Json, scope: string, agent: string): Json[] {
  const entries: Json[] = [];
  if (!event || typeof event !== "object") return entries;
  if (event.type === "agent_start") {
    entries.push({ ts: isoTimestamp(event.timestamp), scope, agent, event: "system", text: "agent_start" });
    return entries;
  }
  if (event.type === "agent_end") {
    entries.push({ ts: isoTimestamp(event.timestamp), scope, agent, event: "system", text: "agent_end", will_retry: event.willRetry });
    return entries;
  }
  if (event.type === "message_end") {
    const message = event.message || {};
    const content = Array.isArray(message.content) ? message.content : [];
    if (message.role === "assistant") {
      const text = truncateText(textFromContent(content));
      const thinkingItems = content.filter((item: any) => item?.type === "thinking");
      const thinkingText = thinkingItems
        .map((item: any) => typeof item.thinking === "string" ? item.thinking : "")
        .filter(Boolean)
        .join("\n\n");
      entries.push({
        ts: isoTimestamp(message.timestamp),
        scope,
        agent,
        event: "assistant",
        text,
        thinking: thinkingText ? truncateText(thinkingText, 1200) : (thinkingItems.length ? "hidden_or_unavailable" : undefined),
        usage: usageSummaryFromMessage(message),
        model: message.model,
        provider: message.provider,
        stop_reason: message.stopReason,
      });
      for (const item of content) {
        if (item?.type !== "toolCall") continue;
        entries.push({
          ts: isoTimestamp(message.timestamp),
          scope,
          agent,
          event: "tool_call",
          tool: item.name,
          text: `call ${item.name}`,
          args: summarizeLogValue(item.arguments || {}),
        });
      }
    } else if (message.role === "toolResult") {
      const text = truncateText(textFromContent(content));
      let parsed: any;
      try {
        parsed = text ? JSON.parse(text) : undefined;
      } catch {
        parsed = undefined;
      }
      entries.push({
        ts: isoTimestamp(message.timestamp),
        scope,
        agent,
        event: "tool_result",
        tool: event.toolName || message.toolName,
        text: parsed ? undefined : text,
        result: parsed ? summarizeLogValue(parsed) : undefined,
      });
    }
    return entries;
  }
  if (event.type === "tool_execution_end") {
    entries.push({
      ts: isoTimestamp(event.timestamp),
      scope,
      agent,
      event: event.isError ? "error" : "tool_result",
      tool: event.toolName,
      text: event.isError ? `tool ${event.toolName} failed` : `tool ${event.toolName} completed`,
      result: summarizeLogValue(event.result),
    });
    return entries;
  }
  if (event.type === "after_provider_response" && numberValue(event.status) >= 400) {
    entries.push({
      ts: isoTimestamp(event.timestamp),
      scope,
      agent,
      event: "error",
      text: `provider response ${event.status}`,
      status: event.status,
      headers: summarizeLogValue(event.headers || {}),
    });
  }
  return entries;
}

function pushReadableLog(logs: Json[], event: Json, scope: string, agent: string) {
  for (const entry of readableLogEntriesFromEvent(event, scope, agent)) logs.push(entry);
}

async function appendReadableLog(runDir: string | undefined, entry: Json) {
  if (!debugDiskWritesEnabled() || !runDir) return;
  const sink = new FileDiagnosticSink(runDir);
  await sink.appendJsonl("events.jsonl", entry, []);
}

function numberValue(value: any) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function usageEntry(component: string, stats: Json, extra: Json = {}) {
  const tokens = {
    input: numberValue(stats.tokens?.input),
    output: numberValue(stats.tokens?.output),
    cacheRead: numberValue(stats.tokens?.cacheRead),
    cacheWrite: numberValue(stats.tokens?.cacheWrite),
    total: numberValue(stats.tokens?.total),
  };
  const cacheTokens = tokens.cacheRead + tokens.cacheWrite;
  return {
    timestamp: new Date().toISOString(),
    component,
    source: extra.source || "session_stats",
    session_id: stats.sessionId,
    session_file: stats.sessionFile,
    call_id: extra.call_id,
    tokens,
    cache_tokens: cacheTokens,
    cache_rate: tokens.total > 0 ? cacheTokens / tokens.total : 0,
    cost: numberValue(stats.cost),
    context_usage: stats.contextUsage,
  };
}

function usageEntryFromMessage(component: string, message: Json, extra: Json = {}) {
  const usage = message?.usage || {};
  const tokens = {
    input: numberValue(usage.input),
    output: numberValue(usage.output),
    cacheRead: numberValue(usage.cacheRead),
    cacheWrite: numberValue(usage.cacheWrite),
    total: numberValue(usage.totalTokens) || numberValue(usage.input) + numberValue(usage.output) + numberValue(usage.cacheRead) + numberValue(usage.cacheWrite),
  };
  const cacheTokens = tokens.cacheRead + tokens.cacheWrite;
  return {
    timestamp: new Date().toISOString(),
    component,
    source: extra.source || "turn_usage",
    turn_index: extra.turn_index,
    stop_reason: message?.stopReason,
    response_id: message?.responseId,
    provider: message?.provider,
    model: message?.model,
    tokens,
    cache_tokens: cacheTokens,
    cache_rate: tokens.total > 0 ? cacheTokens / tokens.total : 0,
    cost: numberValue(usage.cost?.total),
  };
}

async function appendUsageEntry(runDir: string, component: string, entry: Json) {
  await usageSink.append(runDir, component, entry);
}

function scheduleUsageSummary(runDir: string) {
  usageSink.schedule(runDir);
}

async function flushUsageSummaries() {
  await usageSink.flushAll();
}

async function tryAppendUsageEntry(runDir: string | undefined, component: string, entry: Json) {
  if (!runDir) return;
  try {
    await appendUsageEntry(runDir, component, entry);
    scheduleUsageSummary(runDir);
  } catch {
    // Usage accounting must never break the workflow.
  }
}

function mainSessionStats(sessionManager: any): Json {
  const entries = sessionManager?.getEntries?.() || sessionManager?.getBranch?.() || [];
  let userMessages = 0;
  let assistantMessages = 0;
  let toolResults = 0;
  let toolCalls = 0;
  const tokens = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 };
  let cost = 0;
  for (const entry of entries) {
    const message = entry?.message;
    if (!message) continue;
    if (message.role === "user") userMessages += 1;
    if (message.role === "toolResult") toolResults += 1;
    if (message.role !== "assistant") continue;
    assistantMessages += 1;
    if (Array.isArray(message.content)) toolCalls += message.content.filter((item: any) => item?.type === "toolCall").length;
    const usage = message.usage || {};
    tokens.input += numberValue(usage.input);
    tokens.output += numberValue(usage.output);
    tokens.cacheRead += numberValue(usage.cacheRead);
    tokens.cacheWrite += numberValue(usage.cacheWrite);
    tokens.total += numberValue(usage.totalTokens) || numberValue(usage.input) + numberValue(usage.output) + numberValue(usage.cacheRead) + numberValue(usage.cacheWrite);
    cost += numberValue(usage.cost?.total);
  }
  return {
    sessionFile: sessionManager?.getSessionFile?.(),
    sessionId: sessionManager?.getSessionId?.(),
    userMessages,
    assistantMessages,
    toolCalls,
    toolResults,
    totalMessages: entries.length,
    tokens,
    cost,
  };
}

async function readJson(path: string, fallback: Json = {}) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return fallback;
  }
}

async function readPrompt(name: string) {
  return await readFile(join(PROMPT_DIR, `${name}.md`), "utf8");
}

async function loadConfig(cwd: string) {
  const workflowCwd = PROJECT_ROOT || cwd;
  const userConfigPath = process.env.SEEKBRAIN_USER_CONFIG
    || join(homedir(), ".config", "seekbrain", "config.yaml");
  return await new ConfigLoader({
    defaultConfigPath: DEFAULT_CONFIG_PATH,
    userConfigPath,
    projectConfigPath: process.env.SEEKBRAIN_CONFIG || resolve(workflowCwd, CONFIG_FILE),
    env: process.env,
  }).load() as Json;
}

function seekbrainWorkflowConfig(config: Json) {
  const configured = config.workflow?.seekbrain || {};
  const boolValue = (key: string) => configured[key] !== false;
  const literature = literatureCapabilities(config);
  const humanReview = configured.human_review || {};
  const humanReviewEnabled = humanReview.enabled === true && process.env.SEEKBRAIN_NON_INTERACTIVE !== "1";
  const humanReviewGates = humanReview.gates || {};
  return {
    research_planning: configured.research_planning === true,
    research_survey: literature.research_survey,
    deep_research: literature.deep_research,
    targeted_skill_match: literature.targeted_skill_match,
    targeted_skill_generate: literature.targeted_skill_generate,
    literature_provider: literature.provider,
    has_literature_provider: literature.available,
    image_refine: boolValue("image_refine"),
    save_skill: boolValue("save_skill"),
    transparency: boolValue("transparency"),
    human_review: {
      enabled: humanReviewEnabled,
      gates: {
        plan: humanReviewEnabled && humanReviewGates.plan === true,
        code: humanReviewEnabled && humanReviewGates.code === true,
        validate: humanReviewEnabled && humanReviewGates.validate === true,
        interpret: humanReviewEnabled && (humanReviewGates.interpret === true || humanReviewGates.conclude === true),
      },
    },
  };
}

function literatureAgentConfig(config: Json, agentName: string): Json {
  const agent = pickAgentConfig(config, agentName);
  return { ...agent, rag: literatureQueryConfig(config, agent.rag || {}) };
}

function skippedByConfig(runId: string | undefined, tool: string, key: string) {
  return content({
    ok: true,
    skipped: true,
    skipped_by_config: true,
    reason: "disabled_by_user_config",
    message: `${tool} is disabled by user configuration workflow.seekbrain.${key}; this is not a tool failure.`,
    run_id: runId,
    config_key: `workflow.seekbrain.${key}`,
  });
}

function humanGateEnabled(config: Json, stage: string) {
  const workflow = seekbrainWorkflowConfig(config);
  const gates = workflow.human_review.gates as Record<string, boolean>;
  return workflow.human_review.enabled && gates[stage] === true;
}

function parseEnv(text: string) {
  const values: Record<string, string> = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
}

async function ensureProcessEnvFromDotenv(cwd: string) {
  const env = await loadEnv(cwd);
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined || process.env[key] === "") {
      process.env[key] = value;
    }
  }
}

async function loadEnv(cwd: string) {
  const env = { ...process.env };
  const candidates = [
    resolve(cwd, ".env"),
    resolve(PROJECT_ROOT, ".env"),
  ];
  for (const path of candidates) {
    try {
      const parsed = parseEnv(await readFile(path, "utf8"));
      for (const [key, value] of Object.entries(parsed)) {
        if (env[key] === undefined || env[key] === "") env[key] = value;
      }
    } catch {
      // Missing .env files are normal.
    }
  }
  return env;
}

function resolveFromCwd(cwd: string, value: string | undefined, fallback: string) {
  const chosen = value || fallback;
  return resolve(cwd, chosen);
}

function shortTimestamp() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    "-",
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join("");
}

function imageMediaType(path: string) {
  const suffix = extname(path).toLowerCase();
  if (suffix === ".png") return "image/png";
  if (suffix === ".jpg" || suffix === ".jpeg") return "image/jpeg";
  if (suffix === ".webp") return "image/webp";
  throw new Error(`unsupported vision image type '${suffix || "unknown"}'`);
}

const VISION_IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

function isVisionImage(path: string) {
  return VISION_IMAGE_EXTS.has(extname(path).toLowerCase());
}

function resolveArtifactPath(runDir: string, artifactPath: string) {
  return new ArtifactService(runDir).paths.resolve(artifactPath);
}

type Artifact = {
  name?: string;
  path: string;
  kind: "figure" | "statistics" | "data" | "code" | "markdown" | "json" | "log" | "other";
  role?: string;
  description?: string;
  optional?: boolean;
  produced_by?: string;
  content?: string;
};

const DEFAULT_DELIVERABLES: Artifact[] = [
  { path: "generated_code.py", kind: "code" },
  { path: "figure.png", kind: "figure", role: "main" },
  { path: "figure.pdf", kind: "figure", role: "main_pdf", optional: true },
  { path: "statistics.json", kind: "statistics" },
];

function inferArtifactKind(name: string, path: string): Artifact["kind"] {
  return new ArtifactService(process.cwd()).inferKind(name, path) as Artifact["kind"];
}

function normalizeArtifact(raw: any, runDir: string, fallbackName?: string): Artifact | undefined {
  if (!raw || typeof raw !== "object" || !raw.path) return undefined;
  try {
    return new ArtifactService(runDir).normalize(raw, fallbackName) as Artifact;
  } catch {
    return undefined;
  }
}

function normalizeArtifacts(input: any, runDir: string): Artifact[] {
  return new ArtifactService(runDir).normalizeMany(input) as Artifact[];
}

function mergeArtifacts(existing: any, incoming: any, runDir: string): Artifact[] {
  return new ArtifactService(runDir).merge(existing, incoming) as Artifact[];
}

function makeArtifact(runDir: string, name: string, path: string, kind: Artifact["kind"], extra: Partial<Artifact> = {}) {
  return new ArtifactService(runDir).make(name, path, kind, extra as any) as Artifact;
}

function stateArtifacts(run: RunContext) {
  return normalizeArtifacts(run.state.artifacts || [], run.runDir);
}

function figureArtifacts(deliverables: Artifact[]): Artifact[] {
  return (deliverables || []).filter(a => a.kind === "figure" && isVisionImage(a.path));
}

async function createRefinementGuard(run: RunContext) {
  const backupDir = join(run.runDir, ".neuro-refine-guard", randomUUID());
  const guarded: Array<{ source: string; backup: string; immutable: boolean }> = [];
  const candidates = stateArtifacts(run).filter((artifact) =>
    ["data", "statistics", "code", "figure"].includes(artifact.kind)
  );
  for (const [index, artifact] of candidates.entries()) {
    const source = resolveArtifactPath(run.runDir, artifact.path);
    const rel = relative(run.runDir, source);
    if (!rel || rel.startsWith("..") || rel.startsWith("/") || !existsSync(source)) continue;
    const backup = join(backupDir, `${index}-${basename(source)}`);
    await mkdir(dirname(backup), { recursive: true });
    await copyFile(source, backup);
    guarded.push({
      source,
      backup,
      immutable: artifact.kind === "data" || artifact.kind === "statistics",
    });
  }
  return { backupDir, guarded };
}

async function finalizeRefinementGuard(
  guard: Awaited<ReturnType<typeof createRefinementGuard>>,
  subagentSucceeded: boolean,
) {
  const violations: string[] = [];
  if (subagentSucceeded) {
    for (const item of guard.guarded.filter((entry) => entry.immutable)) {
      try {
        const [before, after] = await Promise.all([readFile(item.backup), readFile(item.source)]);
        if (!before.equals(after)) violations.push(item.source);
      } catch {
        violations.push(item.source);
      }
    }
  }
  const accepted = subagentSucceeded && violations.length === 0;
  if (!accepted) {
    for (const item of guard.guarded) {
      try {
        await copyFile(item.backup, item.source);
      } catch {
        // Best-effort rollback; the caller reports the integrity failure.
      }
    }
  }
  await rm(guard.backupDir, { recursive: true, force: true }).catch(() => {});
  return { accepted, violations };
}

async function loadImageForPrompt(path: string) {
  const data = await readFile(path);
  return {
    type: "image",
    mimeType: imageMediaType(path),
    data: data.toString("base64"),
  };
}

async function loadVisionImages(paths: string[]) {
  const images: Json[] = [];
  const warnings: string[] = [];
  const loadedPaths: string[] = [];
  for (const path of paths.filter(Boolean)) {
    try {
      images.push(await loadImageForPrompt(path));
      loadedPaths.push(path);
    } catch (error) {
      warnings.push(`failed to load image '${path}': ${String(error)}`);
    }
  }
  return { images, warnings, loaded_paths: loadedPaths };
}

async function writeJson(path: string, value: Json) {
  await atomicWriteJson(path, value);
}

async function writeText(path: string, value: string) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, value, "utf8");
}

function unifiedDiff(oldText: string, newText: string, fromPath: string, toPath: string) {
  if (oldText === newText) return [`--- ${fromPath}`, `+++ ${toPath}`, "No changes."].join("\n");
  return createTwoFilesPatch(fromPath, toPath, oldText, newText, "", "", { context: 3 });
}

function codeArtifactsFromRun(run: RunContext) {
  return stateArtifacts(run).filter(a => a.kind === "code");
}

function resolveEditableCodePath(run: RunContext, requestedPath?: string) {
  const codeArtifacts = codeArtifactsFromRun(run);
  if (requestedPath) {
    const resolved = resolveArtifactPath(run.runDir, requestedPath);
    const known = codeArtifacts.find(a => a.path === resolved || a.path === requestedPath);
    if (known) return known.path;
    const relativeToRun = relative(run.runDir, resolved);
    if (relativeToRun && !relativeToRun.startsWith("..") && !relativeToRun.startsWith("/")) return resolved;
    return "";
  }
  if (codeArtifacts.length === 1) return codeArtifacts[0].path;
  const defaultPath = resolveArtifactPath(run.runDir, "generated_code.py");
  return existsSync(defaultPath) ? defaultPath : "";
}

const CODE_EDIT_EXEC_OUTPUT_LIMIT = 1_000_000;

function appendLimitedOutput(current: string, chunk: any) {
  if (current.length >= CODE_EDIT_EXEC_OUTPUT_LIMIT) return current;
  return (current + String(chunk)).slice(0, CODE_EDIT_EXEC_OUTPUT_LIMIT);
}

async function fileStamp(path: string) {
  try {
    const info = await stat(path);
    return { exists: true, mtime_ms: info.mtimeMs, size: info.size };
  } catch {
    return { exists: false, mtime_ms: 0, size: 0 };
  }
}

async function artifactStamps(paths: string[]) {
  const entries = await Promise.all(paths.map(async (path) => [path, await fileStamp(path)] as const));
  return Object.fromEntries(entries);
}

async function rerunApprovedPythonCode(codePath: string, runDir: string, signal?: AbortSignal) {
  if (extname(codePath).toLowerCase() !== ".py") {
    return { ok: false, exit_code: null, error: `Automatic rerun only supports Python code artifacts: ${codePath}` };
  }
  const startedAt = Date.now();
  const env = await loadEnv(PROJECT_ROOT);
  const candidates = [env.SEEKBRAIN_PYTHON, "python3", "python"].filter((value, index, values): value is string => Boolean(value) && values.indexOf(value) === index);
  const pythonCommand = candidates.find((command) => spawnSync(command, ["--version"], { env, stdio: "ignore" }).status === 0);
  if (!pythonCommand) {
    return { ok: false, exit_code: null, command: null, error: "Python was not found. Set SEEKBRAIN_PYTHON to a working interpreter before running Code stages." };
  }
  return await new Promise<Json>((done) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    const child = spawn(pythonCommand, [codePath], { cwd: runDir, env });
    const finish = (result: Json) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener("abort", abort);
      done({ ...result, command: pythonCommand, stdout, stderr, duration_ms: Date.now() - startedAt });
    };
    const abort = () => child.kill("SIGTERM");
    signal?.addEventListener("abort", abort, { once: true });
    child.stdout?.on("data", (chunk) => { stdout = appendLimitedOutput(stdout, chunk); });
    child.stderr?.on("data", (chunk) => { stderr = appendLimitedOutput(stderr, chunk); });
    child.on("error", (error) => finish({ ok: false, exit_code: null, error: String(error) }));
    child.on("close", (code, childSignal) => finish({
      ok: code === 0,
      exit_code: code,
      signal: childSignal || undefined,
      error: code === 0 ? undefined : `Regeneration exited with code ${code ?? "unknown"}.`,
    }));
    if (signal?.aborted) abort();
  });
}

function generatedArtifactsForCodeEdit(run: RunContext, codePath: string, scope: string) {
  const produced = stateArtifacts(run).filter((artifact) => artifact.produced_by === codePath);
  const scoped = scope === "presentation"
    ? produced.filter((artifact) => artifact.kind === "figure")
    : produced.filter((artifact) => artifact.kind !== "code" && artifact.kind !== "log");
  if (scoped.length) return scoped;
  return scope === "presentation" ? stateArtifacts(run).filter((artifact) => artifact.kind === "figure") : [];
}

type RunContext = WorkflowRunContext;

async function loadRunState(runId: string, runDir: string): Promise<RunContext> {
  return runLifecycle.loadRunState(runId, runDir);
}

function effectiveMetadata(run: RunContext, requestedDataInfo?: string, requestedExtraPathInfo?: string) {
  const locked = run.state.metadata_locked === true;
  return {
    data_info: locked ? String(run.state.data_info || "") : String(requestedDataInfo || run.state.data_info || ""),
    extra_path_info: locked ? String(run.state.extra_path_info || "") : String(requestedExtraPathInfo || run.state.extra_path_info || ""),
  };
}

function resolveQuestion(run: RunContext, question?: string): string {
  const text = String(question || run.state.question || "").trim();
  if (!text) {
    throw new Error("question is required. Pass it to the tool, or persist it first via seekbrain_run_start/seekbrain_run_resume.");
  }
  return text;
}

async function startRun(cwd: string, workDir: string, userDeliverables?: any[], question?: string): Promise<RunContext> {
  return runLifecycle.startRun(cwd, workDir, userDeliverables, question);
}

async function resolveRun(cwd: string, requestedRunId?: string): Promise<RunContext> {
  return runLifecycle.resolveRun(cwd, requestedRunId);
}

async function resumeRun(cwd: string, workDir: string, question?: string): Promise<RunContext> {
  return runLifecycle.resumeRun(cwd, workDir, question);
}

async function updateState(run: RunContext, patch: Json) {
  await runLifecycle.updateState(run, patch);
  return run.state;
}

async function snapshotRunArtifacts(run: RunContext, label: string) {
  if (!debugDiskWritesEnabled()) return undefined;
  const safeLabel = label.replace(/[^a-zA-Z0-9_.-]+/g, "_").replace(/^_+|_+$/g, "") || "snapshot";
  const snapshotDir = join(run.runDir, "_snapshots", `${shortTimestamp()}_${safeLabel}_${randomUUID().slice(0, 8)}`);
  const deliverables: Artifact[] = run.state.deliverables || DEFAULT_DELIVERABLES;
  const candidates: string[] = [
    join(run.runDir, "exec.log"),
    join(run.runDir, "generated_code.py"),
    join(run.runDir, "figure.png"),
    join(run.runDir, "figure.pdf"),
    join(run.runDir, "statistics.json"),
    join(run.runDir, "validation.json"),
    join(run.runDir, "interpretation.json"),
    join(run.runDir, "conclusions.json"),
    join(run.runDir, "image_analysis.md"),
    join(run.runDir, "figure_analysis.md"),
    ...deliverables.map(a => a.path),
    ...stateArtifacts(run).map(a => a.path),
  ].filter(Boolean) as string[];
  const seen = new Set<string>();
  const copied: Json[] = [];
  for (const candidate of candidates) {
    const source = resolveArtifactPath(run.runDir, candidate);
    if (seen.has(source) || !existsSync(source)) continue;
    seen.add(source);
    const rel = relative(run.runDir, source);
    const target = rel && !rel.startsWith("..") && !rel.startsWith("/")
      ? join(snapshotDir, rel)
      : join(snapshotDir, "external", basename(source));
    try {
      await mkdir(dirname(target), { recursive: true });
      await copyFile(source, target);
      copied.push({ source, snapshot_path: target });
    } catch {
      continue;
    }
  }
  if (!copied.length) return undefined;
  const manifest = {
    label,
    created_at: new Date().toISOString(),
    copied,
  };
  try {
    await writeJson(join(snapshotDir, "manifest.json"), manifest);
  } catch {
    return { snapshot_dir: snapshotDir, copied, manifest_warning: "diagnostic_write_failed" };
  }
  return { snapshot_dir: snapshotDir, copied };
}

function pickAgentConfig(config: Json, agentName: string) {
  return resolveAgentConfig(config as SeekBrainConfig, agentName);
}

function pickResearchPlanningConfig(config: Json) {
  return {
    ...pickAgentConfig(config, "seekbrain_plan"),
    ...(config.agents?.seekbrain_research_planning || {}),
  };
}

function researchTreeSchema() {
  return Type.Object({
    research_goal: Type.String(),
    planning_rationale: Type.String(),
    subquestions: Type.Array(Type.Object({
      id: Type.String(),
      question: Type.String(),
      hypothesis: Type.String(),
      role_in_overall_conclusion: Type.String(),
      dataset_grounding: Type.Array(Type.String(), { minItems: 1 }),
      tasks: Type.Array(Type.Object({
        id: Type.String(),
        title: Type.String(),
        analysis_question: Type.String(),
        biological_hypothesis: Type.String(),
        analysis_strategy: Type.String(),
        required_data: Type.Array(Type.String(), { minItems: 1 }),
        expected_evidence: Type.String(),
        supports_conclusion_if: Type.String(),
        contradicts_conclusion_if: Type.String(),
      }), { minItems: 1, maxItems: 2 }),
    }), { minItems: 2, maxItems: 3 }),
    synthesis_strategy: Type.String(),
  });
}

function researchPlanReviewSchema() {
  const issue = Type.Object({
    target_id: Type.String(),
    dimension: Type.String(),
    issue: Type.String(),
    required_change: Type.String(),
  });
  return Type.Object({
    verdict: Type.Union([Type.Literal("accept"), Type.Literal("revise"), Type.Literal("blocked")]),
    summary: Type.String(),
    blocking_issues: Type.Array(issue),
    non_blocking_suggestions: Type.Array(Type.String()),
    missing_evidence: Type.Array(Type.String()),
    redundancies: Type.Array(Type.String()),
    unsupported_tasks: Type.Array(Type.String()),
    blocked_reason: Type.String(),
    recommended_action: Type.String(),
  });
}

function researchRouteSchema(literatureProvider?: string) {
  const fields: Json = {
    route: Type.Union([Type.Literal("standard"), Type.Literal("research_planning"), Type.Literal("needs_clarification")]),
    reason: Type.String(),
    dataset_summary: Type.String(),
    question_requirements: Type.String(),
    recommended_action: Type.String(),
    evidence_dimensions: Type.Array(Type.String()),
    inferred_background: Type.String(),
    inferred_scientific_goal: Type.String(),
  };
  if (literatureProvider === "semantic_scholar" || literatureProvider === "pubmed") {
    fields.literature_queries = Type.Array(Type.String(), { minItems: 2, maxItems: 3 });
  }
  return Type.Object(fields);
}

async function appendStateEntry(pi: ExtensionAPI, event: Json) {
  try {
    await pi.appendEntry("seekbrain-state", event);
  } catch {
    // appendEntry is best-effort; state.json remains the source of truth.
  }
}

// --- transparency cards ---------------------------------------------------
// Pure markdown builders for the compact research/recipe panels. `pi.sendMessage`
// renders the returned string as themed markdown.
function _firstMeaningfulLine(text: string): string {
  for (const raw of String(text || "").split("\n")) {
    const line = raw.trim();
    if (!line || line === "[Deep Research Background]") continue;
    if (/^#{1,6}\s/.test(line)) return line.replace(/^#{1,6}\s*/, "").trim();
    return line;
  }
  return "";
}

function _year(pubTime: any): string {
  const m = String(pubTime || "").match(/\d{4}/);
  return m ? m[0] : "";
}

function researchCardMarkdown(state: Json): string {
  const ctxText = String(state.deep_research_context || "");
  const sources: Json[] = Array.isArray(state.deep_research_sources) ? state.deep_research_sources : [];
  const summary = String(state.deep_research?.summary || "").trim() || _firstMeaningfulLine(ctxText);
  const lines = ["## 🔬 Deep Research"];
  if (summary) lines.push(summary.slice(0, 300));
  if (sources.length) {
    lines.push("", `**Sources (${sources.length}):**`);
    for (const s of sources.slice(0, 3)) {
      const title = String(s.title || "(untitled paper)").trim();
      const meta = [String(s.magazine || "").trim(), _year(s.pub_time)].filter(Boolean).join(" ");
      const gh = Array.isArray(s.github_links) && s.github_links[0] ? ` · [repo](${s.github_links[0]})` : "";
      lines.push(`- **${title}**${meta ? ` — ${meta}` : ""}${gh}`);
    }
    if (sources.length > 3) lines.push(`- …and ${sources.length - 3} more`);
  } else if (ctxText.trim()) {
    lines.push("", "_Background synthesized without external sources._");
  } else {
    lines.push("", "_Research ran but produced no usable background._");
  }
  lines.push("", "→ `/seekbrain-show research` for the full Deep Research background");
  return lines.join("\n");
}

function _parseSkillHeaders(targeted: string): { name: string; relevance?: string }[] {
  const out: { name: string; relevance?: string }[] = [];
  let m: RegExpExecArray | null;
  // Match the recipe-loader header while retaining compatibility with older SKILL headers.
  const re = /^\s*(?:RECIPE|SKILL)\s*:\s*(.+?)\s*(?:\(relevance:\s*([\d.]+)\))?\s*$/gm;
  while ((m = re.exec(targeted))) out.push({ name: m[1].trim(), relevance: m[2] });
  if (!out.length) {
    const re2 = /^###\s+(?:Recipe|Skill) from:\s*(.+)$/gim;
    while ((m = re2.exec(targeted))) out.push({ name: m[1].trim() });
  }
  return out;
}

function _skillOverview(targeted: string): string {
  const desc = targeted.match(/^\s*description:\s*["']?(.+?)["']?\s*$/im);
  if (desc && desc[1].trim()) return desc[1].trim();
  const ov = targeted.match(/##\s*Overview\s*\n+([^\n#].*)/i);
  if (ov && ov[1].trim()) return ov[1].trim();
  return "";
}

function skillCardMarkdown(state: Json): string {
  const targeted = String(state.targeted_skill || "");
  const source = String(state.targeted_skill_result?.source || (targeted ? "existing_skill" : "none"));
  const label = source === "generated_from_rag" ? "crystallized from literature and code" : source === "existing_skill" ? "retrieved from the Neuroscience Analysis Repertoire" : "no match";
  const lines = [`## 🧩 Analysis Recipe — ${label}`];
  if (!targeted.trim() || source === "none") {
    lines.push("", "_No matching analysis recipe was found for this question._");
    return lines.join("\n");
  }
  for (const s of _parseSkillHeaders(targeted).slice(0, 4)) {
    lines.push(`- **${s.name}**${s.relevance ? ` (relevance ${s.relevance})` : ""}`);
  }
  const overview = _skillOverview(targeted);
  if (overview) lines.push("", overview.slice(0, 300));
  lines.push("", "→ `/seekbrain-show recipe` for the full recipe document (`SKILL.md`)");
  return lines.join("\n");
}

async function writeDiagnosticJson(sink: FileDiagnosticSink, path: string, data: Json, warnings: Json[]) {
  await sink.json(path, data, warnings as DiagnosticWarning[]);
}

async function writeDiagnosticText(sink: FileDiagnosticSink, path: string, text: string, warnings: Json[]) {
  await sink.text(path, text, warnings as DiagnosticWarning[]);
}

async function writeDiagnosticJsonl(sink: FileDiagnosticSink, path: string, entries: Json[], warnings: Json[]) {
  await sink.jsonl(path, entries, warnings as DiagnosticWarning[]);
}

async function snapshotSubagentFiles(agentDir: string, sink: FileDiagnosticSink, warnings: Json[]) {
  if (!debugDiskWritesEnabled()) return undefined;
  const files = ["input.json", "output.json", "prompt.md", "events.jsonl"];
  const existing = files.filter((name) => existsSync(join(agentDir, name)));
  if (!existing.length) return undefined;
  const snapshotDir = join(agentDir, "_snapshots", `call_${shortTimestamp()}_${randomUUID().slice(0, 8)}`);
  if (!await sink.directory(snapshotDir, warnings as DiagnosticWarning[])) return undefined;
  const copied: string[] = [];
  const skipped: Json[] = [];
  for (const name of existing) {
    const source = join(agentDir, name);
    const target = join(snapshotDir, name);
    if (await sink.copy(source, target, warnings as DiagnosticWarning[])) {
      copied.push(target);
    } else {
      skipped.push({ source, target, error: warnings.at(-1)?.error });
    }
  }
  await writeDiagnosticJson(sink, join(snapshotDir, "manifest.json"), {
    created_at: new Date().toISOString(),
    copied,
    skipped,
  }, warnings);
  return snapshotDir;
}

async function runSubagent(options: {
  runDir: string;
  agentName: string;
  finalizeTool: string;
  finalizeSchema: any;
  prompt: string;
  agentConfig?: Json;
  tools?: string[];
  images?: Json[];
  signal?: AbortSignal;
}) {
  const agentDir = join(options.runDir, "subagents", options.agentName);
  const inputPath = join(agentDir, "input.json");
  const outputPath = join(agentDir, "output.json");
  const persistSubagentFiles = debugDiskWritesEnabled();
  const diagnosticSink = new FileDiagnosticSink(options.runDir, persistSubagentFiles);
  const diagnosticWarnings: Json[] = [];
  if (persistSubagentFiles) {
    await diagnosticSink.directory(agentDir, diagnosticWarnings as DiagnosticWarning[]);
  }
  const snapshotDir = persistSubagentFiles ? await snapshotSubagentFiles(agentDir, diagnosticSink, diagnosticWarnings) : undefined;
  if (persistSubagentFiles) {
    await writeDiagnosticJson(diagnosticSink, inputPath, {
      agent_name: options.agentName,
      finalize_tool: options.finalizeTool,
      tools: options.tools || [],
      prompt: options.prompt,
    }, diagnosticWarnings);
    await writeDiagnosticText(diagnosticSink, join(agentDir, "prompt.md"), options.prompt, diagnosticWarnings);
  }

  const readableLogs: Json[] = [];
  const result = await piAgentAdapter.run({
    runDir: options.runDir,
    finalizeTool: options.finalizeTool,
    finalizeSchema: options.finalizeSchema,
    prompt: options.prompt,
    agentConfig: options.agentConfig as any,
    tools: options.tools,
    images: options.images,
    signal: options.signal,
    onEvent: (event) => pushReadableLog(readableLogs, event, "subagent", options.agentName),
    onFinalize: persistSubagentFiles
      ? async (payload) => writeDiagnosticJson(diagnosticSink, outputPath, payload, diagnosticWarnings)
      : undefined,
  });
  if (result.stats) {
    await tryAppendUsageEntry(
      options.runDir,
      options.agentName,
      usageEntry(options.agentName, result.stats, { call_id: snapshotDir }),
    );
  }
  if (persistSubagentFiles) {
    await writeDiagnosticJsonl(diagnosticSink, join(agentDir, "events.jsonl"), readableLogs, diagnosticWarnings);
  }
  if (result.ok && result.result) {
    return {
      ok: true,
      result: result.result as Json,
      subagent_dir: agentDir,
      output_path: outputPath,
      snapshot_dir: snapshotDir,
      diagnostic_warnings: diagnosticWarnings,
    };
  }
  const missingFinalize = result.error === `subagent did not call ${options.finalizeTool}`;
  const failure = {
    ok: false,
    error: result.error || "Pi SDK subagent execution did not complete",
    subagent_dir: agentDir,
    output_path: outputPath,
    snapshot_dir: snapshotDir,
    ...(missingFinalize ? {} : {
      timeout_seconds: result.timeout_seconds,
      fallback: "prompt artifact written; Pi SDK subagent execution did not complete",
    }),
  };
  if (persistSubagentFiles) {
    await writeDiagnosticJson(diagnosticSink, outputPath, failure, diagnosticWarnings);
  }
  return { ...failure, diagnostic_warnings: diagnosticWarnings };
}

export async function registerSeekBrainRuntime(pi: ExtensionAPI) {
  let activeRunDir: string | undefined;
  let configWatcher: FSWatcher | undefined;
  let configWatchedPath: string | undefined;
  const skillLibrary = new SkillLibraryManager({ packageRoot: PACKAGE_ROOT });
  registerTransparencyCardRenderers(pi);
  const ragSkillGenerator = new RagSkillGenerator(async (input) => {
    const runDir = input.signal ? activeRunDir || PROJECT_ROOT : activeRunDir || PROJECT_ROOT;
    const config = await loadConfigCached(PROJECT_ROOT);
    const repositoryContext = input.matchedFiles.map((file) => `### ${file.path}\n\n${file.content}`).join("\n\n").slice(0, 50_000);
    const paperOnly = input.evidenceLevel === "paper_only";
    const authored = await runSubagent({
      runDir,
      agentName: "targeted_skill_generator",
      finalizeTool: "finalize_targeted_skill",
      finalizeSchema: Type.Object({
        name: Type.String(),
        description: Type.String(),
        triggers: Type.Array(Type.String()),
        tags: Type.Array(Type.String()),
        skill_body: Type.String(),
        analysis_script: Type.Optional(Type.String()),
        utility_script: Type.Optional(Type.String()),
      }),
      prompt: [
        paperOnly
          ? "You are the isolated SeekBrain paper-only Recipe Crystallization Agent."
          : "You are the isolated SeekBrain Recipe Crystallization Agent for literature and code.",
        paperOnly
          ? "Generate reusable, evidence-grounded methodological guidance from the paper only. No implementation repository was verified."
          : "Generate a reusable, evidence-grounded neuroscience analysis recipe from the question, paper context, and verified repository files.",
        paperOnly
          ? "Do not claim that paper procedures are implemented, do not invent code or dependencies, and return an empty analysis_script if the field is present."
          : "Do not invent dataset paths, schemas, functions, dependencies, or results. The analysis script must use argparse and save declared outputs.",
        "Return only through finalize_targeted_skill.",
        `Question:\n${input.question}`,
        `Paper: ${input.title}\n${input.matchedPaperContext.slice(0, 30_000)}`,
        paperOnly ? "Evidence level: paper_only" : `Repository: ${input.repoLink}\n${input.repoOverview}`,
        paperOnly ? "Repository evidence: none" : `Matched repository analysis:\n${input.matchedRepoContext.slice(0, 20_000)}`,
        paperOnly ? "Paper-to-code mapping: unavailable" : `Paper-to-code mapping and gaps:\n${input.connectionAnalysis.slice(0, 20_000)}`,
        `Required adaptation plan:\n${input.reproductionPlan.slice(0, 20_000)}`,
        paperOnly ? "Matched repository files: none" : `Matched repository files:\n${repositoryContext}`,
      ].join("\n\n"),
      agentConfig: pickAgentConfig(config, "seekbrain_skill_generate"),
      tools: [],
      signal: input.signal,
    });
    if (!authored.ok || !authored.result) throw new Error((authored as Json).error || "Recipe Crystallization Agent did not finalize");
    return authored.result;
  }, async (input) => {
    const runDir = activeRunDir || PROJECT_ROOT;
    const config = await loadConfigCached(PROJECT_ROOT);
    const manifest = input.repositoryFiles
      .map((file) => `${file.path}\t${file.extension}\t${file.size}`)
      .join("\n")
      .slice(0, 60_000);
    const context = await runSubagent({
      runDir,
      agentName: "targeted_skill_context",
      finalizeTool: "finalize_targeted_skill_context",
      finalizeSchema: Type.Object({
        repo_overview: Type.String(),
        selected_files: Type.Array(Type.String()),
        matched_paper_context: Type.String(),
        matched_repo_context: Type.String(),
        connection_analysis: Type.String(),
        reproduction_plan: Type.String(),
      }),
      prompt: [
        "You are the isolated SeekBrain Recipe Crystallization context analyst for literature and code.",
        "Reproduce the original context-matching stages: analyze the paper method, inspect the repository, rank the exact relevant files, map paper methods to code, identify missing pieces, and produce a detailed executable reproduction plan.",
        "Use read/grep/find/ls to inspect the cloned repository. selected_files must contain exact paths relative to Repository root and at most 10 files.",
        "Never infer a function, parameter, dependency, dataset path, or output that is not supported by the supplied paper or repository.",
        "Return only through finalize_targeted_skill_context.",
        `Question:\n${input.question}`,
        `Paper: ${input.title}\n${input.paperText.slice(0, 60_000)}`,
        `Repository URL: ${input.repoLink}`,
        `Repository root: ${input.repoDir}`,
        `Repository file manifest:\n${manifest}`,
      ].join("\n\n"),
      agentConfig: pickAgentConfig(config, "seekbrain_skill_context"),
      tools: ["read", "grep", "find", "ls"],
      signal: input.signal,
    });
    if (!context.ok || !context.result) throw new Error((context as Json).error || "analysis-recipe context analyst did not finalize");
    return context.result as any;
  });
  const targetedSkillResolver = new TargetedSkillResolver(literatureProviderRouter, {
    ensureTrajectoryDir: () => skillLibrary.ensureTrajectory(),
    userSkillsRoot: skillLibrary.userSkillsRoot,
    generatedSkillDir: join(skillLibrary.userSkillsRoot, "from_rag"),
    ragSkillGenerator,
    selectSkills: async (input) => {
      const runDir = input.traceDir ? resolve(input.traceDir, "..") : activeRunDir || PROJECT_ROOT;
      const config = await loadConfigCached(PROJECT_ROOT);
      const candidateText = input.candidates.map((candidate) => JSON.stringify(candidate)).join("\n").slice(0, 60_000);
      const selected = await runSubagent({
        runDir,
        agentName: "targeted_skill_matcher",
        finalizeTool: "finalize_targeted_skill_match",
        finalizeSchema: Type.Object({
          selected: Type.Array(Type.Object({ name: Type.String(), path: Type.String(), score: Type.Number(), reason: Type.String() })),
        }),
        prompt: [
          "You are the isolated SeekBrain analysis-recipe matcher. Carefully read the name and description of each recipe and assess its relevance to the user's question.",
          `Assign a relevance score between 0 and 1 to each relevant recipe. Only keep scores greater than or equal to ${input.threshold}, and return at most ${input.topK}.`,
          "If no analysis recipe is relevant, return an empty selected array.",
          "Return exact candidate name and path only through finalize_targeted_skill_match.",
          `Question:\n${input.question}`,
          `Candidates:\n${candidateText}`,
        ].join("\n\n"),
        agentConfig: pickAgentConfig(config, "seekbrain_skill_match"),
        tools: [],
        signal: input.signal,
      });
      if (!selected.ok || !Array.isArray(selected.result?.selected)) throw new Error((selected as Json).error || "analysis-recipe matcher did not finalize");
      return selected.result.selected;
    },
  });
  const researchSkillWorkflow = new ResearchSkillWorkflow({
    lifecycle: runLifecycle,
    resolveSkill: (input, cwd, signal) => targetedSkillResolver.resolve(input, cwd, signal),
    retrievePapers: (input, cwd, signal) => literatureProviderRouter.query(input, cwd, signal),
    runAgent: async (input) => runSubagent({
      runDir: input.runDir,
      agentName: "seekbrain_deep_research",
      finalizeTool: "finalize_deep_research",
      finalizeSchema: input.finalizeSchema,
      prompt: input.prompt,
      agentConfig: input.agentConfig,
      tools: [],
      signal: input.signal,
    }),
    writeJson,
    writeText,
    appendEvent: (event) => appendStateEntry(pi, event),
    summarize: limitForMain,
  });
  const researchSurveyWorkflow = new ResearchSurveyWorkflow({
    lifecycle: runLifecycle,
    retrievePapers: (input, cwd, signal) => literatureProviderRouter.query(input, cwd, signal),
    runAgent: async (input) => runSubagent({
      runDir: input.runDir,
      agentName: "seekbrain_research_survey",
      finalizeTool: "finalize_research_survey",
      finalizeSchema: input.finalizeSchema,
      prompt: input.prompt,
      agentConfig: input.agentConfig,
      tools: [],
      signal: input.signal,
    }),
    writeJson,
    writeText,
    appendEvent: (event) => appendStateEntry(pi, event),
  });
  const researchPlanningWorkflow = new ResearchPlanningWorkflow({
    lifecycle: runLifecycle,
    runAgent: async (input) => runSubagent({
      runDir: input.runDir,
      agentName: input.finalizeTool === "finalize_research_route"
        ? "seekbrain_research_route"
        : input.finalizeTool === "finalize_research_plan_review"
          ? "seekbrain_research_plan_reviewer"
          : "seekbrain_research_planning",
      finalizeTool: input.finalizeTool,
      finalizeSchema: input.finalizeSchema,
      prompt: input.prompt,
      agentConfig: input.agentConfig,
      tools: [],
      signal: input.signal,
    }),
    writeJson,
    appendEvent: (event) => appendStateEntry(pi, event),
  });
  const researchTaskScheduler = new ResearchTaskScheduler({
    lifecycle: runLifecycle,
    writeJson,
  });
  const reportEvidenceCompiler = new ReportEvidenceCompiler({ writeJson });
  const reporterWorkflow = new ReporterWorkflow({
    runAgent: async (input) => runSubagent({
      runDir: input.runDir,
      agentName: "seekbrain_report",
      finalizeTool: "finalize_seekbrain_report",
      finalizeSchema: input.finalizeSchema,
      prompt: input.prompt,
      agentConfig: input.agentConfig,
      tools: [],
      images: input.images,
      signal: input.signal,
    }),
    loadImages: loadVisionImages,
    writeJson,
    writeText,
    exportPdf: exportReportPdf,
  });
  const generateScientificReport = async (input: {
    projectPath: string;
    selectedEvidence: string[];
    reportGoal?: string;
    signal?: AbortSignal;
    onProgress?: (progress: Json) => void;
  }) => {
    input.onProgress?.({
      stage: "compiling",
      message: "Compiling selected evidence",
      selected_count: input.selectedEvidence.length,
    });
    const compiled = await reportEvidenceCompiler.compile({
      projectPath: input.projectPath,
      selectedEvidence: input.selectedEvidence,
      reportGoal: input.reportGoal,
    });
    const config = await loadConfigCached(PROJECT_ROOT);
    return reporterWorkflow.execute({
      evidenceBundlePath: compiled.evidence_bundle_path,
      rolePrompt: await readPrompt("report"),
      agentConfig: pickAgentConfig(config, "seekbrain_report"),
      finalizeSchema: seekbrainReportFinalizeSchema(),
      signal: input.signal,
      onProgress: input.onProgress,
      pdf: config.workflow?.seekbrain?.report?.pdf,
    });
  };
  const planWorkflow = new PlanWorkflow({
    lifecycle: runLifecycle,
    runAgent: async (input) => runSubagent({
      runDir: input.runDir,
      agentName: "seekbrain_formulation_generate",
      finalizeTool: "finalize_plan",
      finalizeSchema: input.finalizeSchema,
      prompt: input.prompt,
      agentConfig: input.agentConfig,
      tools: [],
      signal: input.signal,
    }),
    writeText,
    appendEvent: (event) => appendStateEntry(pi, event),
  });
  const codeWorkflow = new CodeWorkflow({
    lifecycle: runLifecycle,
    retryPolicy: codeRetryPolicy,
    runAgent: async (input) => runSubagent({
      runDir: input.runDir,
      agentName: "seekbrain_code_execute",
      finalizeTool: "finalize_code_result",
      finalizeSchema: input.finalizeSchema,
      prompt: input.prompt,
      agentConfig: input.agentConfig,
      tools: ["read", "write", "edit", "bash", "grep", "find", "ls"],
      signal: input.signal,
    }),
    writeText,
    writeJson,
    snapshot: snapshotRunArtifacts,
    appendEvent: (event) => appendStateEntry(pi, event),
  });
  const validateWorkflow = new ValidateWorkflow({
    lifecycle: runLifecycle,
    loadImages: loadVisionImages,
    runAgent: async (input) => runSubagent({
      runDir: input.runDir,
      agentName: "seekbrain_validation_run",
      finalizeTool: "finalize_validation",
      finalizeSchema: input.finalizeSchema,
      prompt: input.prompt,
      agentConfig: input.agentConfig,
      tools: [],
      images: input.images,
      signal: input.signal,
    }),
    normalize: normalizeValidation,
    nextStep: validationNextStep,
    writeJson,
    snapshot: snapshotRunArtifacts,
    appendEvent: (event) => appendStateEntry(pi, event),
  });
  const imageWorkflow = new ImageWorkflow({
    lifecycle: runLifecycle,
    loadImages: loadVisionImages,
    runRefiner: async (input) => runSubagent({
      runDir: input.runDir,
      agentName: "seekbrain_figure_refine",
      finalizeTool: "finalize_refinement",
      finalizeSchema: input.finalizeSchema,
      prompt: input.prompt,
      agentConfig: input.agentConfig,
      tools: ["read", "write", "edit", "bash", "grep", "find", "ls"],
      images: input.images,
      signal: input.signal,
    }),
    createGuard: createRefinementGuard,
    finalizeGuard: (guard, succeeded) => finalizeRefinementGuard(
      guard as Awaited<ReturnType<typeof createRefinementGuard>>,
      succeeded,
    ),
    fastPass: fastPassRefinedValidation,
    nextStep: validationNextStep,
    writeJson,
    snapshot: snapshotRunArtifacts,
    appendEvent: (event) => appendStateEntry(pi, event),
  });
  const interpretWorkflow = new InterpretWorkflow({
    lifecycle: runLifecycle,
    currentArtifactsValidated,
    nextStep: validationNextStep,
    loadImages: loadVisionImages,
    runAgent: async (input) => runSubagent({
      runDir: input.runDir,
      agentName: "seekbrain_interpretation_run",
      finalizeTool: "finalize_interpretation",
      finalizeSchema: input.finalizeSchema,
      prompt: input.prompt,
      agentConfig: input.agentConfig,
      tools: ["read"],
      images: input.images,
      signal: input.signal,
    }),
    writeJson,
    writeText,
    snapshot: snapshotRunArtifacts,
    appendEvent: (event) => appendStateEntry(pi, event),
    publishTaskEvent: async (event) => {
      const parent = await resolveRun(event.cwd, event.parentRunId);
      if (!parent.state.research_execution?.scheduler_path) return false;
      await researchTaskScheduler.publishEvent({
        cwd: event.cwd,
        parentRunId: event.parentRunId,
        taskId: event.taskId,
        type: "task_completed",
        payload: event.payload,
      });
      return true;
    },
  });
  const executeResearchTask: ResearchTaskExecutionDependencies["executeTask"] = async ({ cwd, task, publish, signal }) => {
      const config = await loadConfigCached(PROJECT_ROOT);
      const workflow = seekbrainWorkflowConfig(config);
      const [codePrompt, validatePrompt, refinePrompt, interpretPrompt] = await Promise.all([
        readPrompt("code"), readPrompt("validate"), readPrompt("image_refine"), readPrompt("interpret"),
      ]);
      let child = await resolveRun(cwd, task.run_id);
      if (child.state.interpretation && child.state.conclusions) {
        await publish("task_completed", {
          completed_at: new Date().toISOString(),
          interpretation_path: join(child.runDir, "interpretation.json"),
          conclusions_path: join(child.runDir, "conclusions.json"),
          summary: child.state.conclusions.summary || child.state.interpretation.summary || "",
          recovered_existing_result: true,
        });
        return { task_id: task.task_id, run_id: task.run_id, ok: true, recovered_existing_result: true };
      }
      const needsCode = Number(child.state.code_attempt || 0) === 0 || child.state.validation?.route === "retry_code";
      await publish("execution_started", { resumed: Number(child.state.code_attempt || 0) > 0 });
      await publish("code_started", {
        code_attempt: needsCode ? Number(child.state.code_attempt || 0) + 1 : Number(child.state.code_attempt || 0),
        reused: !needsCode,
        retry_reason: child.state.validation?.route === "retry_code" ? child.state.validation?.next_code_feedback : undefined,
      });
      const code = needsCode ? await codeWorkflow.execute({
        cwd,
        runId: task.run_id,
        validationFeedback: child.state.validation?.next_code_feedback,
        rolePrompt: codePrompt,
        agentConfig: pickAgentConfig(config, "seekbrain_code"),
        finalizeSchema: Type.Object({
          code_files: Type.Array(Type.Object({ path: Type.String() }), { minItems: 1 }),
          exec_log: Type.String(),
          statistics: Type.Any(),
          artifacts: Type.Array(Type.Object({
            name: Type.Optional(Type.String()),
            path: Type.String(),
            kind: Type.Union([Type.Literal("figure"), Type.Literal("statistics"), Type.Literal("data"), Type.Literal("code"), Type.Literal("markdown"), Type.Literal("json"), Type.Literal("log"), Type.Literal("other")]),
            role: Type.Optional(Type.String()),
            description: Type.Optional(Type.String()),
            produced_by: Type.Optional(Type.String()),
          })),
          summary: Type.String(),
          warnings: Type.Array(Type.String()),
        }),
        planReviewRequired: humanGateEnabled(config, "plan"),
        maxAttempts: DEFAULT_MAX_CODE_ATTEMPTS,
        signal,
      }) : { ok: true, code_attempt: child.state.code_attempt, result: child.state.code || {} };
      if (!code.ok) throw new Error(`Code failed for ${task.task_id}: ${code.error || code.message || "unknown error"}`);
      await publish("code_completed", {
        code_attempt: code.code_attempt || child.state.code_attempt,
        code_summary: code.result?.summary,
        reused: !needsCode,
      });

      child = await resolveRun(cwd, task.run_id);
      const persistedValidation = child.state.validation;
      const validationCurrent = persistedValidation
        && Number(persistedValidation.validated_code_attempt ?? child.state.code_attempt) === Number(child.state.code_attempt || 0)
        && child.state.validation_invalidated_by_code_edit !== true
        && persistedValidation.route !== "retry_code";
      await publish("validation_started", { code_attempt: child.state.code_attempt, code_summary: code.result?.summary, reused: validationCurrent });
      const validation = validationCurrent ? {
        ok: true,
        result: persistedValidation,
        validation_path: join(child.runDir, "validation.json"),
      } : await validateWorkflow.execute({
        cwd,
        runId: task.run_id,
        rolePrompt: validatePrompt,
        agentConfig: pickAgentConfig(config, "seekbrain_validate"),
        finalizeSchema: Type.Object({
          pass: Type.Boolean(),
          per_figure: Type.Array(Type.Object({ path: Type.String(), pass: Type.Boolean(), issues: Type.Array(Type.String()) })),
          overall_mismatches: Type.Array(Type.String()),
          blocking_issues: Type.Array(Type.String()),
          methodological_caveats: Type.Array(Type.String()),
          visual_issues: Type.Array(Type.Object({ figure_path: Type.String(), feedback: Type.String() }), { maxItems: 1 }),
          confidence: Type.Number(),
          summary: Type.String(),
        }),
        maxCodeAttempts: DEFAULT_MAX_CODE_ATTEMPTS,
        signal,
      });
      if (!validation.ok) throw new Error(`Validation failed for ${task.task_id}: ${validation.error || "unknown error"}`);
      await publish("validation_completed", {
        validation_path: validation.validation_path,
        route: validation.result?.route,
        pass: validation.result?.pass,
        summary: validation.result?.summary,
      });
      if (validation.result?.route === "retry_code") {
        await publish("task_blocked", {
          blocked_stage: "validate",
          validation_path: validation.validation_path,
          reason: validation.result.next_code_feedback || validation.result.summary || "Code repair is required.",
        });
        return { task_id: task.task_id, run_id: task.run_id, ok: false, blocked: true, stage: "validate", validation_path: validation.validation_path };
      }

      let refinement: Json | undefined;
      if (validation.result?.route === "refine_image" && workflow.image_refine) {
        await publish("refinement_started", { figure_path: validation.result.refine_target?.figure_path });
        refinement = await imageWorkflow.refine({
          cwd,
          runId: task.run_id,
          figurePath: validation.result.refine_target?.figure_path,
          feedback: validation.result.refinement_feedback,
          rolePrompt: refinePrompt,
          agentConfig: pickAgentConfig(config, "seekbrain_refine_image"),
          finalizeSchema: Type.Object({
            refined_code_patch: Type.String(),
            refined_figure_path: Type.Optional(Type.String()),
            summary: Type.String(),
            remaining_issues: Type.Array(Type.String()),
            stop: Type.Boolean(),
          }),
          enabled: true,
          signal,
        });
        // A failed presentation-only refinement is already rolled back and
        // converted to a validation caveat by ImageWorkflow; interpretation continues.
        await publish("refinement_completed", { attempted: true, ok: refinement?.ok, summary: refinement?.summary, skipped: false });
      } else {
        await publish("refinement_completed", { attempted: false, skipped: true });
      }

      await publish("interpretation_started", {
        validation_path: validation.validation_path,
        refinement_attempted: Boolean(refinement),
        refinement_ok: refinement?.ok,
      });
      const interpretation = await interpretWorkflow.execute({
        cwd,
        runId: task.run_id,
        rolePrompt: interpretPrompt,
        agentConfig: pickAgentConfig(config, "seekbrain_interpret"),
        finalizeSchema: Type.Object({
          image_analysis: Type.Object({
            figure_type: Type.String(),
            observations: Type.Array(Type.String()),
            quantitative_evidence: Type.Array(Type.String()),
            biological_interpretation: Type.Array(Type.String()),
            alternative_explanations: Type.Array(Type.String()),
            limitations: Type.Array(Type.String()),
          }),
          conclusions: Type.Array(Type.String()),
          summary: Type.String(),
          limitations: Type.Array(Type.String()),
          confidence: Type.Number(),
          next_research_directions: Type.Array(Type.Object({
            title: Type.String(),
            research_question: Type.String(),
            rationale: Type.String(),
            reuses: Type.Array(Type.String()),
            expected_output: Type.String(),
          }), { minItems: 1, maxItems: 3 }),
        }),
        signal,
      });
      if (!interpretation.ok) throw new Error(`Result Interpretation failed for ${task.task_id}: ${interpretation.error || "unknown error"}`);
      return {
        task_id: task.task_id,
        run_id: task.run_id,
        ok: true,
        validation_path: validation.validation_path,
        interpretation_path: interpretation.interpretation_path,
        conclusions_path: interpretation.conclusions_path,
        refinement_attempted: Boolean(refinement),
        refinement_ok: refinement?.ok,
      };
    };
  const researchTaskExecution = new ResearchTaskExecutionCoordinator({
    scheduler: researchTaskScheduler,
    executeTask: executeResearchTask,
  });
  const reviewWorkflow = new ReviewWorkflow({
    lifecycle: runLifecycle,
    writeText,
    appendEvent: (event) => appendStateEntry(pi, event),
  });

  // Pre-warm the validated TypeScript config loader so the first tool call
  // does not pay YAML parsing and schema-validation cost.
  //
  // IMPORTANT: do NOT `await` here. This factory registers all commands/tools
  // below; an `await` before those registrations suspends the (async) factory
  // and defers registration past pi's command-palette snapshot, so slash
  // Commands such as /seekbrain-show and /seekbrain-save-recipe must remain available. Fire-and-forget.
  void loadConfigCached(PROJECT_ROOT || process.cwd()).catch(() => {
    // Best-effort warm-up; real error surfaces at first tool call.
  });

  function startConfigWatcher(cwd: string, notify?: (msg: string, level?: "info" | "warning" | "error") => void) {
    const workflowCwd = PROJECT_ROOT || cwd;
    const path = process.env.SEEKBRAIN_CONFIG || resolve(workflowCwd, CONFIG_FILE);
    if (configWatcher && configWatchedPath === path) return;
    stopConfigWatcher();
    if (!existsSync(path)) return;
    try {
      configWatcher = watch(path, { persistent: false }, () => {
        invalidateConfigCache();
        // Reload eagerly so debugDiskWritesEnabled() and other synchronous
        // reads see the new values without waiting for the next tool call.
        loadConfigCached(cwd)
          .then(() => notify?.("SeekBrain config reloaded", "info"))
          .catch((error) => notify?.(`SeekBrain config reload failed: ${String(error)}`, "warning"));
      });
      configWatchedPath = path;
    } catch {
      // Watcher is a best-effort optimisation; TTL fallback still refreshes.
    }
  }

  function stopConfigWatcher() {
    if (!configWatcher) return;
    try {
      configWatcher.close();
    } catch {
      // ignore
    }
    configWatcher = undefined;
    configWatchedPath = undefined;
  }

  registerSeekBrainRuntimeHooks(pi, {
    getActiveRunDir: () => activeRunDir,
    setActiveRunDir: (path) => { activeRunDir = path; },
    startConfigWatcher,
    stopConfigWatcher,
    flushUsageSummaries,
    syncWorkflowWritePolicy,
    usageEntryFromMessage,
    appendUsage: tryAppendUsageEntry,
    readableLogEntries: readableLogEntriesFromEvent,
    appendReadableLog,
    transparencyEnabled: async () => seekbrainWorkflowConfig(await loadConfig(PROJECT_ROOT)).transparency,
    readRunState: (runDir) => readJson(join(runDir, "state.json"), {}),
    researchCard: researchCardMarkdown,
    skillCard: skillCardMarkdown,
    numberValue,
  });

  registerSystemCommands(pi, {
    workflowRoot: PROJECT_ROOT,
    invalidateConfig: invalidateConfigCache,
    loadConfig: loadConfigCached,
  });

  registerShowCommand(pi, {
    getActiveRunDir: () => activeRunDir,
    readJson,
    resolveRun,
    loadRunState,
    runIndexPath: (cwd) => resolve(cwd, RUN_INDEX_FILE),
  });

  registerSaveSkillCommand(pi, {
    workflowRoot: PROJECT_ROOT,
    getActiveRunDir: () => activeRunDir,
    loadConfig,
    saveSkillEnabled: (config) => seekbrainWorkflowConfig(config).save_skill,
    readJson,
    writeJson,
    resolveRun,
    loadRunState,
    runIndexPath: (cwd) => resolve(cwd, RUN_INDEX_FILE),
    readRolePrompt: () => readPrompt("save_skill"),
    runNamer: async ({ runDir, prompt, config }) => runSubagent({
      runDir,
      agentName: "save_skill_namer",
      finalizeTool: "finalize_smmt",
      finalizeSchema: Type.Object({
        stage: Type.String(),
        species: Type.String(),
        modality: Type.String(),
        method: Type.String(),
        target: Type.String(),
        rationale: Type.String(),
        proposed_description: Type.String(),
        triggers: Type.Array(Type.String()),
        tags: Type.Array(Type.String()),
      }),
      prompt,
      agentConfig: pickAgentConfig(config, "seekbrain_save_skill"),
      tools: [],
    }),
    writeSkill,
    updateState: async (run, patch) => {
      await updateState(run as RunContext, patch);
    },
    appendEvent: (event) => appendStateEntry(pi, event),
  });

  registerReportCommand(pi, {
    getActiveProjectPath: () => activeRunDir ? dirname(activeRunDir) : undefined,
    listAvailable: (projectPath) => reportEvidenceCompiler.listAvailable(projectPath),
    generate: generateScientificReport,
  });

  pi.registerTool({
    name: "seekbrain_system_check",
    label: "Check Extension",
    description: "Verify that the project-local SeekBrain Pi extension is loaded. Does not create or modify runs.",
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
      const { runCount } = await runLifecycle.ping(ctx.cwd);
      return content(pingResult(runCount));
    },
    renderResult: renderSeekBrainResult("seekbrain_system_check"),
  });

  pi.registerTool({
    name: "seekbrain_system_capabilities",
    label: "Show Capabilities",
    description: "Diagnostic tool that reports the complete SeekBrain workflow contract and current optional capabilities. Normal start, resume, and continuation calls already return the settings needed for that run; do not call this routinely.",
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
      const config = await loadConfigCached(ctx.cwd);
      return content(capabilitiesResult(config as SeekBrainConfig));
    },
    renderResult: renderCapabilitiesResult,
  });

  pi.registerTool({
    name: "seekbrain_data_resolve",
    label: "Profile Dataset",
    description: "Profile a user-provided dataset directory into persistent factual metadata. Reuses the user-level cache for the same canonical dataset directory unless refresh=true.",
    parameters: Type.Object({
      data_dir: Type.String({ description: "Dataset directory explicitly supplied by the user. It is inspected read-only." }),
      question: Type.Optional(Type.String({ description: "Research question, used only to prioritize relevant metadata details." })),
      paper_hint: Type.Optional(Type.String({ description: "Optional paper or dataset name supplied by the user." })),
      refresh: Type.Optional(Type.Boolean({ description: "Regenerate metadata even when this dataset is already cached." })),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const config = await loadConfigCached(ctx.cwd);
      const configuredCacheRoot = String(config.paths?.dataset_cache || "").trim() || undefined;
      const datasetMetadataStore = new DatasetMetadataStore(configuredCacheRoot);
      const identity = await datasetMetadataStore.identify(params.data_dir);
      const cached = params.refresh === true ? undefined : await datasetMetadataStore.load(identity);
      if (cached) {
        return content({
          ok: true,
          source: "cache",
          generated: false,
          dataset_id: identity.datasetId,
          data_dir: identity.canonicalRoot,
          metadata: cached.metadata,
          data_info: JSON.stringify(cached.metadata, null, 2),
          metadata_path: identity.metadataPath,
          manifest_path: identity.manifestPath,
          warnings: cached.manifest.warnings || [],
        });
      }

      await datasetMetadataStore.prepare(identity);
      const prompt = [
        await readPrompt("data_resolve"),
        "",
        "# Current request",
        `DATA_DIR (canonical, read-only): ${identity.canonicalRoot}`,
        `Work directory (writable probes only): ${identity.workDir}`,
        params.paper_hint ? `Paper / dataset hint: ${params.paper_hint}` : "",
        params.question ? `Downstream question (context only): ${params.question}` : "",
      ].filter(Boolean).join("\n\n");
      const resolved = await runSubagent({
        runDir: identity.workDir,
        agentName: "data_resolve",
        finalizeTool: "finalize_data_resolve",
        finalizeSchema: Type.Object({
          metadata: Type.Record(Type.String(), Type.Unknown()),
          dataset_type: Type.Union([Type.Literal("A"), Type.Literal("B"), Type.Literal("C")]),
          summary: Type.String(),
          inspected_paths: Type.Array(Type.String()),
          warnings: Type.Array(Type.String()),
        }),
        prompt,
        agentConfig: pickAgentConfig(config, "seekbrain_data_resolve"),
        tools: ["read", "bash", "grep", "find", "ls", "write"],
        signal,
      });
      if (!resolved.ok) {
        return content({
          ok: false,
          error: (resolved as any).error || "Data Analysis Agent failed to produce a dataset profile",
          dataset_id: identity.datasetId,
          data_dir: identity.canonicalRoot,
        });
      }
      const result = resolved.result as Json;
      const metadata = result.metadata as Json;
      if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
        return content({ ok: false, error: "Data Analysis Agent returned an invalid dataset profile", dataset_id: identity.datasetId });
      }
      metadata.root_dir = identity.canonicalRoot;
      const saved = await datasetMetadataStore.save(identity, metadata, {
        dataset_type: result.dataset_type,
        summary: result.summary,
        inspected_paths: result.inspected_paths,
        warnings: result.warnings,
      });
      return content({
        ok: true,
        source: "generated",
        generated: true,
        dataset_id: identity.datasetId,
        data_dir: identity.canonicalRoot,
        metadata: saved.metadata,
        data_info: JSON.stringify(saved.metadata, null, 2),
        metadata_path: identity.metadataPath,
        manifest_path: identity.manifestPath,
        dataset_type: result.dataset_type,
        summary: result.summary,
        inspected_paths: result.inspected_paths,
        warnings: result.warnings,
      });
    },
    renderResult: renderSeekBrainResult("seekbrain_data_resolve"),
  });

  pi.registerTool({
    name: "seekbrain_research_start",
    label: "Start Research",
    description: "Start a multi-round SeekBrain project and record the main Orchestrator's lightweight Planning assessment, with an internal compatibility fallback when no assessment is supplied. The direct analysis workflow materializes project_dir/round1; Research Planning keeps parent state under project_dir/planning and creates only child analysis-task rounds. Pass metadata_json_path when metadata already exists; the tool reads and locks its content internally.",
    parameters: Type.Object({
      project_dir: Type.String({ description: "Stable project-ID directory. Round outputs are created below it as round1, round2, ..." }),
      question: Type.String({ description: "Research question for round1." }),
      background: Type.Optional(Type.String({ description: "Optional scientific background supplied by the user. It is incorporated into the Research Survey and downstream Research Planning context." })),
      data_info: Type.Optional(Type.String({ description: "Inline canonical metadata content. Omit this when metadata_json_path is available; it is inherited unchanged by later rounds." })),
      extra_path_info: Type.Optional(Type.String({ description: "Canonical path/access notes. They are inherited unchanged by later rounds." })),
      metadata_json_path: Type.Optional(Type.String({ description: "Canonical metadata JSON path for this project. The tool reads and locks the file content internally." })),
      planning_assessment: Type.Optional(Type.Object({
        route: Type.Union([Type.Literal("standard"), Type.Literal("research_planning"), Type.Literal("needs_clarification")]),
        reason: Type.String(),
        dataset_summary: Type.Optional(Type.String()),
        question_requirements: Type.Optional(Type.String()),
        recommended_action: Type.Optional(Type.String()),
        evidence_dimensions: Type.Optional(Type.Array(Type.String())),
        inferred_background: Type.Optional(Type.String()),
        inferred_scientific_goal: Type.Optional(Type.String()),
        literature_queries: Type.Optional(Type.Array(Type.String(), { maxItems: 3 })),
        explicit_request_quote: Type.Optional(Type.String({ description: "Exact quote from the current user request that explicitly asks for Research Planning by name. Omit when Research Planning is only recommended or discussed." })),
      }, { description: "Compact Planning assessment prepared by the main Orchestrator from the current question and resolved dataset metadata. Supplying it avoids a separate routing-agent call." })),
      deliverables: Type.Optional(Type.Array(Type.Object({
        path: Type.String(),
        kind: Type.Union([Type.Literal("figure"), Type.Literal("statistics"), Type.Literal("data"), Type.Literal("code"), Type.Literal("other")]),
        role: Type.Optional(Type.String()),
        description: Type.Optional(Type.String()),
        optional: Type.Optional(Type.Boolean()),
        produced_by: Type.Optional(Type.String()),
      }))),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const config = await loadConfigCached(ctx.cwd);
      const workflowFlags = seekbrainWorkflowConfig(config);
      let canonicalDataInfo = String(params.data_info || "");
      if (!canonicalDataInfo.trim() && params.metadata_json_path) {
        const metadataPath = resolve(ctx.cwd, params.metadata_json_path);
        try {
          canonicalDataInfo = await readFile(metadataPath, "utf8");
        } catch (error) {
          throw new Error(`Unable to read metadata_json_path '${metadataPath}': ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      const created = await runLifecycle.startResearch({
        cwd: ctx.cwd,
        projectPath: params.project_dir,
        question: params.question,
        deliverables: params.deliverables,
        metadata: { data_info: canonicalDataInfo || undefined, extra_path_info: params.extra_path_info, metadata_json_path: params.metadata_json_path, user_background: params.background },
        deferInitialRound: workflowFlags.research_planning,
      });
      let datasetMetaSnapshotPath: string | undefined;
      if (canonicalDataInfo || params.metadata_json_path) {
        datasetMetaSnapshotPath = join(created.run.runDir, "dataset_meta_snapshot.json");
        let metadataContent: any = canonicalDataInfo;
        try { metadataContent = JSON.parse(canonicalDataInfo); } catch { /* retain text metadata */ }
        await atomicWriteJson(datasetMetaSnapshotPath, {
          metadata_json_path: params.metadata_json_path || "",
          metadata: metadataContent,
          captured_at: new Date().toISOString(),
        });
      }
      const suppliedAssessment = params.planning_assessment as Json | undefined;
      const explicitPlanningEvidence = verifiedExplicitResearchPlanningRequest(
        params.question,
        suppliedAssessment?.explicit_request_quote,
      );
      let researchRoute = workflowFlags.research_planning
        ? suppliedAssessment
          ? await researchPlanningWorkflow.recordAssessment({
            cwd: ctx.cwd,
            runId: created.run.runId,
            assessment: {
              ...suppliedAssessment,
              route: explicitPlanningEvidence ? "research_planning" : suppliedAssessment.route,
            },
          })
          : await researchPlanningWorkflow.assess({
            cwd: ctx.cwd,
            runId: created.run.runId,
            literatureProvider: workflowFlags.literature_provider,
            background: params.background,
            rolePrompt: await readPrompt("research_route"),
            agentConfig: pickAgentConfig(config, "seekbrain_research_route"),
            finalizeSchema: researchRouteSchema(workflowFlags.literature_provider),
            signal,
          })
        : {
            enabled: false,
            route: "standard",
            needs_user_review: false,
            needs_user_clarification: false,
            next_tool: "seekbrain_recipe_retrieve",
          };
      if (researchRoute.route === "research_planning" && explicitPlanningEvidence) {
        const reviewed = await researchPlanningWorkflow.recordDecision(
          ctx.cwd,
          created.run.runId,
          "yes",
          "explicit_user_request",
          explicitPlanningEvidence,
        );
        researchRoute = {
          ...researchRoute,
          ...reviewed,
          needs_user_review: false,
          planning_consent: "explicit_request",
        };
      }
      const active = workflowFlags.research_planning && researchRoute.route === "standard"
        ? await runLifecycle.materializeInitialRound(ctx.cwd, created.run.runId)
        : created;
      activeRunDir = active.run.runDir;
      const startResult = {
        ok: true,
        extension: "seekbrain",
        project_id: active.projectId,
        project_dir: active.projectDir,
        project_manifest_path: active.manifestPath,
        round_number: active.roundNumber,
        round_name: active.roundName,
        run_id: active.run.runId,
        run_dir: active.run.runDir,
        state_path: active.run.statePath,
        ...(active.run.runId !== created.run.runId ? { planning_run_id: created.run.runId, planning_dir: created.run.runDir } : {}),
        metadata_locked: true,
        dataset_meta_snapshot_path: datasetMetaSnapshotPath,
        deliverables: active.run.state.deliverables,
        question: active.run.state.question,
        workflow_config: workflowConfigResult(config as SeekBrainConfig),
        research_route: researchRoute,
        next_tool: researchRoute.next_tool,
      };
      const mismatchAction = researchRoute.route === "needs_clarification"
        ? String(researchRoute.recommended_action || "Verify that the supplied dataset and metadata match the research question, or revise the question.").trim()
        : "";
      return content(startResult, mismatchAction ? [
        "Input clarification is required; stop the workflow before Recipe.",
        `Assessment: ${String(researchRoute.reason || researchRoute.message || "").trim()}`,
        `Required user action: ${mismatchAction}`,
        "End the workflow here. In the assistant response, state the assessment once and then the required user action once, as two concise natural-language sentences. Do not mention internal route names, tools, run IDs, or artifact paths.",
      ].join("\n") : undefined);
    },
    renderResult: renderSeekBrainResult("seekbrain_research_start"),
  });

  pi.registerTool({
    name: "seekbrain_planning_assess",
    label: "Assess Research Planning",
    description: "Diagnostic and compatibility entry for rerunning the lightweight Planning assessment on an existing run. Normal new research is assessed internally by seekbrain_research_start when Research Planning is enabled.",
    parameters: Type.Object({
      run_id: Type.String(),
      background: Type.Optional(Type.String({ description: "Optional scientific background already supplied by the user." })),
      scientific_goal: Type.Optional(Type.String({ description: "Optional high-level scientific goal already supplied by the user." })),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const config = await loadConfigCached(PROJECT_ROOT);
      const workflowFlags = seekbrainWorkflowConfig(config);
      return content(await researchPlanningWorkflow.assess({
        cwd: ctx.cwd,
        runId: params.run_id,
        literatureProvider: workflowFlags.literature_provider,
        background: params.background,
        scientificGoal: params.scientific_goal,
        rolePrompt: await readPrompt("research_route"),
        agentConfig: pickAgentConfig(config, "seekbrain_research_route"),
        finalizeSchema: researchRouteSchema(workflowFlags.literature_provider),
        signal,
      }));
    },
    renderResult: renderSeekBrainResult("seekbrain_planning_assess"),
  });

  pi.registerTool({
    name: "seekbrain_planning_decision_review",
    label: "Review Research Planning",
    description: "Show the native Yes/No decision for a Research Planning recommendation. No continues the direct analysis workflow and is not treated as an error.",
    parameters: Type.Object({
      run_id: Type.String(),
      summary: Type.Optional(Type.String({ description: "Short explanation of why Research Planning was recommended." })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const run = await resolveRun(ctx.cwd, params.run_id);
      const assessment = run.state.research_planning?.assessment || {};
      const yesLabel = "Yes — initiate structured research decomposition";
      const noLabel = "No — proceed with the standard SeekBrain workflow";
      const selection = await selectYesNoReview(ctx as any, {
        title: researchPlanningReviewTitle(assessment, params.summary),
        yesLabel,
        noLabel,
      });
      if (selection.decision === "unavailable") {
        await runLifecycle.updateState(run, {
          research_planning: {
            ...(run.state.research_planning || {}),
            status: "awaiting_text_review",
          },
        });
        return content({
          ok: false,
          run_id: params.run_id,
          needs_text_review: true,
          next_tool: "seekbrain_planning_decision_record",
          message: "Interactive selector is unavailable. Ask the user to answer Yes or No, then record that response.",
        });
      }
      if (selection.decision === "cancel") return content({ ok: false, run_id: params.run_id, decision: "cancel", message: "Research Planning decision was cancelled." });
      const decision = selection.decision;
      const reviewed = await researchPlanningWorkflow.recordDecision(
        ctx.cwd,
        params.run_id,
        decision,
        "native_selector",
        decision === "yes" ? yesLabel : noLabel,
      );
      if (reviewed.ok && decision === "no") {
        const standard = await runLifecycle.materializeInitialRound(ctx.cwd, params.run_id);
        activeRunDir = standard.run.runDir;
        return content({
          ...reviewed,
          planning_run_id: params.run_id,
          run_id: standard.run.runId,
          run_dir: standard.run.runDir,
          state_path: standard.run.statePath,
          round_number: standard.roundNumber,
          round_name: standard.roundName,
          deliverables: standard.run.state.deliverables,
          question: standard.run.state.question,
        });
      }
      return content(reviewed);
    },
    renderResult: renderSeekBrainResult("seekbrain_planning_decision_review"),
  });

  pi.registerTool({
    name: "seekbrain_planning_decision_record",
    label: "Record Research Planning Response",
    description: "Record the user's short Yes/No chat response when the native Research Planning selector is unavailable.",
    parameters: Type.Object({
      run_id: Type.String(),
      decision: Type.Union([Type.Literal("yes"), Type.Literal("no")]),
      response_quote: Type.String({ description: "Exact short quote of the user's latest chat response." }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const run = await resolveRun(ctx.cwd, params.run_id);
      if (run.state.research_planning?.status !== "awaiting_text_review") {
        return content({
          ok: false,
          run_id: params.run_id,
          message: "No text-based Research Planning decision is currently pending.",
        });
      }
      const decision = params.decision as "yes" | "no";
      const reviewed = await researchPlanningWorkflow.recordDecision(
        ctx.cwd,
        params.run_id,
        decision,
        "chat_response",
        String(params.response_quote).trim(),
      );
      if (reviewed.ok && decision === "no") {
        const standard = await runLifecycle.materializeInitialRound(ctx.cwd, params.run_id);
        activeRunDir = standard.run.runDir;
        return content({
          ...reviewed,
          planning_run_id: params.run_id,
          run_id: standard.run.runId,
          run_dir: standard.run.runDir,
          state_path: standard.run.statePath,
          round_number: standard.roundNumber,
          round_name: standard.roundName,
          deliverables: standard.run.state.deliverables,
          question: standard.run.state.question,
        });
      }
      return content(reviewed);
    },
    renderResult: renderSeekBrainResult("seekbrain_planning_decision_record"),
  });

  pi.registerTool({
    name: "seekbrain_planning_generate",
    label: "Generate Hierarchical Research Plan",
    description: "Create a dataset-grounded hierarchical research plan with 2–3 scientific subquestions and 1–2 hypothesis-linked analysis tasks per subquestion after the user approves Research Planning.",
    parameters: Type.Object({
      run_id: Type.String(),
      subquestion_count: Type.Optional(Type.Integer({ minimum: 2, maximum: 3 })),
    }),
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      const config = await loadConfigCached(PROJECT_ROOT);
      const workflow = seekbrainWorkflowConfig(config);
      onUpdate?.(content({
        progress: true,
        stage: "research_survey",
        message: workflow.research_survey
          ? "Retrieving and synthesizing global literature background before generating the hierarchical research plan."
          : "Research Survey is unavailable; continuing to generate the hierarchical research plan without literature grounding.",
      }));
      const survey = await researchSurveyWorkflow.execute({
        cwd: ctx.cwd,
        runId: params.run_id,
        enabled: workflow.research_survey,
        disabledReason: workflow.has_literature_provider ? "disabled_by_user_config" : "no_literature_provider",
        rolePrompt: await readPrompt("research_survey"),
        agentConfig: literatureAgentConfig(config, "seekbrain_survey"),
        finalizeSchema: Type.Object({ literature_grounding_context: Type.String() }),
        signal,
      });
      if (!survey.ok) return content({ ...survey, stage: "research_survey", next_tool: "seekbrain_planning_generate" });
      onUpdate?.(content({
        progress: true,
        stage: "research_tree",
        message: survey.skipped
          ? "Research Survey is disabled; generating the hierarchical research plan from the question and dataset metadata."
          : `Research Survey ${survey.reused ? "reused" : "complete"} with ${Number(survey.source_count || 0)} sources; generating the hierarchical research plan.`,
      }));
      const prepared = await researchPlanningWorkflow.prepareSubquestions({
        cwd: ctx.cwd,
        runId: params.run_id,
        subquestionCount: params.subquestion_count,
        rolePrompt: await readPrompt("research_subquestions"),
        agentConfig: pickResearchPlanningConfig(config),
        finalizeSchema: researchTreeSchema(),
        signal,
      });
      return content({
        ...prepared,
        research_survey: {
          status: survey.status || (survey.skipped ? "disabled" : "ready"),
          reused: survey.reused === true,
          source_count: Number(survey.source_count || 0),
          context_path: survey.context_path,
          sources_path: survey.sources_path,
          result_path: survey.result_path,
        },
      });
    },
    renderResult: renderSeekBrainResult("seekbrain_planning_generate"),
  });

  async function applyResearchTreeDecision(
    runId: string,
    decision: "approve" | "revise" | "cancel",
    feedback: string | undefined,
    source: string,
    signal: AbortSignal | undefined,
    ctx: Json,
  ) {
    const config = await loadConfigCached(PROJECT_ROOT);
    return await researchPlanningWorkflow.recordResearchPlanDecision({
      cwd: ctx.cwd,
      runId,
      decision,
      feedback,
      source,
      orchestratorRolePrompt: await readPrompt("research_subquestions"),
      orchestratorAgentConfig: pickResearchPlanningConfig(config),
      revisionFinalizeSchema: Type.Object({
        feedback_response: Type.String(),
        final_plan: researchTreeSchema(),
      }),
      signal,
    });
  }

  async function presentResearchTreeReview(runId: string, signal: AbortSignal | undefined, ctx: Json) {
    const run = await resolveRun(ctx.cwd, runId);
    const planning = run.state.research_planning || {};
    const selection = await selectResearchTreeReview(ctx as any, {
      title: researchTreeReviewTitle(planning.final_plan || {}, planning),
      feedbackTitle: "Scientific feedback for the research plan",
      feedbackPlaceholder: "Describe what should change in the subquestions, hypotheses, tasks, or synthesis strategy",
    });
    if (selection.decision === "unavailable") {
      await runLifecycle.updateState(run, {
        research_planning: { ...planning, text_review_pending: true },
      });
      return {
        ok: false,
        run_id: runId,
        needs_text_review: true,
        next_tool: "seekbrain_planning_researcher_decision_record",
        message: "Interactive selector is unavailable. Ask the user to approve, revise with feedback, or cancel task execution.",
      };
    }
    if (planning.text_review_pending === true) {
      await runLifecycle.updateState(run, {
        research_planning: { ...planning, text_review_pending: false },
      });
    }
    if (selection.decision === "feedback_empty") {
      return { ok: false, run_id: runId, message: "No scientific feedback was entered. Review the plan again." };
    }
    return await applyResearchTreeDecision(
      runId,
      selection.decision === "feedback" ? "revise" : selection.decision,
      selection.decision === "feedback" ? selection.feedback : undefined,
      "research_tree_selector",
      signal,
      ctx,
    );
  }

  pi.registerTool({
    name: "seekbrain_planning_peer_review",
    label: "Run Reviewer Agent",
    description: "Run the single automatic Reviewer Agent critique over the complete hierarchical research plan and, only when required, one Orchestrator Agent refinement.",
    parameters: Type.Object({
      run_id: Type.String(),
      explicit_user_request: Type.Optional(Type.Boolean({ description: "Set true only when the user explicitly asks for another scientific Reviewer pass." })),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const config = await loadConfigCached(PROJECT_ROOT);
      const peerReview = await researchPlanningWorkflow.reviewResearchPlan({
        cwd: ctx.cwd,
        runId: params.run_id,
        reviewerRolePrompt: await readPrompt("research_plan_review"),
        reviewerAgentConfig: pickAgentConfig(config, "seekbrain_research_reviewer"),
        reviewerFinalizeSchema: researchPlanReviewSchema(),
        orchestratorRolePrompt: await readPrompt("research_subquestions"),
        orchestratorAgentConfig: pickResearchPlanningConfig(config),
        refinementFinalizeSchema: Type.Object({
          review_response: Type.Array(Type.Object({
            target_id: Type.String(),
            resolution: Type.Union([Type.Literal("accepted"), Type.Literal("partially_accepted"), Type.Literal("defended")]),
            explanation: Type.String(),
            changed_nodes: Type.Array(Type.String()),
          })),
          final_plan: researchTreeSchema(),
          unresolved_issues: Type.Array(Type.String()),
        }),
        explicitUserRequest: params.explicit_user_request === true,
        signal,
      });
      if (!peerReview.ok || peerReview.needs_user_review !== true) return content(peerReview);
      let researcherReview = await presentResearchTreeReview(params.run_id, signal, ctx);
      while (researcherReview.ok && researcherReview.decision === "revise" && researcherReview.needs_user_review === true) {
        researcherReview = await presentResearchTreeReview(params.run_id, signal, ctx);
      }
      return content({
        ...peerReview,
        researcher_review: researcherReview,
        ...(researcherReview.decision ? { decision: researcherReview.decision } : {}),
        ...(researcherReview.status ? { status: researcherReview.status } : {}),
        ...(researcherReview.next_tool ? { next_tool: researcherReview.next_tool } : {}),
        ...(researcherReview.needs_text_review ? { needs_text_review: true } : {}),
        needs_user_review: researcherReview.needs_user_review === true,
      });
    },
    renderResult: renderSeekBrainResult("seekbrain_planning_peer_review"),
  });

  pi.registerTool({
    name: "seekbrain_planning_researcher_review",
    label: "Review Research Plan",
    description: "Show the final hierarchical research plan review selector. User revisions are applied by the Orchestrator Agent without automatically calling the Reviewer Agent again.",
    parameters: Type.Object({
      run_id: Type.String(),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      return content(await presentResearchTreeReview(params.run_id, signal, ctx));
    },
    renderResult: renderSeekBrainResult("seekbrain_planning_researcher_review"),
  });

  pi.registerTool({
    name: "seekbrain_planning_researcher_decision_record",
    label: "Record Research Plan Review Response",
    description: "Record an approve, revise, or cancel chat response when the native final research-plan selector is unavailable.",
    parameters: Type.Object({
      run_id: Type.String(),
      decision: Type.Union([Type.Literal("approve"), Type.Literal("revise"), Type.Literal("cancel")]),
      response_quote: Type.String({ description: "Exact quote of the user's latest chat response." }),
      feedback: Type.Optional(Type.String()),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const run = await resolveRun(ctx.cwd, params.run_id);
      if (run.state.research_planning?.text_review_pending !== true) {
        return content({ ok: false, run_id: params.run_id, message: "No text-based research-plan review is currently pending." });
      }
      const responseQuote = String(params.response_quote || "").trim();
      if (!responseQuote) {
        return content({ ok: false, run_id: params.run_id, message: "The user's exact review response is required." });
      }
      if (params.decision === "revise" && !String(params.feedback || "").trim()) {
        return content({ ok: false, run_id: params.run_id, message: "Scientific feedback is required when revising the research plan." });
      }
      await runLifecycle.updateState(run, {
        research_planning: {
          ...(run.state.research_planning || {}),
          text_review_pending: false,
          text_review_response_quote: responseQuote,
        },
      });
      return content(await applyResearchTreeDecision(
        params.run_id,
        params.decision as "approve" | "revise" | "cancel",
        params.feedback,
        "chat_response",
        signal,
        ctx,
      ));
    },
    renderResult: renderSeekBrainResult("seekbrain_planning_researcher_decision_record"),
  });

  pi.registerTool({
    name: "seekbrain_analysis_tasks_prepare",
    label: "Prepare Analysis Tasks",
    description: "Create independently traceable child runs for every approved terminal analysis task, inheriting locked metadata and parent scientific context.",
    parameters: Type.Object({ run_id: Type.String() }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      return content(await researchPlanningWorkflow.materializeResearchTasks({ cwd: ctx.cwd, runId: params.run_id }));
    },
    renderResult: renderSeekBrainResult("seekbrain_analysis_tasks_prepare"),
  });

  pi.registerTool({
    name: "seekbrain_execution_initialize",
    label: "Initialize Analysis Execution",
    description: "Initialize the durable parallel scheduler for an approved, materialized hierarchical research plan. This is not used by the ordinary SeekBrain workflow.",
    parameters: Type.Object({ run_id: Type.String() }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const config = await loadConfigCached(PROJECT_ROOT);
      const execution = config.workflow.seekbrain.research_execution;
      return content(await researchTaskScheduler.initialize({
        cwd: ctx.cwd,
        runId: params.run_id,
        planningConcurrency: execution.planning_concurrency,
        executionConcurrency: execution.execution_concurrency,
      }));
    },
    renderResult: renderSeekBrainResult("seekbrain_execution_initialize"),
  });

  pi.registerTool({
    name: "seekbrain_execution_run",
    label: "Run Analysis Execution Engine",
    description: "Canonical start-or-resume entry point for the complete Analysis Execution Engine. Show every analysis task, reconcile interrupted child stages, prepare pending recipes, Deep Research context, and methodological schemas with bounded concurrency, serialize researcher review, and continue approved tasks through Code Generation & Execution, Validation, optional Figure Refinement, and Result Interpretation as slots become available.",
    parameters: Type.Object({ run_id: Type.String() }),
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      const config = await loadConfigCached(PROJECT_ROOT);
      const execution = config.workflow.seekbrain.research_execution;
      const initialized = await researchTaskScheduler.initialize({
        cwd: ctx.cwd,
        runId: params.run_id,
        planningConcurrency: execution.planning_concurrency,
        executionConcurrency: execution.execution_concurrency,
      });
      if (initialized.reused === true) {
        await researchTaskScheduler.recoverInterruptedTasks(ctx.cwd, params.run_id);
      }
      const claimed = await researchTaskScheduler.claimPlanningTasks(ctx.cwd, params.run_id);
      const claimedIds = new Set((claimed.claimed_task_ids || []).map(String));
      const allTasks = (claimed.tasks || []) as Json[];
      const initiallyClaimedTasks = allTasks.filter((task: Json) => claimedIds.has(String(task.task_id)));
      const workflow = seekbrainWorkflowConfig(config);
      const reviewPolicy = await researchTaskScheduler.nextPlanReview(ctx.cwd, params.run_id);
      const planGateEnabled = humanGateEnabled(config, "plan");
      const initiallyAutoApprove = !planGateEnabled || reviewPolicy.approve_remaining === true;
      const [deepResearchPrompt, planPrompt] = await Promise.all([readPrompt("deep_research"), readPrompt("plan")]);
      const childStates = new Map<string, Json>();
      await Promise.all(allTasks.map(async (task: Json) => {
        const child = await resolveRun(ctx.cwd, task.run_id);
        childStates.set(String(task.task_id), child.state);
      }));
      const progress = new Map<string, Json>(allTasks.map((task: Json) => {
        const taskId = String(task.task_id);
        const state = childStates.get(taskId) || {};
        const validationCurrent = state.validation
          && Number(state.validation.validated_code_attempt ?? state.code_attempt) === Number(state.code_attempt || 0)
          && state.validation_invalidated_by_code_edit !== true;
        return [taskId, {
          task_id: taskId,
          skill: state.targeted_skill || state.targeted_skill_result ? "complete" : "waiting",
          deep_research: state.deep_research_context ? "complete" : "waiting",
          plan: state.plan ? "complete" : "waiting",
          review: state.human_reviews?.plan?.status === "approved" ? "approved" : state.plan ? "queued" : "waiting",
          code: state.code ? "complete" : "waiting",
          validate: validationCurrent ? "complete" : "waiting",
          refine: state.image_refinement || state.refinement ? "complete" : validationCurrent ? "skipped" : "waiting",
          interpret: state.interpretation && state.conclusions ? "complete" : "waiting",
        }];
      }));
      const reviewedTaskIds = new Set<string>(allTasks
        .filter((task: Json) => childStates.get(String(task.task_id))?.human_reviews?.plan?.status === "approved")
        .map((task: Json) => String(task.task_id)));
      const emitProgress = (message?: string) => onUpdate?.(content({
        ok: true,
        progress: true,
        parent_run_id: params.run_id,
        message,
        task_progress: [...progress.values()],
      }));
      const updateProgress = (taskId: string, patch: Json, message?: string) => {
        progress.set(taskId, { ...(progress.get(taskId) || { task_id: taskId }), ...patch });
        emitProgress(message);
      };
      const approveChildPlan = async (task: Json, reason: string) => {
        const taskId = String(task.task_id);
        if (reviewedTaskIds.has(taskId)) return;
        const child = await resolveRun(ctx.cwd, task.run_id);
        await reviewWorkflow.approve(child, "plan", reason, { source: "research_task_review_queue" });
        reviewedTaskIds.add(taskId);
      };
      const executionResults: Json[] = [];
      const activeExecutions = new Map<string, Promise<Json>>();
      const updateExecutionProgress = (taskId: string, type: string, payload: Json) => {
        const patch: Json = {};
        if (type === "execution_started" || type === "code_started") {
          patch.code = "running";
          patch.code_attempt = payload.code_attempt;
        } else if (type === "code_completed") patch.code = "complete";
        else if (type === "validation_started") patch.validate = "running";
        else if (type === "validation_completed") patch.validate = payload.route === "retry_code" ? "revision_required" : "complete";
        else if (type === "refinement_started") patch.refine = "running";
        else if (type === "refinement_completed") patch.refine = payload.skipped ? "skipped" : payload.ok === false ? "failed" : "complete";
        else if (type === "interpretation_started") patch.interpret = "running";
        else if (type === "task_completed") patch.interpret = "complete";
        else if (type === "task_blocked") patch.blocked = true;
        else if (type === "task_failed") patch.failed = true;
        updateProgress(taskId, patch, `${taskId} · ${type.replaceAll("_", " ")}`);
      };
      const syncCompletedExecutionProgress = (scheduler: Json) => {
        let changed = false;
        for (const task of scheduler.tasks || []) {
          if (task.status !== "complete") continue;
          const taskId = String(task.task_id);
          const current: Json = progress.get(taskId) || { task_id: taskId };
          if (current.interpret === "complete") continue;
          progress.set(taskId, { ...current, interpret: "complete" });
          changed = true;
        }
        if (changed) emitProgress("Completed task released its execution slot");
      };
      const startApprovedTasks = async () => {
        const claimedExecution = await researchTaskScheduler.claimExecutionTasks(ctx.cwd, params.run_id);
        const executionIds = new Set((claimedExecution.claimed_task_ids || []).map(String));
        for (const task of (claimedExecution.tasks || []).filter((item: Json) => executionIds.has(String(item.task_id)))) {
          const taskId = String(task.task_id);
          if (activeExecutions.has(taskId)) continue;
          const running = (async () => {
            const publish = async (type: ResearchTaskEventType, payload: Json = {}) => {
              await researchTaskScheduler.publishEvent({
                cwd: ctx.cwd, parentRunId: params.run_id, taskId, type, payload,
              });
              updateExecutionProgress(taskId, type, payload);
            };
            try {
              const result = await executeResearchTask({ cwd: ctx.cwd, parentRunId: params.run_id, task, publish, signal });
              executionResults.push(result);
              return result;
            } catch (error) {
              await publish("task_failed", { failed_stage: "execution", error: String(error) });
              const result = { task_id: taskId, run_id: task.run_id, ok: false, error: String(error) };
              executionResults.push(result);
              return result;
            }
          })();
          activeExecutions.set(taskId, running);
          void running.then(() => activeExecutions.delete(taskId), () => activeExecutions.delete(taskId));
        }
      };
      const prepareTask = async (task: Json): Promise<Json> => {
        const taskId = String(task.task_id);
        try {
          updateProgress(taskId, { skill: "running", deep_research: "running" }, `${taskId} · retrieving analysis recipe and running Deep Research`);
          await Promise.all([
            researchTaskScheduler.publishEvent({ cwd: ctx.cwd, parentRunId: params.run_id, taskId, type: "skill_started" }),
            researchTaskScheduler.publishEvent({ cwd: ctx.cwd, parentRunId: params.run_id, taskId, type: "deep_research_started" }),
          ]);
          const skillPromise = researchSkillWorkflow.resolveTargetedSkill({
              cwd: ctx.cwd, workflowRoot: PROJECT_ROOT, runId: task.run_id,
              params: {}, config, flags: workflow, signal,
            }).then(async (skill) => {
              const names = (skill.skill_paths || []).map((path: unknown) => basename(String(path))).filter(Boolean);
              const skillSummary = skill.matched
                ? skill.source === "generated_from_rag"
                  ? `Crystallized ${names.join(", ") || "analysis recipe"} from literature and code`
                  : `Retrieved ${names.join(", ") || "analysis recipe"} from the Neuroscience Analysis Repertoire`
                : String(skill.warnings?.[0] || "No matching analysis recipe found");
              updateProgress(taskId, { skill: skill.matched ? "matched" : "not_found", skill_summary: skillSummary }, `${taskId} · Recipe ${skill.matched ? "ready" : "not found"}`);
              await researchTaskScheduler.publishEvent({
                cwd: ctx.cwd, parentRunId: params.run_id, taskId, type: "skill_resolved",
                payload: { skill_summary: skillSummary, skill_source: skill.source, skill_paths: skill.skill_paths || [] },
              });
              return { skill, skillSummary };
            });
          const researchPromise = researchSkillWorkflow.deepResearch({
              cwd: ctx.cwd, workflowRoot: PROJECT_ROOT, runId: task.run_id,
              params: {}, flags: workflow,
              agentConfig: pickAgentConfig(config, "seekbrain_deep_research"),
              rolePrompt: deepResearchPrompt,
              finalizeSchema: Type.Object({
                deep_research_context: Type.String(), summary: Type.String(), warnings: Type.Array(Type.String()),
              }),
              signal,
            }).then(async (research) => {
              const researchSummary = String(research.result?.summary || research.rag_error || `${Number(research.source_count || 0)} sources`);
              updateProgress(taskId, { deep_research: "complete", deep_research_summary: researchSummary, source_count: Number(research.source_count || 0) }, `${taskId} · Deep Research complete`);
              await researchTaskScheduler.publishEvent({
                cwd: ctx.cwd, parentRunId: params.run_id, taskId, type: "deep_research_completed",
                payload: { deep_research_summary: researchSummary, source_count: Number(research.source_count || 0), rag_ok: research.rag_ok },
              });
              return { research, researchSummary };
            });
          const [{ skill, skillSummary }, { research, researchSummary }] = await Promise.all([skillPromise, researchPromise]);
          updateProgress(taskId, { plan: "running" }, `${taskId} · generating methodological schema`);
          await researchTaskScheduler.publishEvent({ cwd: ctx.cwd, parentRunId: params.run_id, taskId, type: "plan_started" });
          const plan = await planWorkflow.execute({
            cwd: ctx.cwd,
            runId: task.run_id,
            targetedSkill: skill.targeted_skill_preview || skill.targeted_skill,
            deepResearchContext: research.deep_research_context,
            rolePrompt: planPrompt,
            agentConfig: pickAgentConfig(config, "seekbrain_plan"),
            finalizeSchema: Type.Object({
              plan_markdown: Type.String(), review_summary: Type.String(), summary: Type.String(),
              confidence: Type.Number(), warnings: Type.Array(Type.String()),
            }),
            humanReviewRequired: false,
            signal,
          });
          if (!plan.ok) throw new Error(String(plan.error || "Methodological schema generation failed."));
          const planSummary = String(plan.result?.review_summary || plan.result?.summary || "");
          if (initiallyAutoApprove) {
            await approveChildPlan(task, planGateEnabled
              ? "approved by the current Research Planning approve-remaining policy"
              : "Methodological schema review gate is disabled");
          }
          await researchTaskScheduler.publishEvent({
            cwd: ctx.cwd, parentRunId: params.run_id, taskId, type: "plan_ready",
            payload: { plan_path: plan.plan_path, plan_summary: planSummary, skill_summary: skillSummary, deep_research_summary: researchSummary },
          });
          updateProgress(taskId, { plan: "ready", plan_summary: planSummary, review: initiallyAutoApprove ? "approved" : "queued" }, `${taskId} · Methodological schema ready`);
          return { task_id: task.task_id, run_id: task.run_id, ok: true, plan_path: plan.plan_path, plan_summary: planSummary, skill_summary: skillSummary, deep_research_summary: researchSummary };
        } catch (error) {
          await researchTaskScheduler.publishEvent({
            cwd: ctx.cwd, parentRunId: params.run_id, taskId: task.task_id, type: "task_failed",
            payload: { failed_stage: "planning", error: String(error) },
          });
          updateProgress(taskId, { plan: "failed", error: String(error) }, `${taskId} · Analytical Formulation failed`);
          return { task_id: task.task_id, run_id: task.run_id, ok: false, error: String(error) };
        }
      };
      const reviewReadyPlans = async () => {
        if (!planGateEnabled) return;
        while (true) {
          const queue = await researchTaskScheduler.nextPlanReview(ctx.cwd, params.run_id);
          if (!queue.current) return;
          const selection = await selectTaskPlanReview(ctx as any, {
            title: taskPlanReviewTitle(queue.current, queue.queue_length),
            feedbackTitle: `Changes for ${queue.current.task_id}`,
            feedbackPlaceholder: "Describe the scientific or analytical changes required before execution",
          });
          if (["unavailable", "feedback_empty", "cancel"].includes(selection.decision)) return;
          const decision = selection.decision === "feedback" ? "revise" : selection.decision;
          const feedback = selection.decision === "feedback" ? selection.feedback : "";
          const scheduler = await researchTaskScheduler.status(ctx.cwd, params.run_id, true);
          const affected = decision === "approve_remaining"
            ? scheduler.tasks.filter((item: Json) => item.status === "awaiting_plan_review")
            : scheduler.tasks.filter((item: Json) => String(item.task_id) === String(queue.current.task_id));
          for (const affectedTask of affected) {
            const child = await resolveRun(ctx.cwd, affectedTask.run_id);
            if (decision === "revise") await reviewWorkflow.feedback(child, "plan", feedback, { source: "research_task_review_queue", action: "revise" });
            else await approveChildPlan(affectedTask, decision === "approve_remaining" ? "approved with all remaining methodological schemas" : "approved via Research Planning analysis-task queue");
            updateProgress(String(affectedTask.task_id), { review: decision === "revise" ? "revision_required" : "approved" });
          }
          await researchTaskScheduler.recordPlanReview({
            cwd: ctx.cwd, runId: params.run_id, taskId: String(queue.current.task_id),
            decision: decision as "approve" | "revise" | "approve_remaining", feedback,
          });
          emitProgress(`${queue.current.task_id} · Methodological schema ${decision === "revise" ? "revision requested" : "approved"}`);
          if (decision !== "revise") await startApprovedTasks();
        }
      };
      const approveReadyPlansWithoutGate = async () => {
        if (planGateEnabled) return;
        while (true) {
          const queue = await researchTaskScheduler.nextPlanReview(ctx.cwd, params.run_id);
          if (!queue.current) return;
          const scheduler = await researchTaskScheduler.status(ctx.cwd, params.run_id, true);
          const task = scheduler.tasks.find((item: Json) => String(item.task_id) === String(queue.current.task_id));
          if (task) await approveChildPlan(task, "Methodological schema review gate is disabled");
          await researchTaskScheduler.recordPlanReview({
            cwd: ctx.cwd, runId: params.run_id, taskId: String(queue.current.task_id), decision: "approve",
          });
          updateProgress(String(queue.current.task_id), { review: "approved" }, `${queue.current.task_id} · Methodological schema approved`);
        }
      };
      const results: Json[] = [];
      let workerSequence = 0;
      const remaining = new Map<number, Promise<{ index: number; result: Json }>>();
      const enqueuePlanningTasks = (tasks: Json[]) => {
        for (const task of tasks) {
          const index = workerSequence++;
          remaining.set(index, prepareTask(task).then((result) => ({ index, result })));
        }
      };
      const claimAndEnqueuePlanningTasks = async () => {
        const next = await researchTaskScheduler.claimPlanningTasks(ctx.cwd, params.run_id);
        const nextIds = new Set((next.claimed_task_ids || []).map(String));
        enqueuePlanningTasks((next.tasks || []).filter((task: Json) => nextIds.has(String(task.task_id))));
      };
      enqueuePlanningTasks(initiallyClaimedTasks);
      emitProgress("Preparing analysis recipes, Deep Research, and methodological schemas in parallel");
      while (remaining.size) {
        const settled: { index: number; result: Json } = await Promise.race(remaining.values());
        remaining.delete(settled.index);
        results.push(settled.result);
        const scheduler = await researchTaskScheduler.status(ctx.cwd, params.run_id, true);
        // A ready Plan frees one planning slot. Fill it immediately so queued
        // tasks are visible from the start but do not begin Recipe/Formulation work
        // until the configured planning concurrency allows it.
        await claimAndEnqueuePlanningTasks();
        for (const scheduled of scheduler.tasks.filter((item: Json) => item.status === "approved" && item.plan_path)) {
          const sourceTask = allTasks.find((item: Json) => String(item.task_id) === String(scheduled.task_id));
          if (sourceTask) await approveChildPlan(sourceTask, "approved by the current Research Planning approve-remaining policy");
        }
        await approveReadyPlansWithoutGate();
        await reviewReadyPlans();
        await startApprovedTasks();
      }
      await researchTaskScheduler.status(ctx.cwd, params.run_id, true);
      await approveReadyPlansWithoutGate();
      await reviewReadyPlans();
      await startApprovedTasks();
      while (activeExecutions.size) {
        // Consume completion events as soon as any worker settles. Waiting for
        // the whole active batch here leaves already-completed tasks marked as
        // executing, keeps their UI at Interpret ●, and prevents an approved
        // task from taking the newly available execution slot.
        const settledTaskId = await Promise.race(
          [...activeExecutions.entries()].map(([taskId, running]) => running.then(() => taskId, () => taskId)),
        );
        activeExecutions.delete(settledTaskId);
        const scheduler = await researchTaskScheduler.status(ctx.cwd, params.run_id, true);
        syncCompletedExecutionProgress(scheduler);
        await startApprovedTasks();
      }
      const finalStatus = await researchTaskScheduler.status(ctx.cwd, params.run_id, true);
      const queue = await researchTaskScheduler.nextPlanReview(ctx.cwd, params.run_id);
      return content({
        ok: results.every((result) => result.ok) && executionResults.every((result) => result.ok),
        parent_run_id: params.run_id,
        planned_count: results.filter((result) => result.ok).length,
        failed_count: results.filter((result) => !result.ok).length,
        results,
        executed_count: executionResults.filter((result) => result.ok).length,
        execution_failed_count: executionResults.filter((result) => !result.ok).length,
        execution_results: executionResults,
        status: finalStatus.status,
        task_status_counts: finalStatus.task_status_counts,
        next_review: queue.current,
        review_queue_length: queue.queue_length,
      });
    },
    renderResult: renderSeekBrainResult("seekbrain_execution_run"),
  });

  pi.registerTool({
    name: "seekbrain_execution_schema_review",
    label: "Review Methodological Schema",
    description: "Present one serialized methodological-schema review for an analysis task. Supports approval, revision feedback, or approval of this and all remaining valid methodological schemas.",
    parameters: Type.Object({
      run_id: Type.String(),
      decision: Type.Optional(Type.Union([Type.Literal("approve"), Type.Literal("revise"), Type.Literal("approve_remaining")])),
      feedback: Type.Optional(Type.String()),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const queue = await researchTaskScheduler.nextPlanReview(ctx.cwd, params.run_id);
      if (!queue.current) return content({ ok: true, parent_run_id: params.run_id, queue_empty: true, message: "No methodological schema is waiting for review." });
      let decision = params.decision;
      let feedback = String(params.feedback || "").trim();
      if (!decision) {
        const task = queue.current.task || {};
        const selection = await selectTaskPlanReview(ctx as any, {
          title: taskPlanReviewTitle(queue.current, queue.queue_length),
          feedbackTitle: `Changes for ${queue.current.task_id}`,
          feedbackPlaceholder: "Describe the scientific or analytical changes required before execution",
        });
        if (selection.decision === "unavailable") return content({ ok: false, parent_run_id: params.run_id, needs_text_review: true, message: "Interactive methodological-schema review is unavailable." });
        if (selection.decision === "feedback_empty") return content({ ok: false, parent_run_id: params.run_id, message: "No methodological-schema revision feedback was entered." });
        if (selection.decision === "cancel") return content({ ok: false, parent_run_id: params.run_id, message: "Methodological-schema review was cancelled." });
        decision = selection.decision === "feedback" ? "revise" : selection.decision;
        feedback = selection.decision === "feedback" ? selection.feedback : feedback;
      }
      const scheduler = await researchTaskScheduler.status(ctx.cwd, params.run_id, true);
      const affected = decision === "approve_remaining"
        ? scheduler.tasks.filter((task: Json) => task.status === "awaiting_plan_review")
        : scheduler.tasks.filter((task: Json) => String(task.task_id) === String(queue.current.task_id));
      for (const task of affected) {
        const child = await resolveRun(ctx.cwd, task.run_id);
        if (decision === "revise") await reviewWorkflow.feedback(child, "plan", feedback, { source: "research_task_review_queue", action: "revise" });
        else await reviewWorkflow.approve(child, "plan", decision === "approve_remaining" ? "approved with all remaining methodological schemas" : "approved via Research Planning analysis-task queue", { source: "research_task_review_queue" });
      }
      return content(await researchTaskScheduler.recordPlanReview({
        cwd: ctx.cwd,
        runId: params.run_id,
        taskId: String(queue.current.task_id),
        decision: decision as "approve" | "revise" | "approve_remaining",
        feedback,
      }));
    },
    renderResult: renderSeekBrainResult("seekbrain_execution_schema_review"),
  });

  pi.registerTool({
    name: "seekbrain_report_evidence_compile",
    label: "Compile Report Evidence",
    description: "Compile an immutable report input bundle from exactly the completed rounds or Research Planning analysis-task rounds explicitly selected by the user. Does not call the Report Agent.",
    parameters: Type.Object({
      project_path: Type.String(),
      selected_evidence: Type.Array(Type.String({ description: "ROUND:<n> or <task-id>:R<n>, for example ROUND:3 or SQ1-T1:R2." }), { minItems: 1 }),
      report_goal: Type.Optional(Type.String()),
    }),
    async execute(_toolCallId, params) {
      return content(await reportEvidenceCompiler.compile({
        projectPath: params.project_path,
        selectedEvidence: params.selected_evidence,
        reportGoal: params.report_goal,
      }));
    },
    renderResult: renderSeekBrainResult("seekbrain_report_evidence_compile"),
  });

  pi.registerTool({
    name: "seekbrain_execution_tasks_run",
    label: "Execute Analysis Tasks",
    description: "Low-level manual execution of one approved-task batch. Do not use this to start or resume the complete Research Planning pipeline; use seekbrain_execution_run, which restores and continues every task in one live view.",
    parameters: Type.Object({ run_id: Type.String() }),
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      await researchTaskScheduler.recoverInterruptedTasks(ctx.cwd, params.run_id);
      const initial = await researchTaskScheduler.status(ctx.cwd, params.run_id, true);
      const progress = new Map((initial.tasks || []).map((task: Json) => [String(task.task_id), {
        task_id: String(task.task_id), code: task.status === "complete" ? "complete" : "waiting",
        validate: task.status === "complete" ? "complete" : "waiting",
        refine: task.status === "complete" ? "skipped" : "waiting",
        interpret: task.status === "complete" ? "complete" : "waiting",
      }]));
      const emitProgress = (message?: string) => onUpdate?.(content({
        ok: true, progress: true, parent_run_id: params.run_id, message, task_progress: [...progress.values()],
      }));
      const result = await researchTaskExecution.execute({
        cwd: ctx.cwd,
        runId: params.run_id,
        signal,
        onProgress: (event) => {
          const current = progress.get(event.task_id) || { task_id: event.task_id, code: "waiting", validate: "waiting", refine: "waiting", interpret: "waiting" };
          const patch: Json = {};
          if (event.type === "execution_started" || event.type === "code_started") {
            patch.code = "running";
            patch.code_attempt = event.payload.code_attempt;
            patch.retry_reason = event.payload.retry_reason;
          } else if (event.type === "code_completed") {
            patch.code = "complete";
            patch.code_summary = event.payload.code_summary;
          } else if (event.type === "validation_started") patch.validate = "running";
          else if (event.type === "validation_completed") {
            patch.validate = event.payload.route === "retry_code" ? "revision_required" : "complete";
            patch.validation_summary = event.payload.summary;
          } else if (event.type === "refinement_started") patch.refine = "running";
          else if (event.type === "refinement_completed") patch.refine = event.payload.skipped ? "skipped" : event.payload.ok === false ? "failed" : "complete";
          else if (event.type === "interpretation_started") patch.interpret = "running";
          else if (event.type === "task_completed") patch.interpret = "complete";
          else if (event.type === "task_blocked") patch.blocked = true;
          else if (event.type === "task_failed") patch.failed = true;
          progress.set(event.task_id, { ...current, ...patch });
          emitProgress(`${event.task_id} · ${event.type.replaceAll("_", " ")}`);
        },
      });
      return content({ ...result, task_progress: [...progress.values()] });
    },
    renderResult: renderSeekBrainResult("seekbrain_execution_tasks_run"),
  });

  pi.registerTool({
    name: "seekbrain_report_generate",
    label: "Generate Report",
    description: "On explicit user request, compile exactly the selected completed rounds/task rounds and call the Report Agent once. Unselected evidence is not loaded into the Report Agent context.",
    parameters: Type.Object({
      project_path: Type.String(),
      selected_evidence: Type.Array(Type.String({ description: "ROUND:<n> or <task-id>:R<n>." }), { minItems: 1 }),
      report_goal: Type.Optional(Type.String()),
    }),
    async execute(_toolCallId, params, signal, onUpdate) {
      return content(await generateScientificReport({
        projectPath: params.project_path,
        selectedEvidence: params.selected_evidence,
        reportGoal: params.report_goal,
        signal,
        onProgress: (progress) => onUpdate?.(content({ progress: true, ...progress })),
      }));
    },
    renderResult: renderSeekBrainResult("seekbrain_report_generate"),
  });

  pi.registerTool({
    name: "seekbrain_analysis_task_control",
    label: "Control Analysis Task",
    description: "Apply an explicit user decision to one failed, blocked, or unwanted Research Planning analysis task without affecting unrelated tasks.",
    parameters: Type.Object({
      run_id: Type.String(),
      task_id: Type.String(),
      action: Type.Union([Type.Literal("retry_execution"), Type.Literal("restart_planning"), Type.Literal("cancel")]),
      reason: Type.Optional(Type.String()),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      return content(await researchTaskScheduler.controlTask({
        cwd: ctx.cwd, runId: params.run_id, taskId: params.task_id, action: params.action, reason: params.reason,
      }));
    },
    renderResult: renderSeekBrainResult("seekbrain_analysis_task_control"),
  });

  pi.registerTool({
    name: "seekbrain_research_continue",
    label: "Continue Research",
    description: "Create the next independent round in an existing multi-round SeekBrain project. Accepts a project directory or any round directory, works across sessions/days, inherits locked metadata, and exposes prior conclusions/data/code as read-only reusable context.",
    parameters: Type.Object({
      source_path: Type.String({ description: "Existing project directory or a roundN directory supplied by the user." }),
      direction: Type.String({ description: "Accepted suggested direction or the user's own next research question." }),
      deliverables: Type.Optional(Type.Array(Type.Object({
        path: Type.String(),
        kind: Type.Union([Type.Literal("figure"), Type.Literal("statistics"), Type.Literal("data"), Type.Literal("code"), Type.Literal("other")]),
        role: Type.Optional(Type.String()),
        description: Type.Optional(Type.String()),
        optional: Type.Optional(Type.Boolean()),
        produced_by: Type.Optional(Type.String()),
      }))),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const config = await loadConfigCached(ctx.cwd);
      const created = await runLifecycle.continueResearch(ctx.cwd, params.source_path, params.direction, params.deliverables);
      activeRunDir = created.run.runDir;
      return content({
        ok: true,
        extension: "seekbrain",
        project_id: created.projectId,
        project_dir: created.projectDir,
        project_manifest_path: created.manifestPath,
        round_number: created.roundNumber,
        round_name: created.roundName,
        parent_round: created.sourceRound.round_number,
        parent_run_id: created.sourceRound.run_id,
        run_id: created.run.runId,
        run_dir: created.run.runDir,
        state_path: created.run.statePath,
        metadata_locked: true,
        inherited_context: created.run.state.inherited_context,
        deliverables: created.run.state.deliverables,
        question: created.run.state.question,
        workflow_config: workflowConfigResult(config as SeekBrainConfig),
        guidance: "Continue the normal SeekBrain stages using this new run_id. Reuse prior round artifacts only through inherited_context; write every new output inside the new round directory.",
      });
    },
    renderResult: renderSeekBrainResult("seekbrain_research_continue"),
  });

  pi.registerTool({
    name: "seekbrain_run_start",
    label: "Start Analysis Run",
    description: "Create a new SeekBrain run at the required work_dir. The main agent must choose fallback paths such as results/default/{timestamp}. Returns run_id for all subsequent tools. Optionally pass question to persist the task text in state.json. Optionally pass deliverables to declare expected output artifacts (path/kind/role); if omitted, a default set (generated_code.py, figure.png, figure.pdf, statistics.json) is injected. code and statistics infrastructure artifacts are always ensured.",
    parameters: Type.Object({
      work_dir: Type.String({ description: "Run directory. Prefer relative fallback paths such as results/default/{timestamp}; preserve explicit user-provided absolute paths." }),
      question: Type.Optional(Type.String({ description: "Research question or task text to persist in state.json." })),
      deliverables: Type.Optional(Type.Array(Type.Object({
        path: Type.String(),
        kind: Type.Union([Type.Literal("figure"), Type.Literal("statistics"), Type.Literal("data"), Type.Literal("code"), Type.Literal("other")]),
        role: Type.Optional(Type.String()),
        description: Type.Optional(Type.String()),
        optional: Type.Optional(Type.Boolean()),
        produced_by: Type.Optional(Type.String()),
      }))),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const config = await loadConfigCached(ctx.cwd);
      const run = await startRun(ctx.cwd, params.work_dir, params.deliverables, params.question);
      activeRunDir = run.runDir;
      return content({
        ok: true,
        extension: "seekbrain",
        run_id: run.runId,
        run_dir: run.runDir,
        deliverables: run.state.deliverables,
        question: run.state.question,
        workflow_config: workflowConfigResult(config as SeekBrainConfig),
      });
    },
    renderResult: renderSeekBrainResult("seekbrain_run_start"),
  });

  pi.registerTool({
    name: "seekbrain_run_resume",
    label: "Resume Analysis Run",
    description: "Resume an existing SeekBrain run without creating a new run. Reads run_id from work_dir/state.json. Optionally pass question to replace the persisted task text; the previous question is appended to question_history. After resuming, read state.json for full run status. Use for recovery/continuation or interactive follow-up on an existing work_dir.",
    parameters: Type.Object({
      work_dir: Type.String({ description: "Existing run directory to resume. Preserve explicit absolute paths." }),
      question: Type.Optional(Type.String({ description: "Updated research question or follow-up instruction to persist in state.json." })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const config = await loadConfigCached(ctx.cwd);
      const run = await resumeRun(ctx.cwd, params.work_dir, params.question);
      activeRunDir = run.runDir;
      return content({
        ok: true,
        extension: "seekbrain",
        run_id: run.runId,
        run_dir: run.runDir,
        question: run.state.question,
        state_path: run.statePath,
        workflow_config: workflowConfigResult(config as SeekBrainConfig),
      });
    },
    renderResult: renderResumeRunResult,
  });

  pi.registerTool({
    name: "seekbrain_review_approve",
    label: "Approve Stage",
    description: "Record researcher approval for a SeekBrain workflow stage gate. Use only after the user explicitly approves the stage output.",
    parameters: Type.Object({
      run_id: Type.String(),
      stage: Type.String({ description: "Stage name to approve, e.g. plan." }),
      notes: Type.Optional(Type.String({ description: "Optional short researcher approval note." })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      return content(await reviewWorkflow.approveStage(ctx.cwd, params.run_id, params.stage, params.notes));
    },
    renderResult: renderSeekBrainResult("seekbrain_review_approve"),
  });

  pi.registerTool({
    name: "seekbrain_review_feedback",
    label: "Record Researcher Feedback",
    description: "Record researcher revision feedback for a SeekBrain workflow stage gate. Use when the user rejects or modifies a stage output.",
    parameters: Type.Object({
      run_id: Type.String(),
      stage: Type.String({ description: "Stage name receiving feedback, e.g. plan." }),
      feedback: Type.String({ description: "Researcher feedback or requested changes." }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      return content(await reviewWorkflow.recordStageFeedback(ctx.cwd, params.run_id, params.stage, params.feedback));
    },
    renderResult: renderSeekBrainResult("seekbrain_review_feedback"),
  });

  pi.registerTool({
    name: "seekbrain_formulation_researcher_review",
    label: "Review Methodological Schema",
    description: "Show the native two-option methodological-schema review selector after the main agent has summarized the current schema in chat.",
    parameters: Type.Object({
      run_id: Type.String(),
      summary: Type.Optional(Type.String({ description: "Short main-agent summary already shown to the user. Used only as compact selector context." })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const run = await resolveRun(ctx.cwd, params.run_id);
      const planPath = join(run.runDir, "plan.md");
      try {
        const title = [
          "Review the methodological schema?",
          `Schema: ${planPath}`,
          params.summary ? `Summary: ${String(params.summary).slice(0, 360)}` : "",
        ].filter(Boolean).join("\n");
        const selection = await selectBinaryReview(ctx as any, {
          title,
          approveLabel: "Yes, code",
          feedbackTitle: "Feedback for methodological schema",
          feedbackPlaceholder: "Describe what should change before code generation",
        });
        if (selection.decision === "unavailable") {
          return content({ ok: false, run_id: run.runId, plan_path: planPath, needs_text_review: true, message: "Interactive selector is unavailable. Ask the user to approve, reject, or provide feedback in chat." });
        }
        if (selection.decision === "approve") {
          const review = await reviewWorkflow.approve(run, "plan", "approved via plan review selector", { source: "plan_selector" });
          return content({
            ok: true,
            run_id: run.runId,
            plan_path: planPath,
            decision: "approve",
            review,
            guidance: "Proceed to seekbrain_code_execute.",
          });
        }
        if (selection.decision === "feedback_empty") {
            return content({
              ok: false,
              run_id: run.runId,
              plan_path: planPath,
              decision: "cancel",
              message: "No feedback was entered. Summarize the methodological schema again or call seekbrain_formulation_researcher_review again.",
            });
        }
        if (selection.decision === "feedback") {
          const review = await reviewWorkflow.feedback(run, "plan", selection.feedback, { source: "plan_selector", action: "revise" });
          return content({
            ok: true,
            run_id: run.runId,
            plan_path: planPath,
            decision: "feedback",
            feedback: selection.feedback,
            review,
            guidance: "Revise plan_markdown yourself for local changes, call seekbrain_formulation_update with the complete updated methodological schema, then summarize the revised schema and call seekbrain_formulation_researcher_review again. Rerun seekbrain_formulation_generate only for broad redesigns.",
          });
        }
        return content({
          ok: false,
          run_id: run.runId,
          plan_path: planPath,
          decision: "cancel",
          message: "Methodological-schema review was cancelled. Call seekbrain_formulation_researcher_review again when ready.",
        });
      } catch (error) {
        return content({
          ok: false,
          run_id: run.runId,
          plan_path: planPath,
          error: String(error),
          message: "Methodological-schema review selector failed. Ask the user to approve, reject, or provide feedback in chat.",
        });
      }
    },
    renderResult: renderSeekBrainResult("seekbrain_formulation_researcher_review"),
  });

  pi.registerTool({
    name: "seekbrain_formulation_update",
    label: "Update Methodological Schema",
    description: "Persist a researcher-feedback revision to the current methodological schema without rerunning the Formulation Agent.",
    parameters: Type.Object({
      run_id: Type.String(),
      plan_markdown: Type.String({ description: "Complete updated Markdown methodological schema to write to plan.md and state.json." }),
      summary: Type.Optional(Type.String({ description: "Short summary of what changed or what the updated schema does." })),
      confidence: Type.Optional(Type.Number({ description: "Optional updated confidence score. Defaults to the prior confidence if omitted." })),
      warnings: Type.Optional(Type.Array(Type.String({ description: "Optional updated warning list. Defaults to the prior warnings if omitted." }))),
      revision_note: Type.Optional(Type.String({ description: "Optional short note describing the user-requested edit." })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      return content(await reviewWorkflow.updatePlan({
        cwd: ctx.cwd,
        runId: params.run_id,
        planMarkdown: params.plan_markdown,
        summary: params.summary,
        confidence: params.confidence,
        warnings: params.warnings,
        revisionNote: params.revision_note,
      }));
    },
    renderResult: renderSeekBrainResult("seekbrain_formulation_update"),
  });

  pi.registerTool({
    name: "seekbrain_code_edit_review",
    label: "Review Code Edit",
    description: "Prepare exact localized code edits, show a diff for approval, then apply and optionally regenerate in one tool call.",
    renderShell: "self",
    parameters: Type.Object({
      run_id: Type.String(),
      code_path: Type.Optional(Type.String({ description: "Code artifact to edit. Defaults to the single known code artifact or generated_code.py." })),
      edits: Type.Array(Type.Object({
        find: Type.String({ description: "Exact source text to replace." }),
        replace: Type.String({ description: "Replacement source text." }),
        expected_matches: Type.Optional(Type.Integer({ minimum: 1, description: "Required exact match count. Defaults to 1." })),
      }), { minItems: 1, maxItems: 20 }),
      summary: Type.Optional(Type.String({ description: "Short user-facing explanation of the change." })),
      change_scope: Type.Optional(Type.Union([
        Type.Literal("presentation"),
        Type.Literal("scientific"),
      ], { description: "Presentation-only edits invalidate visual review only; scientific edits invalidate full validation." })),
      rerun: Type.Optional(Type.Boolean({ description: "After approval, rerun a Python code artifact and verify regenerated outputs. Defaults to true." })),
    }),
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      // Start the expensive renderer import immediately. Run/state resolution,
      // file reads, exact edit application, and proposal writes proceed in
      // parallel with this warm-up; we join only before opening the review UI.
      const diffWarmup = preloadDiffComponent()
        .then(() => ({ ok: true }))
        .catch((error) => ({ ok: false, error: String(error) }));
      const run = await resolveRun(ctx.cwd, params.run_id);
      const targetPath = resolveEditableCodePath(run, params.code_path);
      if (!targetPath) {
        return content({
          ok: false,
          run_id: run.runId,
          error: "No editable code artifact found. Pass code_path for a code file inside the run directory.",
          code_artifacts: codeArtifactsFromRun(run),
        });
      }

      const oldCode = await readFile(targetPath, "utf8").catch(() => "");
      let editResult: { updatedCode: string; appliedEdits: Json[] };
      try {
        editResult = applyExactCodeEdits(oldCode, params.edits);
      } catch (error) {
        return content({ ok: false, run_id: run.runId, code_path: targetPath, error: String(error) });
      }

      const scope = params.change_scope === "presentation" ? "presentation" : "scientific";
      const rerun = params.rerun !== false;
      const editId = `edit_${shortTimestamp()}_${randomUUID().slice(0, 8)}`;
      const pendingDir = join(run.runDir, "pending_code_edits", editId);
      const beforePath = join(pendingDir, `before_${basename(targetPath)}`);
      const proposedPath = join(pendingDir, basename(targetPath));
      const diffPath = join(pendingDir, "diff.patch");
      const summaryPath = join(pendingDir, "summary.md");
      const executionPath = join(pendingDir, "execution.json");
      const stdoutPath = join(pendingDir, "stdout.log");
      const stderrPath = join(pendingDir, "stderr.log");
      const summary = String(params.summary || "Localized code edit proposed by SeekBrain.").trim();
      const diffText = unifiedDiff(oldCode, editResult.updatedCode, targetPath, proposedPath);
      await Promise.all([
        writeText(beforePath, oldCode),
        writeText(proposedPath, editResult.updatedCode),
        writeText(diffPath, diffText),
        writeText(summaryPath, summary),
      ]);

      const pendingEntry = {
        edit_id: editId,
        status: "proposed",
        mode: "exact_replacements",
        code_path: targetPath,
        before_path: beforePath,
        proposed_path: proposedPath,
        diff_path: diffPath,
        summary_path: summaryPath,
        summary,
        change_scope: scope,
        rerun_requested: rerun,
        edits: editResult.appliedEdits,
        created_at: new Date().toISOString(),
      };
      await reviewWorkflow.proposeCodeEdit(run, pendingEntry, "seekbrain_code_edit_proposed");

      const diffRenderer = await diffWarmup;
      const reviewDetails = createCodeReviewDetails({
        codePath: targetPath,
        diffPath,
        summary,
        oldCode,
        proposedCode: editResult.updatedCode,
        extra: { diffRenderer },
      });
      onUpdate?.({
        content: [{ type: "text", text: `Review pending code edit for ${targetPath}. Full patch: ${diffPath}` }],
        details: reviewDetails,
      });

      const selection = await selectBinaryReview(ctx as any, {
        title: "Apply this code edit?",
        approveLabel: rerun ? "Yes, apply and regenerate" : "Yes, apply",
        feedbackTitle: "Feedback for code edit",
        feedbackPlaceholder: "Describe what should change before applying and regenerating",
      });
      if (selection.decision === "unavailable") {
        const result = {
          ok: false,
          run_id: run.runId,
          edit_id: editId,
          diff_path: diffPath,
          needs_text_review: true,
          message: "Interactive selector is unavailable. Ask the user to approve or provide feedback in chat.",
        };
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], details: { ...reviewDetails, ...result } };
      }

      if (selection.decision === "approve") {
        const trackedArtifacts = generatedArtifactsForCodeEdit(run, targetPath, scope);
        const trackedPaths = trackedArtifacts.map((artifact) => artifact.path);
        const beforeStamps = await artifactStamps(trackedPaths);
        const snapshot = await snapshotRunArtifacts(run, `before_code_edit_${editId}`);
        await writeText(targetPath, editResult.updatedCode);
        const appliedAt = new Date().toISOString();
        const appliedEntry = { ...pendingEntry, status: "applied", applied_at: appliedAt, snapshot };
        await reviewWorkflow.applyCodeEdit(run, editId, appliedEntry, validationInvalidationForScope(scope), "seekbrain_code_edit_apply");

        if (!rerun) {
          return content({
            ok: true,
            run_id: run.runId,
            edit_id: editId,
            decision: "approve",
            status: "applied",
            code_path: targetPath,
            diff_path: diffPath,
            approved_for_execution: true,
          });
        }

        onUpdate?.({
          content: [{ type: "text", text: `Approved. Regenerating artifacts with ${basename(targetPath)}...` }],
          details: reviewDetails,
        });
        const execution = await rerunApprovedPythonCode(targetPath, run.runDir, signal);
        await Promise.all([
          writeText(stdoutPath, String(execution.stdout || "")),
          writeText(stderrPath, String(execution.stderr || "")),
        ]);
        const afterStamps = await artifactStamps(trackedPaths);
        const artifactChecks = trackedPaths.map((path) => {
          const before = beforeStamps[path];
          const after = afterStamps[path];
          return {
            path,
            exists: Boolean(after?.exists),
            updated: Boolean(after?.exists && (!before?.exists || after.mtime_ms > before.mtime_ms)),
            before,
            after,
          };
        });
        const hasRequiredArtifacts = scope !== "presentation" || trackedPaths.length > 0;
        const verified = execution.ok === true
          && hasRequiredArtifacts
          && artifactChecks.every((check) => check.exists && check.updated);
        const status = execution.ok !== true ? "execution_failed" : verified ? "verified" : "verification_failed";
        const executionRecord = {
          command: [execution.command || process.env.SEEKBRAIN_PYTHON || "python3", targetPath],
          cwd: run.runDir,
          ok: execution.ok === true,
          exit_code: execution.exit_code ?? null,
          signal: execution.signal,
          error: execution.error,
          duration_ms: execution.duration_ms,
          stdout_path: stdoutPath,
          stderr_path: stderrPath,
          artifact_checks: artifactChecks,
          has_required_artifacts: hasRequiredArtifacts,
          verified,
          finished_at: new Date().toISOString(),
        };
        await writeJson(executionPath, executionRecord);
        const finalEntry = { ...appliedEntry, status, execution_path: executionPath, executed_at: executionRecord.finished_at };
        await reviewWorkflow.finalizeCodeEdit(run, editId, finalEntry, {
          event: "seekbrain_code_edit_execute",
          ok: verified,
          status,
          exit_code: executionRecord.exit_code,
          artifact_checks: artifactChecks,
        });
        return content({
          ok: verified,
          run_id: run.runId,
          edit_id: editId,
          decision: "approve",
          status,
          code_path: targetPath,
          diff_path: diffPath,
          execution: executionRecord,
          artifacts: trackedArtifacts,
          guidance: verified
            ? "The approved edit was applied and regenerated artifacts were verified. Summarize the result; do not run the script again."
            : "The edit remains applied, but regeneration or artifact verification failed. Inspect execution.json and logs before retrying.",
        });
      }

      if (selection.decision === "feedback_empty") {
          return content({ ok: false, run_id: run.runId, edit_id: editId, decision: "cancel", message: "No feedback was entered." });
      }
      if (selection.decision === "feedback") {
        await reviewWorkflow.requestCodeChanges(run, editId, selection.feedback, "code_edit_selector", "seekbrain_code_edit_feedback");
        return content({
          ok: true,
          run_id: run.runId,
          edit_id: editId,
          decision: "feedback",
          feedback: selection.feedback,
          guidance: "Prepare corrected exact replacements and call seekbrain_code_edit_review again.",
        });
      }

      return content({ ok: false, run_id: run.runId, edit_id: editId, decision: "cancel", message: "Code edit review was cancelled." });
    },
    renderCall: renderCodeEditCall,
    renderResult: renderCodeEditResult,
  });

  pi.registerTool({
    name: "seekbrain_code_update_propose",
    label: "Propose Code Update",
    description: "Create a pending code edit and diff for post-run user feedback. Does not modify the active code artifact.",
    parameters: Type.Object({
      run_id: Type.String(),
      code_path: Type.Optional(Type.String({ description: "Code artifact to update. Defaults to the single known code artifact or generated_code.py." })),
      updated_code: Type.String({ description: "Complete updated code content proposed by the main agent." }),
      summary: Type.Optional(Type.String({ description: "Short explanation of the intended code change." })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const run = await resolveRun(ctx.cwd, params.run_id);
      const targetPath = resolveEditableCodePath(run, params.code_path);
      if (!targetPath) {
        return content({
          ok: false,
          run_id: run.runId,
          error: "No editable code artifact found. Pass code_path for a code file inside the run directory.",
          code_artifacts: codeArtifactsFromRun(run),
        });
      }
      const updatedCode = String(params.updated_code || "");
      if (!updatedCode.trim()) {
        return content({ ok: false, run_id: run.runId, code_path: targetPath, error: "updated_code is required" });
      }
      const oldCode = await readFile(targetPath, "utf8").catch(() => "");
      const editId = `edit_${shortTimestamp()}_${randomUUID().slice(0, 8)}`;
      const pendingDir = join(run.runDir, "pending_code_edits", editId);
      const proposedPath = join(pendingDir, basename(targetPath));
      const diffPath = join(pendingDir, "diff.patch");
      const summaryPath = join(pendingDir, "summary.md");
      const diffText = unifiedDiff(oldCode, updatedCode, targetPath, proposedPath);
      const summary = String(params.summary || "Pending code update proposed by the main agent.").trim();
      await writeText(proposedPath, updatedCode);
      await writeText(diffPath, diffText);
      await writeText(summaryPath, summary);
      const pendingEntry = {
        edit_id: editId,
        status: "proposed",
        code_path: targetPath,
        proposed_path: proposedPath,
        diff_path: diffPath,
        summary_path: summaryPath,
        summary,
        created_at: new Date().toISOString(),
      };
      await reviewWorkflow.proposeCodeEdit(run, pendingEntry, "seekbrain_code_update_propose");
      return content({
        ok: true,
        run_id: run.runId,
        edit_id: editId,
        code_path: targetPath,
        proposed_path: proposedPath,
        diff_path: diffPath,
        summary_path: summaryPath,
        summary,
        guidance: "Show the user the summary, then call seekbrain_code_update_review. Do not apply or execute the proposed code before approval.",
      });
    },
    renderResult: renderSeekBrainResult("seekbrain_code_update_propose"),
  });

  pi.registerTool({
    name: "seekbrain_code_update_review",
    label: "Review Code Update",
    description: "Display a pending code diff and ask for approval before applying post-run code changes.",
    renderShell: "self",
    parameters: Type.Object({
      run_id: Type.String(),
      edit_id: Type.Optional(Type.String({ description: "Pending code edit id. Defaults to the latest proposed edit." })),
    }),
    async execute(_toolCallId, params, _signal, onUpdate, ctx) {
      const diffWarmup = preloadDiffComponent().catch(() => undefined);
      const run = await resolveRun(ctx.cwd, params.run_id);
      const entry = reviewWorkflow.findPending(run, params.edit_id);
      if (!entry) {
        return content({ ok: false, run_id: run.runId, error: "No pending code edit found." });
      }
      const oldCode = await readFile(entry.code_path, "utf8").catch(() => "");
      const proposedCode = await readFile(entry.proposed_path, "utf8").catch(() => "");
      const summaryText = await readFile(entry.summary_path, "utf8").catch(() => entry.summary || "");
      await diffWarmup;
      const reviewDetails = createCodeReviewDetails({
        codePath: entry.code_path,
        diffPath: entry.diff_path,
        summary: summaryText,
        oldCode,
        proposedCode,
      });
      onUpdate?.({
        content: [{
          type: "text",
          text: `Review pending code update for ${entry.code_path}. Full patch: ${entry.diff_path}`,
        }],
        details: reviewDetails,
      });
      const selection = await selectBinaryReview(ctx as any, {
        title: "Apply this code update?",
        approveLabel: "Yes, apply and run",
        feedbackTitle: "Feedback for code update",
        feedbackPlaceholder: "Describe what should change before applying and running",
      });
      if (selection.decision === "unavailable") {
        const result = {
          ok: false,
          run_id: run.runId,
          edit_id: entry.edit_id,
          diff_path: entry.diff_path,
          needs_text_review: true,
          message: "Interactive selector is unavailable. Ask the user to approve or provide feedback in chat.",
        };
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          details: { ...reviewDetails, ...result },
        };
      }
      if (selection.decision === "approve") {
        const updatedCode = await readFile(entry.proposed_path, "utf8");
        await writeText(entry.code_path, updatedCode);
        const appliedEntry = {
          ...entry,
          status: "applied",
          applied_at: new Date().toISOString(),
        };
        await reviewWorkflow.applyCodeEdit(run, entry.edit_id, appliedEntry, { validation_invalidated_by_code_edit: true }, "seekbrain_code_update_apply");
        return content({
          ok: true,
          run_id: run.runId,
          edit_id: entry.edit_id,
          decision: "approve",
          code_path: entry.code_path,
          diff_path: entry.diff_path,
          approved_for_execution: true,
          guidance: "The code update has been applied. Run the updated script in the run directory, then rerun validation/conclusion as needed.",
        });
      }
      if (selection.decision === "feedback_empty") {
          return content({
            ok: false,
            run_id: run.runId,
            edit_id: entry.edit_id,
            decision: "cancel",
            message: "No feedback was entered. Revise the proposal or call seekbrain_code_update_review again.",
          });
      }
      if (selection.decision === "feedback") {
        await reviewWorkflow.requestCodeChanges(run, entry.edit_id, selection.feedback, "code_update_selector", "seekbrain_code_update_feedback");
        return content({
          ok: true,
          run_id: run.runId,
          edit_id: entry.edit_id,
          decision: "feedback",
          feedback: selection.feedback,
          guidance: "Revise the proposed code, call seekbrain_code_update_propose again, then call seekbrain_code_update_review again. Do not apply or execute code until approved.",
        });
      }
      return content({
        ok: false,
        run_id: run.runId,
        edit_id: entry.edit_id,
        decision: "cancel",
        message: "Code update review was cancelled. Call seekbrain_code_update_review again when ready.",
      });
    },
    renderCall: renderCodeUpdateCall,
    renderResult: renderCodeUpdateResult,
  });

  pi.registerTool({
    name: "seekbrain_recipe_retrieve",
    label: "Retrieve Analysis Recipe",
    description: "Retrieve a validated trajectory recipe from the Neuroscience Analysis Repertoire, then fall back to literature-and-code Recipe Crystallization and reuse.",
    parameters: Type.Object({
      question: Type.Optional(Type.String({ description: "Research question or task. Falls back to state.json question." })),
      run_id: Type.String(),
      root_dir: Type.Optional(Type.String()),
      recipe_dir: Type.Optional(Type.String()),
      project_dir: Type.Optional(Type.String()),
      recipe_enabled: Type.Optional(Type.Boolean()),
      recipe_crystallization_enabled: Type.Optional(Type.Boolean()),
      model: Type.Optional(Type.String()),
      top_k: Type.Optional(Type.Number()),
      relevance_threshold: Type.Optional(Type.Number()),
      temperature: Type.Optional(Type.Number()),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const config = await loadConfigCached(ctx.cwd);
      const workflow = seekbrainWorkflowConfig(config);
      const recipeParams = {
        ...params,
        skill_dir: params.recipe_dir,
        skill_enable: params.recipe_enabled,
        generate_skill_enable: params.recipe_crystallization_enabled,
      };
      const resolved = await researchSkillWorkflow.resolveTargetedSkill({
        cwd: ctx.cwd,
        workflowRoot: PROJECT_ROOT,
        runId: params.run_id,
        question: params.question,
        params: recipeParams,
        config,
        flags: workflow,
        signal,
      });
      return content(publicRecipeResult(resolved));
    },
    renderResult: renderSeekBrainResult("seekbrain_recipe_retrieve"),
  });
  pi.registerTool({
    name: "seekbrain_deep_research",
    label: "Deep Research",
    description: "Query Paper RAG and synthesize bounded neuroscience background context for downstream agents.",
    parameters: Type.Object({
      question: Type.Optional(Type.String({ description: "Research question or task. Falls back to state.json question." })),
      run_id: Type.String(),
      top_k: Type.Optional(Type.Number()),
      rag_base_url: Type.Optional(Type.String()),
      rag_timeout: Type.Optional(Type.Number()),
      source_char_limit: Type.Optional(Type.Number()),
      additional_context: Type.Optional(Type.String()),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const config = await loadConfigCached(ctx.cwd);
      const agentConfig = literatureAgentConfig(config, "seekbrain_deep_research");
      const workflow = seekbrainWorkflowConfig(config);
      return content(await researchSkillWorkflow.deepResearch({
        cwd: ctx.cwd,
        workflowRoot: PROJECT_ROOT,
        runId: params.run_id,
        question: params.question,
        additionalContext: params.additional_context,
        params,
        flags: workflow,
        agentConfig,
        rolePrompt: await readPrompt("deep_research"),
        finalizeSchema: Type.Object({
          deep_research_context: Type.String(),
          summary: Type.String(),
          warnings: Type.Array(Type.String()),
        }),
        signal,
      }));
    },
    renderResult: renderSeekBrainResult("seekbrain_deep_research"),
  });

  pi.registerTool({
    name: "seekbrain_formulation_generate",
    label: "Generate Methodological Schema",
    description: "Run the isolated Formulation Agent and persist the methodological schema to plan.md.",
    parameters: Type.Object({
      question: Type.Optional(Type.String({ description: "Research question or task. Falls back to state.json question." })),
      run_id: Type.String(),
      data_info: Type.Optional(Type.String()),
      extra_path_info: Type.Optional(Type.String()),
      analysis_recipe: Type.Optional(Type.String()),
      deep_research_context: Type.Optional(Type.String()),
      additional_context: Type.Optional(Type.String()),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const config = await loadConfigCached(ctx.cwd);
      return content(await planWorkflow.execute({
        cwd: ctx.cwd,
        runId: params.run_id,
        question: params.question,
        dataInfo: params.data_info,
        extraPathInfo: params.extra_path_info,
        targetedSkill: params.analysis_recipe,
        deepResearchContext: params.deep_research_context,
        additionalContext: params.additional_context,
        rolePrompt: await readPrompt("plan"),
        agentConfig: pickAgentConfig(config, "seekbrain_plan"),
        finalizeSchema: Type.Object({
          plan_markdown: Type.String(),
          review_summary: Type.String(),
          summary: Type.String(),
          confidence: Type.Number(),
          warnings: Type.Array(Type.String()),
        }),
        humanReviewRequired: humanGateEnabled(config, "plan"),
        signal,
      }));
    },
    renderResult: renderSeekBrainResult("seekbrain_formulation_generate"),
  });

  pi.registerTool({
    name: "seekbrain_code_execute",
    label: "Run Code Agent",
    description: "Run the isolated Code Agent, persist generated artifacts, and apply deterministic checks.",
    parameters: Type.Object({
      question: Type.Optional(Type.String({ description: "Research question or task. Falls back to state.json question." })),
      run_id: Type.String(),
      methodological_schema: Type.Optional(Type.String()),
      data_info: Type.Optional(Type.String()),
      extra_path_info: Type.Optional(Type.String()),
      analysis_recipe: Type.Optional(Type.String()),
      validation_feedback: Type.Optional(Type.String()),
      additional_context: Type.Optional(Type.String()),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const config = await loadConfigCached(ctx.cwd);
      return content(await codeWorkflow.execute({
        cwd: ctx.cwd,
        runId: params.run_id,
        question: params.question,
        plan: params.methodological_schema,
        dataInfo: params.data_info,
        extraPathInfo: params.extra_path_info,
        targetedSkill: params.analysis_recipe,
        validationFeedback: params.validation_feedback,
        additionalContext: params.additional_context,
        rolePrompt: await readPrompt("code"),
        agentConfig: pickAgentConfig(config, "seekbrain_code"),
        finalizeSchema: Type.Object({
          code_files: Type.Array(Type.Object({
            path: Type.String(),
          }), { minItems: 1 }),
          exec_log: Type.String(),
          statistics: Type.Any(),
          artifacts: Type.Array(Type.Object({
            name: Type.Optional(Type.String()),
            path: Type.String(),
            kind: Type.Union([Type.Literal("figure"), Type.Literal("statistics"), Type.Literal("data"), Type.Literal("code"), Type.Literal("markdown"), Type.Literal("json"), Type.Literal("log"), Type.Literal("other")]),
            role: Type.Optional(Type.String()),
            description: Type.Optional(Type.String()),
            produced_by: Type.Optional(Type.String()),
          })),
          summary: Type.String(),
          warnings: Type.Array(Type.String()),
        }),
        planReviewRequired: humanGateEnabled(config, "plan"),
        maxAttempts: DEFAULT_MAX_CODE_ATTEMPTS,
        signal,
      }));
    },
    renderResult: renderSeekBrainResult("seekbrain_code_execute"),
  });

  pi.registerTool({
    name: "seekbrain_validation_run",
    label: "Run Validation Agent",
    description: "Run the isolated Validation Agent over actual scientific figure artifacts and store validation.json. Pass figure_path to validate only one figure.",
    parameters: Type.Object({
      question: Type.Optional(Type.String({ description: "Research question or task. Falls back to state.json question." })),
      run_id: Type.String(),
      figure_path: Type.Optional(Type.String()),
      statistics: Type.Optional(Type.Any()),
      additional_context: Type.Optional(Type.String()),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const config = await loadConfigCached(ctx.cwd);
      return content(await validateWorkflow.execute({
        cwd: ctx.cwd,
        runId: params.run_id,
        question: params.question,
        figurePath: params.figure_path,
        statistics: params.statistics,
        additionalContext: params.additional_context,
        rolePrompt: await readPrompt("validate"),
        agentConfig: pickAgentConfig(config, "seekbrain_validate"),
        finalizeSchema: Type.Object({
          pass: Type.Boolean(),
          per_figure: Type.Array(Type.Object({
            path: Type.String(),
            pass: Type.Boolean(),
            issues: Type.Array(Type.String()),
          })),
          overall_mismatches: Type.Array(Type.String()),
          blocking_issues: Type.Array(Type.String()),
          methodological_caveats: Type.Array(Type.String()),
          visual_issues: Type.Array(Type.Object({
            figure_path: Type.String(),
            feedback: Type.String(),
          }), { maxItems: 1 }),
          confidence: Type.Number(),
          summary: Type.String(),
        }),
        maxCodeAttempts: DEFAULT_MAX_CODE_ATTEMPTS,
        signal,
      }));
    },
    renderResult: renderSeekBrainResult("seekbrain_validation_run"),
  });

  pi.registerTool({
    name: "seekbrain_figure_refine",
    label: "Refine Figure",
    description: "Run the isolated Figure Refinement stage; the outer loop stays in this extension/tool boundary.",
    parameters: Type.Object({
      question: Type.Optional(Type.String({ description: "Research question or task. Falls back to state.json question." })),
      run_id: Type.String(),
      figure_path: Type.Optional(Type.String()),
      feedback: Type.Optional(Type.String()),
      additional_context: Type.Optional(Type.String()),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const config = await loadConfigCached(ctx.cwd);
      const workflow = seekbrainWorkflowConfig(config);
      return content(await imageWorkflow.refine({
        cwd: ctx.cwd,
        runId: params.run_id,
        question: params.question,
        figurePath: params.figure_path,
        feedback: params.feedback,
        additionalContext: params.additional_context,
        rolePrompt: await readPrompt("image_refine"),
        agentConfig: pickAgentConfig(config, "seekbrain_refine_image"),
        finalizeSchema: Type.Object({
          refined_code_patch: Type.String(),
          refined_figure_path: Type.Optional(Type.String()),
          summary: Type.String(),
          remaining_issues: Type.Array(Type.String()),
          stop: Type.Boolean(),
        }),
        enabled: workflow.image_refine,
        signal,
      }));
    },
    renderResult: renderSeekBrainResult("seekbrain_figure_refine"),
  });

  pi.registerTool({
    name: "seekbrain_interpretation_run",
    label: "Run Interpretation Agent",
    description: "Analyze the single canonical validated figure and synthesize final scientific conclusions in one isolated Interpretation Agent call.",
    parameters: Type.Object({
      run_id: Type.String(),
      additional_context: Type.Optional(Type.String()),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const config = await loadConfigCached(ctx.cwd);
      return content(await interpretWorkflow.execute({
        cwd: ctx.cwd,
        runId: params.run_id,
        additionalContext: params.additional_context,
        rolePrompt: await readPrompt("interpret"),
        agentConfig: pickAgentConfig(config, "seekbrain_interpret"),
        finalizeSchema: Type.Object({
          image_analysis: Type.Object({
            figure_type: Type.String(),
            observations: Type.Array(Type.String()),
            quantitative_evidence: Type.Array(Type.String()),
            biological_interpretation: Type.Array(Type.String()),
            alternative_explanations: Type.Array(Type.String()),
            limitations: Type.Array(Type.String()),
          }),
          conclusions: Type.Array(Type.String()),
          summary: Type.String(),
          limitations: Type.Array(Type.String()),
          confidence: Type.Number(),
          next_research_directions: Type.Array(Type.Object({
            title: Type.String(),
            research_question: Type.String(),
            rationale: Type.String(),
            reuses: Type.Array(Type.String()),
            expected_output: Type.String(),
          }), { minItems: 1, maxItems: 3 }),
        }),
        signal,
      }));
    },
    renderResult: renderSeekBrainResult("seekbrain_interpretation_run"),
  });
}

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { appendFile, copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { availableParallelism, cpus, freemem, platform as osPlatform, totalmem } from "node:os";
import { basename, dirname, extname, join, relative, resolve } from "node:path";

type Json = Record<string, any>;

const AGENT_CONFIG_SCRIPT = "internagent/workflow/agent_config.py";
const WORKFLOW_ROOT = process.env.NEURO_LEVEL1_ROOT || process.cwd();

const EXTENSION_DIR = dirname(new URL(import.meta.url).pathname);
const PROMPT_DIR = join(EXTENSION_DIR, "prompts");
const BAKED_CONFIG_FILE = join(EXTENSION_DIR, "config.json");
const RUN_INDEX_FILE = ".pi/neuroscientist-level1/run_index.json";
const CONFIG_FILE = "config.yaml";

let mergedConfig: Json = {};

function debugDiskWritesEnabled(): boolean {
  return mergedConfig.workflow?.debug_disk_writes === true;
}

async function syncWorkflowWritePolicy(cwd: string) {
  mergedConfig = await loadConfig(cwd);
}

function content(details: Json, text?: string) {
  return {
    content: [{ type: "text", text: text ?? JSON.stringify(limitForMain(details), null, 2) }],
    details,
  };
}

function limitForMain(details: Json) {
  const copy = { ...details };
  if (typeof copy.targeted_skill === "string" && copy.targeted_skill.length > 1200) {
    copy.targeted_skill_preview = copy.targeted_skill.slice(0, 1200);
    delete copy.targeted_skill;
  }
  if (typeof copy.subagent_transcript === "string") {
    delete copy.subagent_transcript;
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

async function writeJsonl(path: string, entries: Json[]) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, entries.map(entry => JSON.stringify(entry)).join("\n") + (entries.length ? "\n" : ""), "utf8");
}

async function appendReadableLog(runDir: string | undefined, entry: Json) {
  if (!debugDiskWritesEnabled() || !runDir) return;
  try {
    await appendFile(join(runDir, "events.jsonl"), JSON.stringify(entry) + "\n", "utf8");
  } catch {
    // Human-readable logs are best-effort.
  }
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
  if (!debugDiskWritesEnabled()) return;
  const path = join(runDir, "usage", `${component}.json`);
  const existing = await readJson(path, { entries: [] });
  const entries = Array.isArray(existing.entries) ? existing.entries : [];
  await writeJson(path, { entries: [...entries, entry] });
}

async function writeUsageSummary(runDir: string) {
  if (!debugDiskWritesEnabled()) return;
  const usageDir = join(runDir, "usage");
  await mkdir(usageDir, { recursive: true });
  let files: string[] = [];
  try {
    files = await readdir(usageDir);
  } catch {
    files = [];
  }
  const components: Json[] = [];
  for (const file of files.sort()) {
    if (!file.endsWith(".json") || file === "summary.json") continue;
    const path = join(usageDir, file);
    const payload = await readJson(path, { entries: [] });
    const entries = Array.isArray(payload.entries) ? payload.entries : [];
    const tokens = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 };
    let cost = 0;
    for (const entry of entries) {
      const t = entry?.tokens || {};
      tokens.input += numberValue(t.input);
      tokens.output += numberValue(t.output);
      tokens.cacheRead += numberValue(t.cacheRead);
      tokens.cacheWrite += numberValue(t.cacheWrite);
      tokens.total += numberValue(t.total) || numberValue(t.input) + numberValue(t.output) + numberValue(t.cacheRead) + numberValue(t.cacheWrite);
      cost += numberValue(entry?.cost);
    }
    const cacheTokens = tokens.cacheRead + tokens.cacheWrite;
    components.push({
      component: file.replace(/\.json$/, ""),
      path,
      entries: entries.length,
      tokens,
      cache_tokens: cacheTokens,
      cache_rate: tokens.total > 0 ? cacheTokens / tokens.total : 0,
      cost,
    });
  }
  const totalTokens = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 };
  let totalCost = 0;
  for (const component of components) {
    totalTokens.input += component.tokens.input;
    totalTokens.output += component.tokens.output;
    totalTokens.cacheRead += component.tokens.cacheRead;
    totalTokens.cacheWrite += component.tokens.cacheWrite;
    totalTokens.total += component.tokens.total;
    totalCost += component.cost;
  }
  const cacheTokens = totalTokens.cacheRead + totalTokens.cacheWrite;
  await writeJson(join(usageDir, "summary.json"), {
    work_dir: runDir,
    usage_dir: usageDir,
    updated_at: new Date().toISOString(),
    component_count: components.length,
    entry_count: components.reduce((sum, component) => sum + numberValue(component.entries), 0),
    tokens: totalTokens,
    cache_tokens: cacheTokens,
    cache_rate: totalTokens.total > 0 ? cacheTokens / totalTokens.total : 0,
    cost: totalCost,
    components,
  });
}

async function tryAppendUsageEntry(runDir: string | undefined, component: string, entry: Json) {
  if (!runDir) return;
  try {
    await appendUsageEntry(runDir, component, entry);
    await writeUsageSummary(runDir);
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

function parseScalar(value: string): any {
  const raw = value.trim();
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1);
  }
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  return raw;
}

function stripYamlComment(line: string) {
  let quote = "";
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === "'" || char === '"') {
      if (quote === char) quote = "";
      else if (!quote) quote = char;
    }
    if (char === "#" && !quote) return line.slice(0, i);
  }
  return line;
}

function parseInlineYaml(value: string): any {
  const raw = value.trim();
  if (raw === "{}") return {};
  if (raw === "[]") return [];
  return parseScalar(raw);
}

function parseSimpleYaml(text: string) {
  const config: Json = {};
  const stack: Array<[number, any]> = [[-1, config]];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = stripYamlComment(rawLine).trimEnd();
    if (!line.trim()) continue;
    const indent = line.length - line.trimStart().length;
    const stripped = line.trim();
    while (indent <= stack[stack.length - 1][0]) stack.pop();
    const parent = stack[stack.length - 1][1];
    if (stripped.startsWith("- ")) {
      if (!Array.isArray(parent)) continue;
      const item: Json = {};
      parent.push(item);
      const rest = stripped.slice(2).trim();
      if (rest && rest.includes(":")) {
        const [key, ...valueParts] = rest.split(":");
        item[key.trim()] = parseInlineYaml(valueParts.join(":"));
      }
      stack.push([indent, item]);
      continue;
    }
    if (!stripped.includes(":") || Array.isArray(parent)) continue;
    const [key, ...valueParts] = stripped.split(":");
    const value = valueParts.join(":").trim();
    if (value) parent[key.trim()] = parseInlineYaml(value);
    else {
      const child: any = key.trim() === "models" ? [] : {};
      parent[key.trim()] = child;
      stack.push([indent, child]);
    }
  }
  return config;
}

async function loadMergedConfigFromPython(cwd: string): Promise<Json> {
  const workflowCwd = WORKFLOW_ROOT || cwd;
  const scriptPath = resolve(workflowCwd, AGENT_CONFIG_SCRIPT);
  const configPath = resolve(workflowCwd, CONFIG_FILE);
  return await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn("python3", [scriptPath, "merged", configPath], { cwd: workflowCwd });
    let stdout = "";
    child.stdout.on("data", (chunk) => { stdout += String(chunk); });
    child.on("error", (error) => rejectPromise(error));
    child.on("close", (code) => {
      if (code !== 0) {
        rejectPromise(new Error(`agent_config.py merged exited ${code}`));
        return;
      }
      resolvePromise(JSON.parse(stdout));
    });
  });
}

async function loadConfig(cwd: string) {
  try {
    return JSON.parse(await readFile(BAKED_CONFIG_FILE, "utf8"));
  } catch {
    return loadMergedConfigFromPython(cwd);
  }
}

function level1WorkflowConfig(config: Json) {
  const configured = config.workflow?.level1 || {};
  const boolValue = (key: string) => configured[key] !== false;
  const humanReview = configured.human_review || {};
  const humanReviewEnabled = humanReview.enabled === true && process.env.NEURO_LEVEL1_NON_INTERACTIVE !== "1";
  const humanReviewGates = humanReview.gates || {};
  return {
    deep_research: boolValue("deep_research"),
    targeted_skill_match: boolValue("targeted_skill_match"),
    targeted_skill_generate: boolValue("targeted_skill_generate"),
    image_refine: boolValue("image_refine"),
    image_analysis: boolValue("image_analysis"),
    resource_sensing: boolValue("resource_sensing"),
    save_skill: boolValue("save_skill"),
    human_review: {
      enabled: humanReviewEnabled,
      gates: {
        plan: humanReviewEnabled && humanReviewGates.plan === true,
        code: humanReviewEnabled && humanReviewGates.code === true,
        validate: humanReviewEnabled && humanReviewGates.validate === true,
        conclude: humanReviewEnabled && humanReviewGates.conclude === true,
      },
    },
  };
}

function skippedByConfig(runId: string | undefined, tool: string, key: string) {
  return content({
    ok: true,
    skipped: true,
    skipped_by_config: true,
    reason: "disabled_by_user_config",
    message: `${tool} is disabled by user configuration workflow.level1.${key}; this is not a tool failure.`,
    run_id: runId,
    config_key: `workflow.level1.${key}`,
  });
}

function normalizeReviewStage(stage: any) {
  return String(stage || "").trim().toLowerCase().replace(/[^a-z0-9_.-]+/g, "_");
}

function humanGateEnabled(config: Json, stage: string) {
  const workflow = level1WorkflowConfig(config);
  const gates = workflow.human_review.gates as Record<string, boolean>;
  return workflow.human_review.enabled && gates[stage] === true;
}

function humanReviewEntry(run: RunContext, stage: string): Json {
  const reviews = run.state.human_reviews || {};
  const entry = reviews[stage] || {};
  return entry && typeof entry === "object" ? entry : {};
}

function humanStageApproved(run: RunContext, stage: string) {
  return humanReviewEntry(run, stage).status === "approved";
}

function humanFeedbackText(run: RunContext, stage: string) {
  const feedback = humanReviewEntry(run, stage).feedback;
  if (!Array.isArray(feedback) || !feedback.length) return "";
  return feedback
    .map((entry: any, index: number) => {
      const text = typeof entry === "string" ? entry : String(entry?.text || "");
      return text.trim() ? `${index + 1}. ${text.trim()}` : "";
    })
    .filter(Boolean)
    .join("\n");
}

function blockedByHumanReview(run: RunContext, stage: string, nextTool: string) {
  const entry = humanReviewEntry(run, stage);
  return content({
    ok: false,
    blocked_by_human_review: true,
    required_stage: stage,
    next_tool: nextTool,
    run_id: run.runId,
    status: entry.status || "pending_review",
    message: `${nextTool} is blocked until human review approves '${stage}'. Ask the user to review the latest ${stage} output, then call neuro_approve_stage or neuro_record_feedback.`,
  });
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

async function loadEnv(cwd: string) {
  const env = { ...process.env };
  const candidates = [
    resolve(cwd, ".env"),
    resolve(WORKFLOW_ROOT, ".env"),
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
  if (suffix === ".jpg" || suffix === ".jpeg") return "image/jpeg";
  if (suffix === ".webp") return "image/webp";
  return "image/png";
}

const VISION_IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

function isVisionImage(path: string) {
  return VISION_IMAGE_EXTS.has(extname(path).toLowerCase());
}

function resolveArtifactPath(runDir: string, artifactPath: string) {
  return resolve(runDir, artifactPath);
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

function normalizeDeliverables(input: any[]): Artifact[] {
  const out: Artifact[] = [];
  for (const raw of input || []) {
    if (!raw || typeof raw !== "object" || !raw.path || !raw.kind) continue;
    out.push({
      path: String(raw.path),
      kind: raw.kind,
      role: raw.role ? String(raw.role) : undefined,
      description: raw.description ? String(raw.description) : undefined,
      optional: Boolean(raw.optional),
      produced_by: raw.produced_by ? String(raw.produced_by) : undefined,
    });
  }
  return out;
}

function inferArtifactKind(name: string, path: string): Artifact["kind"] {
  const lowerName = name.toLowerCase();
  const suffix = extname(path).toLowerCase();
  if (lowerName.includes("statistics")) return "statistics";
  if (lowerName.includes("code") || suffix === ".py" || suffix === ".r" || suffix === ".jl") return "code";
  if (lowerName.includes("log") || suffix === ".log") return "log";
  if (suffix === ".md") return "markdown";
  if (suffix === ".json") return "json";
  if ([".png", ".jpg", ".jpeg", ".webp", ".gif", ".pdf"].includes(suffix)) return "figure";
  if ([".csv", ".tsv", ".xlsx", ".xls", ".parquet", ".feather", ".npy", ".npz"].includes(suffix)) return "data";
  return "other";
}

function artifactName(raw: any, path: string, kind: string, fallback?: string) {
  if (raw?.name) return String(raw.name);
  if (fallback) return fallback;
  const stem = basename(path).replace(/\.[^.]+$/, "");
  return stem ? `${kind}_${stem}` : kind;
}

function normalizeArtifact(raw: any, runDir: string, fallbackName?: string): Artifact | undefined {
  if (!raw || typeof raw !== "object" || !raw.path) return undefined;
  const rawPath = String(raw.path);
  const kind = raw.kind ? String(raw.kind) as Artifact["kind"] : inferArtifactKind(String(raw.name || ""), rawPath);
  const path = resolveArtifactPath(runDir, rawPath);
  return {
    name: artifactName(raw, rawPath, kind, fallbackName),
    path,
    kind,
    role: raw.role ? String(raw.role) : undefined,
    description: raw.description ? String(raw.description) : undefined,
    optional: Boolean(raw.optional),
    produced_by: raw.produced_by ? resolveArtifactPath(runDir, String(raw.produced_by)) : undefined,
    content: typeof raw.content === "string" ? raw.content : undefined,
  };
}

function legacyArtifactsFromMap(map: Json, runDir: string): Artifact[] {
  const artifacts: Artifact[] = [];
  for (const [name, value] of Object.entries(map || {})) {
    if (typeof value !== "string" || !value) continue;
    const normalized = normalizeArtifact({ name, path: value, kind: inferArtifactKind(name, value) }, runDir, name);
    if (normalized) artifacts.push(normalized);
  }
  return artifacts;
}

function normalizeArtifacts(input: any, runDir: string): Artifact[] {
  if (Array.isArray(input)) {
    return input.map((raw) => normalizeArtifact(raw, runDir)).filter(Boolean) as Artifact[];
  }
  if (input && typeof input === "object") return legacyArtifactsFromMap(input, runDir);
  return [];
}

function mergeArtifacts(existing: any, incoming: any, runDir: string): Artifact[] {
  const byKey = new Map<string, Artifact>();
  for (const item of normalizeArtifacts(existing, runDir)) byKey.set(item.path, item);
  for (const item of normalizeArtifacts(incoming, runDir)) byKey.set(item.path, { ...byKey.get(item.path), ...item });
  return Array.from(byKey.values());
}

function makeArtifact(runDir: string, name: string, path: string, kind: Artifact["kind"], extra: Partial<Artifact> = {}) {
  return normalizeArtifact({ name, path, kind, ...extra }, runDir, name)!;
}

function stateArtifacts(run: RunContext) {
  return normalizeArtifacts(run.state.artifacts || [], run.runDir);
}

function artifactsByKind(run: RunContext, kind: Artifact["kind"]) {
  return stateArtifacts(run).filter(a => a.kind === kind);
}

function figureArtifactsFromState(run: RunContext) {
  return stateArtifacts(run).filter(a => a.kind === "figure" && isVisionImage(a.path));
}

function ensureInfrastructure(deliverables: Artifact[]): Artifact[] {
  const merged = [...deliverables];
  const hasKind = (k: string) => merged.some(a => a.kind === k);
  if (!hasKind("code")) merged.push({ path: "generated_code.py", kind: "code" });
  if (!hasKind("statistics")) merged.push({ path: "statistics.json", kind: "statistics" });
  return merged;
}

function figureArtifacts(deliverables: Artifact[]): Artifact[] {
  return (deliverables || []).filter(a => a.kind === "figure" && isVisionImage(a.path));
}

function deliverablesToPromptText(deliverables: Artifact[]): string {
  if (!deliverables?.length) return "";
  return deliverables.map(a => {
    const parts = [a.path, a.kind];
    if (a.role) parts.push(`role=${a.role}`);
    if (a.optional) parts.push("optional");
    if (a.description) parts.push(`desc="${a.description}"`);
    if (a.produced_by) parts.push(`produced_by=${a.produced_by}`);
    return parts.join(", ");
  }).join("\n");
}

function resolveCodePathForFigure(runDir: string, artifacts: Artifact[], figurePath: string): { codePath: string; ambiguous: boolean } {
  const targetPath = resolveArtifactPath(runDir, figurePath);
  const target = artifacts.find(a => a.path === targetPath || a.path === figurePath);
  if (target?.produced_by) return { codePath: target.produced_by, ambiguous: false };
  const codeArtifacts = artifacts.filter(a => a.kind === "code");
  if (codeArtifacts.length === 1) return { codePath: codeArtifacts[0].path, ambiguous: false };
  return { codePath: codeArtifacts.map(a => a.path).join(", "), ambiguous: codeArtifacts.length > 1 };
}

function artifactExistenceWarnings(runDir: string, artifacts: Artifact[]) {
  const warnings: string[] = [];
  for (const artifact of artifacts || []) {
    if (artifact.optional) continue;
    const physicalPath = resolveArtifactPath(runDir, artifact.path);
    if (!existsSync(physicalPath)) {
      warnings.push(`declared ${artifact.kind} artifact is missing: ${artifact.path} (resolved: ${physicalPath})`);
    }
  }
  return warnings;
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
  for (const path of paths.filter(Boolean)) {
    try {
      images.push(await loadImageForPrompt(path));
    } catch (error) {
      warnings.push(`failed to load image '${path}': ${String(error)}`);
    }
  }
  return { images, warnings };
}

async function writeJson(path: string, value: Json) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(value, null, 2), "utf8");
}

async function writeText(path: string, value: string) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, value, "utf8");
}

type RunContext = {
  runId: string;
  runDir: string;
  statePath: string;
  state: Json;
};

async function loadRunState(runId: string, runDir: string): Promise<RunContext> {
  const statePath = join(runDir, "state.json");
  const existing = await readJson(statePath, {});
  const state = {
    ...existing,
    run_id: runId,
    artifacts: normalizeArtifacts(existing.artifacts || [], runDir),
  };
  return { runId, runDir, statePath, state };
}

async function writeRunIndex(cwd: string, runId: string, runDir: string) {
  const indexPath = resolve(cwd, RUN_INDEX_FILE);
  const index = await readJson(indexPath, { runs: {} });
  const runs = index.runs || {};
  runs[runId] = {
    run_id: runId,
    run_dir: runDir,
    updated_at: new Date().toISOString(),
  };
  await writeJson(indexPath, {
    ...index,
    runs,
    updated_at: new Date().toISOString(),
  });
}

function questionHistory(state: Json): Array<{ at: string; text: string }> {
  if (!Array.isArray(state.question_history)) return [];
  return state.question_history.filter((entry) => entry && typeof entry.text === "string");
}

function applyQuestionUpdate(state: Json, question?: string): Json {
  const text = String(question || "").trim();
  if (!text) return {};
  const current = String(state.question || "").trim();
  if (current === text) return { question: text };
  const history = questionHistory(state);
  if (!current) return { question: text };
  return {
    question: text,
    question_history: [...history, { at: new Date().toISOString(), text: current }],
  };
}

function resolveQuestion(run: RunContext, question?: string): string {
  const text = String(question || run.state.question || "").trim();
  if (!text) {
    throw new Error("question is required. Pass it to the tool, or persist it first via neuro_start_run/neuro_resume_run.");
  }
  return text;
}

async function startRun(cwd: string, workDir: string, userDeliverables?: any[], question?: string): Promise<RunContext> {
  const runDir = resolve(cwd, workDir);
  const runId = `${shortTimestamp()}-${basename(runDir) || randomUUID().slice(0, 8)}`;
  await mkdir(join(runDir, "subagents"), { recursive: true });

  const deliverables = ensureInfrastructure(
    userDeliverables && userDeliverables.length
      ? normalizeDeliverables(userDeliverables)
      : DEFAULT_DELIVERABLES
  );

  const statePath = join(runDir, "state.json");
  const existing = await readJson(statePath, {});
  const baseState = {
    ...existing,
    run_id: runId,
    created_at: existing.created_at || new Date().toISOString(),
    artifacts: normalizeArtifacts(existing.artifacts || [], runDir),
    deliverables,
  };
  const state = {
    ...baseState,
    ...applyQuestionUpdate(baseState, question),
  };
  await writeJson(statePath, state);
  await writeRunIndex(cwd, runId, runDir);
  return { runId, runDir, statePath, state };
}

async function resolveRun(cwd: string, requestedRunId?: string): Promise<RunContext> {
  if (!requestedRunId) {
    throw new Error("run_id is required. Call neuro_start_run first, then pass the returned run_id to this tool.");
  }
  const index = await readJson(resolve(cwd, RUN_INDEX_FILE), { runs: {} });
  const entry = index.runs?.[requestedRunId];
  if (!entry?.run_dir) {
    throw new Error(`Unknown run_id '${requestedRunId}'. Call neuro_start_run first or use the run_id returned by it.`);
  }
  const runDir = entry.run_dir;
  await mkdir(join(runDir, "subagents"), { recursive: true });
  return loadRunState(requestedRunId, runDir);
}

async function resumeRun(cwd: string, workDir: string, question?: string): Promise<RunContext> {
  const runDir = resolve(cwd, workDir);
  const statePath = join(runDir, "state.json");
  const existing = await readJson(statePath, {});
  const runId = existing.run_id;
  if (!runId || typeof runId !== "string") {
    throw new Error(`Cannot resume: ${statePath} is missing run_id. Call neuro_start_run first.`);
  }
  await mkdir(join(runDir, "subagents"), { recursive: true });
  await writeRunIndex(cwd, runId, runDir);
  const run = await loadRunState(runId, runDir);
  const questionPatch = applyQuestionUpdate(run.state, question);
  if (Object.keys(questionPatch).length) {
    await updateState(run, questionPatch);
  }
  return run;
}

async function updateState(run: RunContext, patch: Json) {
  const hasArtifactPatch = Object.prototype.hasOwnProperty.call(patch, "artifacts");
  const next = {
    ...run.state,
    ...patch,
    artifacts: hasArtifactPatch
      ? mergeArtifacts(run.state.artifacts || [], patch.artifacts || [], run.runDir)
      : normalizeArtifacts(run.state.artifacts || [], run.runDir),
    updated_at: new Date().toISOString(),
  };
  await writeJson(run.statePath, next);
  run.state = next;
  return next;
}

// Resource-sensing layer
const RESOURCE_SENSING_DEFAULTS = {
  core_fraction: 0.9,
  max_cores: null as number | null,
  reserve_cores: 1,
  blas_threads: "auto" as number | "auto",
};

function resourceSensingConfig(config: Json) {
  const raw = (config.modules && config.modules.resource_sensing) || {};
  const num = (v: any, d: number | null) => (typeof v === "number" && Number.isFinite(v) ? v : d);
  return {
    core_fraction: num(raw.core_fraction, RESOURCE_SENSING_DEFAULTS.core_fraction) as number,
    max_cores: num(raw.max_cores, RESOURCE_SENSING_DEFAULTS.max_cores),
    reserve_cores: num(raw.reserve_cores, RESOURCE_SENSING_DEFAULTS.reserve_cores) as number,
    blas_threads:
      typeof raw.blas_threads === "number" || raw.blas_threads === "auto"
        ? raw.blas_threads
        : RESOURCE_SENSING_DEFAULTS.blas_threads,
  };
}

function detectSchedulerCores(): { cores: number | null; scheduler: string | null } {
  const env = process.env;
  const parse = (v?: string) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const slurm = parse(env.SLURM_CPUS_PER_TASK) || parse(env.SLURM_CPUS_ON_NODE);
  if (slurm) return { cores: slurm, scheduler: "slurm" };
  const pbs = parse(env.PBS_NP) || parse(env.NCPUS);
  if (pbs) return { cores: pbs, scheduler: "pbs" };
  if (env.PJM_PROC_BY_NODE || env.PJMCMD_AVAILABLE || env.PJM_MPI_PROC) {
    return { cores: parse(env.PJM_PROC_BY_NODE), scheduler: "pjm" };
  }
  return { cores: null, scheduler: null };
}

// Best-effort GPU probe
async function detectGpuCount(): Promise<number> {
  return await new Promise((resolvePromise) => {
    try {
      const child = spawn("nvidia-smi", ["-L"], { stdio: ["ignore", "pipe", "ignore"] });
      let out = "";
      const timer = setTimeout(() => {
        try {
          child.kill("SIGKILL");
        } catch {}
        resolvePromise(0);
      }, 2000);
      child.stdout.on("data", (c) => {
        out += String(c);
      });
      child.on("error", () => {
        clearTimeout(timer);
        resolvePromise(0);
      });
      child.on("close", () => {
        clearTimeout(timer);
        resolvePromise(out.split(/\r?\n/).filter((l) => /^GPU \d+:/.test(l.trim())).length);
      });
    } catch {
      resolvePromise(0);
    }
  });
}

const clampInt = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.floor(v)));

async function detectResources(config: Json): Promise<Json> {
  const opts = resourceSensingConfig(config);
  let affinityCores = 1;
  try {
    // availableParallelism() honors Linux CPU affinity / cgroup pinning.
    affinityCores = availableParallelism();
  } catch {
    affinityCores = cpus().length || 1;
  }
  const totalCores = cpus().length || affinityCores;
  const sched = detectSchedulerCores();
  const availCores = sched.cores && sched.cores > 0 ? Math.min(affinityCores, sched.cores) : affinityCores;

  const budget =
    opts.max_cores != null
      ? Math.min(opts.max_cores, availCores)
      : Math.floor(availCores * opts.core_fraction) - opts.reserve_cores;
  const recommended = clampInt(budget, 1, availCores);
  const blasThreads = opts.blas_threads === "auto" ? 1 : clampInt(opts.blas_threads, 1, availCores);
  const gpuCount = await detectGpuCount();

  return {
    platform: osPlatform(),
    n_cores_total: totalCores,
    n_cores_available: availCores,
    recommended_n_jobs: recommended,
    blas_threads: blasThreads,
    mem_total_gb: Math.round((totalmem() / 1e9) * 10) / 10,
    mem_available_gb: Math.round((freemem() / 1e9) * 10) / 10,
    gpu_count: gpuCount,
    scheduler: sched.scheduler,
    detected_at: new Date().toISOString(),
  };
}

// Set thread-env defaults on the extension host process
function applyThreadEnvDefaults(profile: Json) {
  const blas = String(profile.blas_threads ?? 1);
  const setIfUnset = (k: string, v: string) => {
    if (!process.env[k]) process.env[k] = v;
  };
  setIfUnset("OMP_NUM_THREADS", blas);
  setIfUnset("OPENBLAS_NUM_THREADS", blas);
  setIfUnset("MKL_NUM_THREADS", blas);
  setIfUnset("NUMEXPR_NUM_THREADS", blas);
  setIfUnset("VECLIB_MAXIMUM_THREADS", blas);
  process.env.NEURO_N_CORES = String(profile.recommended_n_jobs ?? 1);
}

function formatResourceProfile(profile: Json): string {
  if (!profile || typeof profile !== "object") return "";
  const gpu = Number(profile.gpu_count || 0);
  return [
    `- available_cpu_cores: ${profile.n_cores_available} (machine total ${profile.n_cores_total})`,
    `- recommended_parallel_workers: ${profile.recommended_n_jobs} (also exported as env NEURO_N_CORES)`,
    `- per_worker_blas_threads: ${profile.blas_threads} (OMP/MKL/OPENBLAS/NUMEXPR already set to this)`,
    `- memory_available_gb: ${profile.mem_available_gb} (machine total ${profile.mem_total_gb})`,
    `- gpu_count: ${gpu}${gpu > 0 ? " (GPU libs like torch/cupy may accelerate this)" : " (CPU-only node)"}`,
    profile.scheduler ? `- scheduler: ${profile.scheduler}` : "",
    `Parallelize the dominant embarrassingly-parallel axis across ${profile.recommended_n_jobs} worker processes; keep per-worker BLAS threads at 1 to avoid oversubscription (workers x BLAS threads must stay <= available cores).`,
  ]
    .filter(Boolean)
    .join("\n");
}

// Ensure thread-env is set in the current process from a persisted or freshly
// detected profile.
async function ensureResourceEnv(run: RunContext, config: Json) {
  if (!level1WorkflowConfig(config).resource_sensing) return;
  try {
    let profile = run.state.resource_profile;
    if (!profile || typeof profile !== "object") {
      profile = await detectResources(config);
      await updateState(run, { resource_profile: profile });
    }
    applyThreadEnvDefaults(profile);
  } catch {
    // resource sensing is best-effort; never block the run
  }
}

async function snapshotRunArtifacts(run: RunContext, label: string) {
  if (!debugDiskWritesEnabled()) return undefined;
  const safeLabel = label.replace(/[^a-zA-Z0-9_.-]+/g, "_").replace(/^_+|_+$/g, "") || "snapshot";
  const snapshotDir = join(run.runDir, ".snapshot", `${shortTimestamp()}_${safeLabel}_${randomUUID().slice(0, 8)}`);
  const deliverables: Artifact[] = run.state.deliverables || DEFAULT_DELIVERABLES;
  const candidates: string[] = [
    join(run.runDir, "exec.log"),
    join(run.runDir, "generated_code.py"),
    join(run.runDir, "figure.png"),
    join(run.runDir, "figure.pdf"),
    join(run.runDir, "statistics.json"),
    join(run.runDir, "validation.json"),
    join(run.runDir, "conclusions.json"),
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
    await mkdir(dirname(target), { recursive: true });
    await copyFile(source, target);
    copied.push({ source, snapshot_path: target });
  }
  if (!copied.length) return undefined;
  const manifest = {
    label,
    created_at: new Date().toISOString(),
    copied,
  };
  await writeJson(join(snapshotDir, "manifest.json"), manifest);
  return { snapshot_dir: snapshotDir, copied };
}

function subDefaultKey(agentName: string) {
  return agentName.startsWith("level2_") ? "level2_default" : "level1_default";
}

function pickAgentConfig(config: Json, agentName: string) {
  const defaults = config.agents?.[subDefaultKey(agentName)] || {};
  const specific = config.agents?.[agentName] || {};
  const allowedDefaults = ["provider", "model", "thinking", "timeout_seconds"];
  const merged = { ...specific };
  for (const key of allowedDefaults) {
    if (merged[key] === undefined && defaults[key] !== undefined) {
      merged[key] = defaults[key];
    }
  }
  return merged;
}

function agentTimeoutSeconds(agentConfig: Json) {
  const value = Number(agentConfig?.timeout_seconds || 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

async function resolveModel(agentConfig: Json) {
  if (!agentConfig.provider || !agentConfig.model) return {};
  try {
    const coding = await import("@mariozechner/pi-coding-agent");
    const authStorage = (coding as any).AuthStorage?.create?.();
    const modelRegistry = (coding as any).ModelRegistry?.create?.(authStorage);
    const customModel = modelRegistry?.find?.(agentConfig.provider, agentConfig.model);
    if (customModel) return { model: customModel };
  } catch {
    // Fall through to built-in model lookup.
  }
  try {
    const ai = await import("@mariozechner/pi-ai");
    const model = (ai as any).getModel?.(agentConfig.provider, agentConfig.model);
    return model ? { model } : {};
  } catch {
    return {};
  }
}

async function runPythonScript(scriptPath: string, input: Json, cwd: string, signal?: AbortSignal): Promise<Json> {
  return await new Promise((resolvePromise) => {
    loadEnv(cwd).then(async (env) => {
      const scriptName = basename(scriptPath);
      try {
        const tmpDir = resolve(cwd, ".pi", "neuroscientist-level1", "tmp");
        await mkdir(tmpDir, { recursive: true });
        const id = randomUUID();
        const inputPath = join(tmpDir, `${id}.input.json`);
        const outputPath = join(tmpDir, `${id}.output.json`);
        const logPath = join(tmpDir, `${id}.log`);
        await writeJson(inputPath, input);
        const child = spawn("python3", [scriptPath, "--input", inputPath, "--output", outputPath, "--log", logPath], {
          stdio: ["ignore", "pipe", "pipe"],
          signal,
          env,
        });
        child.stdout.on("data", () => {});
        child.stderr.on("data", () => {});
        child.on("error", (error) => {
          resolvePromise({
            ok: false,
            matched: false,
            source: "none",
            warnings: [`failed to spawn ${scriptName}`],
            error: String(error),
            log_path: logPath,
            output_path: outputPath,
          });
        });
        child.on("close", async (code) => {
          try {
            const parsed = JSON.parse(await readFile(outputPath, "utf8"));
            parsed.output_path = outputPath;
            parsed.log_path = parsed.details?.log_path || logPath;
            if (code !== 0) parsed.exit_code = code;
            resolvePromise(parsed);
          } catch (error) {
            resolvePromise({
              ok: false,
              matched: false,
              source: "none",
              warnings: [`${scriptName} did not write valid JSON output file`],
              error: String(error),
              log_path: logPath,
              output_path: outputPath,
              exit_code: code,
            });
          }
        });
      } catch (error) {
        resolvePromise({
          ok: false,
          matched: false,
          source: "none",
          warnings: [`failed to prepare ${scriptName} JSON file contract`],
          error: String(error),
        });
      }
    }).catch((error) => {
      resolvePromise({
        ok: false,
        matched: false,
        source: "none",
        warnings: [`failed to load environment for ${basename(scriptPath)}`],
        error: String(error),
      });
    });
  });
}

async function runPython(input: Json, cwd: string, signal?: AbortSignal): Promise<Json> {
  const workflowCwd = WORKFLOW_ROOT || cwd;
  const scriptPath = join(workflowCwd, "internagent", "modules", "targeted_skill", "resolve_targeted_skill.py");
  return await runPythonScript(scriptPath, input, workflowCwd, signal);
}

function dummyDataSignals(text: string) {
  const patterns = [
    /\b(dummy|toy|mock|synthetic|simulated|randomly generated)\b/i,
    /\bnp\.random\.(rand|randn|normal|uniform|poisson)\b/,
    /\brandom\.(random|randint|choice|uniform)\b/,
    /\bplaceholder\b/i,
    /\bTODO:?\s*replace\b/i,
  ];
  return patterns.filter((pattern) => pattern.test(text)).map((pattern) => pattern.source);
}

function statisticsWarnings(statistics: any, question: string = "") {
  const warnings: string[] = [];
  if (!statistics || typeof statistics !== "object") {
    warnings.push("statistics is missing or not an object");
    return warnings;
  }
  if ("note" in statistics || "error" in statistics) {
    warnings.push("statistics.json was not generated — results cannot be validated");
    return warnings;
  }

  // Finite-number check (original visit logic)
  function visit(value: any, path: string) {
    if (typeof value === "number" && !Number.isFinite(value)) {
      warnings.push(`${path} is not finite`);
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}[${index}]`));
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      for (const [key, child] of Object.entries(value)) visit(child, `${path}.${key}`);
    }
  }
  visit(statistics, "statistics");
  if (warnings.length) return warnings;

  // Collect all numeric values with their paths
  function* nums(obj: any, path = ""): Generator<[string, number]> {
    if (typeof obj === "number") {
      yield [path, obj];
    } else if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) yield* nums(obj[i], `${path}[${i}]`);
    } else if (obj && typeof obj === "object") {
      for (const [k, v] of Object.entries(obj)) yield* nums(v, path ? `${path}.${k}` : k);
    }
  }
  const numericVals: [string, number][] = [...nums(statistics)];

  // Check 1: all correlation values near zero → missing log-transform or wrong data
  const corrVals = numericVals.filter(
    ([p, v]) => /corr|pearson|r_val|r_value|rho|spearman/i.test(p) && typeof v === "number",
  );
  if (corrVals.length) {
    const nearZero = corrVals.filter(([, v]) => Math.abs(v) < 0.05);
    if (nearZero.length === corrVals.length) {
      warnings.push(
        "All correlation values are near zero (" +
          nearZero.slice(0, 3).map(([p, v]) => `${p}=${v.toFixed(3)}`).join(", ") +
          "). Possible missing preprocessing (e.g. log10 transform) or wrong data source.",
      );
    }
  }

  // Check 3: group means/medians nearly equal when a contrast is expected
  const groupKeys = numericVals.filter(
    ([p, v]) =>
      /mean|median|fraction|frac|ratio|proportion|pct|percent/i.test(p) &&
      typeof v === "number" && !Number.isNaN(v),
  );
  if (groupKeys.length >= 2) {
    const valsOnly = groupKeys.map(([, v]) => v);
    const maxVal = Math.max(...valsOnly);
    if (maxVal > 1e-6) {
      const spread = (maxVal - Math.min(...valsOnly)) / maxVal;
      if (spread < 0.1) {
        warnings.push(
          `Group summary values are nearly identical (relative spread ${(spread * 100).toFixed(1)}%). ` +
            "If a contrast between conditions is expected, data preprocessing may be wrong.",
        );
      }
    }
  }

  // Check 4: sample size inconsistent with numbers mentioned in the question
  const qNs = (question.match(/\b(\d{2,5})\b/g) || []).map(Number);
  const nVals = numericVals.filter(
    ([p, v]) =>
      /\bn\b|n_sample|n_fish|n_cell|n_neuron|sample_size|num_/i.test(p) &&
      typeof v === "number" && v === Math.floor(v) && v > 1,
  );
  for (const [p, n] of nVals) {
    if (qNs.length && qNs.every((qn) => Math.abs(n - qn) / Math.max(qn, 1) > 0.5)) {
      warnings.push(
        `Sample size ${p}=${n} seems inconsistent with numbers in the question ([${qNs}]). ` +
          "Verify the correct dataset is being loaded.",
      );
      break;
    }
  }

  return warnings;
}

async function appendStateEntry(pi: ExtensionAPI, event: Json) {
  try {
    await pi.appendEntry("neuroscientist-level1-state", event);
  } catch {
    // appendEntry is best-effort; state.json remains the source of truth.
  }
}

function finalizationPrompt(agentName: string, finalizeTool: string, rolePrompt: string, body: string) {
  return [
    rolePrompt.trim(),
    "",
    `You are the isolated NeuroScientist level-1 ${agentName} subagent.`,
    "Return only by calling the finalize tool. Do not expose scratch reasoning.",
    `Required final tool: ${finalizeTool}`,
    "",
    body,
  ].join("\n");
}

function additionalContextBlock(additionalContext?: string) {
  const text = String(additionalContext || "").trim();
  return text ? `Additional context from the main agent:\n${text}` : "";
}

// --- save-skill helpers ---------------------------------------------------
// snake_case slug mirroring internagent/modules/targeted_skill/taxonomy.py._slug.
function smmtSlug(raw: any): string {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]+/g, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function extractMessageText(msg: any): string {
  if (!msg) return "";
  if (typeof msg.content === "string") return msg.content;
  if (Array.isArray(msg.content)) {
    return msg.content
      .map((c: any) => (typeof c === "string" ? c : c?.text || ""))
      .filter(Boolean)
      .join(" ");
  }
  return String(msg.text || "");
}

// Build a bounded digest of the dialogue: user turns + their corrections + the
// ordered neuro_* tool-call sequence. Reads the persisted session on demand.
function buildTranscriptDigest(sessionManager: any, maxChars = 4000): string {
  const entries = sessionManager?.getBranch?.() || sessionManager?.getEntries?.() || [];
  const lines: string[] = [];
  for (const entry of entries) {
    if (entry?.type !== "message") continue;
    const msg = entry.message || {};
    if (msg.role === "user") {
      const text = extractMessageText(msg).trim();
      if (text) lines.push(`USER: ${text.slice(0, 400)}`);
    } else if (msg.role === "assistant") {
      const names: string[] = [];
      if (msg.toolName) names.push(String(msg.toolName));
      if (Array.isArray(msg.toolCalls)) {
        for (const t of msg.toolCalls) if (t?.name) names.push(String(t.name));
      }
      const neuro = names.filter((n) => n.startsWith("neuro"));
      if (neuro.length) lines.push(`TOOL: ${neuro.join(", ")}`);
    }
  }
  let digest = lines.join("\n");
  if (digest.length > maxChars) digest = "...\n" + digest.slice(-maxChars);
  return digest;
}

function parseRunIdArg(args?: string): string | undefined {
  const token = String(args || "").trim().split(/\s+/).find((t) => t && !t.startsWith("-"));
  return token || undefined;
}

// Register a saved skill's OWN directory with pi (in .pi/settings.json) so it is
// discoverable as /skill:<name> on the next pi launch. We point pi at the specific
// skill dir (which contains SKILL.md), NOT the parent library — otherwise pi scans
// the parent's loose files (INDEX.md, .gitkeep) as skills and reports conflicts.
async function registerSkillPathWithPi(skillDirAbs: string): Promise<string | undefined> {
  try {
    const piDir = join(WORKFLOW_ROOT, ".pi");
    const settingsPath = join(piDir, "settings.json");
    let settings: Json = {};
    try {
      settings = JSON.parse(await readFile(settingsPath, "utf8"));
    } catch {
      settings = {};
    }
    const rel = relative(piDir, skillDirAbs);
    const arr: string[] = Array.isArray(settings.skills) ? settings.skills : [];
    if (!arr.includes(rel)) {
      arr.push(rel);
      settings.skills = arr;
      await writeFile(settingsPath, JSON.stringify(settings, null, 2) + "\n", "utf8");
    }
    return rel;
  } catch {
    return undefined;
  }
}

async function snapshotSubagentFiles(agentDir: string) {
  if (!debugDiskWritesEnabled()) return undefined;
  const files = ["input.json", "output.json", "prompt.md", "events.jsonl"];
  const existing = files.filter((name) => existsSync(join(agentDir, name)));
  if (!existing.length) return undefined;
  const snapshotDir = join(agentDir, ".snapshot", `call_${shortTimestamp()}_${randomUUID().slice(0, 8)}`);
  await mkdir(snapshotDir, { recursive: true });
  const copied: string[] = [];
  for (const name of existing) {
    const source = join(agentDir, name);
    const target = join(snapshotDir, name);
    await copyFile(source, target);
    copied.push(target);
  }
  await writeJson(join(snapshotDir, "manifest.json"), {
    created_at: new Date().toISOString(),
    copied,
  });
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
  if (persistSubagentFiles) {
    await mkdir(agentDir, { recursive: true });
  }
  const snapshotDir = persistSubagentFiles ? await snapshotSubagentFiles(agentDir) : undefined;
  if (persistSubagentFiles) {
    await writeJson(inputPath, {
      agent_name: options.agentName,
      finalize_tool: options.finalizeTool,
      tools: options.tools || [],
      prompt: options.prompt,
    });
    await writeText(join(agentDir, "prompt.md"), options.prompt);
  }

  const readableLogs: Json[] = [];
  try {
    const sdk = await import("@mariozechner/pi-coding-agent");
    const defineTool = (sdk as any).defineTool;
    const createAgentSession = (sdk as any).createAgentSession;
    const SessionManager = (sdk as any).SessionManager;
    if (!defineTool || !createAgentSession || !SessionManager) {
      throw new Error("Pi SDK subagent APIs are unavailable in this runtime");
    }

    let finalPayload: Json | undefined;
    const finalize = defineTool({
      name: options.finalizeTool,
      label: options.finalizeTool,
      description: "Finalize the isolated NeuroScientist level-1 subagent result.",
      parameters: options.finalizeSchema,
      async execute(_toolCallId: string, params: Json) {
        finalPayload = params;
        if (persistSubagentFiles) {
          await writeJson(outputPath, params);
        }
        return {
          content: [{ type: "text", text: "Finalized." }],
          details: params,
          terminate: true,
        };
      },
    });

    const modelOptions = await resolveModel(options.agentConfig || {});
    const activeTools = [...new Set([...(options.tools || []), options.finalizeTool])];
    const timeoutSeconds = agentTimeoutSeconds(options.agentConfig || {});
    const { session } = await createAgentSession({
      cwd: options.runDir,
      tools: activeTools,
      customTools: [finalize],
      sessionManager: SessionManager.inMemory(options.runDir),
      ...modelOptions,
      ...(options.agentConfig?.thinking ? { thinkingLevel: options.agentConfig.thinking } : {}),
    });
    const unsubscribe = session.subscribe((event: Json) => {
      pushReadableLog(readableLogs, event, "subagent", options.agentName);
    });
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    let signalAbort: (() => void) | undefined;
    try {
      const promptPromise = options.images?.length
        ? session.prompt(options.prompt, { images: options.images })
        : session.prompt(options.prompt);
      const guards: Promise<never>[] = [];
      if (timeoutSeconds > 0) {
        guards.push(new Promise((_, reject) => {
          timeoutHandle = setTimeout(() => {
            reject(new Error(`subagent timed out after ${timeoutSeconds}s`));
          }, timeoutSeconds * 1000);
        }));
      }
      if (options.signal) {
        guards.push(new Promise((_, reject) => {
          signalAbort = () => reject(new Error("subagent aborted by caller"));
          if (options.signal?.aborted) signalAbort();
          else options.signal?.addEventListener("abort", signalAbort, { once: true });
        }));
      }
    await (guards.length ? Promise.race([promptPromise, ...guards]) : promptPromise);
    } catch (error) {
      const stats = session.getSessionStats?.();
      if (stats) await tryAppendUsageEntry(options.runDir, options.agentName, usageEntry(options.agentName, stats, { call_id: snapshotDir }));
      await session.dispose?.();
      throw error;
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      if (options.signal && signalAbort) options.signal.removeEventListener("abort", signalAbort);
    }
    unsubscribe?.();
    const stats = session.getSessionStats?.();
    if (stats) await tryAppendUsageEntry(options.runDir, options.agentName, usageEntry(options.agentName, stats, { call_id: snapshotDir }));
    await session.dispose?.();
    if (persistSubagentFiles) {
      await writeJsonl(join(agentDir, "events.jsonl"), readableLogs);
    }

    if (!finalPayload) {
      const failure = {
        ok: false,
        error: `subagent did not call ${options.finalizeTool}`,
        subagent_dir: agentDir,
        output_path: outputPath,
        snapshot_dir: snapshotDir,
      };
      if (persistSubagentFiles) {
        await writeJson(outputPath, failure);
      }
      return failure;
    }
    const result = persistSubagentFiles ? await readJson(outputPath, finalPayload) : finalPayload;
    return { ok: true, result, subagent_dir: agentDir, output_path: outputPath, snapshot_dir: snapshotDir };
  } catch (error) {
    const failure = {
      ok: false,
      error: String(error),
      subagent_dir: agentDir,
      output_path: outputPath,
      snapshot_dir: snapshotDir,
      timeout_seconds: agentTimeoutSeconds(options.agentConfig || {}) || undefined,
      fallback: "prompt artifact written; Pi SDK subagent execution did not complete",
    };
    if (persistSubagentFiles) {
      await writeJson(outputPath, failure);
    }
    return failure;
  }
}

export default function (pi: ExtensionAPI) {
  let activeRunDir: string | undefined;

  pi.registerCommand("neuro_tools", {
    description: "Show NeuroScientist level-1 loaded and active tools.",
    async handler() {
      const allTools = pi.getAllTools().map((tool: any) => tool.name);
      const activeTools = pi.getActiveTools();
      pi.sendMessage({
        customType: "neuroscientist-level1-tools",
        content: JSON.stringify({
          extension: "neuroscientist-level1",
          all_tools: allTools,
          active_tools: activeTools,
          has_neuro_start_run: allTools.includes("neuro_start_run"),
          active_neuro_start_run: activeTools.includes("neuro_start_run"),
        }, null, 2),
        display: true,
      });
    },
  });

  pi.registerCommand("neuro-save-skill", {
    description: "Save the finished Level-1 run as a reusable neuroscience skill (Stage-Species-Modality-Method-Target). Optional args: <run_id> [--yes].",
    async handler(args: string, ctx: any) {
      const config = await loadConfig(ctx.cwd);
      if (!level1WorkflowConfig(config).save_skill) {
        ctx.ui?.notify?.("save_skill is disabled by config (workflow.level1.save_skill).", "info");
        return;
      }

      // 1. Locate the run.
      let run: RunContext | undefined;
      try {
        const runId = parseRunIdArg(args);
        if (runId) {
          run = await resolveRun(ctx.cwd, runId);
        } else if (activeRunDir) {
          const st = await readJson(join(activeRunDir, "state.json"), {});
          if (st.run_id) run = await loadRunState(st.run_id, activeRunDir);
        }
        if (!run) {
          const index = await readJson(resolve(ctx.cwd, RUN_INDEX_FILE), { runs: {} });
          const ids = Object.keys(index.runs || {});
          if (!ids.length) {
            ctx.ui?.notify?.("No runs found. Finish a Level-1 run first.", "error");
            return;
          }
          let chosen = ids[ids.length - 1];
          if (ctx.hasUI && ids.length > 1) {
            const sel = await ctx.ui.select("Save which run as a skill?", ids);
            if (!sel) return;
            chosen = sel;
          }
          run = await resolveRun(ctx.cwd, chosen);
        }
      } catch (error) {
        ctx.ui?.notify?.(`Could not locate run: ${error}`, "error");
        return;
      }

      // 2. Guard: require generated analysis code.
      const genCode = join(run.runDir, "generated_code.py");
      const hasCode = existsSync(genCode) || (run.state.code?.code_files?.length || 0) > 0;
      if (!hasCode) {
        ctx.ui?.notify?.("This run has no generated analysis code yet; nothing to save.", "error");
        return;
      }

      // 3. Gather run material (structured state + on-disk code + dialogue digest).
      const question = String(run.state.question || "").trim();
      const digest = buildTranscriptDigest(ctx.sessionManager);
      const codeText = existsSync(genCode) ? await readFile(genCode, "utf8").catch(() => "") : "";
      const stats = run.state.code?.statistics && typeof run.state.code.statistics === "object"
        ? run.state.code.statistics : {};

      // 4. Derive the SMMT name via an LLM subagent (not a fixed template).
      const rolePrompt = await readPrompt("save_skill");
      const namerBody = [
        `Question:\n${question}`,
        `Data info (metadata):\n${String(run.state.data_info || "").slice(0, 3000)}`,
        `Plan summary:\n${String(run.state.plan?.summary || run.state.plan?.plan_markdown || "").slice(0, 2000)}`,
        "Analysis code that actually ran:\n```python\n" + codeText.slice(0, 6000) + "\n```",
        `Statistics keys: ${Object.keys(stats).join(", ") || "(none)"}`,
        `Conclusions:\n${JSON.stringify(run.state.conclusions || {}).slice(0, 1500)}`,
        `Dialogue digest (intent & corrections):\n${digest}`,
        "Finalize with { stage, species, modality, method, target, rationale, proposed_description, triggers[5], tags[4-6] }.",
      ].join("\n\n");
      ctx.ui?.notify?.("Analyzing the run to propose a skill name...", "info");
      const sub = await runSubagent({
        runDir: run.runDir,
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
        prompt: finalizationPrompt("save_skill_namer", "finalize_smmt", rolePrompt, namerBody),
        agentConfig: pickAgentConfig(config, "level1_save_skill"),
        tools: [],
      });
      if (!sub.ok || !sub.result) {
        ctx.ui?.notify?.(`Skill naming failed: ${sub.error || "no result"}`, "error");
        return;
      }
      const r = sub.result;
      const smmt = {
        stage: smmtSlug(r.stage), species: smmtSlug(r.species), modality: smmtSlug(r.modality),
        method: smmtSlug(r.method), target: smmtSlug(r.target),
      };
      if (Object.values(smmt).some((v) => !v)) {
        ctx.ui?.notify?.("Namer returned an empty axis; aborting.", "error");
        return;
      }
      const folder_name = [smmt.stage, smmt.species, smmt.modality, smmt.method, smmt.target].join("-");
      const pi_name = folder_name.replace(/_/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
      const warnBits: string[] = [];
      if (!["ns_pre", "ns_seg", "ns_reg", "ns_feat", "ns_ana", "ns_multi"].includes(smmt.stage)) warnBits.push(`stage '${smmt.stage}' is new`);
      if (!["zebrafish", "mouse", "marmoset", "human", "global"].includes(smmt.species)) warnBits.push(`species '${smmt.species}' is unusual`);

      // 5. Expert confirmation.
      const summary = [
        `Skill name : ${folder_name}`,
        `pi name    : /skill:${pi_name}`,
        `description: ${String(r.proposed_description || "").slice(0, 220)}`,
        `rationale  : ${String(r.rationale || "").slice(0, 220)}`,
        warnBits.length ? `warnings   : ${warnBits.join("; ")}` : "",
        `target dir : library/skills/from_expert/`,
      ].filter(Boolean).join("\n");
      const autoYes = /(^|\s)(--yes|-y|yes)(\s|$)/.test(String(args || ""));
      let approved: boolean;
      if (ctx.hasUI) {
        approved = await ctx.ui.confirm("Save this run as a skill?", summary);
      } else {
        approved = autoYes;
        if (!approved) {
          await writeJson(join(run.runDir, "save_skill_proposal.json"), { folder_name, pi_name, smmt, ...r });
          pi.sendMessage({
            customType: "neuro-save-skill", display: true,
            content: `Proposed skill:\n${summary}\n\nHeadless mode: re-run '/neuro-save-skill ${run.runId} --yes' to write it, or inspect save_skill_proposal.json.`,
          });
          return;
        }
      }
      if (!approved) {
        ctx.ui?.notify?.("Skill save cancelled.", "info");
        return;
      }

      // 6. Author + validate + register via the Python backend.
      const targeted = config.modules?.targeted_skill || {};
      const payload = {
        run_dir: run.runDir,
        run_id: run.state.run_id,
        root_dir: WORKFLOW_ROOT,
        output_dir: (Array.isArray(targeted.extra_skill_dirs) && targeted.extra_skill_dirs[0]) || "library/skills/from_expert",
        smmt, folder_name, pi_name,
        description: r.proposed_description,
        triggers: r.triggers,
        tags: r.tags,
        question,
        question_history: run.state.question_history || [],
        data_info: run.state.data_info || "",
        plan_markdown: run.state.plan?.plan_markdown || "",
        statistics: stats,
        conclusions: run.state.conclusions || {},
        deep_research_context: run.state.deep_research_context || "",
        targeted_skill: run.state.targeted_skill || "",
        resource_profile: run.state.resource_profile || {},
        image_analyses: run.state.image_analyses || run.state.image_analysis || [],
        deliverables: run.state.deliverables || [],
        transcript_digest: digest,
        generated_code_path: existsSync(genCode) ? genCode : "",
        use_llm_body: true,
      };
      ctx.ui?.notify?.("Authoring the skill...", "info");
      const scriptPath = join(WORKFLOW_ROOT, "internagent", "modules", "targeted_skill", "save_skill.py");
      const result = await runPythonScript(scriptPath, payload, WORKFLOW_ROOT);
      if (!result.ok) {
        ctx.ui?.notify?.(`Skill save failed: ${result.error || JSON.stringify(result.errors || result.warnings || result)}`, "error");
        return;
      }
      await updateState(run, {
        saved_skill: {
          skill_dir: result.skill_dir, folder_name: result.folder_name,
          pi_name: result.pi_name, at: new Date().toISOString(),
        },
      });
      await appendStateEntry(pi, { run_id: run.runId, event: "neuro_save_skill", ok: true, folder_name: result.folder_name });
      const piRel = result.skill_dir ? await registerSkillPathWithPi(String(result.skill_dir)) : undefined;
      const vs = result.validate_skills?.status || "unknown";
      ctx.ui?.notify?.(`Saved skill: ${result.folder_name} (validate_skills: ${vs})`, "info");
      pi.sendMessage({
        customType: "neuro-save-skill", display: true,
        content: `Saved skill '${result.folder_name}'\n  dir: ${result.skill_dir}\n  pi: /skill:${result.pi_name}${piRel ? " (registered in .pi/settings.json; active next pi launch)" : ""}\n  validate_skills: ${vs}\n  warnings: ${(result.warnings || []).join("; ") || "none"}`,
      });
    },
  });

  pi.on("before_agent_start", async (_event, ctx) => {
    await syncWorkflowWritePolicy(ctx.cwd);
  });

  pi.on("turn_end", async (event: Json, _ctx) => {
    if (!activeRunDir) return;
    const entry = usageEntryFromMessage("main", event.message || {}, { turn_index: event.turnIndex });
    if (entry.tokens.total <= 0 && entry.cost <= 0) return;
    await tryAppendUsageEntry(activeRunDir, "main", entry);
  });

  pi.on("message_end", async (event: Json) => {
    if (!activeRunDir) return;
    for (const entry of readableLogEntriesFromEvent(event, "main", "level1")) {
      await appendReadableLog(activeRunDir, entry);
    }
  });

  pi.on("tool_execution_end", async (event: Json) => {
    const resultRunDir = event.result?.details?.run_dir || event.result?.run_dir;
    if (typeof resultRunDir === "string" && (event.toolName === "neuro_start_run" || event.toolName === "neuro_resume_run")) {
      activeRunDir = resultRunDir;
    }
    if (!activeRunDir) return;
    for (const entry of readableLogEntriesFromEvent(event, "main", "level1")) {
      await appendReadableLog(activeRunDir, entry);
    }
  });

  pi.on("after_provider_response", async (event: Json) => {
    if (!activeRunDir || numberValue(event.status) < 400) return;
    for (const entry of readableLogEntriesFromEvent({ ...event, type: "after_provider_response" }, "main", "level1")) {
      await appendReadableLog(activeRunDir, entry);
    }
  });

  pi.on("session_before_compact", async (event, _ctx) => {
    if (!activeRunDir) return;
    const state = await readJson(join(activeRunDir, "state.json"), {});
    return {
      compaction: {
        summary: `NeuroScientist level-1 run ${state.run_id || "unknown"} artifacts: ${JSON.stringify(state.artifacts || {})}`,
        firstKeptEntryId: event.preparation.firstKeptEntryId,
        tokensBefore: event.preparation.tokensBefore,
      },
    };
  });

  pi.on("tool_result", async (event) => {
    if (event.toolName !== "neuro_code") return;
    const details = event.details || {};
    if (details.blocked_by_dummy_data) {
      const existingContent = event.content || [];
      return {
        content: [
          ...existingContent,
          { type: "text", text: "\n\n⚠️ [NeuroScientist level-1 Extension] Dummy/synthetic data signal detected in neuro_code output. Consider asking the user for correct data paths or retrying with adjusted code before proceeding." },
        ],
        details,
      };
    }
  });

  pi.registerTool({
    name: "neuro_ping",
    label: "Neuro Ping",
    description: "Verify that the project-local NeuroScientist level-1 Pi extension is loaded. Does not create or modify runs.",
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
      const index = await readJson(resolve(ctx.cwd, RUN_INDEX_FILE), { runs: {} });
      return content({
        ok: true,
        extension: "neuroscientist-level1",
        run_count: Object.keys(index.runs || {}).length,
      });
    },
  });

  pi.registerTool({
    name: "neuro_capabilities",
    label: "Neuro Capabilities",
    description: "Report level-1 workflow capabilities and user-configured optional tool availability. Call before starting a run.",
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
      const config = await loadConfig(ctx.cwd);
      const workflow = level1WorkflowConfig(config);
      const status = (enabled: boolean) => enabled ? "enabled" : "disabled_by_user_config";
      const targetedSkillEnabled = workflow.targeted_skill_match || workflow.targeted_skill_generate;
      return content({
        ok: true,
        required_spine: [
          "neuro_start_run",
          "neuro_plan",
          "neuro_code",
          "neuro_validate",
          "neuro_conclude",
        ],
        optional: {
          deep_research: status(workflow.deep_research),
          targeted_skill: status(targetedSkillEnabled),
          image_refine: status(workflow.image_refine),
          image_analysis: status(workflow.image_analysis),
          resource_sensing: status(workflow.resource_sensing),
          save_skill: status(workflow.save_skill),
        },
        human_review: workflow.human_review,
        note: "Disabled optional tools are disabled by user configuration, not because the tool is broken. Continue the required spine without placeholder context for disabled tools.",
      });
    },
  });

  pi.registerTool({
    name: "neuro_start_run",
    label: "Neuro Start Run",
    description: "Create a new NeuroScientist level-1 run at the required work_dir. The main agent must choose fallback paths such as results/default/{timestamp}. Returns run_id for all subsequent tools. Optionally pass question to persist the task text in state.json. Optionally pass deliverables to declare expected output artifacts (path/kind/role); if omitted, a default set (generated_code.py, figure.png, figure.pdf, statistics.json) is injected. code and statistics infrastructure artifacts are always ensured.",
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
      const run = await startRun(ctx.cwd, params.work_dir, params.deliverables, params.question);
      activeRunDir = run.runDir;
      try {
        const config = await loadConfig(ctx.cwd);
        if (level1WorkflowConfig(config).resource_sensing) {
          const profile = await detectResources(config);
          applyThreadEnvDefaults(profile);
          await updateState(run, { resource_profile: profile });
        }
      } catch {
        // resource sensing is best-effort; never block run creation
      }
      return content({
        ok: true,
        extension: "neuroscientist-level1",
        run_id: run.runId,
        run_dir: run.runDir,
        deliverables: run.state.deliverables,
        question: run.state.question,
        resource_profile: run.state.resource_profile,
      });
    },
  });

  pi.registerTool({
    name: "neuro_resume_run",
    label: "Neuro Resume Run",
    description: "Resume an existing NeuroScientist level-1 run without creating a new run. Reads run_id from work_dir/state.json. Optionally pass question to replace the persisted task text; the previous question is appended to question_history. After resuming, read state.json for full run status. Use for recovery/continuation or interactive follow-up on an existing work_dir.",
    parameters: Type.Object({
      work_dir: Type.String({ description: "Existing run directory to resume. Preserve explicit absolute paths." }),
      question: Type.Optional(Type.String({ description: "Updated research question or follow-up instruction to persist in state.json." })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const run = await resumeRun(ctx.cwd, params.work_dir, params.question);
      activeRunDir = run.runDir;
      try {
        await ensureResourceEnv(run, await loadConfig(ctx.cwd));
      } catch {
        // best-effort
      }
      return content({
        ok: true,
        extension: "neuroscientist-level1",
        run_id: run.runId,
        run_dir: run.runDir,
        question: run.state.question,
        state_path: run.statePath,
        resource_profile: run.state.resource_profile,
      });
    },
  });

  pi.registerTool({
    name: "neuro_approve_stage",
    label: "Neuro Approve Stage",
    description: "Record human approval for a Level-1 workflow stage gate. Use only after the user explicitly approves the stage output.",
    parameters: Type.Object({
      run_id: Type.String(),
      stage: Type.String({ description: "Stage name to approve, e.g. plan." }),
      notes: Type.Optional(Type.String({ description: "Optional short human approval note." })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const run = await resolveRun(ctx.cwd, params.run_id);
      const stage = normalizeReviewStage(params.stage);
      if (!stage) {
        return content({ ok: false, run_id: run.runId, error: "stage is required" });
      }
      const reviews = run.state.human_reviews || {};
      const previous = reviews[stage] || {};
      const nextEntry = {
        ...previous,
        status: "approved",
        approved_at: new Date().toISOString(),
        notes: params.notes || previous.notes || "",
      };
      await updateState(run, {
        human_reviews: {
          ...reviews,
          [stage]: nextEntry,
        },
      });
      await appendStateEntry(pi, { run_id: run.runId, event: "neuro_approve_stage", stage, ok: true });
      return content({
        ok: true,
        run_id: run.runId,
        stage,
        review: nextEntry,
        message: `Human review approved '${stage}'. Downstream gated tools may proceed.`,
      });
    },
  });

  pi.registerTool({
    name: "neuro_record_feedback",
    label: "Neuro Record Feedback",
    description: "Record human revision feedback for a Level-1 workflow stage gate. Use when the user rejects or modifies a stage output.",
    parameters: Type.Object({
      run_id: Type.String(),
      stage: Type.String({ description: "Stage name receiving feedback, e.g. plan." }),
      feedback: Type.String({ description: "Human feedback or requested changes." }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const run = await resolveRun(ctx.cwd, params.run_id);
      const stage = normalizeReviewStage(params.stage);
      const feedback = String(params.feedback || "").trim();
      if (!stage) {
        return content({ ok: false, run_id: run.runId, error: "stage is required" });
      }
      if (!feedback) {
        return content({ ok: false, run_id: run.runId, stage, error: "feedback is required" });
      }
      const reviews = run.state.human_reviews || {};
      const previous = reviews[stage] || {};
      const previousFeedback = Array.isArray(previous.feedback) ? previous.feedback : [];
      const nextEntry = {
        ...previous,
        status: "changes_requested",
        feedback: [...previousFeedback, { at: new Date().toISOString(), text: feedback }],
        updated_at: new Date().toISOString(),
      };
      delete nextEntry.approved_at;
      await updateState(run, {
        human_reviews: {
          ...reviews,
          [stage]: nextEntry,
        },
      });
      await appendStateEntry(pi, { run_id: run.runId, event: "neuro_record_feedback", stage, ok: true });
      return content({
        ok: true,
        run_id: run.runId,
        stage,
        review: nextEntry,
        message: `Recorded human feedback for '${stage}'. Rerun the relevant stage with this feedback before requesting approval again.`,
      });
    },
  });

  pi.registerTool({
    name: "resolve_targeted_skill",
    label: "Resolve Targeted Skill",
    description: "Resolve a NeuroScientist level-1 targeted skill via the existing Python SkillLoader/RAG flow.",
    parameters: Type.Object({
      question: Type.Optional(Type.String({ description: "Research question or task. Falls back to state.json question." })),
      run_id: Type.String(),
      root_dir: Type.Optional(Type.String()),
      skill_dir: Type.Optional(Type.String()),
      project_dir: Type.Optional(Type.String()),
      skill_enable: Type.Optional(Type.Boolean()),
      generate_skill_enable: Type.Optional(Type.Boolean()),
      model: Type.Optional(Type.String()),
      top_k: Type.Optional(Type.Number()),
      relevance_threshold: Type.Optional(Type.Number()),
      temperature: Type.Optional(Type.Number()),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const config = await loadConfig(ctx.cwd);
      const workflow = level1WorkflowConfig(config);
      const paths = config.paths || {};
      const targeted = config.modules?.targeted_skill || config.targeted_skill || {};
      const run = await resolveRun(ctx.cwd, params.run_id);
      if (!workflow.targeted_skill_match && !workflow.targeted_skill_generate) {
        return skippedByConfig(run.runId, "resolve_targeted_skill", "targeted_skill_match/targeted_skill_generate");
      }
      const question = resolveQuestion(run, params.question);
      const traceDir = join(run.runDir, "targeted_skill_trace");
      const projectDir = params.project_dir || paths.project_dir
        ? resolveFromCwd(ctx.cwd, params.project_dir || paths.project_dir, ".")
        : undefined;
      const rootDir = params.root_dir || paths.root_dir
        ? resolveFromCwd(ctx.cwd, params.root_dir || paths.root_dir, ".")
        : WORKFLOW_ROOT;
      const result = await runPython({
        ...targeted,
        ...params,
        question,
        skill_enable: true,
        match_skill_enable: workflow.targeted_skill_match,
        generate_skill_enable: workflow.targeted_skill_generate,
        ...(projectDir ? { project_dir: projectDir } : {}),
        root_dir: rootDir,
        trace_dir: traceDir,
      }, ctx.cwd, signal);

      const targetedSkillPath = join(run.runDir, "targeted_skill.md");
      if (result.targeted_skill) {
        await writeText(targetedSkillPath, result.targeted_skill);
      }
      await updateState(run, {
        targeted_skill: result.targeted_skill || "",
        targeted_skill_result: limitForMain(result),
      });
      await appendStateEntry(pi, {
        run_id: run.runId,
        event: "resolve_targeted_skill",
        ok: result.ok,
        matched: result.matched,
        source: result.source,
        trace_id: result.trace_id,
      });
      return content({ ...result, run_id: run.runId, targeted_skill_path: result.targeted_skill ? targetedSkillPath : undefined, trace_dir: traceDir });
    },
  });
  pi.registerTool({
    name: "neuro_deep_research",
    label: "Neuro Deep Research",
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
      const config = await loadConfig(ctx.cwd);
      const agentConfig = pickAgentConfig(config, "level1_deep_research");
      const ragConfig = agentConfig.rag || {};
      const run = await resolveRun(ctx.cwd, params.run_id);
      const workflow = level1WorkflowConfig(config);
      if (!workflow.deep_research) {
        return skippedByConfig(run.runId, "neuro_deep_research", "deep_research");
      }
      const question = resolveQuestion(run, params.question);
      const ragResult = await runPythonScript(join(WORKFLOW_ROOT, "internagent", "modules", "targeted_skill", "rag_paper.py"), {
        ...ragConfig,
        ...(ragConfig.base_url ? { rag_base_url: ragConfig.base_url } : {}),
        ...(ragConfig.timeout ? { rag_timeout: ragConfig.timeout } : {}),
        ...params,
        question,
      }, ctx.cwd, signal);
      await writeJson(join(run.runDir, "deep_research_sources.json"), ragResult);

      if (!ragResult.ok || !ragResult.sources?.length) {
        const contextText = "[Deep Research Background]\nPaper RAG returned no usable background evidence for this question.";
        const contextPath = join(run.runDir, "deep_research_context.md");
        const sourcesPath = join(run.runDir, "deep_research_sources.json");
        await writeText(contextPath, contextText);
        await updateState(run, {
          deep_research_context: contextText,
          deep_research_sources: ragResult.sources || [],
        });
        return content({
          ok: true,
          run_id: run.runId,
          rag_ok: ragResult.ok,
          source_count: 0,
          deep_research_context: contextText,
          context_path: contextPath,
          sources_path: sourcesPath,
          warnings: ragResult.warnings || [],
          rag_error: ragResult.error,
        });
      }

      const rolePrompt = await readPrompt("deep_research");
      const prompt = finalizationPrompt("deep research", "finalize_deep_research", rolePrompt, [
        `Question:\n${question}`,
        `Retrieved sources:\n${JSON.stringify(ragResult.sources, null, 2)}`,
        additionalContextBlock(params.additional_context),
        "Finalize with: { deep_research_context, summary, warnings }.",
      ].join("\n\n"));
      const sub = await runSubagent({
        runDir: run.runDir,
        agentName: "neuro_deep_research",
        finalizeTool: "finalize_deep_research",
        finalizeSchema: Type.Object({
          deep_research_context: Type.String(),
          summary: Type.String(),
          warnings: Type.Array(Type.String()),
        }),
        prompt,
        agentConfig,
        tools: [],
        signal,
      });
      if (sub.ok) {
        const contextPath = join(run.runDir, "deep_research_context.md");
        const sourcesPath = join(run.runDir, "deep_research_sources.json");
        await writeText(contextPath, sub.result.deep_research_context);
        await updateState(run, {
          deep_research_context: sub.result.deep_research_context,
          deep_research_sources: ragResult.sources,
          deep_research: {
            summary: sub.result.summary,
            warnings: sub.result.warnings,
          },
        });
      }
      await appendStateEntry(pi, { run_id: run.runId, event: "neuro_deep_research", ok: sub.ok, source_count: ragResult.sources.length });
      return content({
        run_id: run.runId,
        ok: sub.ok,
        result: sub.result ? {
          summary: sub.result.summary,
          warnings: sub.result.warnings,
          deep_research_context_preview: sub.result.deep_research_context?.slice(0, 1200),
        } : undefined,
        context_path: sub.ok ? join(run.runDir, "deep_research_context.md") : undefined,
        sources_path: join(run.runDir, "deep_research_sources.json"),
        output_path: sub.output_path,
        debug: { subagent_dir: sub.subagent_dir, snapshot_dir: sub.snapshot_dir },
        rag: {
          ok: ragResult.ok,
          source_count: ragResult.sources.length,
          warnings: ragResult.warnings || [],
        },
      });
    },
  });

  pi.registerTool({
    name: "neuro_plan",
    label: "Neuro Plan",
    description: "Run the isolated planning subagent and persist plan.md.",
    parameters: Type.Object({
      question: Type.Optional(Type.String({ description: "Research question or task. Falls back to state.json question." })),
      run_id: Type.String(),
      data_info: Type.Optional(Type.String()),
      extra_path_info: Type.Optional(Type.String()),
      targeted_skill: Type.Optional(Type.String()),
      deep_research_context: Type.Optional(Type.String()),
      additional_context: Type.Optional(Type.String()),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const config = await loadConfig(ctx.cwd);
      const run = await resolveRun(ctx.cwd, params.run_id);
      const question = resolveQuestion(run, params.question);
      const rolePrompt = await readPrompt("plan");
      const planHumanFeedback = humanFeedbackText(run, "plan");
      const prompt = finalizationPrompt("planner", "finalize_plan", rolePrompt, [
        `Question:\n${question}`,
        `Data info:\n${params.data_info || ""}`,
        `Extra path info:\n${params.extra_path_info || run.state.extra_path_info || ""}`,
        `Targeted skill:\n${params.targeted_skill || run.state.targeted_skill || ""}`,
        `Deep research context:\n${params.deep_research_context || run.state.deep_research_context || ""}`,
        run.state.resource_profile ? `Resource profile:\n${formatResourceProfile(run.state.resource_profile)}` : "",
        planHumanFeedback ? `Human review feedback for the plan:\n${planHumanFeedback}` : "",
        additionalContextBlock(params.additional_context),
        "Finalize with: { plan_markdown, summary, confidence, warnings }.",
      ].join("\n\n"));
      const sub = await runSubagent({
        runDir: run.runDir,
        agentName: "neuro_plan",
        finalizeTool: "finalize_plan",
        finalizeSchema: Type.Object({
          plan_markdown: Type.String(),
          summary: Type.String(),
          confidence: Type.Number(),
          warnings: Type.Array(Type.String()),
        }),
        prompt,
        agentConfig: pickAgentConfig(config, "level1_plan"),
        tools: [],
        signal,
      });
      if (sub.ok) {
        const planPath = join(run.runDir, "plan.md");
        await writeText(planPath, sub.result.plan_markdown);
        await updateState(run, {
          plan: sub.result,
          data_info: params.data_info || run.state.data_info || "",
          extra_path_info: params.extra_path_info || run.state.extra_path_info || "",
        });
      }
      await appendStateEntry(pi, { run_id: run.runId, event: "neuro_plan", ok: sub.ok });
      return content({
        run_id: run.runId,
        ok: sub.ok,
        error: sub.error,
        plan_path: sub.ok ? join(run.runDir, "plan.md") : undefined,
        output_path: sub.output_path,
        result: sub.result ? {
          summary: sub.result.summary,
          confidence: sub.result.confidence,
          warnings: sub.result.warnings,
        } : undefined,
        human_review: {
          required: humanGateEnabled(config, "plan"),
          approved: humanStageApproved(run, "plan"),
          feedback: planHumanFeedback,
        },
        debug: { subagent_dir: sub.subagent_dir, snapshot_dir: sub.snapshot_dir },
      });
    },
  });

  pi.registerTool({
    name: "neuro_code",
    label: "Neuro Code",
    description: "Run the isolated code subagent, persist generated artifacts, and apply deterministic checks.",
    parameters: Type.Object({
      question: Type.Optional(Type.String({ description: "Research question or task. Falls back to state.json question." })),
      run_id: Type.String(),
      plan: Type.Optional(Type.String()),
      data_info: Type.Optional(Type.String()),
      extra_path_info: Type.Optional(Type.String()),
      targeted_skill: Type.Optional(Type.String()),
      validation_feedback: Type.Optional(Type.String()),
      additional_context: Type.Optional(Type.String()),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const config = await loadConfig(ctx.cwd);
      const run = await resolveRun(ctx.cwd, params.run_id);
      if (humanGateEnabled(config, "plan") && !humanStageApproved(run, "plan")) {
        return blockedByHumanReview(run, "plan", "neuro_code");
      }
      const agentConfig = pickAgentConfig(config, "level1_code");
      const question = resolveQuestion(run, params.question);
      const rolePrompt = await readPrompt("code");
      const previousAttempt = Number(run.state.code_attempt || 0);
      const isRetry = Boolean(params.validation_feedback || run.state.code || previousAttempt > 0);
      const deliverables: Artifact[] = run.state.deliverables || DEFAULT_DELIVERABLES;
      const codeArtifacts = deliverables.filter(a => a.kind === "code");
      const mainCodePath = codeArtifacts[0]?.path || "generated_code.py";
      const statsArtifact = deliverables.find(a => a.kind === "statistics");
      const statsPath = statsArtifact?.path || "statistics.json";
      const currentArtifacts = stateArtifacts(run);
      const currentExecLog = currentArtifacts.find(a => a.name === "exec_log" || a.kind === "log")?.path || join(run.runDir, "exec.log");
      const currentFigure = currentArtifacts.find(a => a.kind === "figure" && isVisionImage(a.path));
      const existingArtifacts = {
        deliverables: deliverables.map(a => ({ ...a })),
        artifacts: currentArtifacts,
        exec_log: currentExecLog,
      };
      const retryContext = isRetry
        ? [
            "Retry context:",
            "This is a follow-up code attempt in the same run.",
            "Before changing code, inspect existing artifacts when present.",
            "Prefer patching the existing code files instead of rewriting from scratch, unless a full rewrite is clearly necessary.",
            "Use validation_feedback as the primary correction target when provided.",
            "Preserve correct parts of the previous implementation.",
            `Existing artifacts:\n${JSON.stringify(existingArtifacts, null, 2)}`,
          ].join("\n")
        : "";
      const codeVisionPath = agentConfig.vision === true ? currentFigure?.path || "" : "";
      const codeVision = codeVisionPath ? await loadVisionImages([codeVisionPath]) : { images: [], warnings: [] };
      const prompt = finalizationPrompt("coder", "finalize_code_result", rolePrompt, [
        `Question:\n${question}`,
        `Plan:\n${params.plan || run.state.plan?.plan_markdown || ""}`,
        `Data info:\n${params.data_info || run.state.data_info || ""}`,
        `Extra path info:\n${params.extra_path_info || run.state.extra_path_info || ""}`,
        `Targeted skill:\n${params.targeted_skill || run.state.targeted_skill || ""}`,
        `Deep research context:\n${run.state.deep_research_context || ""}`,
        run.state.resource_profile ? `Resource profile:\n${formatResourceProfile(run.state.resource_profile)}` : "",
        `Validation feedback:\n${params.validation_feedback || ""}`,
        `Deliverables (read-only contract; produce every file listed):\n${deliverablesToPromptText(deliverables)}`,
        additionalContextBlock(params.additional_context),
        retryContext,
        codeVision.warnings.length ? `Vision warnings:\n${codeVision.warnings.join("\n")}` : "",
        "Generate analysis code and only finalize with: { code_files, exec_log, statistics, artifacts, summary, warnings }. code_files must list every code artifact you wrote; each entry is { path, code }. artifacts must list every artifact you actually generated, with name/path/kind/role/description; each figure/data artifact must include produced_by pointing to the code artifact path that generated it. For every pdf figure, also produce a same-stem png.",
      ].join("\n\n"));
      const sub = await runSubagent({
        runDir: run.runDir,
        agentName: "neuro_code",
        finalizeTool: "finalize_code_result",
        finalizeSchema: Type.Object({
          code_files: Type.Array(Type.Object({
            path: Type.String(),
            code: Type.String(),
          })),
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
        prompt,
        agentConfig,
        tools: ["read", "write", "edit", "bash", "grep", "find", "ls"],
        images: codeVision.images,
        signal,
      });

      const returnedCodeText = [
        ...((Array.isArray(sub.result?.code_files) ? sub.result.code_files : []).map((entry: any) => entry?.code || "")),
      ].join("\n");
      let checks: Json = {
        dummy_data_signals: dummyDataSignals([returnedCodeText, sub.result?.exec_log || ""].join("\n")),
        statistics_warnings: statisticsWarnings(sub.result?.statistics, question),
      };
      const blocked = checks.dummy_data_signals.length > 0;
      let resultArtifacts: Artifact[] = [];
      if (sub.ok) {
        // Persist returned code content. Agents usually write files themselves;
        // this keeps finalize output and declared code artifacts in sync.
        const mainCodePhysicalPath = resolveArtifactPath(run.runDir, mainCodePath);
        const statsPhysicalPath = resolveArtifactPath(run.runDir, statsPath);
        const codeFiles = (Array.isArray(sub.result.code_files) ? sub.result.code_files : [])
          .filter((entry: any) => entry?.path && typeof entry.code === "string")
          .map((entry: any) => ({ path: String(entry.path), code: String(entry.code) }));
        const codeFilePaths = new Set<string>();
        for (const codeFile of codeFiles) {
          codeFilePaths.add(codeFile.path);
          await writeText(resolveArtifactPath(run.runDir, codeFile.path), codeFile.code);
        }
        await writeText(join(run.runDir, "exec.log"), sub.result.exec_log || "");
        await writeJson(statsPhysicalPath, sub.result.statistics || {});
        const declaredArtifacts = normalizeArtifacts(sub.result.artifacts || [], run.runDir);
        const codeArtifacts = codeFiles.map((codeFile: any, index: number) =>
          makeArtifact(run.runDir, index === 0 ? "generated_code" : `code_${index + 1}`, codeFile.path, "code", {
            role: index === 0 ? "analysis_script" : "support_script",
          })
        );
        resultArtifacts = mergeArtifacts([], [
          ...declaredArtifacts,
          ...codeArtifacts,
          makeArtifact(run.runDir, "exec_log", join(run.runDir, "exec.log"), "log"),
          makeArtifact(run.runDir, "statistics", statsPhysicalPath, "statistics"),
        ], run.runDir);
        if (!resultArtifacts.some(a => a.kind === "figure")) {
          resultArtifacts = mergeArtifacts(resultArtifacts, deliverables.filter(a => a.kind === "figure"), run.runDir);
        }
        checks = {
          ...checks,
          artifact_warnings: artifactExistenceWarnings(run.runDir, resultArtifacts),
        };
        await updateState(run, {
          code_attempt: previousAttempt + 1,
          code: {
            ...sub.result,
            code_files: codeFiles.map(({ path }) => ({ path })),
            artifacts: resultArtifacts,
          },
          checks,
          artifacts: resultArtifacts,
        });
        await snapshotRunArtifacts(run, `after_code_attempt_${previousAttempt + 1}`);
      }
      await appendStateEntry(pi, {
        run_id: run.runId,
        event: "neuro_code",
        ok: sub.ok,
        blocked_by_dummy_data: blocked,
        code_attempt: previousAttempt + 1,
      });
      return content({
        run_id: run.runId,
        ok: sub.ok,
        error: sub.error,
        result: sub.result ? {
          summary: sub.result.summary,
          warnings: sub.result.warnings,
          statistics: sub.result.statistics,
        } : undefined,
        artifacts: resultArtifacts,
        checks,
        blocked_by_dummy_data: blocked,
        code_attempt: previousAttempt + 1,
        output_path: sub.output_path,
        debug: { subagent_dir: sub.subagent_dir, snapshot_dir: sub.snapshot_dir },
      });
    },
  });

  pi.registerTool({
    name: "neuro_validate",
    label: "Neuro Validate",
    description: "Run the isolated semantics validator over actual vision figure artifacts and store validation.json. Pass figure_path to validate only one figure.",
    parameters: Type.Object({
      question: Type.Optional(Type.String({ description: "Research question or task. Falls back to state.json question." })),
      run_id: Type.String(),
      figure_path: Type.Optional(Type.String()),
      statistics: Type.Optional(Type.Any()),
      additional_context: Type.Optional(Type.String()),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const config = await loadConfig(ctx.cwd);
      const run = await resolveRun(ctx.cwd, params.run_id);
      const agentConfig = pickAgentConfig(config, "level1_validate");
      const question = resolveQuestion(run, params.question);
      let figures = figureArtifactsFromState(run);
      if (params.figure_path) {
        const requestedFigure = resolveArtifactPath(run.runDir, params.figure_path);
        figures = figures.filter(a => a.path === requestedFigure);
      }
      if (agentConfig.vision !== true) {
        return content({
          ok: false,
          run_id: run.runId,
          error: "configuration issue: neuro_validate requires vision=true. Report this to the user; do not edit config.yaml unless explicitly asked.",
          figure_paths: figures.map(a => a.path),
        });
      }
      if (!figures.length) {
        const legacy = params.figure_path || "";
        if (!legacy) return content({ ok: false, run_id: run.runId, error: "neuro_validate requires at least one actual vision figure artifact from neuro_code" });
        figures = [makeArtifact(run.runDir, "figure", legacy, "figure")];
      }
      const vision = await loadVisionImages(figures.map(a => a.path));
      if (!vision.images.length) {
        return content({ ok: false, run_id: run.runId, error: "failed to load validation images", warnings: vision.warnings });
      }
      const rolePrompt = await readPrompt("validate");
      const figuresText = figures.map((a, i) => `(${i + 1}) ${a.path}${a.role ? ` [${a.role}]` : ""}${a.description ? ` — ${a.description}` : ""}`).join("\n");
      const prompt = finalizationPrompt("validator", "finalize_validation", rolePrompt, [
        `Question:\n${question}`,
        `Figures (${figures.length}):\n${figuresText}`,
        `Plan:\n${run.state.plan?.plan_markdown || ""}`,
        `Deep research context:\n${run.state.deep_research_context || ""}`,
        `Statistics:\n${JSON.stringify(params.statistics || run.state.code?.statistics || {}, null, 2)}`,
        additionalContextBlock(params.additional_context),
        "Finalize with: { pass, per_figure, overall_mismatches, confidence, summary, next_code_feedback }. per_figure must have one entry per figure path with { path, pass, issues, next_code_feedback }.",
      ].join("\n\n"));
      const sub = await runSubagent({
        runDir: run.runDir,
        agentName: "neuro_validate",
        finalizeTool: "finalize_validation",
        finalizeSchema: Type.Object({
          pass: Type.Boolean(),
          per_figure: Type.Array(Type.Object({
            path: Type.String(),
            pass: Type.Boolean(),
            issues: Type.Array(Type.String()),
            next_code_feedback: Type.String(),
          })),
          overall_mismatches: Type.Array(Type.String()),
          confidence: Type.Number(),
          summary: Type.String(),
          next_code_feedback: Type.String(),
        }),
        prompt,
        agentConfig,
        tools: [],
        images: vision.images,
        signal,
      });
      if (sub.ok) {
        const validationPath = join(run.runDir, "validation.json");
        await writeJson(validationPath, sub.result);
        await updateState(run, { validation: sub.result, validations: sub.result.per_figure });
        await snapshotRunArtifacts(run, "after_validate");
      }
      await appendStateEntry(pi, { run_id: run.runId, event: "neuro_validate", ok: sub.ok, pass: sub.result?.pass });
      return content({
        run_id: run.runId,
        ok: sub.ok,
        error: sub.error,
        result: sub.result,
        validation_path: sub.ok ? join(run.runDir, "validation.json") : undefined,
        output_path: sub.output_path,
        debug: { subagent_dir: sub.subagent_dir, snapshot_dir: sub.snapshot_dir },
      });
    },
  });

  pi.registerTool({
    name: "neuro_refine_image",
    label: "Neuro Refine Image",
    description: "Run the isolated image refinement subagent; outer loop stays in this extension/tool boundary.",
    parameters: Type.Object({
      question: Type.Optional(Type.String({ description: "Research question or task. Falls back to state.json question." })),
      run_id: Type.String(),
      figure_path: Type.String(),
      feedback: Type.Optional(Type.String()),
      additional_context: Type.Optional(Type.String()),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const config = await loadConfig(ctx.cwd);
      const run = await resolveRun(ctx.cwd, params.run_id);
      const agentConfig = pickAgentConfig(config, "level1_refine_image");
      const question = resolveQuestion(run, params.question);
      const workflow = level1WorkflowConfig(config);
      if (!workflow.image_refine) {
        return skippedByConfig(run.runId, "neuro_refine_image", "image_refine");
      }
      if (agentConfig.vision !== true) {
        return content({
          ok: false,
          run_id: run.runId,
          error: "configuration issue: neuro_refine_image requires vision=true. Report this to the user; do not edit config.yaml unless explicitly asked.",
          figure_path: params.figure_path,
        });
      }
      const figurePath = resolveArtifactPath(run.runDir, params.figure_path);
      const vision = await loadVisionImages([figurePath]);
      if (!vision.images.length) {
        return content({ ok: false, run_id: run.runId, error: "failed to load refinement image", warnings: vision.warnings });
      }
      const rolePrompt = await readPrompt("image_refine");
      const allFigures = figureArtifactsFromState(run);
      const idx = allFigures.findIndex(a => a.path === figurePath);
      const otherFigures = allFigures.filter((_, i) => i !== idx).map(a => a.path);
      const multiFigureContext = allFigures.length > 1
        ? `Multi-figure context: 本次共生成 ${allFigures.length} 张图。你只改进第 ${(idx < 0 ? 0 : idx) + 1} 张：${params.figure_path}。其它图：${otherFigures.join(", ")}。跨图综合由下游完成。`
        : "";
      const { codePath, ambiguous } = resolveCodePathForFigure(run.runDir, stateArtifacts(run), figurePath);
      const codePathNote = ambiguous
        ? `生成此图的代码可能在以下脚本中之一：${codePath}。请 read 后自行判断归属，只修改生成 ${params.figure_path} 的那个脚本。`
        : `生成此图的代码在：${codePath}`;
      const prompt = finalizationPrompt("image refiner", "finalize_refinement", rolePrompt, [
        `Question:\n${question}`,
        `Figure path:\n${params.figure_path}`,
        multiFigureContext,
        codePathNote,
        `Feedback:\n${params.feedback || ""}`,
        additionalContextBlock(params.additional_context),
        "用 read 读取上述代码，定位生成此图的段并修改，用 bash 重跑该脚本。重跑会更新该脚本产出的所有图，这是正常的；只关注目标 figure 是否按 feedback 改善。原地覆盖 figure_path，不要新存 figure_refine.png。",
        "Finalize with: { refined_code_patch, refined_figure_path, summary, remaining_issues, stop }. refined_figure_path 应等于原 figure_path。",
      ].join("\n\n"));
      const sub = await runSubagent({
        runDir: run.runDir,
        agentName: "neuro_refine_image",
        finalizeTool: "finalize_refinement",
        finalizeSchema: Type.Object({
          refined_code_patch: Type.String(),
          refined_figure_path: Type.Optional(Type.String()),
          summary: Type.String(),
          remaining_issues: Type.Array(Type.String()),
          stop: Type.Boolean(),
        }),
        prompt,
        agentConfig,
        tools: ["read", "write", "edit", "bash", "grep", "find", "ls"],
        images: vision.images,
        signal,
      });
      if (sub.ok) {
        await updateState(run, { refinement: sub.result });
        await snapshotRunArtifacts(run, "after_refine");
      }
      await appendStateEntry(pi, { run_id: run.runId, event: "neuro_refine_image", ok: sub.ok });
      return content({
        run_id: run.runId,
        ok: sub.ok,
        error: sub.error,
        result: sub.result,
        refined_figure_path: sub.ok ? sub.result.refined_figure_path || figurePath : undefined,
        output_path: sub.output_path,
        debug: { subagent_dir: sub.subagent_dir, snapshot_dir: sub.snapshot_dir },
      });
    },
  });

  pi.registerTool({
    name: "neuro_analyze_image",
    label: "Neuro Analyze Image",
    description: "Run the isolated image analysis subagent and store image analysis text.",
    parameters: Type.Object({
      question: Type.Optional(Type.String({ description: "Research question or task. Falls back to state.json question." })),
      run_id: Type.String(),
      figure_path: Type.String(),
      additional_context: Type.Optional(Type.String()),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const config = await loadConfig(ctx.cwd);
      const run = await resolveRun(ctx.cwd, params.run_id);
      const agentConfig = pickAgentConfig(config, "level1_analyze_image");
      const question = resolveQuestion(run, params.question);
      const workflow = level1WorkflowConfig(config);
      if (!workflow.image_analysis) {
        return skippedByConfig(run.runId, "neuro_analyze_image", "image_analysis");
      }
      if (agentConfig.vision !== true) {
        return content({
          ok: false,
          run_id: run.runId,
          error: "configuration issue: neuro_analyze_image requires vision=true. Report this to the user; do not edit config.yaml unless explicitly asked.",
          figure_path: params.figure_path,
        });
      }
      const figurePath = resolveArtifactPath(run.runDir, params.figure_path);
      const vision = await loadVisionImages([figurePath]);
      if (!vision.images.length) {
        return content({ ok: false, run_id: run.runId, error: "failed to load image analysis image", warnings: vision.warnings });
      }
      const rolePrompt = await readPrompt("image_analysis");
      const allFigures = figureArtifactsFromState(run);
      const idx = allFigures.findIndex(a => a.path === figurePath);
      const otherFigures = allFigures.filter((_, i) => i !== idx).map(a => a.path);
      const multiFigureContext = allFigures.length > 1
        ? `Multi-figure context: 本次共生成 ${allFigures.length} 张图。你负责的是第 ${(idx < 0 ? 0 : idx) + 1} 张：${params.figure_path}。其它图：${otherFigures.join(", ")}。你只解读这一张；跨图综合由下游 conclude agent 完成，不要尝试综合其它图。`
        : "";
      const prompt = finalizationPrompt("image analyzer", "finalize_image_analysis", rolePrompt, [
        `Question:\n${question}`,
        `Figure path:\n${params.figure_path}`,
        multiFigureContext,
        additionalContextBlock(params.additional_context),
        "Finalize with: { image_analysis_text, image_quality, image_issues, summary }.",
      ].join("\n\n"));
      const sub = await runSubagent({
        runDir: run.runDir,
        agentName: "neuro_analyze_image",
        finalizeTool: "finalize_image_analysis",
        finalizeSchema: Type.Object({
          image_analysis_text: Type.String(),
          image_quality: Type.String(),
          image_issues: Type.Array(Type.String()),
          summary: Type.String(),
        }),
        prompt,
        agentConfig,
        tools: [],
        images: vision.images,
        signal,
      });
      if (sub.ok) {
        const analysisDir = join(run.runDir, "image_analyses");
        await mkdir(analysisDir, { recursive: true });
        const baseName = basename(params.figure_path).replace(/\.[^.]+$/, "");
        const analysisMdPath = join(analysisDir, `${baseName}.md`);
        await writeText(analysisMdPath, sub.result.image_analysis_text);
        const entry = { path: figurePath, ...sub.result };
        const prevList: any[] = Array.isArray(run.state.image_analyses) ? run.state.image_analyses : [];
        const nextList = [...prevList.filter(e => e?.path !== params.figure_path), entry];
        // Backward-compatible single-figure field: prefer the main figure's analysis.
        const mainFigure = allFigures.find(a => a.role === "main") || allFigures[0];
        const mainEntry = mainFigure ? nextList.find(e => e.path === mainFigure.path) : nextList[0];
        await updateState(run, {
          image_analysis: mainEntry || entry,
          image_analyses: nextList,
        });
      }
      await appendStateEntry(pi, { run_id: run.runId, event: "neuro_analyze_image", ok: sub.ok, figure_path: params.figure_path });
      return content({
        run_id: run.runId,
        ok: sub.ok,
        error: sub.error,
        image_analysis_path: sub.ok ? join(run.runDir, "image_analyses", `${basename(params.figure_path).replace(/\.[^.]+$/, "")}.md`) : undefined,
        output_path: sub.output_path,
        result: sub.result ? {
          image_quality: sub.result.image_quality,
          image_issues: sub.result.image_issues,
          summary: sub.result.summary,
        } : undefined,
        debug: { subagent_dir: sub.subagent_dir, snapshot_dir: sub.snapshot_dir },
      });
    },
  });

  pi.registerTool({
    name: "neuro_conclude",
    label: "Neuro Conclude",
    description: "Run the isolated conclusion subagent and store conclusions.json.",
    parameters: Type.Object({
      question: Type.Optional(Type.String({ description: "Research question or task. Falls back to state.json question." })),
      run_id: Type.String(),
      validation: Type.Optional(Type.Any()),
      validations: Type.Optional(Type.Any()),
      statistics: Type.Optional(Type.Any()),
      image_analysis: Type.Optional(Type.String()),
      image_analyses: Type.Optional(Type.Any()),
      additional_context: Type.Optional(Type.String()),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const config = await loadConfig(ctx.cwd);
      const run = await resolveRun(ctx.cwd, params.run_id);
      const question = resolveQuestion(run, params.question);
      const dummyDataSignals = run.state.checks?.dummy_data_signals || [];
      const dataIntegrityWarning = dummyDataSignals.length
        ? [
            "DATA INTEGRITY WARNING:",
            "The generated code or execution log contains dummy/synthetic data signals.",
            `Signals: ${JSON.stringify(dummyDataSignals)}`,
            "You must explicitly state this limitation in the final limitations.",
            "Do not present conclusions as validated empirical findings unless the limitation is resolved.",
          ].join("\n")
        : "";
      const rolePrompt = await readPrompt("conclude");
      const paramImageAnalyses = Array.isArray(params.image_analyses) ? params.image_analyses : [];
      const imageAnalyses: any[] = paramImageAnalyses.length
        ? paramImageAnalyses
        : Array.isArray(run.state.image_analyses) && run.state.image_analyses.length
        ? run.state.image_analyses
        : (run.state.image_analysis ? [{ path: figureArtifactsFromState(run)[0]?.path || "", ...run.state.image_analysis }] : []);
      const imageAnalysesText = imageAnalyses.map((e, i) => {
        const head = e.path ? `### Figure ${i + 1}: ${e.path}` : `### Figure ${i + 1}`;
        return `${head}\n${e.image_analysis_text || e.summary || ""}`;
      }).join("\n\n");
      const dataArtifacts = artifactsByKind(run, "data");
      const dataArtifactsText = dataArtifacts.length
        ? dataArtifacts.map(a => `- ${a.path}${a.description ? ` — ${a.description}` : ""}`).join("\n")
        : "";
      const prompt = finalizationPrompt("conclusion", "finalize_conclusion", rolePrompt, [
        `Question:\n${question}`,
        `Validation:\n${JSON.stringify(params.validations || params.validation || run.state.validation || {}, null, 2)}`,
        `Statistics:\n${JSON.stringify(params.statistics || run.state.code?.statistics || {}, null, 2)}`,
        `Image analyses (${imageAnalyses.length}):\n${imageAnalysesText}`,
        dataArtifactsText ? `Data artifacts:\n${dataArtifactsText}` : "",
        `Deep research context:\n${run.state.deep_research_context || ""}`,
        dataIntegrityWarning,
        additionalContextBlock(params.additional_context),
        "Finalize with: { conclusions, summary, limitations, confidence }. 跨图综合是你的职责。",
      ].join("\n\n"));
      const sub = await runSubagent({
        runDir: run.runDir,
        agentName: "neuro_conclude",
        finalizeTool: "finalize_conclusion",
        finalizeSchema: Type.Object({
          conclusions: Type.Array(Type.String()),
          summary: Type.String(),
          limitations: Type.Array(Type.String()),
          confidence: Type.Number(),
        }),
        prompt,
        agentConfig: pickAgentConfig(config, "level1_conclude"),
        tools: [],
        signal,
      });
      if (sub.ok) {
        const conclusionsPath = join(run.runDir, "conclusions.json");
        await writeJson(conclusionsPath, sub.result);
        await updateState(run, {
          conclusions: sub.result,
          conclusion_warnings: {
            dummy_data_limited: dummyDataSignals.length > 0,
            dummy_data_signals: dummyDataSignals,
          },
        });
        await snapshotRunArtifacts(run, "after_conclude");
      }
      await appendStateEntry(pi, {
        run_id: run.runId,
        event: "neuro_conclude",
        ok: sub.ok,
        dummy_data_limited: dummyDataSignals.length > 0,
      });
      return content({
        run_id: run.runId,
        ok: sub.ok,
        error: sub.error,
        result: sub.result,
        conclusions_path: sub.ok ? join(run.runDir, "conclusions.json") : undefined,
        output_path: sub.output_path,
        warnings: {
          dummy_data_limited: dummyDataSignals.length > 0,
          dummy_data_signals: dummyDataSignals,
        },
        debug: { subagent_dir: sub.subagent_dir, snapshot_dir: sub.snapshot_dir },
      });
    },
  });
}

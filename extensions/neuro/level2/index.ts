// @ts-nocheck
// NeuroScientist level-2 Pi extension.
//
// Level-2 = explore: given a paper-level scientific goal + background + main
// question + dataset meta, decompose into subquestions, generate analysis plans
// per subquestion, execute each plan via the full level-1 pipeline (spawned as
// an isolated subprocess through the level-1 workflow), then aggregate subquestion
// conclusions and a final paper report.
//
// Level-2 does NOT share tools with level-1. The only coupling is the
// isolated level-1 workflow CLI contract (--query/--dataset/--work_dir/--path) and the
// artifacts it writes under the per-plan work_dir (conclusions.json, state.json,
// figure.*, statistics artifact declared in state.json).

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { appendFile, copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, relative, resolve } from "node:path";

type Json = Record<string, any>;

const AGENT_CONFIG_SCRIPT = "internagent/workflow/agent_config.py";

const EXTENSION_DIR = dirname(new URL(import.meta.url).pathname);
const PROMPT_DIR = join(EXTENSION_DIR, "prompts");
const BAKED_CONFIG_FILE = join(EXTENSION_DIR, "config.json");
const CONFIG_FILE = "config.yaml";
const RUN_INDEX_FILE = ".pi/neuroscientist-level2/run_index.json";

let mergedConfig: Json = {};

const USAGE_SUMMARY_DEBOUNCE_MS = 300;
const usageSummaryTimers = new Map<string, ReturnType<typeof setTimeout>>();
let sharedCodingSdk: any;
let sharedAuthStorage: any;
let sharedModelRegistry: any;
let sharedAiSdk: any;


function debugDiskWritesEnabled(): boolean {
  return mergedConfig.workflow?.debug_disk_writes === true;
}

// Level-2 workflow flags. Mirrors level1WorkflowConfig (extensions/neuro/level1
// /index.ts): default-ON via `!== false`, except report_review which is opt-in.
function level2WorkflowConfig(config: Json) {
  const c = config.workflow?.level2 || {};
  return {
    paper_report_vision: c.paper_report_vision !== false,
    report_lint: c.report_lint !== false,
    report_review: c.report_review === true,
    export_docx: c.export_docx !== false,
    export_pdf: c.export_pdf !== false,
  };
}

function skippedByConfigL2(runId: string | undefined, tool: string, key: string) {
  return content({
    ok: true,
    skipped: true,
    skipped_by_config: true,
    reason: "disabled_by_user_config",
    message: `${tool} is disabled by user configuration workflow.level2.${key}; this is not a tool failure.`,
    run_id: runId,
    config_key: `workflow.level2.${key}`,
  });
}

async function syncWorkflowWritePolicy(cwd: string) {
  mergedConfig = await loadConfig(cwd);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function content(details: Json, text?: string) {
  return {
    content: [{ type: "text", text: text ?? JSON.stringify(details, null, 2) }],
    details,
  };
}

// Vision image helpers — mirror of extensions/neuro/level1/index.ts so the
// paper-report subagent can be shown the figures it references.
function imageMediaType(path: string) {
  const suffix = extname(path).toLowerCase();
  if (suffix === ".jpg" || suffix === ".jpeg") return "image/jpeg";
  if (suffix === ".webp") return "image/webp";
  return "image/png";
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

// Bounded selection of figure images to attach to the report subagent. Keeps the
// catalog order (sq -> plan -> F) so the attached-image index maps to Figure N.
const MAX_REPORT_VISION_IMAGES = 12;

function selectReportVisionFigures(figureCatalog: any[], cap = MAX_REPORT_VISION_IMAGES) {
  const seen = new Set<string>();
  const selected: { figure_id: string; figure_number: number; absolute_path: string }[] = [];
  for (const entry of figureCatalog || []) {
    const abs = entry?.absolute_path;
    if (!abs || seen.has(abs) || !existsSync(abs)) continue;
    seen.add(abs);
    selected.push({
      figure_id: entry.figure_id,
      figure_number: entry.figure_number,
      absolute_path: abs,
    });
    if (selected.length >= cap) break;
  }
  return selected;
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

function numberValue(value: any) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
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

function scheduleUsageSummary(runDir: string) {
  if (!debugDiskWritesEnabled()) return;
  const existing = usageSummaryTimers.get(runDir);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    usageSummaryTimers.delete(runDir);
    writeUsageSummary(runDir).catch(() => {
      // Usage accounting must never break the workflow.
    });
  }, USAGE_SUMMARY_DEBOUNCE_MS);
  usageSummaryTimers.set(runDir, timer);
}

async function flushUsageSummaries() {
  const runDirs = [...usageSummaryTimers.keys()];
  for (const runDir of runDirs) {
    const timer = usageSummaryTimers.get(runDir);
    if (timer) clearTimeout(timer);
    usageSummaryTimers.delete(runDir);
    try {
      await writeUsageSummary(runDir);
    } catch {
      // Usage accounting must never break the workflow.
    }
  }
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

function level1UsageComponentName(subquestionIndex: number, planIndex: number) {
  return `level1_sq${subquestionIndex}_p${planIndex}`;
}

async function ingestLevel1Usage(
  l2RunDir: string,
  planDir: string,
  subquestionIndex: number,
  planIndex: number,
) {
  const summaryPath = join(planDir, "usage", "summary.json");
  let summary: Json;
  try {
    summary = JSON.parse(await readFile(summaryPath, "utf8"));
  } catch {
    return;
  }
  const tokens = summary.tokens || {};
  await tryAppendUsageEntry(l2RunDir, level1UsageComponentName(subquestionIndex, planIndex), {
    timestamp: new Date().toISOString(),
    component: level1UsageComponentName(subquestionIndex, planIndex),
    source: "level1_subprocess",
    subquestion_index: subquestionIndex,
    plan_index: planIndex,
    plan_work_dir: planDir,
    child_summary_path: summaryPath,
    child_component_count: summary.component_count,
    child_entry_count: summary.entry_count,
    tokens: {
      input: numberValue(tokens.input),
      output: numberValue(tokens.output),
      cacheRead: numberValue(tokens.cacheRead),
      cacheWrite: numberValue(tokens.cacheWrite),
      total: numberValue(tokens.total),
    },
    cache_tokens: numberValue(summary.cache_tokens),
    cache_rate: numberValue(summary.cache_rate),
    cost: numberValue(summary.cost),
    child_components: summary.components,
  });
}

function inferArtifactKind(name: string, path: string) {
  const lowerName = name.toLowerCase();
  const suffix = path.split(".").pop()?.toLowerCase() || "";
  if (lowerName.includes("statistics")) return "statistics";
  if (lowerName.includes("code") || ["py", "r", "jl"].includes(suffix)) return "code";
  if (lowerName.includes("log") || suffix === "log") return "log";
  if (suffix === "md") return "markdown";
  if (suffix === "json") return "json";
  if (["png", "jpg", "jpeg", "webp", "gif", "pdf"].includes(suffix)) return "figure";
  if (["csv", "tsv", "xlsx", "xls", "parquet", "feather", "npy", "npz"].includes(suffix)) return "data";
  return "other";
}

function normalizeArtifact(raw: any, runDir: string) {
  if (!raw || typeof raw !== "object" || !raw.path) return undefined;
  const path = resolve(runDir, String(raw.path));
  const kind = raw.kind ? String(raw.kind) : inferArtifactKind(String(raw.name || ""), String(raw.path));
  return {
    name: raw.name ? String(raw.name) : `${kind}_${basename(path).replace(/\.[^.]+$/, "") || "artifact"}`,
    path,
    kind,
    role: raw.role ? String(raw.role) : undefined,
    description: raw.description ? String(raw.description) : undefined,
    produced_by: raw.produced_by ? resolve(runDir, String(raw.produced_by)) : undefined,
    content: typeof raw.content === "string" ? raw.content : undefined,
  };
}

function legacyArtifactsFromMap(map: Json, runDir: string) {
  const artifacts = [];
  for (const [name, value] of Object.entries(map || {})) {
    if (typeof value !== "string" || !value) continue;
    const item = normalizeArtifact({ name, path: value, kind: inferArtifactKind(name, value) }, runDir);
    if (item) artifacts.push(item);
  }
  return artifacts;
}

function normalizeArtifacts(input: any, runDir: string) {
  if (Array.isArray(input)) return input.map((raw) => normalizeArtifact(raw, runDir)).filter(Boolean);
  if (input && typeof input === "object") return legacyArtifactsFromMap(input, runDir);
  return [];
}

function mergeArtifacts(existing: any, incoming: any, runDir: string) {
  const byPath = new Map();
  for (const item of normalizeArtifacts(existing, runDir)) byPath.set(item.path, item);
  for (const item of normalizeArtifacts(incoming, runDir)) byPath.set(item.path, { ...byPath.get(item.path), ...item });
  return Array.from(byPath.values());
}

function makeArtifact(runDir: string, name: string, path: string, kind: string, extra: Json = {}) {
  return normalizeArtifact({ name, path, kind, ...extra }, runDir);
}

async function readJson(path: string, fallback: Json = {}) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return fallback;
  }
}

async function readOptionalText(path: string, maxChars = 4000) {
  try {
    return (await readFile(path, "utf8")).slice(0, maxChars);
  } catch {
    return "";
  }
}

async function readPrompt(name: string) {
  return await readFile(join(PROMPT_DIR, `${name}.md`), "utf8");
}

async function writeJson(path: string, value: Json) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(value, null, 2), "utf8");
}

async function writeText(path: string, value: string) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, value, "utf8");
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
  const scriptPath = resolve(cwd, AGENT_CONFIG_SCRIPT);
  const configPath = resolve(cwd, CONFIG_FILE);
  return await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn("python3", [scriptPath, "merged", configPath], { cwd });
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
    return await loadMergedConfigFromPython(cwd);
  } catch {
    return JSON.parse(await readFile(BAKED_CONFIG_FILE, "utf8"));
  }
}

// Spawn a python3 helper that prints one JSON object to stdout. Mirrors the
// spawnLevel1 lifecycle (stderr tail, timeout -> SIGTERM -> SIGKILL, AbortSignal)
// and the loadMergedConfigFromPython stdout-capture pattern.
async function spawnPythonJson(
  rootDir: string,
  scriptRel: string,
  scriptArgs: string[],
  opts: { cwd?: string; timeoutSeconds?: number; signal?: AbortSignal } = {},
): Promise<{ ok: boolean; json?: Json; stderr: string; exitCode: number | null; error?: string }> {
  const scriptPath = resolve(rootDir, scriptRel);
  return await new Promise((resolvePromise) => {
    const child = spawn("python3", [scriptPath, ...scriptArgs], {
      cwd: opts.cwd || rootDir,
      env: { ...process.env, PI_CODING_AGENT_DIR: process.env.PI_CODING_AGENT_DIR || join(rootDir, ".pi", "agent") },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let done = false;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    let killHandle: ReturnType<typeof setTimeout> | undefined;
    const finish = (result: { ok: boolean; json?: Json; stderr: string; exitCode: number | null; error?: string }) => {
      if (done) return;
      done = true;
      if (timeoutHandle) clearTimeout(timeoutHandle);
      if (killHandle) clearTimeout(killHandle);
      if (opts.signal) opts.signal.removeEventListener("abort", onAbort);
      resolvePromise(result);
    };
    const onAbort = () => {
      try { child.kill("SIGTERM"); } catch { /* ignore */ }
      finish({ ok: false, stderr, exitCode: null, error: "aborted by caller" });
    };
    child.stdout.on("data", (chunk) => { stdout += String(chunk); });
    child.stderr.on("data", (chunk) => { stderr = (stderr + String(chunk)).slice(-12000); });
    child.on("error", (error) => finish({ ok: false, stderr, exitCode: null, error: String(error) }));
    child.on("close", (code) => {
      if (code !== 0) { finish({ ok: false, stderr, exitCode: code, error: `python3 ${scriptRel} exited ${code}` }); return; }
      try { finish({ ok: true, json: JSON.parse(stdout), stderr, exitCode: code }); }
      catch (error) { finish({ ok: false, stderr, exitCode: code, error: `could not parse helper JSON: ${String(error)}` }); }
    });
    const timeoutSeconds = Number(opts.timeoutSeconds || 0);
    if (timeoutSeconds > 0) {
      timeoutHandle = setTimeout(() => {
        try { child.kill("SIGTERM"); } catch { /* ignore */ }
        killHandle = setTimeout(() => { try { child.kill("SIGKILL"); } catch { /* ignore */ } }, 10000);
        finish({ ok: false, stderr, exitCode: null, error: `python3 ${scriptRel} timed out after ${timeoutSeconds}s` });
      }, timeoutSeconds * 1000);
    }
    if (opts.signal) {
      if (opts.signal.aborted) onAbort();
      else opts.signal.addEventListener("abort", onAbort, { once: true });
    }
  });
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

function pickMainAgentConfig(config: Json, level: 1 | 2) {
  const agentName = level === 1 ? "level1" : "level2";
  return config.agents?.[agentName] || {};
}

function agentTimeoutSeconds(agentConfig: Json) {
  const value = Number(agentConfig?.timeout_seconds || 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

async function getSharedCodingSdk() {
  if (sharedCodingSdk) {
    return { sdk: sharedCodingSdk, authStorage: sharedAuthStorage, modelRegistry: sharedModelRegistry };
  }
  const cwd = process.cwd();
  sharedCodingSdk = await import("@earendil-works/pi-coding-agent");
  const agentDir = process.env.PI_CODING_AGENT_DIR || resolve(cwd, ".pi", "agent");
  sharedAuthStorage = sharedCodingSdk.AuthStorage?.create?.(join(agentDir, "auth.json"));
  sharedModelRegistry = sharedCodingSdk.ModelRegistry?.create?.(sharedAuthStorage, join(agentDir, "models.json"));
  return { sdk: sharedCodingSdk, authStorage: sharedAuthStorage, modelRegistry: sharedModelRegistry };
}

async function getSharedAiSdk() {
  if (!sharedAiSdk) sharedAiSdk = await import("@earendil-works/pi-ai");
  return sharedAiSdk;
}

async function resolveModel(agentConfig: Json) {
  if (!agentConfig.provider || !agentConfig.model) return {};
  try {
    const { modelRegistry } = await getSharedCodingSdk();
    const customModel = modelRegistry?.find?.(agentConfig.provider, agentConfig.model);
    if (customModel) return { model: customModel };
  } catch {
    // Fall through to built-in model lookup.
  }
  try {
    const ai = await getSharedAiSdk();
    const model = (ai as any).getModel?.(agentConfig.provider, agentConfig.model);
    return model ? { model } : {};
  } catch {
    return {};
  }
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

// ---------------------------------------------------------------------------
// Run state
// ---------------------------------------------------------------------------

type RunContext = {
  runId: string;
  runDir: string;
  statePath: string;
  state: Json;
};

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

async function startRun(cwd: string, workDir: string): Promise<RunContext> {
  const runDir = resolve(cwd, workDir);
  const runId = `l2-${shortTimestamp()}-${basename(runDir)}`;
  await mkdir(join(runDir, "subagents"), { recursive: true });
  const statePath = join(runDir, "state.json");
  const existing = await readJson(statePath, {});
  const state = {
    ...existing,
    run_id: runId,
    created_at: existing.created_at || new Date().toISOString(),
    artifacts: normalizeArtifacts(existing.artifacts || [], runDir),
  };
  await writeJson(statePath, state);
  await writeRunIndex(cwd, runId, runDir);
  return { runId, runDir, statePath, state };
}

async function resolveRun(cwd: string, requestedRunId?: string): Promise<RunContext> {
  if (!requestedRunId) {
    throw new Error("run_id is required. Call neuro_l2_start_run first, then pass the returned run_id to this tool.");
  }
  const index = await readJson(resolve(cwd, RUN_INDEX_FILE), { runs: {} });
  const entry = index.runs?.[requestedRunId];
  if (!entry?.run_dir) {
    throw new Error(`Unknown run_id '${requestedRunId}'. Call neuro_l2_start_run first or use the run_id returned by it.`);
  }
  const runDir = entry.run_dir;
  await mkdir(join(runDir, "subagents"), { recursive: true });
  const statePath = join(runDir, "state.json");
  const existing = await readJson(statePath, {});
  const state = {
    ...existing,
    artifacts: normalizeArtifacts(existing.artifacts || [], runDir),
  };
  return { runId: requestedRunId, runDir, statePath, state };
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

async function appendStateEntry(pi: ExtensionAPI, event: Json) {
  try {
    await pi.appendEntry("neuroscientist-level2-state", event);
  } catch {
    // best-effort
  }
}

// ---------------------------------------------------------------------------
// Subagent runner (text-only LLM agents for the explore layer)
// ---------------------------------------------------------------------------

function finalizationPrompt(agentName: string, finalizeTool: string, rolePrompt: string, body: string) {
  return [
    rolePrompt.trim(),
    "",
    `You are the isolated NeuroScientist level-2 ${agentName} subagent.`,
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

function deriveMethodReviewPass(review: Json) {
  const decision = String(review?.decision || "").trim().toLowerCase();
  return decision === "accept" || decision === "weak accept";
}

function deriveSubquestionReviewPass(review: Json) {
  const decision = String(review?.decision || "").trim().toLowerCase();
  if (decision === "accept" || decision === "weak accept") return true;
  return Boolean(review?.final_feedback?.is_acceptable);
}

function subquestionReviewFeedback(review: Json) {
  const finalFeedback = review?.final_feedback || {};
  const parts = [
    ...(Array.isArray(finalFeedback.required_improvements_if_not_accepted)
      ? finalFeedback.required_improvements_if_not_accepted
      : []),
    ...(Array.isArray(review?.improvement_suggestions) ? review.improvement_suggestions : []),
    ...(Array.isArray(review?.missing_aspects) ? review.missing_aspects : []),
    ...(Array.isArray(review?.weaknesses) ? review.weaknesses : []),
  ].map((item) => String(item).trim()).filter(Boolean);
  return parts.length ? parts.join("\n") : String(review?.summary || finalFeedback.acceptance_reason || "").trim();
}

function methodReviewFeedback(review: Json) {
  const parts = [
    ...(Array.isArray(review?.recommended_revisions) ? review.recommended_revisions : []),
    ...(Array.isArray(review?.missing_analyses) ? review.missing_analyses : []),
    ...(Array.isArray(review?.major_weaknesses) ? review.major_weaknesses : []),
  ].map((item) => String(item).trim()).filter(Boolean);
  return parts.length ? parts.join("\n") : String(review?.final_assessment || "").trim();
}

function subquestionIndexFor(run: RunContext, subquestion: string, explicitIndex?: any) {
  const numeric = Number(explicitIndex);
  if (Number.isInteger(numeric) && numeric > 0) return numeric;
  const target = String(subquestion || "").trim();
  const subquestions = Array.isArray(run.state.subquestions) ? run.state.subquestions : [];
  const found = subquestions.findIndex((item: any) => String(item || "").trim() === target);
  if (found >= 0) return found + 1;
  return Math.max(1, subquestions.length + 1);
}

function subquestionAgentName(index: number, role: string) {
  return `sq${String(index).padStart(2, "0")}_${role}`;
}

async function updateSubquestionWorkflow(run: RunContext, index: number, subquestion: string, patch: Json) {
  const latest = await readJson(run.statePath, run.state);
  run.state = {
    ...latest,
    artifacts: normalizeArtifacts(latest.artifacts || [], run.runDir),
  };
  const workflows = Array.isArray(run.state.subquestion_workflows)
    ? [...run.state.subquestion_workflows]
    : [];
  const existingIndex = workflows.findIndex((item: Json) =>
    Number(item?.subquestion_index) === index
    || (subquestion && String(item?.subquestion || "").trim() === String(subquestion).trim())
  );
  const previous = existingIndex >= 0 ? workflows[existingIndex] : {};
  const next = {
    ...previous,
    subquestion_index: index,
    subquestion,
    ...patch,
    updated_at: new Date().toISOString(),
  };
  if (existingIndex >= 0) workflows[existingIndex] = next;
  else workflows.push(next);
  workflows.sort((a: Json, b: Json) => Number(a.subquestion_index || 0) - Number(b.subquestion_index || 0));
  await updateState(run, { subquestion_workflows: workflows });
  return next;
}

function diagnosticWriteWarning(operation: string, path: string, error: unknown): Json {
  return {
    type: "diagnostic_write_failed",
    operation,
    path,
    error: String(error),
  };
}

async function writeDiagnosticJson(path: string, data: Json, warnings: Json[]) {
  try {
    await writeJson(path, data);
  } catch (error) {
    warnings.push(diagnosticWriteWarning("write_json", path, error));
  }
}

async function writeDiagnosticText(path: string, text: string, warnings: Json[]) {
  try {
    await writeText(path, text);
  } catch (error) {
    warnings.push(diagnosticWriteWarning("write_text", path, error));
  }
}

async function writeDiagnosticJsonl(path: string, entries: Json[], warnings: Json[]) {
  try {
    await writeJsonl(path, entries);
  } catch (error) {
    warnings.push(diagnosticWriteWarning("write_jsonl", path, error));
  }
}

async function snapshotSubagentFiles(agentDir: string, warnings: Json[]) {
  if (!debugDiskWritesEnabled()) return undefined;
  const files = ["input.json", "output.json", "prompt.md", "events.jsonl"];
  const existing = files.filter((name) => existsSync(join(agentDir, name)));
  if (!existing.length) return undefined;
  const snapshotDir = join(agentDir, "_snapshots", `call_${shortTimestamp()}_${randomUUID().slice(0, 8)}`);
  try {
    await mkdir(snapshotDir, { recursive: true });
  } catch (error) {
    warnings.push(diagnosticWriteWarning("mkdir", snapshotDir, error));
    return undefined;
  }
  const copied: string[] = [];
  const skipped: Json[] = [];
  for (const name of existing) {
    const source = join(agentDir, name);
    const target = join(snapshotDir, name);
    try {
      await copyFile(source, target);
      copied.push(target);
    } catch (error) {
      const warning = diagnosticWriteWarning("copy_file", target, error);
      skipped.push({ source, target, error: warning.error });
      warnings.push(warning);
    }
  }
  await writeDiagnosticJson(join(snapshotDir, "manifest.json"), {
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
}): Promise<any> {
  const agentDir = join(options.runDir, "subagents", options.agentName);
  const inputPath = join(agentDir, "input.json");
  const outputPath = join(agentDir, "output.json");
  const persistSubagentFiles = debugDiskWritesEnabled();
  const diagnosticWarnings: Json[] = [];
  if (persistSubagentFiles) {
    try {
      await mkdir(agentDir, { recursive: true });
    } catch (error) {
      diagnosticWarnings.push(diagnosticWriteWarning("mkdir", agentDir, error));
    }
  }
  const snapshotDir = persistSubagentFiles ? await snapshotSubagentFiles(agentDir, diagnosticWarnings) : undefined;
  if (persistSubagentFiles) {
    await writeDiagnosticJson(inputPath, {
      agent_name: options.agentName,
      finalize_tool: options.finalizeTool,
      tools: options.tools || [],
      prompt: options.prompt,
    }, diagnosticWarnings);
    await writeDiagnosticText(join(agentDir, "prompt.md"), options.prompt, diagnosticWarnings);
  }

  const readableLogs: Json[] = [];
  try {
    const { sdk } = await getSharedCodingSdk();
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
      description: "Finalize the isolated NeuroScientist level-2 subagent result.",
      parameters: options.finalizeSchema,
      async execute(_toolCallId: string, params: Json) {
        finalPayload = params;
        if (persistSubagentFiles) {
          await writeDiagnosticJson(outputPath, params, diagnosticWarnings);
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
    const piAgentDir = process.env.PI_CODING_AGENT_DIR || resolve(process.cwd(), ".pi", "agent");
    const { session } = await createAgentSession({
      cwd: options.runDir,
      agentDir: piAgentDir,
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
      await writeDiagnosticJsonl(join(agentDir, "events.jsonl"), readableLogs, diagnosticWarnings);
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
        await writeDiagnosticJson(outputPath, failure, diagnosticWarnings);
      }
      return { ...failure, diagnostic_warnings: diagnosticWarnings };
    }
    return { ok: true, result: finalPayload, subagent_dir: agentDir, output_path: outputPath, snapshot_dir: snapshotDir, diagnostic_warnings: diagnosticWarnings };
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
      await writeDiagnosticJson(outputPath, failure, diagnosticWarnings);
    }
    return { ...failure, diagnostic_warnings: diagnosticWarnings };
  }
}

function exposedSubagent(sub: Json, result: any = sub.result) {
  return {
    ok: sub.ok,
    error: sub.error,
    result,
    output_path: sub.output_path,
    debug: { subagent_dir: sub.subagent_dir, snapshot_dir: sub.snapshot_dir },
  };
}

// ---------------------------------------------------------------------------
// Level-1 subprocess executor
// ---------------------------------------------------------------------------

function spawnLevel1(args: {
  rootDir: string;
  query: string;
  dataset: string;
  workDir: string;
  extraPath?: string;
  timeoutSeconds?: number;
  signal?: AbortSignal;
  onStderr?: (line: string) => void;
}): Promise<{ ok: boolean; exitCode: number | null; stderr: string }> {
  return new Promise((resolvePromise) => {
    const scriptPath = join(args.rootDir, "internagent", "workflow", "level1.sh");
    const cmdArgs = [
      "--non-interactive",
      "--query", args.query,
      "--dataset", args.dataset,
      "--work_dir", args.workDir,
    ];
    if (args.extraPath) cmdArgs.push("--path", args.extraPath);

    const child = spawn(scriptPath, cmdArgs, {
      cwd: args.rootDir,
      // Inherit the parent session's agent dir (where setup_api.sh registered the
      // providers, e.g. neuro-proxy). Only fall back to project-local .pi/agent
      // when unset — hardcoding it here loaded a models.json without the provider
      // and the spawned level-1 died with 'Unknown provider "neuro-proxy"'.
      env: { ...process.env, PI_CODING_AGENT_DIR: process.env.PI_CODING_AGENT_DIR || join(args.rootDir, ".pi", "agent") },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderrBuf = "";
    let timedOut = false;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    let killHandle: ReturnType<typeof setTimeout> | undefined;
    const appendStderrTail = (text: string) => {
      stderrBuf = (stderrBuf + text).slice(-12000);
    };
    child.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      appendStderrTail(text);
      if (args.onStderr) {
        for (const line of text.split(/\r?\n/)) {
          if (line.trim()) args.onStderr(line);
        }
      }
    });
    // Drain stdout to avoid backpressure; level-1 writes JSONL there.
    child.stdout?.on("data", () => {});

    const onAbort = () => {
      try { child.kill("SIGTERM"); } catch { /* ignore */ }
    };
    const timeoutSeconds = Number(args.timeoutSeconds || 0);
    if (Number.isFinite(timeoutSeconds) && timeoutSeconds > 0) {
      timeoutHandle = setTimeout(() => {
        timedOut = true;
        appendStderrTail(`\nlevel-1 subprocess timed out after ${timeoutSeconds}s`);
        try { child.kill("SIGTERM"); } catch { /* ignore */ }
        killHandle = setTimeout(() => {
          try { child.kill("SIGKILL"); } catch { /* ignore */ }
        }, 10000);
      }, timeoutSeconds * 1000);
    }
    if (args.signal) {
      if (args.signal.aborted) onAbort();
      else args.signal.addEventListener("abort", onAbort, { once: true });
    }

    child.on("close", (code) => {
      if (args.signal) args.signal.removeEventListener("abort", onAbort);
      if (timeoutHandle) clearTimeout(timeoutHandle);
      if (killHandle) clearTimeout(killHandle);
      resolvePromise({ ok: !timedOut && code === 0, exitCode: code, stderr: stderrBuf });
    });
    child.on("error", (err) => {
      if (args.signal) args.signal.removeEventListener("abort", onAbort);
      if (timeoutHandle) clearTimeout(timeoutHandle);
      if (killHandle) clearTimeout(killHandle);
      appendStderrTail(`\nspawn error: ${String(err)}`);
      resolvePromise({ ok: false, exitCode: null, stderr: stderrBuf });
    });
  });
}

async function readLevel1Artifacts(workDir: string) {
  const conclusions = await readJson(join(workDir, "conclusions.json"), {});
  const state = await readJson(join(workDir, "state.json"), {});
  const artifacts = normalizeArtifacts(state.artifacts || [], workDir);

  const figurePaths = artifacts
    .filter((a) => a.kind === "figure" && /\.(png|jpe?g|webp|gif)$/i.test(a.path))
    .map((a) => a.path);
  const dataArtifacts = artifacts
    .filter((a) => a.kind === "data")
    .map((a) => ({
      path: a.path,
      role: a.role || "",
      description: a.description || "",
      produced_by: a.produced_by || "",
      exists: existsSync(a.path),
    }));
  const tableLikePaths = dataArtifacts
    .filter((a) => /\.(csv|tsv|xlsx?|parquet|feather)$/i.test(a.path))
    .map((a) => a.path);
  const dataPreviews = [];
  for (const artifact of dataArtifacts) {
    if (/\.(csv|tsv|json|txt|md)$/i.test(artifact.path)) {
      const preview = await readOptionalText(artifact.path);
      if (preview) dataPreviews.push({ path: artifact.path, preview });
    }
  }

  const statisticsArtifact = artifacts.find((a) => a.kind === "statistics");
  const statisticsPath = statisticsArtifact?.path || join(workDir, "statistics.json");
  const statistics = await readJson(statisticsPath, {});
  const validation = state.validation || {};
  const validations = Array.isArray(state.validations) ? state.validations : [];
  let imageAnalyses = Array.isArray(state.image_analyses) ? state.image_analyses : [];
  if (!imageAnalyses.length && state.image_analysis) {
    imageAnalyses = [{ path: figurePaths[0] || "", ...state.image_analysis }];
  }
  const imageAnalysisFiles = [];
  const imageAnalysisDir = artifacts.find((a) => a.name === "image_analyses_dir")?.path || join(workDir, "image_analyses");
  try {
    for (const entry of await readdir(imageAnalysisDir)) {
      if (!/\.(md|txt|json)$/i.test(entry)) continue;
      const path = join(imageAnalysisDir, entry);
      imageAnalysisFiles.push({
        path,
        preview: await readOptionalText(path),
      });
    }
  } catch {
    // Image analysis is optional in the current level-1 contract.
  }
  const evidenceNotes = [
    "Evidence is collected from the current Pi level-1 contract: dynamic state.artifacts, fixed conclusions.json, statistics artifact, validation, and image analysis files when present.",
  ];
  if (!tableLikePaths.length) {
    evidenceNotes.push("No table-like data artifacts were produced by level-1; this is a known deviation from the reference level-2 evidence shape.");
  }
  if (!imageAnalyses.length && !imageAnalysisFiles.length) {
    evidenceNotes.push("No image analysis files were found; use figure paths and statistics directly unless level-1 ran neuro_analyze_image.");
  }
  return {
    conclusions,
    atomic_conclusions: Array.isArray(conclusions.conclusions) ? conclusions.conclusions : [],
    figure_paths: figurePaths,
    statistics,
    statistics_path: statisticsPath,
    data_artifacts: dataArtifacts,
    table_paths: tableLikePaths,
    data_previews: dataPreviews,
    validations,
    validation,
    image_analyses: imageAnalyses,
    image_analysis_files: imageAnalysisFiles,
    artifacts,
    artifact_warnings: state.checks?.artifact_warnings || [],
    evidence_notes: evidenceNotes,
    run_id: state.run_id || "",
    state_path: join(workDir, "state.json"),
  };
}

function normalizeConfidence(value: any) {
  if (typeof value === "number") return value;
  const text = String(value || "").trim().toLowerCase();
  if (text === "high") return 0.85;
  if (text === "medium") return 0.6;
  if (text === "low") return 0.35;
  return 0.5;
}

function buildEvidenceBundle(runDir: string, subquestionConclusions: any[], planResults: any[]) {
  const figureCatalog: any[] = [];
  const evidenceCatalog: any[] = [];
  const subquestionItems = subquestionConclusions.map((subq, subqIdx) => {
    const subquestionIndex = subq.subquestion_index || subq.index || subqIdx + 1;
    const subquestion = subq.subquestion || "";
    const plans = (planResults || []).filter((plan) => {
      if (plan.subquestion_index !== undefined) return Number(plan.subquestion_index) === Number(subquestionIndex);
      return !subquestion || plan.subquestion === subquestion;
    });
    const analysisPlanEvidence = plans.map((plan, planIdx) => {
      const planIndex = plan.plan_index || planIdx + 1;
      const figures = (plan.figure_paths || []).map((figurePath: string, figIdx: number) => {
        const figureId = `Fig S${subquestionIndex}-P${planIndex}-F${figIdx + 1}`;
        const absolutePath = figurePath.startsWith("/") ? figurePath : resolve(plan.work_dir || runDir, figurePath);
        const relativePath = relative(runDir, absolutePath) || basename(absolutePath);
        const catalogEntry = {
          figure_id: figureId,
          subquestion_index: subquestionIndex,
          plan_index: planIndex,
          path: figurePath,
          absolute_path: absolutePath,
          relative_path: relativePath,
          caption: `${figureId}. Evidence for subquestion ${subquestionIndex}, analysis plan ${planIndex}.`,
        };
        figureCatalog.push(catalogEntry);
        return catalogEntry;
      });
      const evidenceItem = {
        subquestion_index: subquestionIndex,
        plan_index: planIndex,
        analysis_plan: plan.analysis_plan,
        status: plan.status,
        figures,
        table_paths: plan.table_paths || [],
        data_artifacts: plan.data_artifacts || [],
        statistics: plan.statistics || {},
        conclusions: plan.conclusions || {},
        atomic_conclusions: plan.level1_evidence?.atomic_conclusions || plan.conclusions?.conclusions || [],
        validations: plan.validations || plan.level1_evidence?.validations || [],
        image_analyses: plan.image_analyses || plan.level1_evidence?.image_analyses || [],
        artifact_warnings: plan.artifact_warnings || plan.level1_evidence?.artifact_warnings || [],
        evidence_notes: plan.evidence_notes || plan.level1_evidence?.evidence_notes || [],
        work_dir: plan.work_dir || "",
      };
      evidenceCatalog.push(evidenceItem);
      return evidenceItem;
    });
    return {
      subquestion_metadata: {
        subquestion_index: subquestionIndex,
        subquestion,
        plan_count: plans.length,
        confidence_numeric: normalizeConfidence(subq.confidence),
      },
      subquestion_conclusion: subq,
      analysis_plan_evidence: analysisPlanEvidence,
    };
  });
  const evidenceNotes = Array.from(new Set(evidenceCatalog.flatMap((item) => item.evidence_notes || [])));
  // Deterministic human numbering (Figure 1..N) in catalog order, plus an optional
  // per-figure excerpt from any upstream Level-1 image analysis matched by basename.
  const allImageAnalyses = evidenceCatalog.flatMap((item) => item.image_analyses || []);
  figureCatalog.forEach((entry, index) => {
    entry.figure_number = index + 1;
    entry.human_label = `Figure ${index + 1}`;
    const match = allImageAnalyses.find((ia) => {
      const p = ia?.path || ia?.figure_path || "";
      return p && basename(String(p)) === basename(entry.absolute_path);
    });
    const excerpt = match?.image_analysis_text || match?.summary || match?.analysis_text || "";
    if (excerpt) entry.image_analysis_excerpt = truncateText(String(excerpt), 800);
  });
  const figureIndex = figureCatalog.map((entry) => ({
    figure_id: entry.figure_id,
    figure_number: entry.figure_number,
    human_label: entry.human_label,
    relative_path: entry.relative_path,
  }));
  return {
    figure_catalog: figureCatalog,
    evidence_catalog: evidenceCatalog,
    subquestion_items: subquestionItems,
    evidence_notes: evidenceNotes,
    figure_index: figureIndex,
  };
}

// Deterministic, warn-only traceability lint for the paper report. Never throws;
// returns { ok, warnings } so the report tool can surface issues without failing.
function lintPaperReport(markdown: string, figureCatalog: any[], figureLegends: any[], keyClaims: any[] = []) {
  const warnings: string[] = [];
  const md = String(markdown || "");
  const numbers = new Set((figureCatalog || []).map((e) => Number(e.figure_number)).filter((n) => Number.isFinite(n)));
  const ids = new Set((figureCatalog || []).map((e) => e.figure_id).filter(Boolean));

  // Cited "Figure N" that do not exist in the catalog.
  for (const m of md.matchAll(/\bFig(?:ure)?\s+(\d+)/gi)) {
    const n = Number(m[1]);
    if (!numbers.has(n)) warnings.push(`cites "Figure ${n}" which is not in the figure catalog`);
  }
  // Cited machine ids that do not exist.
  for (const m of md.matchAll(/Fig S\d+-P\d+-F\d+/g)) {
    if (!ids.has(m[0])) warnings.push(`cites figure_id "${m[0]}" which is not in the figure catalog`);
  }
  // Every catalog figure should be referenced at least once (by number, id, or embed path).
  const embedPaths = new Set(Array.from(md.matchAll(/\]\(([^)]+)\)/g)).map((m) => m[1]));
  for (const e of figureCatalog || []) {
    const byNumber = new RegExp(`\\bFig(?:ure)?\\s+${e.figure_number}\\b`).test(md);
    const byId = e.figure_id && md.includes(e.figure_id);
    const byEmbed = e.relative_path && (embedPaths.has(e.relative_path) || md.includes(e.relative_path));
    if (!byNumber && !byId && !byEmbed) warnings.push(`figure ${e.human_label || e.figure_id} is never referenced in the report body`);
  }
  // Legends map to a real figure and carry ≥1 panel.
  const legendPanels = new Map<number, Set<string>>();
  for (const lg of figureLegends || []) {
    if (lg?.figure_id && !ids.has(lg.figure_id)) warnings.push(`figure_legend references unknown figure_id "${lg.figure_id}"`);
    if (!Array.isArray(lg?.panels) || lg.panels.length === 0) warnings.push(`figure_legend for "${lg?.figure_id || lg?.figure_number}" has no panels`);
    if (Number.isFinite(Number(lg?.figure_number))) {
      legendPanels.set(Number(lg.figure_number), new Set((lg.panels || []).map((p: any) => String(p?.label || "").toUpperCase())));
    }
  }
  // In-body "(Figure N, panel X)" whose panel is not declared in that figure's legend.
  for (const m of md.matchAll(/\(Figure\s+(\d+),\s*panel\s+([A-Za-z0-9]+)\)/gi)) {
    const n = Number(m[1]);
    const label = String(m[2]).toUpperCase();
    const panels = legendPanels.get(n);
    if (panels && panels.size && !panels.has(label)) warnings.push(`cites (Figure ${n}, panel ${m[2]}) but that panel is not in the figure's legend`);
  }
  // Domain convention: entities should be 1-based, not 0-based.
  const zeroBased = md.match(/\b(fish|trial|neuron|session|subject|mouse|cell)\s+0\b/i);
  if (zeroBased) warnings.push(`0-based entity numbering detected ("${zeroBased[0]}"); use 1-based (e.g. fish 1)`);
  // Structured claims must be traceable.
  (keyClaims || []).forEach((c, i) => {
    if (c && typeof c === "object") {
      if (!c.figure_id) warnings.push(`key_claims[${i}] is missing figure_id`);
      if (!c.data_source) warnings.push(`key_claims[${i}] is missing data_source`);
    }
  });

  return { ok: warnings.length === 0, warnings };
}

// ---------------------------------------------------------------------------
// Question YAML parsing (minimal, mirrors reference _parse_simple_yaml_mapping)
// ---------------------------------------------------------------------------

function parseSimpleYamlMapping(text: string): Json {
  const payload: Json = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes(":")) continue;
    const idx = line.indexOf(":");
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    payload[key] = value;
  }
  return payload;
}

async function loadQuestionYaml(path: string): Promise<Json> {
  const raw = await readFile(path, "utf8");
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const yaml = await import("yaml");
    const parsed = yaml.parse(raw);
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    // fall through to simple parser
  }
  return parseSimpleYamlMapping(raw);
}

// ---------------------------------------------------------------------------
// Extension entry
// ---------------------------------------------------------------------------

export default function (pi: ExtensionAPI) {
  let activeRunDir: string | undefined;

  pi.on("session_shutdown", async () => {
    await flushUsageSummaries();
  });

  pi.registerCommand("neuro_l2_tools", {
    description: "Show NeuroScientist level-2 loaded and active tools.",
    async handler() {
      const allTools = pi.getAllTools().map((tool: any) => tool.name);
      const activeTools = pi.getActiveTools();
      pi.sendMessage({
        customType: "neuroscientist-level2-tools",
        content: JSON.stringify({
          extension: "neuroscientist-level2",
          all_tools: allTools,
          active_tools: activeTools,
          has_neuro_l2_start_run: allTools.includes("neuro_l2_start_run"),
          active_neuro_l2_start_run: activeTools.includes("neuro_l2_start_run"),
        }, null, 2),
        display: true,
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
    for (const entry of readableLogEntriesFromEvent(event, "main", "level2")) {
      await appendReadableLog(activeRunDir, entry);
    }
  });

  pi.on("tool_execution_end", async (event: Json) => {
    const resultRunDir = event.result?.details?.run_dir || event.result?.run_dir;
    if (typeof resultRunDir === "string" && event.toolName === "neuro_l2_start_run") {
      activeRunDir = resultRunDir;
    }
    if (!activeRunDir) return;
    for (const entry of readableLogEntriesFromEvent(event, "main", "level2")) {
      await appendReadableLog(activeRunDir, entry);
    }
  });

  pi.on("after_provider_response", async (event: Json) => {
    if (!activeRunDir || numberValue(event.status) < 400) return;
    for (const entry of readableLogEntriesFromEvent({ ...event, type: "after_provider_response" }, "main", "level2")) {
      await appendReadableLog(activeRunDir, entry);
    }
  });

  pi.registerTool({
    name: "neuro_l2_ping",
    label: "Neuro L2 Ping",
    description: "Verify that the project-local NeuroScientist level-2 Pi extension is loaded.",
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
      return content({ ok: true, extension: "neuroscientist-level2", cwd: ctx.cwd });
    },
  });

  pi.registerTool({
    name: "neuro_l2_start_run",
    label: "Neuro L2 Start Run",
    description: "Create a new level-2 run directory. Pass question_yaml_path to load scientific_goal/question/background/meta_json_path from a YAML file, or pass scientific_goal/question/background/meta_json_path directly.",
    parameters: Type.Object({
      work_dir: Type.String({ description: "Level-2 run directory. Prefer relative fallback paths; preserve explicit user-provided absolute paths." }),
      question_yaml_path: Type.Optional(Type.String()),
      scientific_goal: Type.Optional(Type.String()),
      question: Type.Optional(Type.String()),
      background: Type.Optional(Type.String()),
      meta_json_path: Type.Optional(Type.String()),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const run = await startRun(ctx.cwd, params.work_dir);
      activeRunDir = run.runDir;
      let questionInput: Json = {};
      if (params.question_yaml_path) {
        questionInput = await loadQuestionYaml(resolve(ctx.cwd, params.question_yaml_path));
      }
      const scientificGoal = params.scientific_goal || questionInput.scientific_goal || "";
      const mainQuestion = params.question || questionInput.question || "";
      const background = params.background || questionInput.background || "";
      const metaJsonPath = params.meta_json_path || questionInput.meta_json_path || "";
      await updateState(run, {
        question_input: {
          scientific_goal: scientificGoal,
          question: mainQuestion,
          background,
          meta_json_path: metaJsonPath,
          question_yaml_path: params.question_yaml_path || "",
        },
      });
      return content({
        ok: true,
        extension: "neuroscientist-level2",
        run_id: run.runId,
        run_dir: run.runDir,
        scientific_goal: scientificGoal,
        question: mainQuestion,
        background,
        meta_json_path: metaJsonPath,
      });
    },
  });

  // -- Subquestion generation + review -------------------------------------

  pi.registerTool({
    name: "neuro_l2_subquestion",
    label: "Neuro L2 Subquestion",
    description: "Decompose the main question into N subquestions.",
    parameters: Type.Object({
      run_id: Type.String(),
      scientific_goal: Type.String(),
      question: Type.String(),
      background: Type.String(),
      meta_json_path: Type.Optional(Type.String()),
      subquestion_count: Type.Optional(Type.Number()),
      previous_subquestions: Type.Optional(Type.Array(Type.String())),
      review_feedback: Type.Optional(Type.String()),
      additional_context: Type.Optional(Type.String()),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const config = await loadConfig(ctx.cwd);
      const run = await resolveRun(ctx.cwd, params.run_id);
      const rolePrompt = await readPrompt("subquestion");
      const prompt = finalizationPrompt("subquestion", "finalize_subquestions", rolePrompt, [
        `Scientific goal:\n${params.scientific_goal}`,
        `Main question:\n${params.question}`,
        `Background:\n${params.background}`,
        `Meta JSON path:\n${params.meta_json_path || ""}`,
        `Previous subquestions:\n${(params.previous_subquestions || []).join("\n")}`,
        `Review feedback:\n${params.review_feedback || ""}`,
        additionalContextBlock(params.additional_context),
        `Target subquestion count: ${params.subquestion_count ?? 3}`,
        "Finalize with: { subquestion_texts: string[], rationale: string }.",
      ].join("\n\n"));
      const sub = await runSubagent({
        runDir: run.runDir,
        agentName: "subquestion",
        finalizeTool: "finalize_subquestions",
        finalizeSchema: Type.Object({
          subquestion_texts: Type.Array(Type.String()),
          rationale: Type.String(),
        }),
        prompt,
        agentConfig: pickAgentConfig(config, "level2_subquestion"),
        tools: [],
        signal,
      });
      if (sub.ok) {
        const subquestionWorkflows = (sub.result.subquestion_texts || []).map((text: string, idx: number) => ({
          subquestion_index: idx + 1,
          subquestion: text,
          method_status: "pending",
          execution_status: "pending",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }));
        await updateState(run, {
          subquestions: sub.result.subquestion_texts,
          subquestion_rationale: sub.result.rationale,
          subquestion_workflows: subquestionWorkflows,
        });
      }
      await appendStateEntry(pi, { run_id: run.runId, event: "neuro_l2_subquestion", ok: sub.ok });
      return content({ run_id: run.runId, ...exposedSubagent(sub) });
    },
  });

  pi.registerTool({
    name: "neuro_l2_subquestion_review",
    label: "Neuro L2 Subquestion Review",
    description: "Review the generated subquestions for coverage, independence, and answerability.",
    parameters: Type.Object({
      run_id: Type.String(),
      subquestion_index: Type.Optional(Type.Number()),
      scientific_goal: Type.String(),
      question: Type.String(),
      background: Type.String(),
      meta_json_path: Type.Optional(Type.String()),
      subquestions: Type.Array(Type.String()),
      additional_context: Type.Optional(Type.String()),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const config = await loadConfig(ctx.cwd);
      const run = await resolveRun(ctx.cwd, params.run_id);
      const rolePrompt = await readPrompt("subquestion_review");
      const datasetMeta = params.meta_json_path
        ? await readJson(resolve(ctx.cwd, params.meta_json_path), {})
        : {};
      const prompt = finalizationPrompt("subquestion review", "finalize_subquestion_review", rolePrompt, [
        `Question title:\n${params.question}`,
        `Scientific goal:\n${params.scientific_goal}`,
        `Main question:\n${params.question}`,
        `Background:\n${params.background}`,
        `Dataset meta:\n${JSON.stringify(datasetMeta, null, 2)}`,
        `Subquestions:\n${params.subquestions.map((s, i) => `(${i + 1}) ${s}`).join("\n")}`,
        additionalContextBlock(params.additional_context),
        "Finalize with the required review JSON. The extension will derive pass and feedback from decision/final_feedback.",
      ].join("\n\n"));
      const sub = await runSubagent({
        runDir: run.runDir,
        agentName: "subquestion_review",
        finalizeTool: "finalize_subquestion_review",
        finalizeSchema: Type.Object({
          question_title: Type.String(),
          total_score: Type.Number(),
          decision: Type.String(),
          scores: Type.Any(),
          summary: Type.String(),
          strengths: Type.Array(Type.String()),
          weaknesses: Type.Array(Type.String()),
          background_alignment: Type.Any(),
          per_subquestion_evaluation: Type.Array(Type.Any()),
          redundant_or_overlapping_subquestions: Type.Array(Type.Any()),
          off_topic_or_weakly_related_subquestions: Type.Array(Type.Any()),
          unsupported_or_weakly_supported_subquestions: Type.Array(Type.Any()),
          missing_aspects: Type.Array(Type.String()),
          improvement_suggestions: Type.Array(Type.String()),
          suggested_revised_subquestion_list: Type.Array(Type.String()),
          final_feedback: Type.Any(),
        }),
        prompt,
        agentConfig: pickAgentConfig(config, "level2_subquestion_review"),
        tools: [],
        signal,
      });
      if (sub.ok) {
        sub.result = {
          ...sub.result,
          pass: deriveSubquestionReviewPass(sub.result),
          feedback: subquestionReviewFeedback(sub.result),
        };
        if (sub.output_path) await writeJson(sub.output_path, sub.result);
        await updateState(run, { subquestion_review: sub.result });
      }
      await appendStateEntry(pi, { run_id: run.runId, event: "neuro_l2_subquestion_review", ok: sub.ok, pass: sub.result?.pass });
      return content({ run_id: run.runId, ...exposedSubagent(sub) });
    },
  });

  // -- Method development + review -----------------------------------------

  pi.registerTool({
    name: "neuro_l2_method_development",
    label: "Neuro L2 Method Development",
    description: "Generate analysis plans for one subquestion.",
    parameters: Type.Object({
      run_id: Type.String(),
      subquestion_index: Type.Optional(Type.Number()),
      scientific_goal: Type.String(),
      question: Type.String(),
      background: Type.String(),
      subquestion: Type.String(),
      meta_json_path: Type.Optional(Type.String()),
      max_analysis_plan_count: Type.Optional(Type.Number()),
      previous_analysis_plans: Type.Optional(Type.Array(Type.Any())),
      review_feedback: Type.Optional(Type.String()),
      additional_context: Type.Optional(Type.String()),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const config = await loadConfig(ctx.cwd);
      const run = await resolveRun(ctx.cwd, params.run_id);
      const subquestionIndex = subquestionIndexFor(run, params.subquestion, params.subquestion_index);
      const rolePrompt = await readPrompt("method_development");
      const prompt = finalizationPrompt("method development", "finalize_analysis_plans", rolePrompt, [
        `Scientific goal:\n${params.scientific_goal}`,
        `Main question:\n${params.question}`,
        `Background:\n${params.background}`,
        `Subquestion:\n${params.subquestion}`,
        `Meta JSON path:\n${params.meta_json_path || ""}`,
        `Max analysis plan count: ${params.max_analysis_plan_count ?? 1}`,
        `Previous analysis plans:\n${JSON.stringify(params.previous_analysis_plans || [], null, 2)}`,
        `Review feedback:\n${params.review_feedback || ""}`,
        additionalContextBlock(params.additional_context),
        "Finalize with: { analysis_plans: [{plan, method, expected_result}], rationale: string }.",
      ].join("\n\n"));
      const sub = await runSubagent({
        runDir: run.runDir,
        agentName: subquestionAgentName(subquestionIndex, "method_development"),
        finalizeTool: "finalize_analysis_plans",
        finalizeSchema: Type.Object({
          analysis_plans: Type.Array(Type.Object({
            plan: Type.String(),
            method: Type.String(),
            expected_result: Type.String(),
          })),
          rationale: Type.String(),
        }),
        prompt,
        agentConfig: pickAgentConfig(config, "level2_method_development"),
        tools: [],
        signal,
      });
      await updateSubquestionWorkflow(run, subquestionIndex, params.subquestion, {
        method_development: {
          ok: sub.ok,
          error: sub.error,
          output_path: sub.output_path,
          subagent_dir: sub.subagent_dir,
          analysis_plans: sub.result?.analysis_plans,
          rationale: sub.result?.rationale,
        },
        analysis_plans: sub.result?.analysis_plans,
        method_status: sub.ok ? "developed" : "development_failed",
      });
      await appendStateEntry(pi, {
        run_id: run.runId,
        event: "neuro_l2_method_development",
        ok: sub.ok,
        subquestion_index: subquestionIndex,
        subquestion: params.subquestion,
      });
      return content({
        run_id: run.runId,
        subquestion_index: subquestionIndex,
        subquestion: params.subquestion,
        ...exposedSubagent(sub),
      });
    },
  });

  pi.registerTool({
    name: "neuro_l2_method_review",
    label: "Neuro L2 Method Review",
    description: "Review analysis plans for one subquestion.",
    parameters: Type.Object({
      run_id: Type.String(),
      subquestion_index: Type.Optional(Type.Number()),
      scientific_goal: Type.String(),
      question: Type.String(),
      background: Type.String(),
      subquestion: Type.String(),
      meta_json_path: Type.Optional(Type.String()),
      analysis_plans: Type.Array(Type.Object({
        plan: Type.String(),
        method: Type.String(),
        expected_result: Type.String(),
      })),
      additional_context: Type.Optional(Type.String()),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const config = await loadConfig(ctx.cwd);
      const run = await resolveRun(ctx.cwd, params.run_id);
      const subquestionIndex = subquestionIndexFor(run, params.subquestion, params.subquestion_index);
      const rolePrompt = await readPrompt("method_review");
      const datasetMeta = params.meta_json_path
        ? await readJson(resolve(ctx.cwd, params.meta_json_path), {})
        : {};
      const prompt = finalizationPrompt("method review", "finalize_method_review", rolePrompt, [
        `Question title:\n${params.question}`,
        `Scientific goal:\n${params.scientific_goal}`,
        `Main question:\n${params.question}`,
        `Background:\n${params.background}`,
        `Dataset meta:\n${JSON.stringify(datasetMeta, null, 2)}`,
        `Subquestion:\n${params.subquestion}`,
        `Analysis plans:\n${JSON.stringify(params.analysis_plans, null, 2)}`,
        additionalContextBlock(params.additional_context),
        "Finalize with the required review JSON. The extension will derive pass from decision: Accept or Weak Accept means pass=true; Revise or Reject means pass=false.",
      ].join("\n\n"));
      const sub = await runSubagent({
        runDir: run.runDir,
        agentName: subquestionAgentName(subquestionIndex, "method_review"),
        finalizeTool: "finalize_method_review",
        finalizeSchema: Type.Object({
          decision: Type.String(),
          feasibility_gate: Type.Any(),
          per_plan_feasibility: Type.Array(Type.Any()),
          total_score: Type.Number(),
          max_score: Type.Number(),
          normalized_score: Type.Number(),
          criterion_scores: Type.Any(),
          per_plan_evaluation: Type.Array(Type.Any()),
          major_strengths: Type.Array(Type.String()),
          major_weaknesses: Type.Array(Type.String()),
          unsupported_or_infeasible_plans: Type.Array(Type.Any()),
          redundant_or_overlapping_plans: Type.Array(Type.Any()),
          missing_analyses: Type.Array(Type.String()),
          recommended_revisions: Type.Array(Type.String()),
          revised_analysis_plan_list: Type.Array(Type.String()),
          final_assessment: Type.String(),
        }),
        prompt,
        agentConfig: pickAgentConfig(config, "level2_method_review"),
        tools: [],
        signal,
      });
      if (sub.ok) {
        sub.result = {
          ...sub.result,
          pass: deriveMethodReviewPass(sub.result),
          feedback: methodReviewFeedback(sub.result),
        };
        if (sub.output_path) await writeJson(sub.output_path, sub.result);
      }
      await updateSubquestionWorkflow(run, subquestionIndex, params.subquestion, {
        method_review: {
          ok: sub.ok,
          error: sub.error,
          output_path: sub.output_path,
          subagent_dir: sub.subagent_dir,
          pass: sub.result?.pass,
          decision: sub.result?.decision,
          feedback: sub.result?.feedback,
          result: sub.result,
        },
        review_pass: sub.result?.pass,
        review_decision: sub.result?.decision,
        review_feedback: sub.result?.feedback,
        method_status: sub.result?.pass ? "review_passed" : "review_failed",
      });
      await appendStateEntry(pi, {
        run_id: run.runId,
        event: "neuro_l2_method_review",
        ok: sub.ok,
        pass: sub.result?.pass,
        decision: sub.result?.decision,
        subquestion_index: subquestionIndex,
        subquestion: params.subquestion,
      });
      return content({
        run_id: run.runId,
        subquestion_index: subquestionIndex,
        subquestion: params.subquestion,
        ...exposedSubagent(sub),
      });
    },
  });

  // -- Level-1 subprocess executor -----------------------------------------

  pi.registerTool({
    name: "neuro_l2_run_level1",
    label: "Neuro L2 Run Level-1",
    description: "Execute one analysis plan via the full level-1 pipeline by spawning an isolated level-1 workflow process. Returns conclusions, figure_paths, statistics, and the level-1 run_id. This is the ONLY way level-2 executes analysis.",
    parameters: Type.Object({
      run_id: Type.String(),
      subquestion_index: Type.Number(),
      subquestion: Type.String(),
      plan_index: Type.Number(),
      analysis_plan: Type.String(),
      scientific_goal: Type.String(),
      question: Type.String(),
      background: Type.String(),
      meta_json_path: Type.Optional(Type.String()),
      work_dir: Type.String({ description: "Per-plan output directory. Prefer a child path under the level-2 run directory; preserve explicit absolute paths." }),
    }),
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      const config = await loadConfig(ctx.cwd);
      const run = await resolveRun(ctx.cwd, params.run_id);
      const planDir = resolve(ctx.cwd, params.work_dir);
      await mkdir(planDir, { recursive: true });
      const timeoutSeconds = agentTimeoutSeconds(pickMainAgentConfig(config, 1));

      const nsQuestion = [
        "You are executing one analysis plan derived from a larger neuroscience task.",
        "",
        "[Scientific Goal]",
        params.scientific_goal,
        "",
        "[Main Question]",
        params.question,
        "",
        "[Background]",
        params.background,
        "",
        "[Subquestion]",
        params.subquestion,
        "",
        "[Analysis Plan]",
        params.analysis_plan,
        "",
        "Please execute this analysis plan with code, generate outputs, and provide scientific conclusions.",
      ].join("\n");

      let dataset = "";
      if (params.meta_json_path) {
        try {
          dataset = await readFile(resolve(ctx.cwd, params.meta_json_path), "utf8");
        } catch (e) {
          dataset = String(e);
        }
      }

      const inputPayload = {
        subquestion_index: params.subquestion_index,
        subquestion: params.subquestion,
        plan_index: params.plan_index,
        analysis_plan: params.analysis_plan,
        ns_question: nsQuestion,
        meta_json_path: params.meta_json_path || "",
        work_dir: planDir,
      };
      const level1InputPath = join(planDir, "level1_input.json");
      const level1ResultPath = join(planDir, "level1_result.json");
      if (debugDiskWritesEnabled()) {
        await writeJson(level1InputPath, inputPayload);
      }

      onUpdate?.({ content: [{ type: "text", text: `[neuro_l2_run_level1] spawning level-1 workflow -> ${planDir}` }] });
      const result = await spawnLevel1({
        rootDir: ctx.cwd,
        query: nsQuestion,
        dataset: dataset || "{}",
        workDir: planDir,
        timeoutSeconds,
        signal,
        onStderr: (line) => onUpdate?.({ content: [{ type: "text", text: `[level1] ${line}` }] }),
      });

      await ingestLevel1Usage(run.runDir, planDir, params.subquestion_index, params.plan_index);

      const level1Artifacts = await readLevel1Artifacts(planDir);
      const resultArtifacts = level1Artifacts.artifacts || [];
      const planRecord = {
        subquestion_index: params.subquestion_index,
        plan_index: params.plan_index,
        analysis_plan: params.analysis_plan,
        work_dir: planDir,
        input_path: level1InputPath,
        result_path: level1ResultPath,
        status: result.ok ? "success" : "failed",
        exit_code: result.exitCode,
        timeout_seconds: timeoutSeconds || undefined,
        level1_run_id: level1Artifacts.run_id,
        conclusions: level1Artifacts.conclusions,
        figure_paths: level1Artifacts.figure_paths,
        statistics: level1Artifacts.statistics,
        level1_evidence: level1Artifacts,
        data_artifacts: level1Artifacts.data_artifacts,
        table_paths: level1Artifacts.table_paths,
        validations: level1Artifacts.validations,
        image_analyses: level1Artifacts.image_analyses,
        artifact_warnings: level1Artifacts.artifact_warnings,
        evidence_notes: level1Artifacts.evidence_notes,
        stderr_tail: result.stderr.slice(-2000),
        artifacts: resultArtifacts,
      };
      if (debugDiskWritesEnabled()) {
        await writeJson(level1ResultPath, planRecord);
      }

      const latestState = await readJson(run.statePath, run.state);
      run.state = {
        ...latestState,
        artifacts: normalizeArtifacts(latestState.artifacts || [], run.runDir),
      };
      const prevPlans: any[] = Array.isArray(run.state.plan_runs) ? run.state.plan_runs : [];
      const nextPlans = [...prevPlans, planRecord];
      await updateState(run, { plan_runs: nextPlans, artifacts: resultArtifacts });
      const currentWorkflow = (Array.isArray(run.state.subquestion_workflows)
        ? run.state.subquestion_workflows
        : []).find((item: Json) => Number(item?.subquestion_index) === Number(params.subquestion_index));
      const existingPlanRuns = Array.isArray(currentWorkflow?.plan_runs) ? currentWorkflow.plan_runs : [];
      await updateSubquestionWorkflow(run, params.subquestion_index, params.subquestion, {
        plan_runs: [...existingPlanRuns, planRecord],
        execution_status: result.ok ? "level1_plan_completed" : "level1_plan_failed",
      });

      await appendStateEntry(pi, {
        run_id: run.runId,
        event: "neuro_l2_run_level1",
        ok: result.ok,
        subquestion_index: params.subquestion_index,
        plan_index: params.plan_index,
      });

      return content({
        run_id: run.runId,
        ok: result.ok,
        exit_code: result.exitCode,
        subquestion_index: params.subquestion_index,
        subquestion: params.subquestion,
        plan_index: params.plan_index,
        analysis_plan: params.analysis_plan,
        work_dir: planDir,
        timeout_seconds: timeoutSeconds || undefined,
        input_path: level1InputPath,
        result_path: level1ResultPath,
        level1_run_id: level1Artifacts.run_id,
        conclusions: level1Artifacts.conclusions,
        figure_paths: level1Artifacts.figure_paths,
        statistics: level1Artifacts.statistics,
        level1_evidence: level1Artifacts,
        data_artifacts: level1Artifacts.data_artifacts,
        table_paths: level1Artifacts.table_paths,
        validations: level1Artifacts.validations,
        image_analyses: level1Artifacts.image_analyses,
        artifact_warnings: level1Artifacts.artifact_warnings,
        evidence_notes: level1Artifacts.evidence_notes,
        stderr_tail: planRecord.stderr_tail,
        artifacts: resultArtifacts,
      });
    },
  });

  // -- Subagent (per-subquestion) conclusion --------------------------------

  pi.registerTool({
    name: "neuro_l2_subagent_conclusion",
    label: "Neuro L2 Subagent Conclusion",
    description: "Aggregate one subquestion's plan results into a subquestion-level conclusion.",
    parameters: Type.Object({
      run_id: Type.String(),
      subquestion_index: Type.Optional(Type.Number()),
      scientific_goal: Type.String(),
      question: Type.String(),
      background: Type.String(),
      subquestion: Type.String(),
      plan_results: Type.Array(Type.Object({
        plan_index: Type.Number(),
        analysis_plan: Type.String(),
        conclusions: Type.Any(),
        statistics: Type.Any(),
        figure_paths: Type.Array(Type.String()),
        level1_evidence: Type.Optional(Type.Any()),
        data_artifacts: Type.Optional(Type.Array(Type.Any())),
        table_paths: Type.Optional(Type.Array(Type.String())),
        validations: Type.Optional(Type.Any()),
        image_analyses: Type.Optional(Type.Any()),
        artifact_warnings: Type.Optional(Type.Array(Type.String())),
        evidence_notes: Type.Optional(Type.Array(Type.String())),
        status: Type.String(),
      })),
      additional_context: Type.Optional(Type.String()),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const config = await loadConfig(ctx.cwd);
      const run = await resolveRun(ctx.cwd, params.run_id);
      const subquestionIndex = subquestionIndexFor(run, params.subquestion, params.subquestion_index);
      const rolePrompt = await readPrompt("subagent_conclusion");
      const prompt = finalizationPrompt("subagent conclusion", "finalize_subagent_conclusion", rolePrompt, [
        `Scientific goal:\n${params.scientific_goal}`,
        `Main question:\n${params.question}`,
        `Background:\n${params.background}`,
        `Subquestion:\n${params.subquestion}`,
        `Plan results:\n${JSON.stringify(params.plan_results, null, 2)}`,
        additionalContextBlock(params.additional_context),
        "Finalize with: { subquestion_conclusion: string, key_findings: string[], confidence: number, limitations: string[] }.",
      ].join("\n\n"));
      const sub = await runSubagent({
        runDir: run.runDir,
        agentName: subquestionAgentName(subquestionIndex, "subagent_conclusion"),
        finalizeTool: "finalize_subagent_conclusion",
        finalizeSchema: Type.Object({
          subquestion_conclusion: Type.String(),
          key_findings: Type.Array(Type.String()),
          confidence: Type.Number(),
          limitations: Type.Array(Type.String()),
        }),
        prompt,
        agentConfig: pickAgentConfig(config, "level2_subagent_conclusion"),
        tools: [],
        signal,
      });
      await updateSubquestionWorkflow(run, subquestionIndex, params.subquestion, {
        subquestion_conclusion: sub.result,
        conclusion_status: sub.ok ? "concluded" : "conclusion_failed",
        conclusion_output_path: sub.output_path,
      });
      await appendStateEntry(pi, {
        run_id: run.runId,
        event: "neuro_l2_subagent_conclusion",
        ok: sub.ok,
        subquestion_index: subquestionIndex,
        subquestion: params.subquestion,
      });
      return content({
        run_id: run.runId,
        subquestion_index: subquestionIndex,
        subquestion: params.subquestion,
        ...exposedSubagent(sub),
      });
    },
  });

  pi.registerTool({
    name: "neuro_l2_subagent_conclusion_review",
    label: "Neuro L2 Subagent Conclusion Review",
    description: "Review one subquestion-level conclusion for evidence consistency and scientific-goal alignment.",
    parameters: Type.Object({
      run_id: Type.String(),
      subquestion_index: Type.Optional(Type.Number()),
      scientific_goal: Type.String(),
      subquestion: Type.String(),
      subquestion_conclusion: Type.Any(),
      plan_results: Type.Array(Type.Object({
        plan_index: Type.Number(),
        analysis_plan: Type.String(),
        conclusions: Type.Any(),
        statistics: Type.Any(),
        figure_paths: Type.Array(Type.String()),
        level1_evidence: Type.Optional(Type.Any()),
        data_artifacts: Type.Optional(Type.Array(Type.Any())),
        table_paths: Type.Optional(Type.Array(Type.String())),
        validations: Type.Optional(Type.Any()),
        image_analyses: Type.Optional(Type.Any()),
        artifact_warnings: Type.Optional(Type.Array(Type.String())),
        evidence_notes: Type.Optional(Type.Array(Type.String())),
        status: Type.String(),
      })),
      additional_context: Type.Optional(Type.String()),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const config = await loadConfig(ctx.cwd);
      const run = await resolveRun(ctx.cwd, params.run_id);
      const subquestionIndex = subquestionIndexFor(run, params.subquestion, params.subquestion_index);
      const rolePrompt = await readPrompt("subagent_conclusion_review");
      const prompt = finalizationPrompt("subagent conclusion review", "finalize_subagent_conclusion_review", rolePrompt, [
        `Scientific goal:\n${params.scientific_goal}`,
        `Subquestion:\n${params.subquestion}`,
        `Subquestion conclusion:\n${JSON.stringify(params.subquestion_conclusion, null, 2)}`,
        `Analysis plan evidence:\n${JSON.stringify(params.plan_results, null, 2)}`,
        additionalContextBlock(params.additional_context),
        "Finalize with: { decision: string, total_score: number, strengths: string[], issues: string[], required_revisions: string[], revised_overall_conclusion: string }.",
      ].join("\n\n"));
      const sub = await runSubagent({
        runDir: run.runDir,
        agentName: subquestionAgentName(subquestionIndex, "subagent_conclusion_review"),
        finalizeTool: "finalize_subagent_conclusion_review",
        finalizeSchema: Type.Object({
          decision: Type.String(),
          total_score: Type.Number(),
          strengths: Type.Array(Type.String()),
          issues: Type.Array(Type.String()),
          required_revisions: Type.Array(Type.String()),
          revised_overall_conclusion: Type.String(),
        }),
        prompt,
        agentConfig: pickAgentConfig(config, "level2_subagent_conclusion_review"),
        tools: [],
        signal,
      });
      if (sub.ok) {
        const latest = await readJson(run.statePath, run.state);
        run.state = {
          ...latest,
          artifacts: normalizeArtifacts(latest.artifacts || [], run.runDir),
        };
        const prevReviews: any[] = Array.isArray(run.state.subquestion_conclusion_reviews)
          ? run.state.subquestion_conclusion_reviews
          : [];
        await updateState(run, {
          subquestion_conclusion_reviews: [
            ...prevReviews,
            {
              subquestion: params.subquestion,
              subquestion_index: subquestionIndex,
              review: sub.result,
            },
          ],
        });
      }
      await updateSubquestionWorkflow(run, subquestionIndex, params.subquestion, {
        subquestion_conclusion_review: sub.result,
        conclusion_review_status: sub.ok ? "reviewed" : "review_failed",
        conclusion_review_decision: sub.result?.decision,
        conclusion_review_output_path: sub.output_path,
      });
      await appendStateEntry(pi, {
        run_id: run.runId,
        event: "neuro_l2_subagent_conclusion_review",
        ok: sub.ok,
        subquestion_index: subquestionIndex,
        subquestion: params.subquestion,
        decision: sub.result?.decision,
      });
      return content({
        run_id: run.runId,
        subquestion_index: subquestionIndex,
        subquestion: params.subquestion,
        ...exposedSubagent(sub),
      });
    },
  });

  // -- Question-level conclusion -------------------------------------------

  pi.registerTool({
    name: "neuro_l2_question_conclusion",
    label: "Neuro L2 Question Conclusion",
    description: "Synthesize a question-level conclusion across all subquestion conclusions.",
    parameters: Type.Object({
      run_id: Type.String(),
      scientific_goal: Type.String(),
      question: Type.String(),
      background: Type.String(),
      subquestion_conclusions: Type.Array(Type.Object({
        subquestion_index: Type.Optional(Type.Number()),
        subquestion: Type.String(),
        subquestion_conclusion: Type.String(),
        key_findings: Type.Array(Type.String()),
        confidence: Type.Number(),
        limitations: Type.Array(Type.String()),
      })),
      plan_results: Type.Optional(Type.Array(Type.Any())),
      additional_context: Type.Optional(Type.String()),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const config = await loadConfig(ctx.cwd);
      const run = await resolveRun(ctx.cwd, params.run_id);
      const rolePrompt = await readPrompt("question_conclusion");
      const evidenceBundle = buildEvidenceBundle(run.runDir, params.subquestion_conclusions, params.plan_results || run.state.plan_runs || []);
      const prompt = finalizationPrompt("question conclusion", "finalize_question_conclusion", rolePrompt, [
        `Scientific goal:\n${params.scientific_goal}`,
        `Main question:\n${params.question}`,
        `Background:\n${params.background}`,
        `Subquestion conclusions:\n${JSON.stringify(params.subquestion_conclusions, null, 2)}`,
        `Subquestion items with analysis evidence:\n${JSON.stringify(evidenceBundle.subquestion_items, null, 2)}`,
        `Evidence catalog:\n${JSON.stringify(evidenceBundle.evidence_catalog, null, 2)}`,
        `Evidence notes:\n${JSON.stringify(evidenceBundle.evidence_notes, null, 2)}`,
        additionalContextBlock(params.additional_context),
        "Finalize with: { question_conclusion: string, overall_findings: string[], confidence: number, limitations: string[], cross_subquestion_reasoning?: string[], per_subquestion_contributions?: [{subquestion_index, subquestion, contribution, evidence_summary}] }.",
      ].join("\n\n"));
      const sub = await runSubagent({
        runDir: run.runDir,
        agentName: "question_conclusion",
        finalizeTool: "finalize_question_conclusion",
        finalizeSchema: Type.Object({
          question_conclusion: Type.String(),
          overall_findings: Type.Array(Type.String()),
          confidence: Type.Number(),
          limitations: Type.Array(Type.String()),
          cross_subquestion_reasoning: Type.Optional(Type.Array(Type.String())),
          per_subquestion_contributions: Type.Optional(Type.Array(Type.Any())),
        }),
        prompt,
        agentConfig: pickAgentConfig(config, "level2_question_conclusion"),
        tools: [],
        signal,
      });
      if (sub.ok) {
        await updateState(run, { question_conclusion: sub.result, evidence_bundle: evidenceBundle });
      }
      await appendStateEntry(pi, { run_id: run.runId, event: "neuro_l2_question_conclusion", ok: sub.ok });
      return content({ run_id: run.runId, ...exposedSubagent(sub) });
    },
  });

  // -- Paper report --------------------------------------------------------

  pi.registerTool({
    name: "neuro_l2_paper_report",
    label: "Neuro L2 Paper Report",
    description: "Generate the final paper report (markdown) from the full level-2 run evidence.",
    parameters: Type.Object({
      run_id: Type.String(),
      scientific_goal: Type.String(),
      question: Type.String(),
      background: Type.String(),
      subquestion_conclusions: Type.Array(Type.Object({
        subquestion_index: Type.Optional(Type.Number()),
        subquestion: Type.String(),
        subquestion_conclusion: Type.String(),
        key_findings: Type.Array(Type.String()),
        confidence: Type.Number(),
        limitations: Type.Array(Type.String()),
      })),
      plan_results: Type.Array(Type.Any()),
      question_conclusion: Type.Optional(Type.Any()),
      additional_context: Type.Optional(Type.String()),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const config = await loadConfig(ctx.cwd);
      const wf = level2WorkflowConfig(config);
      const agentConfig = pickAgentConfig(config, "level2_paper_report");
      const run = await resolveRun(ctx.cwd, params.run_id);
      const rolePrompt = await readPrompt("paper_report");
      const evidenceBundle = buildEvidenceBundle(run.runDir, params.subquestion_conclusions, params.plan_results || []);
      const questionConclusion = params.question_conclusion || run.state.question_conclusion || {};

      // Vision: show the report agent the referenced figures so it can identify
      // panels (A/B/C) and author accurate legends. Bounded + degrades gracefully.
      const visionOn = wf.paper_report_vision && agentConfig.vision === true;
      const selected = visionOn ? selectReportVisionFigures(evidenceBundle.figure_catalog) : [];
      const vision = selected.length ? await loadVisionImages(selected.map((s) => s.absolute_path)) : { images: [], warnings: [] };
      const imageOrderBlock = vision.images.length
        ? `Attached figure images (in order):\n${selected
            .slice(0, vision.images.length)
            .map((s, i) => `[${i + 1}] Figure ${s.figure_number} = ${s.figure_id}`)
            .join("\n")}\nRead each attached image, identify its panels, and write the legend from what you see.`
        : "No figure images are attached; author legends from the text evidence and image_analysis_excerpt only.";

      const prompt = finalizationPrompt("paper report", "finalize_paper_report", rolePrompt, [
        `Scientific goal:\n${params.scientific_goal}`,
        `Main question:\n${params.question}`,
        `Background:\n${params.background}`,
        `Question conclusion:\n${JSON.stringify(questionConclusion, null, 2)}`,
        `Subquestion conclusions:\n${JSON.stringify(params.subquestion_conclusions, null, 2)}`,
        `Subquestion items with evidence:\n${JSON.stringify(evidenceBundle.subquestion_items, null, 2)}`,
        `Figure catalog:\n${JSON.stringify(evidenceBundle.figure_catalog, null, 2)}`,
        `Figure index (human numbering — cite figures in prose as "Figure N"):\n${JSON.stringify(evidenceBundle.figure_index, null, 2)}`,
        `Evidence catalog:\n${JSON.stringify(evidenceBundle.evidence_catalog, null, 2)}`,
        `Evidence notes:\n${JSON.stringify(evidenceBundle.evidence_notes, null, 2)}`,
        imageOrderBlock,
        additionalContextBlock(params.additional_context),
        "Finalize with: { paper_report_markdown: string, title: string, abstract: string, sections: [{heading, body}], figure_legends: [{figure_id, figure_number, title, caption, panels: [{label, description}]}], key_claims: [{claim, figure_id, panel?, data_source, reasoning}], limitations?: string[] }.",
      ].join("\n\n"));

      const sub = await runSubagent({
        runDir: run.runDir,
        agentName: "paper_report",
        finalizeTool: "finalize_paper_report",
        finalizeSchema: Type.Object({
          paper_report_markdown: Type.String(),
          title: Type.String(),
          abstract: Type.String(),
          sections: Type.Array(Type.Object({
            heading: Type.String(),
            body: Type.String(),
          })),
          figure_legends: Type.Optional(Type.Array(Type.Object({
            figure_id: Type.String(),
            figure_number: Type.Optional(Type.Number()),
            title: Type.String(),
            caption: Type.String(),
            panels: Type.Array(Type.Object({
              label: Type.String(),
              description: Type.String(),
            })),
          }))),
          // Objects {claim, figure_id, panel?, data_source, reasoning}; Type.Any keeps
          // backward compatibility with the previous string[] shape.
          key_claims: Type.Optional(Type.Array(Type.Any())),
          limitations: Type.Optional(Type.Array(Type.String())),
        }),
        prompt,
        agentConfig,
        tools: [],
        images: vision.images,
        signal,
      });

      let reportLint: Json | undefined;
      if (sub.ok) {
        const mdPath = join(run.runDir, "paper_report.md");
        await writeText(mdPath, sub.result.paper_report_markdown);
        if (wf.report_lint) {
          reportLint = lintPaperReport(sub.result.paper_report_markdown, evidenceBundle.figure_catalog, sub.result.figure_legends || [], sub.result.key_claims || []);
        }
        await updateState(run, {
          paper_report: sub.result,
          evidence_bundle: evidenceBundle,
          report_lint: reportLint,
        });
      }
      await appendStateEntry(pi, { run_id: run.runId, event: "neuro_l2_paper_report", ok: sub.ok });
      return content({
        run_id: run.runId,
        ok: sub.ok,
        error: sub.error,
        paper_report_path: sub.ok ? join(run.runDir, "paper_report.md") : undefined,
        output_path: sub.output_path,
        vision: { enabled: visionOn, images_attached: vision.images.length, warnings: vision.warnings },
        report_lint: reportLint,
        next_step: sub.ok ? "Call neuro_l2_export_report with this run_id to produce DOCX/PDF." : undefined,
        result: sub.result ? {
          title: sub.result.title,
          abstract: sub.result.abstract,
          sections: sub.result.sections,
          figure_legends: sub.result.figure_legends,
          key_claims: sub.result.key_claims,
          limitations: sub.result.limitations,
        } : undefined,
        debug: { subagent_dir: sub.subagent_dir, snapshot_dir: sub.snapshot_dir },
      });
    },
  });

  // -- Report export (DOCX / PDF) ------------------------------------------

  pi.registerTool({
    name: "neuro_l2_export_report",
    label: "Neuro L2 Export Report",
    description: "Export the final paper_report.md to DOCX and PDF. Best-effort and portable: a format is skipped with a warning when no converter engine is available on the host. The markdown stays the canonical output; a skip is never a failure.",
    parameters: Type.Object({
      run_id: Type.String(),
      formats: Type.Optional(Type.Array(Type.String())),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const config = await loadConfig(ctx.cwd);
      const wf = level2WorkflowConfig(config);
      const run = await resolveRun(ctx.cwd, params.run_id);
      const requested = (params.formats && params.formats.length ? params.formats : ["docx", "pdf"])
        .map((f) => String(f).toLowerCase())
        .filter((f) => (f === "docx" && wf.export_docx) || (f === "pdf" && wf.export_pdf));
      if (!requested.length) {
        return skippedByConfigL2(run.runId, "neuro_l2_export_report", "export_docx/export_pdf");
      }
      const mdPath = join(run.runDir, "paper_report.md");
      if (!existsSync(mdPath)) {
        return content({ ok: false, run_id: run.runId, error: "paper_report.md not found; run neuro_l2_paper_report first.", md_path: mdPath });
      }
      const result = await spawnPythonJson(
        ctx.cwd,
        "internagent/workflow/export_report.py",
        ["--md", mdPath, "--outdir", run.runDir, "--basename", "paper_report", "--formats", requested.join(",")],
        { cwd: run.runDir, timeoutSeconds: 600, signal },
      );
      const payload = result.json || {};
      const outputs = payload.outputs || {};
      await updateState(run, { report_exports: payload });
      await appendStateEntry(pi, { run_id: run.runId, event: "neuro_l2_export_report", ok: result.ok });
      return content({
        run_id: run.runId,
        ok: result.ok,
        error: result.ok ? undefined : (payload.error || result.error),
        md_path: outputs.md || mdPath,
        docx_path: outputs.docx,
        pdf_path: outputs.pdf,
        engines: payload.engines,
        skipped: payload.skipped,
        warnings: payload.warnings,
        stderr_tail: result.ok ? undefined : result.stderr,
      });
    },
  });
}

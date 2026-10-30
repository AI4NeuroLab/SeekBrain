import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { FileDiagnosticSink, FileUsageSink, type DiagnosticWarning } from "../../../core/index.ts";
import type { Json } from "../runtime-types.ts";

export interface ObservabilityServiceDependencies {
  debugDiskWritesEnabled(): boolean;
}

const LOG_TEXT_LIMIT = 4000;
export const READABLE_EVENTS_FILE = "events.jsonl";
export const RAW_COT_FILE = "cot.jsonl";

function shortTimestamp() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return [now.getFullYear(), pad(now.getMonth() + 1), pad(now.getDate()), "-", pad(now.getHours()), pad(now.getMinutes()), pad(now.getSeconds())].join("");
}

export function createObservabilityService(deps: ObservabilityServiceDependencies) {
  const usageSink = new FileUsageSink(() => deps.debugDiskWritesEnabled(), 300);

  function numberValue(value: any) {
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
  }

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
    if (!deps.debugDiskWritesEnabled() || !runDir) return;
    const sink = new FileDiagnosticSink(runDir);
    await sink.appendJsonl(READABLE_EVENTS_FILE, entry, []);
  }

  async function appendRawCotLog(runDir: string | undefined, entry: Json) {
    if (!deps.debugDiskWritesEnabled() || !runDir) return;
    const sink = new FileDiagnosticSink(runDir);
    await sink.appendJsonl(RAW_COT_FILE, entry, []);
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

  async function tryAppendUsageEntry(runDir: string | undefined, component: string, entry: Json) {
    if (!runDir) return;
    try {
      await usageSink.append(runDir, component, entry);
      usageSink.schedule(runDir);
    } catch {
      // Usage accounting must never break the workflow.
    }
  }

  async function flushUsageSummaries() {
    await usageSink.flushAll();
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
    if (!deps.debugDiskWritesEnabled()) return undefined;
    const files = ["input.json", "output.json", "prompt.md", READABLE_EVENTS_FILE, RAW_COT_FILE];
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

  return {
    numberValue,
    readableLogEntriesFromEvent,
    pushReadableLog,
    appendReadableLog,
    appendRawCotLog,
    usageEntry,
    usageEntryFromMessage,
    tryAppendUsageEntry,
    flushUsageSummaries,
    mainSessionStats,
    writeDiagnosticJson,
    writeDiagnosticText,
    writeDiagnosticJsonl,
    snapshotSubagentFiles,
  };
}

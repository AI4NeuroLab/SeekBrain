import { join } from "node:path";
import { FileDiagnosticSink, type DiagnosticWarning } from "../../../core/index.ts";
import type { CodeAgentToolResultHandler } from "../../../workflows/index.ts";
import type { ExistingPiAgentAdapter } from "../../existing-pi-agent-adapter.ts";
import type { ExistingPiCustomTool } from "../../existing-pi-agent-adapter.ts";
import type { Json } from "../runtime-types.ts";
import { RAW_COT_FILE, READABLE_EVENTS_FILE } from "./observability-service.ts";

export interface SubagentRunnerDependencies {
  adapter: ExistingPiAgentAdapter;
  debugDiskWritesEnabled(): boolean;
  usageEntry(component: string, stats: Json, extra?: Json): Json;
  tryAppendUsageEntry(runDir: string | undefined, component: string, entry: Json): Promise<void>;
  writeDiagnosticJson(sink: FileDiagnosticSink, path: string, data: Json, warnings: Json[]): Promise<void>;
  writeDiagnosticText(sink: FileDiagnosticSink, path: string, text: string, warnings: Json[]): Promise<void>;
  writeDiagnosticJsonl(sink: FileDiagnosticSink, path: string, entries: Json[], warnings: Json[]): Promise<void>;
  readableLogEntriesFromEvent(event: Json, scope: string, agent: string): Json[];
  snapshotSubagentFiles(agentDir: string, sink: FileDiagnosticSink, warnings: Json[]): Promise<string | undefined>;
}

export interface RunSubagentOptions {
  runDir: string;
  workDir?: string;
  agentName: string;
  finalizeTool: string;
  finalizeSchema: any;
  prompt: string;
  agentConfig?: Json;
  tools?: string[];
  customTools?: ExistingPiCustomTool[];
  images?: Json[];
  skillPaths?: string[];
  signal?: AbortSignal;
  beforeToolCall?: (event: { toolName: string; toolCallId?: string; args: unknown }) => Promise<void> | void;
  afterToolCall?: CodeAgentToolResultHandler;
}

export function createSubagentRunner(deps: SubagentRunnerDependencies) {
  return async function runSubagent(options: RunSubagentOptions) {
    const agentDir = join(options.runDir, "subagents", options.agentName);
    const inputPath = join(agentDir, "input.json");
    const outputPath = join(agentDir, "output.json");
    const persistSubagentFiles = deps.debugDiskWritesEnabled();
    const diagnosticSink = new FileDiagnosticSink(options.runDir, persistSubagentFiles);
    const diagnosticWarnings: Json[] = [];
    if (persistSubagentFiles) {
      await diagnosticSink.directory(agentDir, diagnosticWarnings as DiagnosticWarning[]);
    }
    const snapshotDir = persistSubagentFiles
      ? await deps.snapshotSubagentFiles(agentDir, diagnosticSink, diagnosticWarnings)
      : undefined;
    if (persistSubagentFiles) {
      await deps.writeDiagnosticJson(diagnosticSink, inputPath, {
        agent_name: options.agentName,
        finalize_tool: options.finalizeTool,
        tools: options.tools || [],
        custom_tools: (options.customTools || []).map((tool) => tool.name),
        skill_paths: options.skillPaths || [],
        prompt: options.prompt,
      }, diagnosticWarnings);
      await deps.writeDiagnosticText(diagnosticSink, join(agentDir, "prompt.md"), options.prompt, diagnosticWarnings);
    }

    const rawWriter = await diagnosticSink.jsonlWriter(join(agentDir, RAW_COT_FILE), diagnosticWarnings as DiagnosticWarning[]);
    const readableWriter = await diagnosticSink.jsonlWriter(join(agentDir, READABLE_EVENTS_FILE), diagnosticWarnings as DiagnosticWarning[]);
    let result: Awaited<ReturnType<ExistingPiAgentAdapter["run"]>>;
    try {
    result = await deps.adapter.run({
      runDir: options.workDir || options.runDir,
      finalizeTool: options.finalizeTool,
      finalizeSchema: options.finalizeSchema,
      prompt: options.prompt,
      agentConfig: options.agentConfig as any,
      tools: options.tools,
      customTools: options.customTools,
      images: options.images,
      skillPaths: options.skillPaths,
      signal: options.signal,
      beforeToolCall: options.beforeToolCall,
      afterToolCall: options.afterToolCall,
      onEvent: event => {
        if (!persistSubagentFiles) return;
        // Delta events contain cumulative partial messages; retain only the delta
        // and store full messages once at message_end to avoid quadratic logs.
        const delta = event.assistantMessageEvent as Json | undefined;
        const raw = event.type === "message_update" ? { type: event.type, assistantMessageEvent: {
          type: delta?.type, delta: delta?.delta, contentIndex: delta?.contentIndex,
        } } : event;
        rawWriter.write(raw);
        try { for (const entry of deps.readableLogEntriesFromEvent(event, "subagent", options.agentName)) readableWriter.write(entry); }
        catch (error) { diagnosticWarnings.push({ type: "diagnostic_write_failed", operation: "readable_event", path: agentDir, error: String(error) }); }
      },
      onFinalize: persistSubagentFiles
        ? async (payload) => deps.writeDiagnosticJson(diagnosticSink, outputPath, payload, diagnosticWarnings)
        : undefined,
    });
    if (result.stats) {
      try {
      await deps.tryAppendUsageEntry(
        options.runDir,
        options.agentName,
        deps.usageEntry(options.agentName, result.stats, { call_id: snapshotDir }),
      );
      } catch (error) { diagnosticWarnings.push({ type: "diagnostic_write_failed", operation: "usage", path: options.runDir, error: String(error) }); }
    }
    } finally { await Promise.all([rawWriter.close(), readableWriter.close()]); }
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
      normal_end: result.normal_end === true,
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
      await deps.writeDiagnosticJson(diagnosticSink, outputPath, failure, diagnosticWarnings);
    }
    return { ...failure, diagnostic_warnings: diagnosticWarnings };
  };
}

import { join } from "node:path";
import { FileDiagnosticSink, type DiagnosticWarning } from "../../../core/index.ts";
import type { CodeAgentToolResultHandler } from "../../../workflows/index.ts";
import type { ExistingPiAgentAdapter } from "../../existing-pi-agent-adapter.ts";
import type { Json } from "../runtime-types.ts";

export interface SubagentRunnerDependencies {
  adapter: ExistingPiAgentAdapter;
  debugDiskWritesEnabled(): boolean;
  pushReadableLog(logs: Json[], event: Json, scope: string, agent: string): void;
  usageEntry(component: string, stats: Json, extra?: Json): Json;
  tryAppendUsageEntry(runDir: string | undefined, component: string, entry: Json): Promise<void>;
  writeDiagnosticJson(sink: FileDiagnosticSink, path: string, data: Json, warnings: Json[]): Promise<void>;
  writeDiagnosticText(sink: FileDiagnosticSink, path: string, text: string, warnings: Json[]): Promise<void>;
  writeDiagnosticJsonl(sink: FileDiagnosticSink, path: string, entries: Json[], warnings: Json[]): Promise<void>;
  snapshotSubagentFiles(agentDir: string, sink: FileDiagnosticSink, warnings: Json[]): Promise<string | undefined>;
}

export interface RunSubagentOptions {
  runDir: string;
  agentName: string;
  finalizeTool: string;
  finalizeSchema: any;
  prompt: string;
  agentConfig?: Json;
  tools?: string[];
  images?: Json[];
  signal?: AbortSignal;
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
        prompt: options.prompt,
      }, diagnosticWarnings);
      await deps.writeDiagnosticText(diagnosticSink, join(agentDir, "prompt.md"), options.prompt, diagnosticWarnings);
    }

    const readableLogs: Json[] = [];
    const result = await deps.adapter.run({
      runDir: options.runDir,
      finalizeTool: options.finalizeTool,
      finalizeSchema: options.finalizeSchema,
      prompt: options.prompt,
      agentConfig: options.agentConfig as any,
      tools: options.tools,
      images: options.images,
      signal: options.signal,
      afterToolCall: options.afterToolCall,
      onEvent: (event) => deps.pushReadableLog(readableLogs, event, "subagent", options.agentName),
      onFinalize: persistSubagentFiles
        ? async (payload) => deps.writeDiagnosticJson(diagnosticSink, outputPath, payload, diagnosticWarnings)
        : undefined,
    });
    if (result.stats) {
      await deps.tryAppendUsageEntry(
        options.runDir,
        options.agentName,
        deps.usageEntry(options.agentName, result.stats, { call_id: snapshotDir }),
      );
    }
    if (persistSubagentFiles) {
      await deps.writeDiagnosticJsonl(diagnosticSink, join(agentDir, "events.jsonl"), readableLogs, diagnosticWarnings);
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
      await deps.writeDiagnosticJson(diagnosticSink, outputPath, failure, diagnosticWarnings);
    }
    return { ...failure, diagnostic_warnings: diagnosticWarnings };
  };
}


import { RESEARCH_CARD_ENTRY, SKILL_CARD_ENTRY } from "./tui/transparency-card.ts";

type Json = Record<string, any>;

export interface RuntimeHookAPI {
  on(event: string, handler: (event: any, context?: any) => any): void;
  appendEntry(customType: string, data: Json): void;
}

export interface RuntimeHookDependencies {
  getActiveRunDir(): string | undefined;
  setActiveRunDir(path: string): void;
  startConfigWatcher(cwd: string, notify?: (message: string, level?: "info" | "warning" | "error") => void): void;
  stopConfigWatcher(): void;
  flushUsageSummaries(): Promise<void>;
  syncWorkflowWritePolicy(cwd: string): Promise<void>;
  usageEntryFromMessage(component: string, message: Json, extra?: Json): Json;
  appendUsage(runDir: string, component: string, entry: Json): Promise<void>;
  readableLogEntries(event: Json, component: string, extension: string): Json[];
  appendReadableLog(runDir: string, entry: Json): Promise<void>;
  transparencyEnabled(): Promise<boolean>;
  readRunState(runDir: string): Promise<Json>;
  researchCard(state: Json): string;
  skillCard(state: Json): string;
  numberValue(value: unknown): number;
}

const RUN_TOOLS = new Set(["neuro_start_research", "neuro_continue_research", "neuro_start_run", "neuro_resume_run"]);

export function registerSeekBrainRuntimeHooks(pi: RuntimeHookAPI, dependencies: RuntimeHookDependencies): void {
  pi.on("session_start", (_event, context) => {
    const notify = (message: string, level: "info" | "warning" | "error" = "info") => {
      try { context?.ui?.notify?.(message, level); } catch { /* optional UI sugar */ }
    };
    dependencies.startConfigWatcher(context.cwd, notify);
  });

  pi.on("session_shutdown", async () => {
    dependencies.stopConfigWatcher();
    await dependencies.flushUsageSummaries();
  });

  pi.on("before_agent_start", async (_event, context) => {
    await dependencies.syncWorkflowWritePolicy(context.cwd);
    dependencies.startConfigWatcher(context.cwd);
  });

  pi.on("turn_end", async (event: Json) => {
    const runDir = dependencies.getActiveRunDir();
    if (!runDir) return;
    const entry = dependencies.usageEntryFromMessage("main", event.message || {}, { turn_index: event.turnIndex });
    if (entry.tokens.total <= 0 && entry.cost <= 0) return;
    await dependencies.appendUsage(runDir, "main", entry);
  });

  pi.on("message_end", async (event: Json) => {
    const runDir = dependencies.getActiveRunDir();
    if (!runDir) return;
    for (const entry of dependencies.readableLogEntries(event, "main", "seekbrain")) {
      await dependencies.appendReadableLog(runDir, entry);
    }
  });

  pi.on("tool_execution_end", async (event: Json) => {
    const resultRunDir = event.result?.details?.run_dir || event.result?.run_dir;
    if (typeof resultRunDir === "string" && RUN_TOOLS.has(event.toolName)) dependencies.setActiveRunDir(resultRunDir);
    const runDir = dependencies.getActiveRunDir();
    if (!runDir) return;
    for (const entry of dependencies.readableLogEntries(event, "main", "seekbrain")) {
      await dependencies.appendReadableLog(runDir, entry);
    }
    if (event.toolName !== "neuro_deep_research" && event.toolName !== "resolve_targeted_skill") return;
    try {
      if (!await dependencies.transparencyEnabled()) return;
      const state = await dependencies.readRunState(runDir);
      const content = event.toolName === "neuro_deep_research" ? dependencies.researchCard(state) : dependencies.skillCard(state);
      if (!content) return;
      pi.appendEntry(event.toolName === "neuro_deep_research" ? RESEARCH_CARD_ENTRY : SKILL_CARD_ENTRY, {
        content,
        run_id: state.run_id,
        tool: event.toolName,
        timestamp: Date.now(),
      });
    } catch {
      // Transparency is best-effort and must never disrupt the run.
    }
  });

  pi.on("after_provider_response", async (event: Json) => {
    const runDir = dependencies.getActiveRunDir();
    if (!runDir || dependencies.numberValue(event.status) < 400) return;
    for (const entry of dependencies.readableLogEntries({ ...event, type: "after_provider_response" }, "main", "seekbrain")) {
      await dependencies.appendReadableLog(runDir, entry);
    }
  });

  pi.on("session_before_compact", async (event: Json) => {
    const runDir = dependencies.getActiveRunDir();
    if (!runDir) return;
    const state = await dependencies.readRunState(runDir);
    return { compaction: { summary: `SeekBrain run ${state.run_id || "unknown"} artifacts: ${JSON.stringify(state.artifacts || {})}`, firstKeptEntryId: event.preparation.firstKeptEntryId, tokensBefore: event.preparation.tokensBefore } };
  });

  pi.on("tool_result", async (event: Json) => {
    if (event.toolName !== "neuro_code") return;
    const details = event.details || {};
    if (!details.blocked_by_dummy_data) return;
    return { content: [...(event.content || []), { type: "text", text: "\n\n⚠️ [SeekBrain] Dummy/synthetic data signal detected in neuro_code output. Consider asking the user for correct data paths or retrying with adjusted code before proceeding." }], details };
  });
}

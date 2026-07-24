import { describe, expect, it } from "vitest";
import { registerSeekBrainRuntimeHooks } from "../../src/extension/runtime-hooks.ts";

function fixture() {
  const handlers = new Map<string, Function>();
  const entries: any[] = [];
  const calls: any[] = [];
  let activeRunDir: string | undefined;
  const pi = {
    on(event: string, handler: Function) { handlers.set(event, handler); },
    appendEntry(customType: string, data: any) { entries.push({ customType, data }); },
  };
  registerSeekBrainRuntimeHooks(pi, {
    getActiveRunDir: () => activeRunDir,
    setActiveRunDir: (path) => { activeRunDir = path; },
    startConfigWatcher: (cwd, notify) => { calls.push(["watch", cwd, Boolean(notify)]); },
    stopConfigWatcher: () => { calls.push(["stop"]); },
    flushUsageSummaries: async () => { calls.push(["flush"]); },
    syncWorkflowWritePolicy: async (cwd) => { calls.push(["policy", cwd]); },
    usageEntryFromMessage: () => ({ tokens: { total: 5 }, cost: 0.1 }),
    appendUsage: async (runDir, component, entry) => { calls.push(["usage", runDir, component, entry.tokens.total]); },
    readableLogEntries: (event) => [{ type: event.type || event.toolName || "message" }],
    appendReadableLog: async (runDir, entry) => { calls.push(["log", runDir, entry.type]); },
    transparencyEnabled: async () => true,
    readRunState: async () => ({ run_id: "run-1", artifacts: [{ path: "figure.png" }] }),
    researchCard: () => "research card",
    skillCard: () => "skill card",
    numberValue: (value) => Number(value || 0),
  });
  return { handlers, entries, calls, getActive: () => activeRunDir };
}

describe("Pi runtime hooks", () => {
  it("registers lifecycle hooks and tracks the active run for usage and logs", async () => {
    const item = fixture();
    expect([...item.handlers.keys()].sort()).toEqual([
      "after_provider_response", "before_agent_start", "message_end", "session_before_compact",
      "session_shutdown", "session_start", "tool_execution_end", "tool_result", "turn_end",
    ]);
    await item.handlers.get("session_start")?.({}, { cwd: "/project", ui: { notify() {} } });
    await item.handlers.get("before_agent_start")?.({}, { cwd: "/project" });
    await item.handlers.get("tool_execution_end")?.({ toolName: "seekbrain_run_start", result: { details: { run_dir: "/run" } } });
    await item.handlers.get("turn_end")?.({ message: {}, turnIndex: 2 });
    await item.handlers.get("message_end")?.({ type: "message_end" });
    expect(item.getActive()).toBe("/run");
    expect(item.calls).toContainEqual(["usage", "/run", "main", 5]);
    expect(item.calls).toContainEqual(["log", "/run", "message_end"]);
    await item.handlers.get("session_shutdown")?.();
    expect(item.calls.slice(-2)).toEqual([["stop"], ["flush"]]);
  });

  it("surfaces transparency, compaction and dummy-data warnings", async () => {
    const item = fixture();
    await item.handlers.get("tool_execution_end")?.({ toolName: "seekbrain_run_start", result: { details: { run_dir: "/run" } } });
    await item.handlers.get("tool_execution_end")?.({ toolName: "seekbrain_deep_research", result: { details: {} } });
    expect(item.entries[0]).toMatchObject({ customType: "seekbrain-research-card", data: { content: "research card", run_id: "run-1", tool: "seekbrain_deep_research" } });
    await item.handlers.get("tool_execution_end")?.({ toolName: "seekbrain_recipe_retrieve", result: { details: {} } });
    expect(item.entries[1]).toMatchObject({ customType: "seekbrain-skill-card", data: { content: "skill card", run_id: "run-1", tool: "seekbrain_recipe_retrieve" } });
    const compact = await item.handlers.get("session_before_compact")?.({ preparation: { firstKeptEntryId: "entry", tokensBefore: 100 } });
    expect(compact.compaction).toMatchObject({ firstKeptEntryId: "entry", tokensBefore: 100 });
    expect(compact.compaction.summary).toContain("run-1");
    const result = await item.handlers.get("tool_result")?.({ toolName: "seekbrain_code_execute", details: { blocked_by_dummy_data: true }, content: [{ type: "text", text: "original" }] });
    expect(result.content).toHaveLength(2);
    expect(result.content[1].text).toContain("Dummy/synthetic data signal");
  });
});

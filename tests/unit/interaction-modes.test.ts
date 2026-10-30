import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ModeController, registerModeCommands } from "../../src/extension/runtime/mode-controller.ts";
import { createScopedWriteTools } from "../../src/extension/runtime/shared/scoped-write-tools.ts";
import { createBashTool } from "@earendil-works/pi-coding-agent";
import { activityLines } from "../../src/extension/tui/research-activity.ts";

const dirs: string[] = [];
afterEach(async () => { delete process.env.SEEKBRAIN_INTERACTION_MODE; await Promise.all(dirs.splice(0).map(path => rm(path, { recursive: true, force: true }))); });
async function directory() { const path = await mkdtemp(join(tmpdir(), "seekbrain-modes-")); dirs.push(path); return path; }
function harness() {
  const handlers = new Map<string, any[]>(), commands = new Map<string, any>(), entries: any[] = [], sent: string[] = [];
  const pi: any = { registerCommand: (name: string, command: any) => commands.set(name, command), on: (name: string, handler: any) => handlers.set(name, [...(handlers.get(name) || []), handler]),
    appendEntry: (customType: string, data: any) => entries.push({ type: "custom", customType, data }), sendUserMessage: (text: string) => sent.push(text), getAllTools: () => ["read", "write", "bash", "seekbrain_literature_search", "seekbrain_paper_read", "seekbrain_plan_generate", "seekbrain_execution_run"].map(name => ({ name })), setActiveTools: vi.fn() };
  const ctx: any = { cwd: "/tmp", isIdle: () => true, waitForIdle: vi.fn(async () => {}), abort: vi.fn(), sessionManager: { getBranch: () => entries }, ui: { setStatus: vi.fn(), notify: vi.fn() } };
  const controller = registerModeCommands(pi);
  const emit = async (name: string, event = {}) => { let result; for (const handler of handlers.get(name) || []) result = await handler(event, ctx); return result; };
  return { controller, commands, entries, sent, pi, ctx, emit };
}
describe("interaction modes", () => {
  it("keeps web tools disabled across modes while retaining the paired literature tools", () => {
    const controller = new ModeController();
    controller.webSearchEnabled = false;
    for (const mode of ["ask", "plan", "research", "deep-research"] as const) {
      controller.mode = mode;
      for (const name of ["web_search", "fetch_content", "get_search_content"]) expect(controller.allows(name)).toBe(false);
      for (const name of ["seekbrain_literature_search", "seekbrain_paper_read"]) expect(controller.allows(name)).toBe(true);
    }
    controller.webSearchEnabled = true;
    expect(controller.allows("web_search")).toBe(true);
  });
  it("defaults to Research, switches without submitting a task, and forwards only an explicit command request", async () => {
    const h = harness(); await h.emit("session_start"); expect(h.controller.mode).toBe("research");
    await h.commands.get("plan").handler("", h.ctx); expect(h.sent).toEqual([]); expect(h.controller.mode).toBe("plan");
    await h.commands.get("plan").handler("Write analyze.json", h.ctx); expect(h.sent).toEqual(["Write analyze.json"]);
    await h.commands.get("research").handler("", h.ctx); expect(h.sent).toHaveLength(1);
    expect(h.ctx.ui.setStatus.mock.calls.some((call: any[]) => call[1] === "Research")).toBe(true);
  });
  it("restores mode and project in a resumed session; explicit CLI mode overrides only the initial restore", async () => {
    process.env.SEEKBRAIN_INTERACTION_MODE = "ask";
    const h = harness(); h.entries.push({ type: "custom", customType: "seekbrain-mode", data: { mode: "plan", project: "/tmp/my-study" } });
    process.env.SEEKBRAIN_INTERACTION_MODE = "research"; // Later host changes must not affect this session.
    await h.emit("session_start"); expect(h.controller.mode).toBe("ask"); expect(h.controller.project).toBe("/tmp/my-study");
    await h.emit("session_start"); expect(h.controller.mode).toBe("plan");
    h.entries.length = 0; await h.emit("session_start"); expect(h.controller.mode).toBe("research"); expect(h.controller.project).toBeUndefined();
  });
  it("allows inspection commands in Ask and Plan while restricting workflow tools by mode", async () => {
    const h = harness(); await h.commands.get("ask").handler("", h.ctx);
    expect(await h.emit("tool_call", { toolName: "read" })).toBeUndefined();
    expect(await h.emit("tool_call", { toolName: "seekbrain_paper_read" })).toBeUndefined();
    expect(await h.emit("tool_call", { toolName: "bash" })).toBeUndefined();
    expect(h.pi.setActiveTools).toHaveBeenLastCalledWith(["read", "bash", "seekbrain_literature_search", "seekbrain_paper_read"]);
    for (const toolName of ["write", "edit", "codemode", "seekbrain_research_start", "seekbrain_plan_generate", "seekbrain_formulation_generate", "seekbrain_execution_run", "seekbrain_report_generate"]) {
      expect((await h.emit("tool_call", { toolName })).block).toBe(true);
      await expect(h.controller.run(toolName, undefined, async () => "mutated")).rejects.toThrow("unavailable");
    }
    await h.commands.get("plan").handler("", h.ctx);
    expect(h.controller.allows("seekbrain_plan_generate")).toBe(true);
    expect(await h.emit("tool_call", { toolName: "bash" })).toBeUndefined();
    expect(h.pi.setActiveTools).toHaveBeenLastCalledWith(["read", "bash", "seekbrain_literature_search", "seekbrain_paper_read", "seekbrain_plan_generate"]);
    expect(h.controller.allows("seekbrain_execution_run")).toBe(false);
    expect(h.controller.allows("seekbrain_formulation_generate")).toBe(false); expect(h.controller.allows("seekbrain_report_generate")).toBe(false);
  });
  it("enables Deep Research without submitting work on a mode-only switch", async () => {
    const h = harness(); await h.commands.get("deep-research").handler("", h.ctx);
    expect(h.sent).toEqual([]); expect(h.controller.mode).toBe("deep-research");
    expect(h.controller.allows("read")).toBe(true); expect(h.controller.allows("seekbrain_research_decide")).toBe(true);
    expect(await h.emit("input", { text: "Run the task" })).toBeUndefined();
    await h.commands.get("deep-research").handler("Analyze everything", h.ctx);
    expect(h.sent).toEqual(["Analyze everything"]);
    for (const mode of ["ask", "plan", "research"] as const) {
      await h.commands.get(mode).handler("", h.ctx);
      expect(h.controller.allows("seekbrain_research_decide")).toBe(false);
    }
  });
  it("aborts and drains current work before applying another mode and blocks new dispatch during the transition", async () => {
    const controller = new ModeController(); const started = vi.fn(), stopped = vi.fn();
    let release!: () => void;
    const work = controller.run("seekbrain_execution_run", undefined, signal => new Promise(resolve => {
      started(); signal.addEventListener("abort", () => { stopped(); release = () => resolve("saved"); });
    }));
    await Promise.resolve();
    const switching = controller.switchTo("ask", { isIdle: () => false, abort: vi.fn(), waitForIdle: async () => {} });
    expect(started).toHaveBeenCalledOnce(); expect(stopped).toHaveBeenCalledOnce(); expect(controller.mode).toBe("research"); expect(controller.pending).toBe("ask");
    await expect(controller.run("seekbrain_execution_run", undefined, async () => "new")).rejects.toThrow("switching");
    release(); expect(await work).toBe("saved"); await switching; expect(controller.mode).toBe("ask");
  });
  it("limits scoped plan write/edit tools to requested files and rejects output symlinks", async () => {
    const cwd = await directory(), target = join(cwd, "analyze.json"); await writeFile(join(cwd, "data.txt"), "source");
    const tools = createScopedWriteTools(cwd, [target]);
    await tools[0].execute("write", { path: target, content: '{"goal":"old"}' });
    await tools[1].execute("edit", { path: target, edits: [{ oldText: '"old"', newText: '"new"' }] });
    expect(JSON.parse(await readFile(target, "utf8"))).toEqual({ goal: "new" });
    await expect(tools[0].execute("invalid", { path: target, content: "not JSON" })).rejects.toThrow();
    expect(JSON.parse(await readFile(target, "utf8"))).toEqual({ goal: "new" });
    await expect(tools[0].execute("bad", { path: "data.txt", content: "changed" })).rejects.toThrow("outside");
    const link = join(cwd, "link.json"); await symlink(join(cwd, "data.txt"), link);
    await expect(createScopedWriteTools(cwd, [link])[0].execute("bad", { path: link, content: "changed" })).rejects.toThrow("Symlink");
    expect(await readFile(join(cwd, "data.txt"), "utf8")).toBe("source");
  });
  it("reads existing material through Ask's command tool", async () => {
    const h = harness(); await h.commands.get("ask").handler("", h.ctx);
    const cwd = await directory(), file = join(cwd, "notes.md"); await writeFile(file, "Existing background material.");
    const result = await h.controller.run("bash", undefined, signal => createBashTool(cwd).execute("read", { command: "cat notes.md" }, signal));
    expect(result.content.filter(part => part.type === "text").map(part => part.text).join("\n")).toContain("Existing background material.");
    expect(await readFile(file, "utf8")).toBe("Existing background material.");
  });
  it("keeps the full project path, times the current operation and shows only active or failed tasks", () => {
    const projectPath = "/mnt/shared-storage-gpfs2/ai4neuro-share/xiangpeishan/BrainAtlas/Q1_Subclass_diversification/results_20261014_19";
    expect(activityLines({ projectPath, activity: "Executing tasks", elapsedMs: 80_000,
      tasks: [{ id: "T1", status: "complete" }, { id: "T2", status: "running" }, { id: "T3", status: "failed" }, { id: "T4", status: "pending" }, { id: "T5", status: "partial" }], outputs: []
    })).toEqual([projectPath, "Executing tasks  1m20s", "  ● T2", "  × T3"]);
    expect(activityLines({ activity: "", tasks: [{ id: "T1", status: "complete" }], outputs: ["report-0001.pdf"] })).toEqual(["report-0001.pdf"]);
  });
});

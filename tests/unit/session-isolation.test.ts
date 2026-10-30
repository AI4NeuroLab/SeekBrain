import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import registerSeekBrain from "../../src/extension/index.ts";
import { getModeController } from "../../src/extension/runtime/mode-controller.ts";
import { createConfigService } from "../../src/extension/runtime/shared/config-service.ts";
import { withModelEnvironment } from "../../src/extension/runtime/shared/scoped-model-runtime.ts";
import { StudyWorkflow } from "../../src/workflows/unified/study-workflow.ts";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });
async function folder() { const root = await mkdtemp(join(tmpdir(), "seekbrain-session-isolation-")); roots.push(root); return root; }

function fixture(cwd: string, env: NodeJS.ProcessEnv) {
  const handlers = new Map<string, Function[]>(), tools = new Map<string, any>(), commands = new Map<string, any>();
  const entries: any[] = [{ type: "message", id: "request", message: { role: "user", content: "Prepare a scientific plan" } }];
  const statuses = new Map<string, string>();
  const pi: any = {
    on(name: string, fn: Function) { handlers.set(name, [...(handlers.get(name) || []), fn]); },
    registerTool(tool: any) { tools.set(tool.name, tool); }, registerCommand(name: string, value: any) { commands.set(name, value); },
    registerMessageRenderer() {}, getAllTools: () => [...tools.values()], setActiveTools() {}, sendMessage() {},
    appendEntry(customType: string, data: any) { entries.push({ type: "custom", customType, data }); },
  };
  const ctx: any = { cwd, hasUI: false, isIdle: () => true, waitForIdle: async () => {},
    sessionManager: { getBranch: () => entries },
    ui: { setStatus: (key: string, value: string) => statuses.set(key, value), notify() {}, setWidget() {} } };
  registerSeekBrain(pi, { projectRoot: cwd, env });
  const fire = async (name: string, event: any = {}) => { for (const fn of handlers.get(name) || []) await fn(event, ctx); };
  return { pi, ctx, tools, commands, statuses, fire };
}

describe("sessions sharing the cached SeekBrain extension factory", () => {
  it("keeps project configuration, active studies, logs, and shutdown independent", async () => {
    const root = await folder(), a = join(root, "a"), b = join(root, "b");
    await Promise.all([mkdir(a), mkdir(b)]);
    for (const [path, enabled] of [[a, false], [b, true]] as const) await writeFile(join(path, "seekbrain.config.yaml"), `workflow:\n  debug_disk_writes: true\n  seekbrain:\n    web_search: ${enabled}\n`);
    const env = { SEEKBRAIN_USER_CONFIG: join(root, "missing.yaml") };
    const one = fixture(a, { ...env, SEEKBRAIN_INTERACTION_MODE: "plan" });
    const two = fixture(b, env), sameProject = fixture(a, env);
    try {
      await Promise.all([one.fire("session_start"), two.fire("session_start"), sameProject.fire("session_start")]);
      expect(getModeController(one.pi).mode).toBe("plan");
      expect(getModeController(two.pi).mode).toBe("research");
      expect(getModeController(one.pi).webSearchEnabled).toBe(false);
      expect(getModeController(two.pi).webSearchEnabled).toBe(true);
      const started = await one.tools.get("seekbrain_research_start").execute("a", { project_dir: "study-a" }, undefined, undefined, one.ctx);
      expect(started.details.project_dir).toBe(join(a, "study-a"));
      await one.fire("tool_execution_end", { toolName: "seekbrain_research_start", result: started });
      const status = await two.tools.get("seekbrain_system_check").execute("b", {}, undefined, undefined, two.ctx);
      const same = await sameProject.tools.get("seekbrain_system_check").execute("c", {}, undefined, undefined, sameProject.ctx);
      expect(status.details.run_count).toBe(0); expect(same.details.run_count).toBe(0);
      await one.fire("message_end", { type: "message_end", message: { role: "assistant", content: [{ type: "text", text: "only-project-a" }] } });
      expect(await readFile(join(a, "study-a/.seekbrain/cot.jsonl"), "utf8")).toContain("only-project-a");
      await expect(readFile(join(b, "study-a/.seekbrain/cot.jsonl"))).rejects.toThrow();
      await one.fire("session_shutdown");
      await two.fire("before_agent_start", { systemPromptOptions: { sections: [] } });
      expect(getModeController(two.pi).mode).toBe("research");
    } finally { await Promise.all([two.fire("session_shutdown"), sameProject.fire("session_shutdown")]); }
  });

  it("cancels only the mode controller that was switched", async () => {
    const root = await folder(), a = fixture(root, {}), b = fixture(root, {});
    const controllerA = getModeController(a.pi), controllerB = getModeController(b.pi);
    let signalB: AbortSignal | undefined, finishB!: () => void;
    const first = controllerA.run("seekbrain_execution_run", undefined, signal => new Promise<void>(done => signal.addEventListener("abort", () => done(), { once: true })));
    const second = controllerB.run("seekbrain_execution_run", undefined, signal => new Promise<void>(done => { signalB = signal; finishB = done; }));
    await Promise.resolve(); await controllerA.switchTo("ask", a.ctx); await first;
    expect(signalB?.aborted).toBe(false); expect(controllerB.mode).toBe("research");
    finishB(); await second;
  });

  it("loads different .env files without changing the host environment", async () => {
    const root = await folder(), a = join(root, "a"), b = join(root, "b"); await Promise.all([mkdir(a), mkdir(b)]);
    await writeFile(join(a, ".env"), "SEEKBRAIN_TEST_SCOPED_VALUE=a\n"); await writeFile(join(b, ".env"), "SEEKBRAIN_TEST_SCOPED_VALUE=b\n");
    const before = process.env.SEEKBRAIN_TEST_SCOPED_VALUE;
    const options = { defaultConfigPath: resolve("config/default.yaml"), configFile: "seekbrain.config.yaml", env: {} };
    const [envA, envB] = await Promise.all([createConfigService({ ...options, projectRoot: a }).loadEnv(a), createConfigService({ ...options, projectRoot: b }).loadEnv(b)]);
    expect(envA.SEEKBRAIN_TEST_SCOPED_VALUE).toBe("a"); expect(envB.SEEKBRAIN_TEST_SCOPED_VALUE).toBe("b"); expect(process.env.SEEKBRAIN_TEST_SCOPED_VALUE).toBe(before);
    const streamSimple = vi.fn(), base = { streamSimple };
    withModelEnvironment(base, envA).streamSimple({}, {}, {});
    withModelEnvironment(base, envB).streamSimple({}, {}, {});
    expect(streamSimple.mock.calls[0][2].env.SEEKBRAIN_TEST_SCOPED_VALUE).toBe("a"); expect(streamSimple.mock.calls[1][2].env.SEEKBRAIN_TEST_SCOPED_VALUE).toBe("b");
  });

  it("refuses a concurrent writer to the same study across workflow instances", async () => {
    const root = await folder(); let started!: () => void, finish!: () => void;
    const entered = new Promise<void>(done => { started = done; });
    const gate = new Promise<void>(done => { finish = done; });
    const one = new StudyWorkflow({ runAgent: async () => { started(); await gate; throw new Error("test complete"); } });
    const two = new StudyWorkflow({ runAgent: async () => { throw new Error("second writer must not reach a model"); } });
    const created = await one.start({ cwd: root, projectPath: "study", request: "Plan a study" });
    const runA = await one.resolve(root, { runId: created.run_id }), runB = await two.resolve(root, { projectPath: "study" });
    const pending = one.plan(runA).catch(error => error);
    try {
      await entered;
      await expect(two.plan(runB)).rejects.toThrow("active workflow");
      await expect(two.start({ cwd: root, projectPath: "study", request: "A conflicting request" })).rejects.toThrow("active workflow");
      expect(JSON.parse(await readFile(runA.statePath, "utf8")).original_request).toBe("Plan a study");
    }
    finally { finish(); await pending; }
  });
});

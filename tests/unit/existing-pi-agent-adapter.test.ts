import { describe, expect, it } from "vitest";
import { ExistingPiAgentAdapter } from "../../src/extension/existing-pi-agent-adapter.ts";

describe("ExistingPiAgentAdapter", () => {
  it("shares effective shell settings and the configured Python interpreter with subagents", async () => {
    let finalize: any, bashOptions: any, sessionOptions: any;
    const settings = { getShellPath: () => "C:/Custom Git/bin/bash.exe", getShellCommandPrefix: () => "export SCIENCE=1" };
    const sdk = {
      defineTool(definition: any) { if (definition.name === "finish") finalize = definition; return definition; },
      SettingsManager: { create: () => settings },
      ModelRuntime: { create: async () => ({ refresh: async () => {} }) },
      SessionManager: { inMemory: () => ({}) },
      createBashToolDefinition(_cwd: string, options: any) { bashOptions = options; return { name: "bash" }; },
      async createAgentSession(options: any) {
        sessionOptions = options;
        return { session: { subscribe: () => () => {}, async prompt() { await finalize.execute("done", { ok: true }); }, async dispose() {} } };
      },
    };
    const adapter = new ExistingPiAgentAdapter({
      codingSdkLoader: async () => sdk,
      loadEnvironment: async () => ({ SEEKBRAIN_PYTHON: "C:/Research Python/python.exe", SCIENCE: "yes" }),
    });
    const result = await adapter.run({ runDir: "/tmp/run", finalizeTool: "finish", finalizeSchema: {}, prompt: "analyze", tools: ["bash"] });
    expect(result.ok).toBe(true);
    expect(sessionOptions.settingsManager).toBe(settings);
    expect(bashOptions).toMatchObject({ shellPath: "C:/Custom Git/bin/bash.exe", commandPrefix: "export SCIENCE=1" });
    expect(bashOptions.spawnHook({ command: "analyze", env: { PATH: "tools", PI_SESSION_ID: "session" } }).env)
      .toMatchObject({ PATH: "tools", PI_SESSION_ID: "session", SCIENCE: "yes", SEEKBRAIN_PYTHON: "C:/Research Python/python.exe" });
    expect(sessionOptions.customTools.find((tool: any) => tool.name === "bash").promptGuidelines.join(" ")).toContain('$SEEKBRAIN_PYTHON');
  });
  it("registers explicit skill resources only for the requesting session", async () => {
    let finalize: any;
    const sessions: any[] = [], loaders: any[] = [];
    const reload = async () => {};
    const sdk = {
      defineTool: (definition: any) => { finalize = definition; return definition; },
      SessionManager: { inMemory: (cwd: string) => ({ cwd }) },
      DefaultResourceLoader: class { options: any; reload = reload; constructor(options: any) { this.options = options; loaders.push(this); } },
      async createAgentSession(options: any) {
        sessions.push(options);
        return { session: { subscribe: () => () => {}, async prompt() { await finalize.execute("finish", { answer: 1 }); }, async dispose() {} } };
      },
    };
    const adapter = new ExistingPiAgentAdapter({ codingSdkLoader: async () => sdk, agentDir: "/tmp/pi" });
    const base = { runDir: "/tmp/report-outside-package", finalizeTool: "finish", finalizeSchema: {}, prompt: "work", tools: ["read"] };
    expect((await adapter.run({ ...base, skillPaths: ["/tmp/package/skills/report"] })).ok).toBe(true);
    expect((await adapter.run(base)).ok).toBe(true);
    expect(loaders).toHaveLength(1);
    expect(loaders[0].options).toMatchObject({ cwd: base.runDir, additionalSkillPaths: ["/tmp/package/skills/report"] });
    expect(sessions[0].resourceLoader).toBe(loaders[0]);
    expect(sessions[1].resourceLoader).toBeUndefined();
  });
  it("preserves Pi session tools, model policy, images, events, finalization and usage", async () => {
    let sessionOptions: any;
    let promptOptions: any;
    let finalTool: any;
    let searchTool: any;
    const events: unknown[] = [];
    const sdk = {
      defineTool(definition: any) {
        if (definition.name === "finish") finalTool = definition;
        if (definition.name === "search_literature") searchTool = definition;
        return definition;
      },
      SessionManager: { inMemory: (cwd: string) => ({ cwd }) },
      async createAgentSession(options: any) {
        sessionOptions = options;
        return { session: {
          subscribe(handler: (event: any) => void) { handler({ type: "agent_start" }); return () => {}; },
          async prompt(_prompt: string, options?: any) {
            promptOptions = options;
            await finalTool.execute("call", { answer: 42 });
          },
          getSessionStats() { return { tokens: { total: 7 }, cost: 0.2 }; },
          async dispose() {},
        } };
      },
      ModelRuntime: { create: async () => ({ async refresh() {}, getModel: () => ({ id: "resolved-model" }) }) },
    };
    const adapter = new ExistingPiAgentAdapter({ codingSdkLoader: async () => sdk, agentDir: "/tmp/pi-agent" });
    const result = await adapter.run({
      runDir: "/tmp/run",
      finalizeTool: "finish",
      finalizeSchema: {},
      prompt: "work",
      tools: ["read"],
      customTools: [{
        name: "search_literature",
        description: "search",
        promptSnippet: "Find research papers.",
        promptGuidelines: ["Search relevant literature and cite consulted papers."],
        parameters: {},
        async execute() { return { content: [{ type: "text", text: "evidence" }] }; },
      }],
      images: [{ type: "image", data: "x" }],
      agentConfig: { provider: "provider", model: "model", thinking: "high" },
      onEvent: (event) => events.push(event),
    });

    expect(result).toMatchObject({ ok: true, result: { answer: 42 }, stats: { cost: 0.2 } });
    expect(sessionOptions.tools).toEqual(["read", "search_literature", "finish"]);
    expect(sessionOptions.customTools).toEqual([finalTool, searchTool]);
    expect(searchTool.promptSnippet).toBe("Find research papers.");
    expect(searchTool.promptGuidelines).toEqual(["Search relevant literature and cite consulted papers."]);
    expect(sessionOptions.model).toEqual({ id: "resolved-model" });
    expect(sessionOptions.thinkingLevel).toBe("high");
    expect(promptOptions).toEqual({ images: [{ type: "image", data: "x" }] });
    expect(events).toHaveLength(1);
  });

  it("maps an AbortSignal to the existing subagent failure contract and disposes the session", async () => {
    let disposed = false;
    const sdk = {
      defineTool: (definition: any) => definition,
      SessionManager: { inMemory: () => ({}) },
      async createAgentSession() {
        return { session: {
          subscribe: () => () => {},
          prompt: () => new Promise(() => {}),
          getSessionStats: () => ({ tokens: { total: 1 } }),
          async dispose() { disposed = true; },
        } };
      },
    };
    const signal = new AbortController();
    signal.abort();
    const result = await new ExistingPiAgentAdapter({ codingSdkLoader: async () => sdk }).run({
      runDir: "/tmp/run",
      finalizeTool: "finish",
      finalizeSchema: {},
      prompt: "work",
      signal: signal.signal,
    });
    expect(result).toMatchObject({ ok: false, error: "Error: subagent aborted by caller" });
    expect(disposed).toBe(true);
  });

  it("composes a caller tool-result interceptor after Pi's existing hook", async () => {
    let finalTool: any;
    let effectiveResult: any;
    const agent: any = {
      afterToolCall: async () => ({
        content: [{ type: "text", text: "existing hook output" }],
        details: { existing: true },
        isError: true,
      }),
    };
    const sdk = {
      defineTool(definition: any) { finalTool = definition; return definition; },
      SessionManager: { inMemory: () => ({}) },
      async createAgentSession() {
        return { session: {
          agent,
          subscribe: () => () => {},
          async prompt() {
            effectiveResult = await agent.afterToolCall({
              toolCall: { id: "bash-1", name: "bash" },
              args: { command: "python analysis.py" },
              result: { content: [{ type: "text", text: "raw" }], details: {} },
              isError: true,
            });
            await finalTool.execute("call", { answer: 1 });
          },
          getSessionStats: () => ({}),
          async dispose() {},
        } };
      },
    };
    const adapter = new ExistingPiAgentAdapter({ codingSdkLoader: async () => sdk });
    const result = await adapter.run({
      runDir: "/tmp/run",
      finalizeTool: "finish",
      finalizeSchema: {},
      prompt: "work",
      afterToolCall: async (event) => ({
        content: [...event.content, { type: "text", text: "dependency approval output" }],
        details: { ...(event.details as any), intercepted: true },
      }),
    });

    expect(result.ok).toBe(true);
    expect(effectiveResult).toMatchObject({
      content: [
        { type: "text", text: "existing hook output" },
        { type: "text", text: "dependency approval output" },
      ],
      details: { existing: true, intercepted: true },
      isError: true,
    });
  });

  it("reports a tool call before execution while preserving Pi's existing hook", async () => {
    let finalTool: any;
    const order: string[] = [];
    const agent: any = {
      beforeToolCall: async () => { order.push("existing"); return { args: { preserved: true } }; },
    };
    const sdk = {
      defineTool(definition: any) { finalTool = definition; return definition; },
      SessionManager: { inMemory: () => ({}) },
      async createAgentSession() {
        return { session: {
          agent,
          subscribe: () => () => {},
          async prompt() {
            const before = await agent.beforeToolCall({ toolCall: { id: "read-1", name: "read" }, args: { path: "metadata.json" } });
            expect(before).toEqual({ args: { preserved: true } });
            await finalTool.execute("call", { answer: 1 });
          },
          getSessionStats: () => ({}),
          async dispose() {},
        } };
      },
    };
    const result = await new ExistingPiAgentAdapter({ codingSdkLoader: async () => sdk }).run({
      runDir: "/tmp/run",
      finalizeTool: "finish",
      finalizeSchema: {},
      prompt: "work",
      beforeToolCall: ({ toolName }) => { order.push(`caller:${toolName}`); },
    });
    expect(result.ok).toBe(true);
    expect(order).toEqual(["existing", "caller:read"]);
  });
});

import { describe, expect, it } from "vitest";
import { ExistingPiAgentAdapter } from "../../src/extension/existing-pi-agent-adapter.ts";

describe("ExistingPiAgentAdapter", () => {
  it("preserves Pi session tools, model policy, images, events, finalization and usage", async () => {
    let sessionOptions: any;
    let promptOptions: any;
    let finalTool: any;
    const events: unknown[] = [];
    const sdk = {
      defineTool(definition: any) { finalTool = definition; return definition; },
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
      AuthStorage: { create: () => ({}) },
      ModelRegistry: { create: () => ({ find: () => ({ id: "resolved-model" }) }) },
    };
    const adapter = new ExistingPiAgentAdapter({ codingSdkLoader: async () => sdk, agentDir: "/tmp/pi-agent" });
    const result = await adapter.run({
      runDir: "/tmp/run",
      finalizeTool: "finish",
      finalizeSchema: {},
      prompt: "work",
      tools: ["read"],
      images: [{ type: "image", data: "x" }],
      agentConfig: { provider: "provider", model: "model", thinking: "high" },
      onEvent: (event) => events.push(event),
    });

    expect(result).toMatchObject({ ok: true, result: { answer: 42 }, stats: { cost: 0.2 } });
    expect(sessionOptions.tools).toEqual(["read", "finish"]);
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
});

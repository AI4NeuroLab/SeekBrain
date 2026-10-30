import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { createSetupManager, customProviderConfig, mainstreamModels } from "../../src/cli/setup.mjs";
import { ExistingPiAgentAdapter } from "../../src/extension/existing-pi-agent-adapter.ts";

describe("Pi 1.2 compatibility", () => {
  it("updates an existing setup-created relay without changing its existing models", async () => {
    const home = await mkdtemp(join(tmpdir(), "seekbrain-relay-upgrade-"));
    const agentDir = join(home, ".pi", "agent");
    let runtime: ModelRuntime;
    try {
      await mkdir(agentDir, { recursive: true });
      const oldModel = { id: "gpt-5.6-sol", name: "Existing model", api: "openai-completions", input: ["text", "image"], contextWindow: 200000, maxTokens: 32000 };
      await writeFile(join(agentDir, "models.json"), JSON.stringify({ providers: {
        "openai-relay": { name: "OpenAI Custom", baseUrl: "https://example.invalid/v1", api: "openai-completions", models: [oldModel] },
      } }));
      await createSetupManager({ homeDir: home, allowModelNetwork: false,
        runtimeFactory: async (options: any) => (runtime = await ModelRuntime.create(options)),
      });
      expect(runtime!.getModel("openai-relay", "gpt-6.1-sol")?.api).toBe("openai-responses");
      expect(runtime!.getModel("openai-relay", "gpt-6-astra")?.api).toBe("openai-responses");
      expect(runtime!.getModel("openai-relay", oldModel.id)?.api).toBe("openai-completions");
    } finally { await rm(home, { recursive: true, force: true }); }
  });
  it("reloads a custom Responses model using the real Pi runtime", async () => {
    const home = await mkdtemp(join(tmpdir(), "seekbrain-pi120-"));
    const agentDir = join(home, ".pi", "agent");
    let runtime: ModelRuntime;
    try {
      await mkdir(agentDir, { recursive: true });
      const manager = await createSetupManager({
        homeDir: home,
        allowModelNetwork: false,
        runtimeFactory: async (options: any) => (runtime = await ModelRuntime.create(options)),
      });
      const model = runtime!.getModel("openai", "gpt-6.1-sol")!;
      expect(model?.api).toBe("openai-responses");
      expect(runtime!.getModel("openai", "gpt-6-astra")).toBeDefined();
      const config = customProviderConfig({ id: "openai", name: "OpenAI" }, "https://example.invalid/v1", [model]);
      expect(config.models[0].api).toBe("openai-responses");
      expect(config.models[0].thinkingLevelMap).toEqual(model.thinkingLevelMap);
      await writeFile(join(agentDir, "models.json"), JSON.stringify({ providers: { "openai-relay": config } }));
      await manager.reload();
      expect(runtime!.getModel("openai-relay", "gpt-6.1-sol")?.api).toBe("openai-responses");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("does not hide future vision models in the legacy setup selector", () => {
    const models = ["gpt-6.1-sol", "future-model"].map(id => ({ id, input: ["text", "image"], reasoning: true }));
    expect(mainstreamModels(models, "openai").map((model: any) => model.id)).toEqual(["gpt-6.1-sol", "future-model"]);
  });

  it("rejects an unknown explicit subagent model instead of selecting the default", async () => {
    let sessionCreated = false;
    const sdk = {
      defineTool: (tool: any) => tool,
      SessionManager: { inMemory() { return {}; } },
      ModelRuntime: { async create() { return { async refresh() {}, getModel() { return undefined; } }; } },
      async createAgentSession() { sessionCreated = true; throw new Error("unexpected fallback"); },
    };
    const result = await new ExistingPiAgentAdapter({ codingSdkLoader: async () => sdk }).run({
      runDir: "/tmp/test-run", finalizeTool: "finish", finalizeSchema: {}, prompt: "test",
      agentConfig: { provider: "openai-relay", model: "missing" },
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Configured subagent model is unavailable: openai-relay/missing");
    expect(sessionCreated).toBe(false);
  });
});

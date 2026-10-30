import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { stream } from "@earendil-works/pi-ai/api/anthropic-messages";
import { customProviderConfig, relayProviderConfig } from "../../src/cli/setup.mjs";
import { ensureRelayCompatibility } from "../../src/cli/relay-compat.mjs";

async function capture(model: any) {
  let payload: any;
  const context = { messages: [
    { role: "system", content: "Test prompt", timestamp: 0 },
    { role: "user", content: [{ type: "text", text: "hi" }], timestamp: 1 },
  ] } as any;
  await stream(model, context, {
    client: {} as any, thinkingEnabled: true, effort: "medium",
    onPayload(value) { payload = value; throw new Error("capture only; no network"); },
  }).result();
  expect(payload).toBeDefined();
  return payload;
}

describe("Anthropic gateway transport compatibility", () => {
  it("keeps adaptive thinking without effort-only system messages for Opus 5.5", async () => {
    const home = await mkdtemp(join(tmpdir(), "seekbrain-opus55-"));
    try {
      const runtime = await ModelRuntime.create({ authPath: join(home, "auth.json"), modelsPath: join(home, "models.json"), allowModelNetwork: false });
      const official = runtime.getModel("anthropic", "claude-opus-5-5")!;
      expect((official.compat as any)?.supportsMidConvoEffort).toBe(true);
      const native = await capture(official);
      expect(native.messages.some((m: any) => m.role === "system" && m.content.length === 0)).toBe(true);
      const configs = [
        customProviderConfig({ id: "anthropic", name: "Anthropic" }, "https://relay.invalid", [official]),
        relayProviderConfig({ name: "Anthropic custom endpoint", baseUrl: "https://relay.invalid", api: "anthropic-messages", models: [official] }),
      ];
      for (const config of configs) {
        const payload = await capture({ ...official, ...config.models[0], provider: "anthropic-relay", baseUrl: config.baseUrl });
        expect(payload.messages.map((m: any) => m.role)).toEqual(["user"]);
        expect(payload.thinking).toEqual({ type: "adaptive", display: "summarized" });
        expect(payload.output_config).toEqual({ effort: "medium" });
        expect(payload.betas || []).not.toContain("mid-conversation-output-config-2026-07-01");
        expect(payload.betas || []).not.toContain("inline-tools-2026-09-15");
      }
      expect((official.compat as any)?.supportsMidConvoEffort).toBe(true);
    } finally { await rm(home, { recursive: true, force: true }); }
  });

  it("repairs existing relays through symlinks, preserves other providers and is idempotent", async () => {
    const home = await mkdtemp(join(tmpdir(), "seekbrain-relay-config-"));
    try {
      const target = join(home, "stored-models.json"), modelsPath = join(home, "models.json");
      const official = { baseUrl: "https://api.anthropic.com", compat: { supportsMidConvoEffort: true } };
      const config = { providers: {
        anthropic: official,
        "anthropic-relay": { api: "anthropic-messages", baseUrl: "https://relay.invalid", models: [{ id: "claude-opus-5-5", compat: { supportsMidConvoEffort: true, forceAdaptiveThinking: true } }] },
      } };
      await writeFile(target, JSON.stringify(config));
      await symlink(target, modelsPath);
      expect(ensureRelayCompatibility({ modelsPath })).toBe(true);
      const repaired = JSON.parse(await readFile(target, "utf8"));
      expect(repaired.providers.anthropic).toEqual(official);
      expect(repaired.providers["anthropic-relay"].models[0].compat).toMatchObject({ supportsMidConvoEffort: false, supportsMidConvoSystemMessages: false, supportsMidConvoToolChanges: false, forceAdaptiveThinking: true });
      expect(ensureRelayCompatibility({ modelsPath })).toBe(false);
      expect(ensureRelayCompatibility({ modelsPath: join(home, "absent.json") })).toBe(false);
    } finally { await rm(home, { recursive: true, force: true }); }
  });
});

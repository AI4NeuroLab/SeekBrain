import { describe, expect, it } from "vitest";
import { Value } from "typebox/value";
import { AgentConfigSchema } from "../../src/core/schemas/config.ts";
import {
  DEFAULT_SEEKBRAIN_CONFIG,
  mainPiArguments,
  mergeConfig,
  resolveAgentConfig,
  type SeekBrainConfig,
} from "../../src/core/index.ts";

describe("agent configuration", () => {
  it("accepts zero to disable an agent deadline and preserves it during inheritance", () => {
    expect(Value.Check(AgentConfigSchema, { timeout_seconds: 0 })).toBe(true);
    expect(Value.Check(AgentConfigSchema, { timeout_seconds: -1 })).toBe(false);
    const config = mergeConfig(DEFAULT_SEEKBRAIN_CONFIG, { agents: { seekbrain_default: { timeout_seconds: 300 }, seekbrain_code: { timeout_seconds: 0 } } }) as SeekBrainConfig;
    expect(resolveAgentConfig(config, "seekbrain_code").timeout_seconds).toBe(0);
  });
  it("inherits only shared fields for subagents", () => {
    const config = mergeConfig(DEFAULT_SEEKBRAIN_CONFIG, {
      agents: {
        seekbrain_default: { provider: "default", model: "base", thinking: "high", vision: true },
        seekbrain_validate: { model: "validator", vision: false },
      },
    }) as SeekBrainConfig;

    expect(resolveAgentConfig(config, "seekbrain_validate")).toEqual({
      provider: "default",
      model: "validator",
      thinking: "high",
      vision: false,
    });
  });

  it("formats the main Pi model and thinking as one argument", () => {
    expect(mainPiArguments({ provider: "proxy", model: "model", thinking: "high" })).toEqual([
      "--provider", "proxy", "--model", "model:high",
    ]);
  });
});

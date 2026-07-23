import { describe, expect, it } from "vitest";
import {
  DEFAULT_SEEKBRAIN_CONFIG,
  mainPiArguments,
  mergeConfig,
  resolveAgentConfig,
  type SeekBrainConfig,
} from "../../src/core/index.ts";

describe("agent configuration", () => {
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

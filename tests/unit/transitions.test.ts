import { describe, expect, it } from "vitest";
import { nextStage, seekBrainStages } from "../../src/workflows/index.ts";

describe("SeekBrain transitions", () => {
  it("defines one deterministic workflow spine", () => {
    expect(seekBrainStages).toEqual(["skill", "plan", "code", "validate", "interpret"]);
    expect(nextStage("plan")).toBe("code");
    expect(nextStage("interpret")).toBeUndefined();
  });
});

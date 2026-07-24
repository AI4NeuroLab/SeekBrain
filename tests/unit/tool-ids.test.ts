import { describe, expect, it } from "vitest";
import { canonicalToolId, migrateLegacyToolReferences } from "../../src/core/tool-ids.ts";

describe("SeekBrain tool ID migration", () => {
  it("maps legacy public tool IDs to the current namespace", () => {
    expect(canonicalToolId("neuro_code")).toBe("seekbrain_code_execute");
    expect(canonicalToolId("resolve_targeted_skill")).toBe("seekbrain_recipe_retrieve");
    expect(canonicalToolId("seekbrain_validation_run")).toBe("seekbrain_validation_run");
  });

  it("migrates persisted next-tool references without changing unrelated state", () => {
    expect(migrateLegacyToolReferences({
      next_tool: "neuro_plan",
      next_step: { tool: "neuro_refine_image", args: { run_id: "run-1" } },
      history: [{ tool: "resolve_targeted_skill" }],
      note: "neuro_code is historical prose",
    })).toEqual({
      next_tool: "seekbrain_formulation_generate",
      next_step: { tool: "seekbrain_figure_refine", args: { run_id: "run-1" } },
      history: [{ tool: "seekbrain_recipe_retrieve" }],
      note: "neuro_code is historical prose",
    });
  });
});

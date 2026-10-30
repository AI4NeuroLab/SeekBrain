import { Value } from "typebox/value";
import { describe, expect, it } from "vitest";
import {
  ArtifactSchema,
  ExecutionContractSchema,
  ExecutionTopologySchema,
  RunStateSchema,
  TaskBriefDraftSchema,
  TaskBriefSchema,
} from "../../src/core/index.ts";

describe("core schemas", () => {
  it("accepts a versioned run state", () => {
    expect(Value.Check(RunStateSchema, {
      schema_version: 2,
      run_id: "run-1",
      run_dir: "/tmp/run-1",
      question: "Which neurons changed?",
      status: "created",
      stages: {},
      artifacts: [],
      reviews: {},
      usage: {},
    })).toBe(true);
  });

  it("rejects artifacts without an explicit kind", () => {
    expect(Value.Check(ArtifactSchema, { name: "figure", path: "figure.png" })).toBe(false);
  });

  it("accepts the artifact kinds used by the current workflow", () => {
    for (const kind of ["code", "figure", "statistics", "data", "markdown", "json", "log", "other"]) {
      expect(Value.Check(ArtifactSchema, { name: kind, path: `artifact.${kind}`, kind })).toBe(true);
    }
  });

  it("accepts the lightweight TaskBrief, topology, and Plan execution contract", () => {
    const draft = {
      scientific_goal: "Classify zebrafish neurons into molecular subtypes.",
      intent_mode: "focused_analysis",
      intent_status: "ready",
      biological_scope: ["fish 1-3 neurons"],
      requested_data: ["continuous RNA spot counts"],
      hard_constraints: ["exclude cfos from subtype identity"],
      output_preferences: ["retain cfos for display"],
    };
    expect(Value.Check(TaskBriefDraftSchema, draft)).toBe(true);
    expect(Value.Check(TaskBriefSchema, { raw_question: "Classify the neurons.", ...draft })).toBe(true);
    expect(Value.Check(ExecutionTopologySchema, "single_pipeline")).toBe(true);
    expect(Value.Check(ExecutionContractSchema, {
      requirements: ["Exclude cfos from subtype identity."],
      validation_checks: ["Verify the identity barcode omits cfos while the display matrix retains it."],
    })).toBe(true);
  });

  it("keeps Route intake limited to TaskBrief fields", () => {
    const draft = {
      scientific_goal: "Classify RNA barcodes.",
      intent_mode: "focused_analysis",
      intent_status: "ready",
      biological_scope: ["fish neurons"],
      requested_data: ["RNA spot counts"],
      hard_constraints: ["Exclude cfos from subtype identity."],
      output_preferences: ["Retain cfos for display."],
    };
    expect(Value.Check(TaskBriefDraftSchema, draft)).toBe(true);
    expect(Value.Check(TaskBriefDraftSchema, {
      ...draft,
      extra_route_field: true,
    })).toBe(false);
  });
});

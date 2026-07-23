import { Value } from "typebox/value";
import { describe, expect, it } from "vitest";
import { ArtifactSchema, RunStateSchema } from "../../src/core/index.ts";

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
});

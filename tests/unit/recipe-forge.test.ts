import { describe, expect, it } from "vitest";
import { buildEvidenceManifest, buildRagRecipeCard, evaluateRecipeDraft } from "../../src/targeted-skill/index.ts";

describe("Recipe Forge quality gates", () => {
  it("keeps RAG output as a candidate with content-addressed evidence", async () => {
    const card = buildRagRecipeCard({
      authored: {
        name: "cortical-map",
        description: "Map subject effects to cortical regions.",
        triggers: ["Map regional effects"],
        recipe_card: {
          recipe_id: "cortical-map",
          version: "0.1.0",
          kind: "visualization",
          summary: "Map subject effects to cortical regions.",
          aliases: ["map-back"],
          does: ["spatial_mapping"],
          evidence_for: ["regional_localization"],
          accepts: { species: ["human"], modalities: ["fmri"], observation_units: ["subject"], requires: ["regional_effect"] },
          produces: ["cortical_map"],
          use_when: ["Regional effects are available"],
          avoid_when: ["No atlas coordinates are available"],
        },
      },
      question: "Map effects to cortex",
      evidenceLevel: "repository_backed",
      repositoryUrl: "https://github.com/example/map",
      sourceCommit: "a".repeat(40),
    });
    expect(card).toMatchObject({ status: "candidate", kind: "visualization", source: { type: "rag", source_commit: "a".repeat(40) } });
    const gate = await evaluateRecipeDraft({
      card,
      skillBody: "# Cortical map\n\n## Procedure\n\n1. Load regional effects.\n2. Map them through the supplied atlas.\n",
      analysisScript: "def map_effects(values, atlas):\n    return atlas.project(values)\n",
      evidenceLevel: "repository_backed",
      paperText: "The method projects regional effects onto a cortical atlas.",
      matchedFiles: [{ path: "src/map.py", content: "def map_effects(values, atlas): pass" }],
    });
    expect(gate).toMatchObject({ passed: true, checks: { evidence_available: true, no_instance_path_leakage: true, script_syntax: "passed" } });
    const evidence = buildEvidenceManifest({
      question: "Map effects to cortex",
      title: "Mapping paper",
      paperText: "method",
      evidenceLevel: "repository_backed",
      repositoryUrl: "https://github.com/example/map",
      sourceCommit: "a".repeat(40),
      matchedFiles: [{ path: "src/map.py", content: "code" }],
      matchedPaperContext: "paper context",
      matchedRepoContext: "repo context",
      connectionAnalysis: "mapping",
      reproductionPlan: "1. map",
    });
    expect(evidence.question_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(evidence.repository?.files[0]).toMatchObject({ path: "src/map.py", chars: 4 });
  });

  it("rejects task-instance paths and syntactically invalid scripts", async () => {
    const card = buildRagRecipeCard({ authored: { name: "bad", description: "Bad", triggers: ["Read /mnt/shared/private/data.npy"] }, question: "bad", evidenceLevel: "repository_backed" });
    const gate = await evaluateRecipeDraft({
      card,
      skillBody: "## Procedure\n\n1. Read the configured input.",
      analysisScript: "def broken(:\n    pass\n",
      evidenceLevel: "repository_backed",
      paperText: "method",
      matchedFiles: [{ path: "analysis.py", content: "code" }],
    });
    expect(gate.passed).toBe(false);
    expect(gate.blocking_issues.join("\n")).toContain("task-instance absolute paths");
    expect(gate.checks.script_syntax).toBe("failed");
  });

  it("normalizes non-executable reference cards into capability-free boundary memory", () => {
    const card = buildRagRecipeCard({
      authored: {
        name: "repository-boundary",
        description: "This repository does not implement the requested RNA operation.",
        recipe_card: {
          kind: "reference",
          does: ["clustering"],
          evidence_for: ["regional_localization"],
          produces: ["cell_subtypes"],
          use_when: ["RNA transcript spot-count input is requested"],
        },
      },
      question: "Cluster RNA transcript spot counts",
      evidenceLevel: "repository_backed",
      repositoryUrl: "https://github.com/example/boundary",
    });
    expect(card).toMatchObject({
      kind: "reference",
      does: [],
      evidence_for: [],
      produces: [],
      use_when: ["RNA transcript spot-count input is requested"],
    });
  });
});

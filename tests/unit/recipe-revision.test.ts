import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RecipeRevisionManager, type RecipeCard } from "../../src/targeted-skill/index.ts";

function sourceCard(): RecipeCard {
  return {
    schema_version: 1,
    recipe_id: "repo-recipe",
    version: "0.1.0",
    status: "candidate",
    kind: "analysis",
    summary: "Repository-backed group comparison",
    aliases: [],
    does: ["group_comparison"],
    evidence_for: ["group_difference"],
    accepts: { species: ["human"], modalities: ["fmri"], observation_units: ["subject"], requires: ["group_label"] },
    produces: ["group_effect"],
    use_when: ["Comparing diagnostic groups"],
    avoid_when: [],
    source: { type: "rag", evidence_refs: ["references/evidence_manifest.json"], repository_url: "https://github.com/example/repo" },
    quality: { passed_runs: 0, recipe_attributed_failures: 0 },
  };
}

describe("trace-conditioned Recipe revision", () => {
  it("creates one local candidate, feeds the existing retry, and settles it from the next Validation", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekbrain-recipe-revision-"));
    try {
      // Repository-scoped folders do not have to equal the authored Recipe id.
      const source = join(root, "from_rag", "github_example_repo");
      const complementary = join(root, "builtin", "group-visualization");
      await mkdir(source, { recursive: true });
      await writeFile(join(source, "SKILL.md"), "---\nname: repo-recipe\ndescription: Compare groups\n---\n\n# Compare groups\n\n## Procedure\n\n1. Fit the model.\n", "utf8");
      await writeFile(join(source, "recipe-card.json"), JSON.stringify(sourceCard()), "utf8");
      const manager = new RecipeRevisionManager(async () => ({
        revised_skill_body: "# Compare groups\n\n## Preconditions\n\nRequire at least two observed groups.\n\n## Procedure\n\n1. Validate group labels.\n2. Fit the model.\n\n## Validation criteria\n\nConfirm both groups contribute observations.",
        recipe_card: { ...sourceCard(), avoid_when: ["Fewer than two observed groups"] },
        change_summary: "Added a missing group-label precondition.",
        executor_guidance: "Validate that at least two non-empty groups are present before fitting, while preserving the existing model and outputs.",
        expected_acceptance_signals: ["two non-empty groups", "existing output contract preserved"],
        preserved_checks: ["figure path exists"],
      }));
      const state = {
        code_attempt: 1,
        targeted_skill_result: {
          source: "generated_from_rag",
          skill_paths: [complementary, source],
          recipe_set: { selected: [{ recipe_id: "group-visualization", path: complementary }, { recipe_id: "repo-recipe", path: source }] },
        },
      };
      const failed = await manager.handle({
        runDir: root,
        state,
        enabled: true,
        budget: 1,
        generatedOnly: true,
        validation: {
          pass: false,
          route: "retry_code",
          validated_code_attempt: 1,
          next_code_feedback: "The model received only one group.",
          recipe_feedback: {
            attribution: "recipe_defect",
            recipe_id: "repo-recipe",
            defect_type: "missing_precondition",
            failed_checks: ["two groups required"],
            evidence: ["fit failed with one observed group"],
            preserve: ["figure path exists"],
          },
        },
      });
      expect(failed?.validation_patch.recipe_revision).toMatchObject({ status: "candidate", recipe_id: "repo-recipe", base_code_attempt: 1 });
      expect(failed?.validation_patch.next_code_feedback).toContain("bounded revision 1/1");
      const candidate = failed?.state_patch.recipe_revision_candidate;
      expect(failed?.validation_patch.next_code_feedback).toContain(candidate.candidate_path);
      expect(await readFile(candidate.candidate_path, "utf8")).toContain("Validate group labels");
      expect(JSON.parse(await readFile(candidate.card_path, "utf8"))).toMatchObject({ status: "candidate", version: "0.1.1" });

      const passed = await manager.handle({
        runDir: root,
        state: { ...state, ...failed?.state_patch, code_attempt: 2 },
        enabled: true,
        budget: 1,
        generatedOnly: true,
        validation: { pass: true, route: "proceed", validated_code_attempt: 2 },
      });
      expect(passed?.validation_patch.recipe_revision).toMatchObject({ status: "provisional", recipe_id: "repo-recipe" });
      expect(JSON.parse(await readFile(candidate.card_path, "utf8"))).toMatchObject({ status: "provisional", quality: { passed_runs: 1 } });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("does not revise a builtin Recipe online", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekbrain-builtin-revision-"));
    try {
      const source = join(root, "builtin", "recipe");
      await mkdir(source, { recursive: true });
      await writeFile(join(source, "SKILL.md"), "---\nname: builtin\ndescription: Builtin\n---\n\n## Procedure\n\n1. Run.\n", "utf8");
      const manager = new RecipeRevisionManager(async () => { throw new Error("must not author"); });
      const result = await manager.handle({
        runDir: root,
        state: { targeted_skill_result: { skill_paths: [source] } },
        enabled: true,
        budget: 1,
        generatedOnly: true,
        validation: { pass: false, route: "retry_code", validated_code_attempt: 1, recipe_feedback: { attribution: "recipe_defect", recipe_id: "recipe" } },
      });
      expect(result?.validation_patch.recipe_revision).toEqual({ status: "skipped", reason: "online_revision_is_limited_to_rag_candidates" });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("charges the single revision budget even when the revision author fails", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekbrain-failed-revision-"));
    try {
      const source = join(root, "from_rag", "github_example_repo");
      await mkdir(source, { recursive: true });
      await writeFile(join(source, "SKILL.md"), "---\nname: repo-recipe\ndescription: Compare groups\n---\n\n## Procedure\n\n1. Fit the model.\n", "utf8");
      await writeFile(join(source, "recipe-card.json"), JSON.stringify(sourceCard()), "utf8");
      let calls = 0;
      const manager = new RecipeRevisionManager(async () => { calls += 1; throw new Error("author unavailable"); });
      const validation = { pass: false, route: "retry_code", validated_code_attempt: 1, recipe_feedback: { attribution: "recipe_defect", recipe_id: "repo-recipe" } };
      const state = { targeted_skill_result: { skill_paths: [source], recipe_set: { selected: [{ recipe_id: "repo-recipe", path: source }] } } };
      const failed = await manager.handle({ runDir: root, state, validation, enabled: true, budget: 1, generatedOnly: true });
      expect(failed).toMatchObject({ state_patch: { recipe_revision_count: 1 }, validation_patch: { recipe_revision: { status: "skipped", reason: "revision_author_failed" } } });
      const repeated = await manager.handle({ runDir: root, state: { ...state, ...failed?.state_patch }, validation, enabled: true, budget: 1, generatedOnly: true });
      expect(repeated?.validation_patch.recipe_revision).toEqual({ status: "skipped", reason: "revision_budget_exhausted" });
      expect(calls).toBe(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

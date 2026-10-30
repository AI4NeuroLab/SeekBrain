import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildRecipeQuery,
  loadRecipeCard,
  minimalCoverageSelections,
  rankRecipes,
  recipeCompatibility,
  recipeSet,
  type DiscoverableRecipe,
  type RecipeCard,
} from "../../src/targeted-skill/index.ts";

function card(input: Partial<RecipeCard> & Pick<RecipeCard, "recipe_id" | "does">): RecipeCard {
  return {
    schema_version: 1,
    version: "1.0.0",
    status: "active",
    kind: "analysis",
    summary: input.recipe_id,
    aliases: [],
    evidence_for: [],
    accepts: { species: [], modalities: [], observation_units: [], requires: [] },
    produces: [],
    use_when: [],
    avoid_when: [],
    source: { type: "builtin", evidence_refs: [] },
    quality: { passed_runs: 0, recipe_attributed_failures: 0 },
    ...input,
    recipe_id: input.recipe_id,
    does: input.does,
  };
}

function recipe(value: RecipeCard): DiscoverableRecipe {
  return { name: value.recipe_id, path: `/recipes/${value.recipe_id}`, description: value.summary, text: `# ${value.recipe_id}`, card: value };
}

describe("NeuroRecipe discovery", () => {
  it("ignores modality compatibility entirely", () => {
    const query = buildRecipeQuery({ question: "classify neurons from RNA expression with brain-region annotations" });
    const calciumAtlas = card({
      recipe_id: "calcium-manifold-with-atlas",
      does: ["clustering"],
      accepts: { species: [], modalities: ["calcium", "atlas"], observation_units: [], requires: [] },
      primary_modalities: ["calcium"],
      context_modalities: ["atlas"],
    });
    expect(query.accepts.modalities).toEqual(expect.arrayContaining(["omics", "atlas"]));
    expect(recipeCompatibility(query, calciumAtlas)).toMatchObject({ compatible: true, known: false, conflicts: [] });
  });

  it("retains species as the only hard compatibility filter", () => {
    const query = buildRecipeQuery({ question: "analyze zebrafish connectivity" });
    const mouse = card({
      recipe_id: "mouse-connectome",
      does: ["connectivity"],
      accepts: { species: ["mouse"], modalities: ["connectome"], observation_units: [], requires: [] },
    });
    expect(recipeCompatibility(query, mouse)).toMatchObject({
      compatible: false,
      conflicts: ["species: requested zebrafish; recipe accepts mouse"],
    });
  });

  it("does not use modality in Recipe ranking", () => {
    const query = buildRecipeQuery({ question: "mouse clustering" });
    const matching = recipe(card({
      recipe_id: "recipe-a",
      summary: "Cluster observations",
      does: ["clustering"],
      accepts: { species: ["mouse"], modalities: ["calcium"], observation_units: [], requires: [] },
    }));
    const mismatched = recipe(card({
      recipe_id: "recipe-b",
      summary: "Cluster observations",
      does: ["clustering"],
      accepts: { species: ["mouse"], modalities: ["omics"], observation_units: [], requires: [] },
    }));
    const ranked = rankRecipes(query, [mismatched, matching], { poolSize: 2 });
    expect(ranked.map((item) => item.name)).toEqual(expect.arrayContaining(["recipe-a", "recipe-b"]));
    expect(ranked[0].score).toBeCloseTo(ranked[1].score);
  });

  it("uses raw BM25 only, without status or historical-quality weights", () => {
    const query = buildRecipeQuery({ question: "mouse clustering" });
    const strongHistory = recipe(card({
      recipe_id: "recipe-c",
      summary: "Cluster observations",
      does: ["clustering"],
      accepts: { species: ["mouse"], modalities: [], observation_units: [], requires: [] },
      quality: { passed_runs: 5, recipe_attributed_failures: 0 },
    }));
    const weakHistory = recipe(card({
      recipe_id: "recipe-d",
      status: "provisional",
      summary: "Cluster observations",
      does: ["clustering"],
      accepts: { species: ["mouse"], modalities: [], observation_units: [], requires: [] },
      quality: { passed_runs: 0, recipe_attributed_failures: 5 },
    }));
    const ranked = rankRecipes(query, [strongHistory, weakHistory], { poolSize: 2 });
    expect(ranked[0].score).toBeCloseTo(ranked[1].score);
    expect(ranked[0].score).toBeLessThan(1);
    expect(ranked.every((item) => item.score === item.lexical_score)).toBe(true);
    expect(ranked.every((item) => !("structured_score" in item))).toBe(true);
  });

  it("builds one structured query and greedily selects a minimal complementary Recipe set", () => {
    const query = buildRecipeQuery({
      question: "analyze the dataset",
      task_brief: {
        scientific_goal: "Compare human fMRI disorders, map effects to cortex, and show disease progression trajectories.",
        biological_scope: ["human", "fMRI", "cross-disorder"],
        hard_constraints: ["Compare diagnostic groups to identify cross-disorder effects."],
        requested_data: ["Map effects back to cortical brain regions."],
        output_preferences: ["Plot trajectories over disease progression."],
      },
    });
    expect(query.requirements.map((item) => item.id)).toEqual(["R1", "R2", "R3"]);
    expect(query.accepts).toMatchObject({ species: ["human"], modalities: ["fmri", "atlas"] });

    const candidates = [
      recipe(card({ recipe_id: "cross-disorder-comparison", summary: "Compare diagnostic groups in human fMRI", does: ["group_comparison"], evidence_for: ["disease_related"], accepts: { species: ["human"], modalities: ["fmri"], observation_units: ["subject"], requires: ["group_label"] } })),
      recipe(card({ recipe_id: "duplicate-comparison", summary: "A second human fMRI group comparison", does: ["group_comparison"], accepts: { species: ["human"], modalities: ["fmri"], observation_units: [], requires: [] } })),
      recipe(card({ recipe_id: "cortical-map", kind: "visualization", summary: "Map effects back to cortical brain regions", does: ["spatial_mapping", "visualization"], evidence_for: ["regional_localization"], accepts: { species: ["human"], modalities: ["fmri"], observation_units: [], requires: [] } })),
      recipe(card({ recipe_id: "progression-trajectory", kind: "visualization", summary: "Plot disease progression trajectories", does: ["trajectory_analysis", "visualization"], evidence_for: ["temporal_dynamics", "disease_related"], accepts: { species: ["human"], modalities: ["fmri"], observation_units: [], requires: [] } })),
      recipe(card({ recipe_id: "mouse-calcium", summary: "Mouse calcium group trajectory map", does: ["group_comparison", "trajectory_analysis", "spatial_mapping"], accepts: { species: ["mouse"], modalities: ["calcium"], observation_units: [], requires: [] } })),
      recipe(card({ recipe_id: "paper-boundary", kind: "reference", summary: "Paper evidence without executable analysis capability", does: ["group_comparison", "spatial_mapping", "trajectory_analysis"] })),
    ];
    const ranked = rankRecipes(query, candidates, { poolSize: 8 });
    expect(ranked.map((item) => item.name)).not.toContain("mouse-calcium");
    expect(ranked.map((item) => item.name)).not.toContain("paper-boundary");
    const selections = minimalCoverageSelections(query, ranked, 3, 0.05);
    const selectedSet = recipeSet(query, selections);
    expect(selectedSet.complete).toBe(true);
    expect(selectedSet.uncovered_requirement_ids).toEqual([]);
    expect(selectedSet.selected).toHaveLength(3);
    expect(new Set(selectedSet.selected.flatMap((item) => item.covers))).toEqual(new Set(["R1", "R2", "R3"]));
    expect(selectedSet.selected.filter((item) => item.covers.includes("R1"))).toHaveLength(1);
  });

  it("uses TaskBrief requirements as Recipe query facets when needed", () => {
    const query = buildRecipeQuery({
      question: "using the specified grouped summaries and sampling",
      task_brief: {
        scientific_goal: "Classify fish neurons by RNA barcodes.",
        biological_scope: ["zebrafish neurons"],
        requested_data: ["Use continuous RNA transcript spot counts with gene and fish identities."],
        hard_constraints: [
          "Exclude cfos from subtype identity while retaining it for display.",
          "Take the annotation mode every 10 cells.",
        ],
        output_preferences: ["Select one representative expression cell every 130 cells."],
      },
    });

    expect(query.requirements).toEqual([
      expect.objectContaining({ id: "R1", kind: "analysis" }),
      expect.objectContaining({ id: "R2", kind: "analysis" }),
      expect.objectContaining({ id: "R3", kind: "evidence" }),
      expect.objectContaining({ id: "R4", kind: "visualization" }),
    ]);
    expect(query.requirements.map((item) => item.text).join(" ")).toContain("continuous RNA transcript spot counts");
    expect(query.accepts.modalities).toContain("omics");
  });

  it("loads an explicit sidecar without requiring changes to SKILL.md", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekbrain-recipe-card-"));
    try {
      await mkdir(root, { recursive: true });
      await writeFile(join(root, "SKILL.md"), "---\nname: legacy-name\ndescription: legacy summary\n---\n\n# Legacy\n", "utf8");
      await writeFile(join(root, "recipe-card.json"), JSON.stringify(card({
        recipe_id: "explicit-card",
        status: "provisional",
        summary: "Atlas-backed spatial mapping",
        does: ["spatial_mapping"],
        avoid_when: ["No atlas coordinates are available"],
      })), "utf8");
      const loaded = await loadRecipeCard(root);
      expect(loaded).toMatchObject({ recipe_id: "explicit-card", status: "provisional", does: ["spatial_mapping"], avoid_when: ["No atlas coordinates are available"] });
      expect(await readFile(join(root, "SKILL.md"), "utf8")).toContain("legacy summary");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

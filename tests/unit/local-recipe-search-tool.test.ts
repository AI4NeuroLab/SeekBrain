import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createLocalRecipeSearchTool } from "../../src/formulation-recipe/local-recipe-tool.ts";

async function recipe(root: string, id: string, card: Record<string, unknown>, parent = "trajectory") {
  const path = join(root, parent, id);
  await mkdir(path, { recursive: true });
  await writeFile(join(path, "SKILL.md"), `---\nname: ${id}\ndescription: ${String(card.summary || id)}\n---\n\n# ${id}\n`);
  await writeFile(join(path, "recipe-card.json"), JSON.stringify({
    schema_version: 1,
    recipe_id: id,
    version: "1.0",
    status: "active",
    kind: "analysis",
    summary: id,
    aliases: [],
    does: [],
    evidence_for: [],
    accepts: { species: [], modalities: [], observation_units: [], requires: [] },
    produces: [],
    use_when: [],
    avoid_when: [],
    source: { type: "trajectory", evidence_refs: ["SKILL.md"] },
    quality: { passed_runs: 0, recipe_attributed_failures: 0 },
    ...card,
  }, null, 2));
  return path;
}

function parsed(result: any) {
  return JSON.parse(result.content[0].text);
}

describe("local Recipe search tool", () => {
  it("ranks high-information RecipeCard fields, filters species, ignores modality compatibility, and excludes from_rag", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekbrain-local-recipes-"));
    try {
      await recipe(root, "zebrafish-transcript-subtypes", {
        summary: "Classifies neurons into molecular subtypes from per-neuron RNA transcript spot counts.",
        does: ["clustering", "cell_type_specificity"],
        accepts: { species: ["zebrafish"], modalities: ["omics"], observation_units: ["neuron"], requires: ["rna_spot_counts"] },
        produces: ["molecular_subtypes"],
      });
      await recipe(root, "mouse-transcript-subtypes", {
        summary: "Classifies neurons into molecular subtypes from RNA transcript spot counts.",
        does: ["clustering", "cell_type_specificity"],
        accepts: { species: ["mouse"], modalities: ["omics"], observation_units: ["neuron"], requires: ["rna_spot_counts"] },
        produces: ["molecular_subtypes"],
      });
      await recipe(root, "zebrafish-connectome-clustering", {
        summary: "Clusters zebrafish brain regions using hierarchical consensus clustering.",
        does: ["clustering", "connectivity"],
        accepts: { species: ["zebrafish"], modalities: ["connectome"], observation_units: ["region"], requires: ["connectivity_matrix"] },
        produces: ["consensus_modules"],
      });
      await recipe(root, "hidden-rag-recipe", {
        summary: "RNA transcript molecular subtype clustering.",
        does: ["clustering", "cell_type_specificity"],
        accepts: { species: ["zebrafish"], modalities: ["omics"], observation_units: ["neuron"], requires: ["rna_spot_counts"] },
        source: { type: "rag", evidence_refs: [] },
      }, "from_rag");

      const tool = createLocalRecipeSearchTool({
        resolveRoots: async () => [root],
        resolveContextText: async () => "Dataset species: zebrafish",
        resultLimit: 5,
      });
      const value = parsed(await tool.execute("search-1", { query: "cluster neurons into molecular subtypes from transcript spot counts" }));
      expect(value.recipes.map((item: any) => item.recipe_id)).toEqual([
        "zebrafish-transcript-subtypes",
        "zebrafish-connectome-clustering",
      ]);
      expect(value.recipes[0]).toMatchObject({
        does: ["clustering", "cell_type_specificity"],
        accepts: { species: ["zebrafish"], observation_units: ["neuron"], requires: ["rna_spot_counts"] },
      });
      expect(value.recipes[0].skill_path).toBe(join(root, "trajectory", "zebrafish-transcript-subtypes", "SKILL.md"));
      expect(value.recipes[0].path).toBeUndefined();
      expect(value.recipes[0].accepts.modalities).toBeUndefined();
      expect(value.recipes[0].score).toBeUndefined();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("finds the intended bundled Recipe for the hierarchical-consensus query", async () => {
    const tool = createLocalRecipeSearchTool({
      resolveRoots: async () => [join(process.cwd(), "recipes")],
      resolveContextText: async () => "zebrafish structural connectivity dataset",
      resultLimit: 5,
    });
    const value = parsed(await tool.execute("search-1", {
      query: "hierarchical consensus clustering of structural connectivity with consensus matrix and dendrogram",
    }));
    expect(value.recipes.slice(0, 3).map((item: any) => item.recipe_id)).toContain(
      "ns_ana-zebrafish-sc_matrix-hierarchical_consensus_clustering-consensus_matrix_dendrogram",
    );
  });

  it("recalls the useful expression-count Recipe first for the Fish molecular-subtype case", async () => {
    const tool = createLocalRecipeSearchTool({
      resolveRoots: async () => [join(process.cwd(), "recipes")],
      resolveContextText: async () => "zebrafish Fish 1-3",
      resultLimit: 8,
    });
    const value = parsed(await tool.execute("search-1", {
      query: "classify neurons into molecular subtypes from per-neuron continuous RNA transcript spot counts, gene identities, fish identities, and brain-region annotations",
    }));
    expect(value.recipes[0].recipe_id).toBe(
      "ns_multi-zebrafish-gene_anatomy-expression_count_mapping-spatial_density",
    );
    expect(value.recipes.map((item: any) => item.recipe_id)).toContain(
      "ns_multi-zebrafish-gene_anatomy-expression_level_clustering-heatmap",
    );
  });

  it("exposes only the query as a model-facing argument", () => {
    const tool: any = createLocalRecipeSearchTool({
      resolveRoots: async () => [],
      resolveContextText: async () => "",
    });
    expect(Object.keys(tool.parameters.properties)).toEqual(["query"]);
    expect(tool.parameters.additionalProperties).toBe(false);
  });
});

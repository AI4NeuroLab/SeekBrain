import { join } from "node:path";
import { Type } from "typebox";
import type { ExistingPiCustomTool } from "../extension/existing-pi-agent-adapter.ts";
import { LocalRecipeIndex } from "./local-recipe-search.ts";

export interface LocalRecipeToolOptions {
  resolveRoots(): Promise<string[]>;
  resolveContextText(): Promise<string>;
  resultLimit?: number;
  resolveResultLimit?(): Promise<number>;
}

export function createLocalRecipeSearchTool(options: LocalRecipeToolOptions): ExistingPiCustomTool {
  const index = new LocalRecipeIndex(options.resolveRoots);
  return {
    name: "seekbrain_recipe_search_local",
    label: "Search local analysis Skills",
    description: "Search formal local neuroscience analysis Skills and return their Recipe Cards and exact SKILL.md paths in retrieval order.",
    parameters: Type.Object({ query: Type.String({ minLength: 1 }) }, { additionalProperties: false }),
    async execute(_toolCallId: string, params: { query: string }) {
      const query = String(params.query || "").trim();
      if (!query) {
        const error = { ok: false, error: "query is required" };
        return { content: [{ type: "text", text: JSON.stringify(error) }], details: error, isError: true };
      }
      try {
        const configuredLimit = options.resolveResultLimit ? await options.resolveResultLimit() : options.resultLimit;
        const recipes = await index.search(query, await options.resolveContextText(), Math.max(1, Number(configuredLimit || 8)));
        const value = {
          ok: true,
          query,
          recipes: recipes.map(({ path, card }) => ({
            recipe_id: card.recipe_id,
            skill_path: join(path, "SKILL.md"),
            summary: card.summary,
            does: card.does,
            accepts: {
              species: card.accepts.species,
              observation_units: card.accepts.observation_units,
              requires: card.accepts.requires,
            },
            produces: card.produces,
            use_when: card.use_when,
            avoid_when: card.avoid_when,
            status: card.status,
            passed_runs: card.quality.passed_runs,
          })),
        };
        return { content: [{ type: "text", text: JSON.stringify(value) }], details: value, isError: false };
      } catch (error) {
        const value = { ok: false, error: error instanceof Error ? error.message : String(error) };
        return { content: [{ type: "text", text: JSON.stringify(value) }], details: value, isError: true };
      }
    },
  };
}

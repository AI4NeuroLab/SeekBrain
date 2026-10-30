import { Type } from "typebox";
import type { ExistingPiCustomTool } from "../extension/existing-pi-agent-adapter.ts";
import { RagRecipeSearchService } from "./rag-recipe-search.ts";

function result(value: Record<string, unknown>, isError = false) {
  return { content: [{ type: "text", text: JSON.stringify(value) }], details: value, isError };
}

export function createRagRecipeSearchTool(service: RagRecipeSearchService): ExistingPiCustomTool {
  return {
    name: "seekbrain_recipe_search_rag",
    label: "Search repository-backed analysis Skills",
    description: "Search papers with reachable public repositories and usable Methods sections. Returns evidence candidates without cloning repositories or generating Skills.",
    parameters: Type.Object({ query: Type.String({ minLength: 1 }) }, { additionalProperties: false }),
    async execute(_toolCallId: string, params: { query: string }, signal?: AbortSignal) {
      const query = String(params.query || "").trim();
      if (!query) return result({ ok: false, error: "query is required" }, true);
      try {
        const artifact = await service.search(query, signal);
        return result({
          ok: true,
          search_id: artifact.search_id,
          query,
          candidates: artifact.candidates.map((candidate) => ({
            candidate_id: candidate.candidate_id,
            paper: candidate.paper,
            repository: candidate.repository,
            ...(candidate.existing_from_rag?.length ? { existing_from_rag: candidate.existing_from_rag } : {}),
          })),
          rejected_repositories: artifact.rejected_repositories,
        });
      } catch (error) {
        return result({ ok: false, error: error instanceof Error ? error.message : String(error) }, true);
      }
    },
  };
}

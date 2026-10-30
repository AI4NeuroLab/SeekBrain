import { Type } from "typebox";
import type { ExistingPiCustomTool } from "../extension/existing-pi-agent-adapter.ts";
import { RagRecipeGenerationService } from "./rag-recipe-generation.ts";

function result(value: Record<string, unknown>, isError = false) {
  return { content: [{ type: "text", text: JSON.stringify(value) }], details: value, isError };
}

export function createRagRecipeGenerationTool(service: RagRecipeGenerationService, maxCandidatesPerCall = 3): ExistingPiCustomTool {
  return {
    name: "seekbrain_recipe_generate_from_rag",
    label: "Generate repository-backed analysis Skills",
    description: "Generate or reuse candidate analysis Skills for previously searched repository-paper candidates. Generated Skills remain optional and are not automatically selected.",
    parameters: Type.Object({ candidate_ids: Type.Array(Type.String({ minLength: 1 }), { minItems: 1, maxItems: maxCandidatesPerCall }) }, { additionalProperties: false }),
    async execute(_toolCallId: string, params: { candidate_ids: string[] }, signal?: AbortSignal) {
      const candidateIds = [...new Set((Array.isArray(params.candidate_ids) ? params.candidate_ids : []).map((value) => String(value || "").trim()).filter(Boolean))];
      if (!candidateIds.length) return result({ ok: false, error: "candidate_ids is required" }, true);
      if (candidateIds.length > maxCandidatesPerCall) return result({ ok: false, error: `At most ${maxCandidatesPerCall} candidate_ids may be generated per call.` }, true);
      try {
        const generated = await service.generate(candidateIds, signal);
        if (generated.limitExceeded) {
          return result({
            ok: false,
            error_code: "recipe_generation_call_limit_exceeded",
            error: "seekbrain_recipe_generate_from_rag can be called at most twice per run",
            allowed_calls: generated.budget.allowedCalls,
            used_calls: generated.budget.used,
          }, true);
        }
        return result({ ok: true, recipes: generated.recipes, failures: generated.failures });
      } catch (error) {
        return result({ ok: false, error: error instanceof Error ? error.message : String(error) }, true);
      }
    },
  };
}

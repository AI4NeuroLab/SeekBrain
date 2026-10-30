import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { ResearchSkillWorkflow } from "../../../workflows/index.ts";
import { renderSeekBrainResult } from "../../tui/compact-tool-results.ts";
import type { Json, SeekBrainToolDefinition } from "../runtime-types.ts";

export interface RecipeResearchToolDependencies {
  workflowRoot: string;
  workflow: ResearchSkillWorkflow;
  loadConfig(cwd: string): Promise<Json>;
  workflowConfig(config: Json): {
    targeted_skill_match: boolean;
    targeted_skill_generate: boolean;
    rag_recipe_crystallization?: boolean;
    [key: string]: any;
  };
  literatureAgentConfig(config: Json, name: string): Json;
  readPrompt(name: string): Promise<string>;
  content(details: Json): any;
}

function publicRecipeResult(details: Json): Json {
  const copy = { ...details };
  const aliases: Record<string, string> = {
    targeted_skill: "analysis_recipe",
    targeted_skill_preview: "analysis_recipe_preview",
    targeted_skill_path: "analysis_recipe_path",
    skill_paths: "recipe_paths",
  };
  for (const [legacy, current] of Object.entries(aliases)) {
    if (Object.prototype.hasOwnProperty.call(copy, legacy)) copy[current] = copy[legacy];
    delete copy[legacy];
  }
  if (copy.source === "generated_from_rag") copy.source = "crystallized";
  else if (copy.source === "existing_skill") copy.source = "repertoire";
  else if (copy.source === "none") copy.source = "no_match";
  if (copy.details && typeof copy.details === "object") {
    const nested = { ...copy.details };
    if (Object.prototype.hasOwnProperty.call(nested, "generated_skill_output_dir")) nested.generated_recipe_output_dir = nested.generated_skill_output_dir;
    if (Object.prototype.hasOwnProperty.call(nested, "reused_skill_paths")) nested.reused_recipe_paths = nested.reused_skill_paths;
    delete nested.generated_skill_output_dir;
    delete nested.reused_skill_paths;
    copy.details = nested;
  }
  return copy;
}

export function createRecipeResearchTools(deps: RecipeResearchToolDependencies): SeekBrainToolDefinition[] {
  return [
    defineTool({
      name: "seekbrain_recipe_retrieve",
      label: "Retrieve Analysis Recipe",
      description: "Scout local RecipeCards and Paper RAG repositories as equal candidate sources, inspect a bounded shortlist, and return one scientific backbone plus an optional complementary method.",
      parameters: Type.Object({
        question: Type.Optional(Type.String({ description: "Research question or task. Falls back to state.json question." })),
        run_id: Type.String(),
        root_dir: Type.Optional(Type.String()),
        recipe_dir: Type.Optional(Type.String()),
        project_dir: Type.Optional(Type.String()),
        recipe_enabled: Type.Optional(Type.Boolean()),
        recipe_crystallization_enabled: Type.Optional(Type.Boolean()),
        repository_recipe_crystallization_enabled: Type.Optional(Type.Boolean({ description: "Generate or reuse a repository-scoped Recipe under from_rag. Disabled by default." })),
        model: Type.Optional(Type.String()),
        top_k: Type.Optional(Type.Number()),
        relevance_threshold: Type.Optional(Type.Number()),
        temperature: Type.Optional(Type.Number()),
      }),
      async execute(_toolCallId, params, signal, _onUpdate, ctx) {
        const config = await deps.loadConfig(ctx.cwd);
        const workflow = deps.workflowConfig(config);
        const recipeParams = {
          ...params,
          skill_dir: params.recipe_dir,
          skill_enable: params.recipe_enabled,
          generate_skill_enable: params.recipe_crystallization_enabled,
          repository_recipe_crystallization_enabled: params.repository_recipe_crystallization_enabled,
        };
        const resolved = await deps.workflow.resolveTargetedSkill({
          cwd: ctx.cwd,
          workflowRoot: deps.workflowRoot,
          runId: params.run_id,
          question: params.question,
          params: recipeParams,
          config,
          flags: workflow,
          signal,
        });
        return deps.content(publicRecipeResult(resolved));
      },
      renderResult: renderSeekBrainResult("seekbrain_recipe_retrieve"),
    }),
  ];
}

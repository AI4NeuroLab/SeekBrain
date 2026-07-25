import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { PlanWorkflow } from "../../../workflows/index.ts";
import { renderSeekBrainResult } from "../../tui/compact-tool-results.ts";
import type { Json, SeekBrainToolDefinition } from "../runtime-types.ts";

export interface FormulationToolDependencies {
  workflow: PlanWorkflow;
  loadConfig(cwd: string): Promise<Json>;
  readPrompt(name: string): Promise<string>;
  pickAgentConfig(config: Json, name: string): Json;
  humanGateEnabled(config: Json, stage: string): boolean;
  content(details: Json): any;
}

export function createFormulationTools(deps: FormulationToolDependencies): SeekBrainToolDefinition[] {
  const {
    workflow: planWorkflow,
    loadConfig: loadConfigCached,
    readPrompt,
    pickAgentConfig,
    humanGateEnabled,
    content,
  } = deps;
  return [
    defineTool({
    name: "seekbrain_formulation_generate",
    label: "Generate Methodological Schema",
    description: "Run the isolated Formulation Agent and persist the methodological schema to plan.md.",
    parameters: Type.Object({
      question: Type.Optional(Type.String({ description: "Research question or task. Falls back to state.json question." })),
      run_id: Type.String(),
      data_info: Type.Optional(Type.String()),
      extra_path_info: Type.Optional(Type.String()),
      analysis_recipe: Type.Optional(Type.String()),
      deep_research_context: Type.Optional(Type.String()),
      additional_context: Type.Optional(Type.String()),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const config = await loadConfigCached(ctx.cwd);
      return content(await planWorkflow.execute({
        cwd: ctx.cwd,
        runId: params.run_id,
        question: params.question,
        dataInfo: params.data_info,
        extraPathInfo: params.extra_path_info,
        targetedSkill: params.analysis_recipe,
        deepResearchContext: params.deep_research_context,
        additionalContext: params.additional_context,
        rolePrompt: await readPrompt("plan"),
        agentConfig: pickAgentConfig(config, "seekbrain_plan"),
        finalizeSchema: Type.Object({
          plan_markdown: Type.String(),
          review_summary: Type.String(),
          summary: Type.String(),
          confidence: Type.Number(),
          warnings: Type.Array(Type.String()),
        }),
        humanReviewRequired: humanGateEnabled(config, "plan"),
        signal,
      }));
    },
    renderResult: renderSeekBrainResult("seekbrain_formulation_generate"),
    }),
  ];
}

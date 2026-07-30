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
      run_id: Type.String(),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const config = await loadConfigCached(ctx.cwd);
      return content(await planWorkflow.execute({
        cwd: ctx.cwd,
        runId: params.run_id,
        rolePrompt: await readPrompt("plan"),
        agentConfig: pickAgentConfig(config, "seekbrain_plan"),
        finalizeSchema: Type.Object({
          plan_markdown: Type.String(),
          review_summary: Type.String(),
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

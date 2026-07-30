import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { InterpretWorkflow } from "../../../workflows/index.ts";
import { renderSeekBrainResult } from "../../tui/compact-tool-results.ts";
import type { Json, SeekBrainToolDefinition } from "../runtime-types.ts";

export interface InterpretationToolDependencies {
  workflow: InterpretWorkflow;
  loadConfig(cwd: string): Promise<Json>;
  readPrompt(name: string): Promise<string>;
  pickAgentConfig(config: Json, name: string): Json;
  content(details: Json): any;
}

export function createInterpretationTools(deps: InterpretationToolDependencies): SeekBrainToolDefinition[] {
  const {
    workflow: interpretWorkflow,
    loadConfig: loadConfigCached,
    readPrompt,
    pickAgentConfig,
    content,
  } = deps;
  return [
    defineTool({
    name: "seekbrain_interpretation_run",
    label: "Run Interpretation Agent",
    description: "Inspect validated scientific figures and synthesize final conclusions from the images, validated observations, and statistics.",
    parameters: Type.Object({
      run_id: Type.String(),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const config = await loadConfigCached(ctx.cwd);
      return content(await interpretWorkflow.execute({
        cwd: ctx.cwd,
        runId: params.run_id,
        rolePrompt: await readPrompt("interpret"),
        agentConfig: pickAgentConfig(config, "seekbrain_interpret"),
        finalizeSchema: Type.Object({
          conclusions: Type.Array(Type.String()),
          summary: Type.String(),
          limitations: Type.Array(Type.String()),
          next_research_directions: Type.Array(Type.Object({
            title: Type.String(),
            research_question: Type.String(),
          })),
        }),
        signal,
      }));
    },
    renderResult: renderSeekBrainResult("seekbrain_interpretation_run"),
    }),
  ];
}

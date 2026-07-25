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
    description: "Analyze the single canonical validated figure and synthesize final scientific conclusions in one isolated Interpretation Agent call.",
    parameters: Type.Object({
      run_id: Type.String(),
      additional_context: Type.Optional(Type.String()),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const config = await loadConfigCached(ctx.cwd);
      return content(await interpretWorkflow.execute({
        cwd: ctx.cwd,
        runId: params.run_id,
        additionalContext: params.additional_context,
        rolePrompt: await readPrompt("interpret"),
        agentConfig: pickAgentConfig(config, "seekbrain_interpret"),
        finalizeSchema: Type.Object({
          image_analysis: Type.Object({
            figure_type: Type.String(),
            observations: Type.Array(Type.String()),
            quantitative_evidence: Type.Array(Type.String()),
            biological_interpretation: Type.Array(Type.String()),
            alternative_explanations: Type.Array(Type.String()),
            limitations: Type.Array(Type.String()),
          }),
          conclusions: Type.Array(Type.String()),
          summary: Type.String(),
          limitations: Type.Array(Type.String()),
          confidence: Type.Number(),
          next_research_directions: Type.Array(Type.Object({
            title: Type.String(),
            research_question: Type.String(),
            rationale: Type.String(),
            reuses: Type.Array(Type.String()),
            expected_output: Type.String(),
          }), { minItems: 1, maxItems: 3 }),
        }),
        signal,
      }));
    },
    renderResult: renderSeekBrainResult("seekbrain_interpretation_run"),
    }),
  ];
}

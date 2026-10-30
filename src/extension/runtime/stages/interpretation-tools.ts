import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import {
  ConclusionClaimsSchema,
  InterpretationEvidenceSchema,
  type InterpretWorkflow,
} from "../../../workflows/index.ts";
import { renderSeekBrainResult } from "../../tui/compact-tool-results.ts";
import type { Json, SeekBrainToolDefinition } from "../runtime-types.ts";

export interface InterpretationToolDependencies {
  workflow: InterpretWorkflow;
  loadConfig(cwd: string): Promise<Json>;
  readPrompt(name: string): Promise<string>;
  literatureAgentConfig(config: Json, name: string): Json;
  content(details: Json): any;
}

export function createInterpretationTools(deps: InterpretationToolDependencies): SeekBrainToolDefinition[] {
  const {
    workflow: interpretWorkflow,
    loadConfig: loadConfigCached,
    readPrompt,
    literatureAgentConfig,
    content,
  } = deps;
  return [
    defineTool({
    name: "seekbrain_interpretation_run",
    label: "Run Interpretation Agent",
    description: "Inspect validated scientific figures and synthesize final conclusions from the images, validated observations, statistics, and selectively retrieved biological context.",
    parameters: Type.Object({
      run_id: Type.String(),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const config = await loadConfigCached(ctx.cwd);
      return content(await interpretWorkflow.execute({
        cwd: ctx.cwd,
        runId: params.run_id,
        researchRolePrompt: await readPrompt("interpret_research"),
        rolePrompt: await readPrompt("interpret"),
        agentConfig: literatureAgentConfig(config, "seekbrain_interpret"),
        researchFinalizeSchema: InterpretationEvidenceSchema,
        finalizeSchema: ConclusionClaimsSchema,
        signal,
      }));
    },
    renderResult: renderSeekBrainResult("seekbrain_interpretation_run"),
    }),
  ];
}

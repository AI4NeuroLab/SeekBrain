import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { ImageWorkflow } from "../../../workflows/index.ts";
import { renderSeekBrainResult } from "../../tui/compact-tool-results.ts";
import type { Json, SeekBrainToolDefinition } from "../runtime-types.ts";

export interface FigureRefinementToolDependencies {
  workflow: ImageWorkflow;
  loadConfig(cwd: string): Promise<Json>;
  workflowConfig(config: Json): Json & { image_refine: boolean };
  readPrompt(name: string): Promise<string>;
  pickAgentConfig(config: Json, name: string): Json;
  content(details: Json): any;
}

export function createFigureRefinementTools(deps: FigureRefinementToolDependencies): SeekBrainToolDefinition[] {
  const {
    workflow: imageWorkflow,
    loadConfig: loadConfigCached,
    workflowConfig: seekbrainWorkflowConfig,
    readPrompt,
    pickAgentConfig,
    content,
  } = deps;
  return [
    defineTool({
    name: "seekbrain_figure_refine",
    label: "Refine Figure",
    description: "Run the isolated Figure Refinement stage; the outer loop stays in this extension/tool boundary.",
    parameters: Type.Object({
      question: Type.Optional(Type.String({ description: "Research question or task. Falls back to state.json question." })),
      run_id: Type.String(),
      figure_path: Type.Optional(Type.String()),
      feedback: Type.Optional(Type.String()),
      additional_context: Type.Optional(Type.String()),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const config = await loadConfigCached(ctx.cwd);
      const workflow = seekbrainWorkflowConfig(config);
      return content(await imageWorkflow.refine({
        cwd: ctx.cwd,
        runId: params.run_id,
        question: params.question,
        figurePath: params.figure_path,
        feedback: params.feedback,
        additionalContext: params.additional_context,
        rolePrompt: await readPrompt("image_refine"),
        agentConfig: pickAgentConfig(config, "seekbrain_refine_image"),
        finalizeSchema: Type.Object({
          refined_code_patch: Type.String(),
          refined_figure_path: Type.Optional(Type.String()),
          summary: Type.String(),
          remaining_issues: Type.Array(Type.String()),
          stop: Type.Boolean(),
        }),
        enabled: workflow.image_refine,
        signal,
      }));
    },
    renderResult: renderSeekBrainResult("seekbrain_figure_refine"),
    }),
  ];
}

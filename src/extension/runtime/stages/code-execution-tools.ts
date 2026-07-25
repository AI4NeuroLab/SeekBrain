import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { CodeWorkflow } from "../../../workflows/index.ts";
import { createDependencyInstallToolResultHandler, type DependencyInstallApprovalQueue } from "../../dependency-install.ts";
import { renderSeekBrainResult } from "../../tui/compact-tool-results.ts";
import type { Json, SeekBrainToolDefinition } from "../runtime-types.ts";

export interface CodeExecutionToolDependencies {
  workflow: CodeWorkflow;
  loadConfig(cwd: string): Promise<Json>;
  readPrompt(name: string): Promise<string>;
  pickAgentConfig(config: Json, name: string): Json;
  humanGateEnabled(config: Json, stage: string): boolean;
  defaultMaxCodeAttempts: number;
  createDependencyApprovalQueue(context: Json): Promise<DependencyInstallApprovalQueue>;
  content(details: Json): any;
}

export function createCodeExecutionTools(deps: CodeExecutionToolDependencies): SeekBrainToolDefinition[] {
  const {
    workflow: codeWorkflow,
    loadConfig: loadConfigCached,
    readPrompt,
    pickAgentConfig,
    humanGateEnabled,
    defaultMaxCodeAttempts: DEFAULT_MAX_CODE_ATTEMPTS,
    createDependencyApprovalQueue,
    content,
  } = deps;
  return [
    defineTool({
    name: "seekbrain_code_execute",
    label: "Run Code Agent",
    description: "Run the isolated Code Agent, persist generated artifacts, and apply deterministic checks.",
    parameters: Type.Object({
      question: Type.Optional(Type.String({ description: "Research question or task. Falls back to state.json question." })),
      run_id: Type.String(),
      methodological_schema: Type.Optional(Type.String()),
      data_info: Type.Optional(Type.String()),
      extra_path_info: Type.Optional(Type.String()),
      analysis_recipe: Type.Optional(Type.String()),
      validation_feedback: Type.Optional(Type.String()),
      additional_context: Type.Optional(Type.String()),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const config = await loadConfigCached(ctx.cwd);
      const dependencyQueue = await createDependencyApprovalQueue(ctx as Json);
      return content(await codeWorkflow.execute({
        cwd: ctx.cwd,
        runId: params.run_id,
        question: params.question,
        plan: params.methodological_schema,
        dataInfo: params.data_info,
        extraPathInfo: params.extra_path_info,
        targetedSkill: params.analysis_recipe,
        validationFeedback: params.validation_feedback,
        additionalContext: params.additional_context,
        rolePrompt: await readPrompt("code"),
        agentConfig: pickAgentConfig(config, "seekbrain_code"),
        finalizeSchema: Type.Object({
          code_files: Type.Array(Type.Object({
            path: Type.String(),
          }), { minItems: 1 }),
          exec_log: Type.String(),
          statistics: Type.Any(),
          artifacts: Type.Array(Type.Object({
            name: Type.Optional(Type.String()),
            path: Type.String(),
            kind: Type.Union([Type.Literal("figure"), Type.Literal("statistics"), Type.Literal("data"), Type.Literal("code"), Type.Literal("markdown"), Type.Literal("json"), Type.Literal("log"), Type.Literal("other")]),
            role: Type.Optional(Type.String()),
            description: Type.Optional(Type.String()),
            produced_by: Type.Optional(Type.String()),
          })),
          summary: Type.String(),
          warnings: Type.Array(Type.String()),
        }),
        planReviewRequired: humanGateEnabled(config, "plan"),
        maxAttempts: DEFAULT_MAX_CODE_ATTEMPTS,
        signal,
        afterToolCall: createDependencyInstallToolResultHandler(dependencyQueue, { runId: params.run_id }),
      }));
    },
    renderResult: renderSeekBrainResult("seekbrain_code_execute"),
    }),
  ];
}

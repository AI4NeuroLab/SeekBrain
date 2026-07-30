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
      run_id: Type.String(),
      validation_feedback: Type.Optional(Type.String()),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const config = await loadConfigCached(ctx.cwd);
      const dependencyQueue = await createDependencyApprovalQueue(ctx as Json);
      return content(await codeWorkflow.execute({
        cwd: ctx.cwd,
        runId: params.run_id,
        validationFeedback: params.validation_feedback,
        rolePrompt: await readPrompt("code"),
        agentConfig: pickAgentConfig(config, "seekbrain_code"),
        finalizeSchema: Type.Object({
          code_files: Type.Array(Type.Object({
            path: Type.String(),
          }), { minItems: 1 }),
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

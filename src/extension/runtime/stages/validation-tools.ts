import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { ValidateWorkflow } from "../../../workflows/index.ts";
import { renderSeekBrainResult } from "../../tui/compact-tool-results.ts";
import type { Json, SeekBrainToolDefinition } from "../runtime-types.ts";

export interface ValidationToolDependencies {
  workflow: ValidateWorkflow;
  loadConfig(cwd: string): Promise<Json>;
  readPrompt(name: string): Promise<string>;
  pickAgentConfig(config: Json, name: string): Json;
  defaultMaxCodeAttempts: number;
  content(details: Json): any;
}

export function createValidationTools(deps: ValidationToolDependencies): SeekBrainToolDefinition[] {
  const {
    workflow: validateWorkflow,
    loadConfig: loadConfigCached,
    readPrompt,
    pickAgentConfig,
    defaultMaxCodeAttempts: DEFAULT_MAX_CODE_ATTEMPTS,
    content,
  } = deps;
  return [
    defineTool({
    name: "seekbrain_validation_run",
    label: "Run Validation Agent",
    description: "Validate the current run's scientific figure artifacts and store validation.json.",
    parameters: Type.Object({
      run_id: Type.String(),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const config = await loadConfigCached(ctx.cwd);
      return content(await validateWorkflow.execute({
        cwd: ctx.cwd,
        runId: params.run_id,
        rolePrompt: await readPrompt("validate"),
        agentConfig: pickAgentConfig(config, "seekbrain_validate"),
        finalizeSchema: Type.Object({
          pass: Type.Boolean(),
          per_figure: Type.Array(Type.Object({
            path: Type.String(),
            pass: Type.Boolean(),
            issues: Type.Array(Type.String()),
          })),
          overall_mismatches: Type.Array(Type.String()),
          blocking_issues: Type.Array(Type.String()),
          methodological_caveats: Type.Array(Type.String()),
          figure_observations: Type.Array(Type.String()),
          visual_issues: Type.Array(Type.Object({
            figure_path: Type.String(),
            feedback: Type.String(),
          }), { maxItems: 1 }),
          confidence: Type.Number(),
          summary: Type.String(),
        }),
        maxCodeAttempts: DEFAULT_MAX_CODE_ATTEMPTS,
        imageRefineEnabled: config.workflow?.seekbrain?.image_refine === true,
        signal,
      }));
    },
    renderResult: renderSeekBrainResult("seekbrain_validation_run"),
    }),
  ];
}

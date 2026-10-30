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
          recipe_feedback: Type.Optional(Type.Object({
            attribution: Type.Union([
              Type.Literal("recipe_defect"),
              Type.Literal("retrieval_mismatch"),
              Type.Literal("implementation_defect"),
              Type.Literal("data_mismatch"),
              Type.Literal("environment"),
              Type.Literal("inconclusive"),
            ]),
            recipe_id: Type.String(),
            defect_type: Type.String(),
            failed_checks: Type.Array(Type.String()),
            evidence: Type.Array(Type.String()),
            preserve: Type.Array(Type.String()),
            suggested_scope: Type.Union([Type.Literal("local"), Type.Literal("method"), Type.Literal("retrieval"), Type.Literal("none")]),
            summary: Type.String(),
          })),
          confidence: Type.Number(),
          summary: Type.String(),
        }),
        maxCodeAttempts: DEFAULT_MAX_CODE_ATTEMPTS,
        imageRefineEnabled: config.workflow?.seekbrain?.image_refine === true,
        recipeRevision: config.modules?.targeted_skill?.revision,
        signal,
      }));
    },
    renderResult: renderSeekBrainResult("seekbrain_validation_run"),
    }),
  ];
}

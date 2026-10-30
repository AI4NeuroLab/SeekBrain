import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { PlanFinalizeSchema } from "../../../core/index.ts";
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

const FORMULATION_TOOL_ACTIVITY: Record<string, string> = {
  read: "Reading formulation evidence",
  bash: "Inspecting the dataset",
  grep: "Searching dataset files",
  find: "Locating dataset files",
  ls: "Inspecting dataset structure",
  seekbrain_literature_search: "Searching biological and neuroscience literature",
  seekbrain_paper_read: "Reading a scientific paper",
  seekbrain_recipe_search_local: "Searching local analysis Skills",
  seekbrain_recipe_search_rag: "Searching repository-backed analysis methods",
  seekbrain_recipe_generate_from_rag: "Generating repository-backed analysis Skills",
};

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
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      const config = await loadConfigCached(ctx.cwd);
      return content(await planWorkflow.execute({
        cwd: ctx.cwd,
        runId: params.run_id,
        rolePrompt: await readPrompt("plan"),
        agentConfig: pickAgentConfig(config, "seekbrain_plan"),
        finalizeSchema: PlanFinalizeSchema,
        humanReviewRequired: humanGateEnabled(config, "plan"),
        signal,
        onToolCall: ({ toolName }) => {
          if (toolName === "finalize_plan") return;
          onUpdate?.(content({
            ok: true,
            progress: true,
            stage: "tool_call",
            active_tool: toolName,
            message: FORMULATION_TOOL_ACTIVITY[toolName] || `Using ${toolName}`,
          }));
        },
      }));
    },
    renderResult: renderSeekBrainResult("seekbrain_formulation_generate"),
    }),
  ];
}

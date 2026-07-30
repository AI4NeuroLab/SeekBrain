import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { SeekBrainToolDefinition } from "./runtime-types.ts";

export const TOOL_REGISTRATION_ORDER = [
  "seekbrain_system_check",
  "seekbrain_system_capabilities",
  "seekbrain_data_resolve",
  "seekbrain_research_start",
  "seekbrain_planning_assess",
  "seekbrain_planning_decision_review",
  "seekbrain_planning_decision_record",
  "seekbrain_planning_generate",
  "seekbrain_planning_peer_review",
  "seekbrain_planning_researcher_review",
  "seekbrain_planning_researcher_decision_record",
  "seekbrain_analysis_tasks_prepare",
  "seekbrain_research_extend",
  "seekbrain_execution_initialize",
  "seekbrain_execution_run",
  "seekbrain_execution_schema_review",
  "seekbrain_report_evidence_compile",
  "seekbrain_execution_tasks_run",
  "seekbrain_report_generate",
  "seekbrain_analysis_task_control",
  "seekbrain_research_continue",
  "seekbrain_run_start",
  "seekbrain_run_resume",
  "seekbrain_review_approve",
  "seekbrain_review_feedback",
  "seekbrain_formulation_researcher_review",
  "seekbrain_formulation_update",
  "seekbrain_code_edit_review",
  "seekbrain_code_update_propose",
  "seekbrain_code_update_review",
  "seekbrain_recipe_retrieve",
  "seekbrain_deep_research",
  "seekbrain_formulation_generate",
  "seekbrain_code_execute",
  "seekbrain_validation_run",
  "seekbrain_figure_refine",
  "seekbrain_interpretation_run",
] as const;

export function registerTools(pi: ExtensionAPI, definitions: SeekBrainToolDefinition[]) {
  const byName = new Map<string, SeekBrainToolDefinition>();
  for (const definition of definitions) {
    if (byName.has(definition.name)) {
      throw new Error(`Duplicate SeekBrain tool definition: ${definition.name}`);
    }
    byName.set(definition.name, definition);
  }

  const expected = new Set<string>(TOOL_REGISTRATION_ORDER);
  const unexpected = [...byName.keys()].filter((name) => !expected.has(name));
  if (unexpected.length) {
    throw new Error(`Unexpected SeekBrain tool definitions: ${unexpected.join(", ")}`);
  }

  for (const name of TOOL_REGISTRATION_ORDER) {
    const definition = byName.get(name);
    if (!definition) throw new Error(`Missing SeekBrain tool definition: ${name}`);
    pi.registerTool(definition);
  }
}

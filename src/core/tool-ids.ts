export const LEGACY_TOOL_ID_MAP = {
  neuro_ping: "seekbrain_system_check",
  neuro_capabilities: "seekbrain_system_capabilities",
  neuro_resolve_data: "seekbrain_data_resolve",
  neuro_start_research: "seekbrain_research_start",
  neuro_assess_research: "seekbrain_planning_assess",
  neuro_review_research_planning: "seekbrain_planning_decision_review",
  neuro_prepare_subquestions: "seekbrain_planning_generate",
  neuro_review_research_plan: "seekbrain_planning_peer_review",
  neuro_review_research_tree: "seekbrain_planning_researcher_review",
  neuro_materialize_research_tasks: "seekbrain_analysis_tasks_prepare",
  neuro_initialize_research_execution: "seekbrain_execution_initialize",
  neuro_prepare_task_plans: "seekbrain_execution_run",
  neuro_review_task_plan: "seekbrain_execution_schema_review",
  neuro_compile_report_evidence: "seekbrain_report_evidence_compile",
  neuro_execute_research_tasks: "seekbrain_execution_tasks_run",
  neuro_generate_report: "seekbrain_report_generate",
  neuro_control_research_task: "seekbrain_analysis_task_control",
  neuro_continue_research: "seekbrain_research_continue",
  neuro_start_run: "seekbrain_run_start",
  neuro_resume_run: "seekbrain_run_resume",
  neuro_approve_stage: "seekbrain_review_approve",
  neuro_record_feedback: "seekbrain_review_feedback",
  neuro_review_plan: "seekbrain_formulation_researcher_review",
  neuro_update_plan: "seekbrain_formulation_update",
  neuro_review_code_edit: "seekbrain_code_edit_review",
  neuro_propose_code_update: "seekbrain_code_update_propose",
  neuro_review_code_update: "seekbrain_code_update_review",
  resolve_targeted_skill: "seekbrain_recipe_retrieve",
  neuro_plan: "seekbrain_formulation_generate",
  neuro_code: "seekbrain_code_execute",
  neuro_validate: "seekbrain_validation_run",
  neuro_refine_image: "seekbrain_figure_refine",
  neuro_interpret: "seekbrain_interpretation_run",
} as const;

export type LegacyToolId = keyof typeof LEGACY_TOOL_ID_MAP;
export type SeekBrainToolId = (typeof LEGACY_TOOL_ID_MAP)[LegacyToolId];

export function canonicalToolId(value: unknown): string {
  const id = String(value || "");
  return LEGACY_TOOL_ID_MAP[id as LegacyToolId] || id;
}

const TOOL_REFERENCE_KEYS = new Set(["tool", "next_tool", "required_tool"]);

export function migrateLegacyToolReferences<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => migrateLegacyToolReferences(item)) as T;
  }
  if (!value || typeof value !== "object") return value;
  const migrated = Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, child]) => [
    key,
    TOOL_REFERENCE_KEYS.has(key)
      ? canonicalToolId(child)
      : migrateLegacyToolReferences(child),
  ]));
  return migrated as T;
}

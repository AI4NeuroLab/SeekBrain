import { literatureCapabilities, type SeekBrainConfig } from "../../core/index.ts";

type JsonObject = Record<string, unknown>;

export function pingResult(runCount: number): JsonObject {
  return { ok: true, extension: "seekbrain", run_count: runCount };
}

export function workflowConfigResult(config: Readonly<SeekBrainConfig>): JsonObject {
  const workflow = config.workflow.seekbrain;
  const literature = literatureCapabilities(config);
  const status = (enabled: boolean) => enabled ? "enabled" : "disabled_by_user_config";
  const literatureStatus = (enabled: boolean) => literature.available ? status(enabled) : "disabled_no_literature_provider";
  return {
    optional: {
      research_planning: status(workflow.research_planning),
      research_planning_peer_review: status(workflow.research_planning_peer_review),
      research_survey: literatureStatus(literature.research_survey),
      deep_research: literatureStatus(literature.deep_research),
      targeted_skill: status(workflow.targeted_skill_match || workflow.targeted_skill_generate),
      image_refine: status(workflow.image_refine),
      save_skill: status(workflow.save_skill),
      transparency: status(workflow.transparency),
    },
    literature: { provider: literature.provider, available: literature.available },
    human_review: workflow.human_review,
  };
}

export function capabilitiesResult(config: Readonly<SeekBrainConfig>): JsonObject {
  const workflowConfig = workflowConfigResult(config);
  return {
    ok: true,
    required_spine: [
      "seekbrain_data_resolve",
      "seekbrain_research_start",
      "seekbrain_formulation_generate",
      "seekbrain_code_execute",
      "seekbrain_validation_run",
      "seekbrain_interpretation_run",
    ],
    ...workflowConfig,
    post_run_code_edit: {
      preferred_tool: "seekbrain_code_edit_review",
      diff_review: "required",
      exact_replacement_fast_path: true,
      apply_and_regenerate_after_approval: true,
      legacy_fallback: ["seekbrain_code_update_propose", "seekbrain_code_update_review"],
    },
    continuation_tool: "seekbrain_research_continue",
    legacy_compatibility: ["seekbrain_run_start", "seekbrain_run_resume"],
    note: "Disabled optional tools are disabled by user configuration, not because the tool is broken. Continue the required spine without placeholder context for disabled tools.",
  };
}

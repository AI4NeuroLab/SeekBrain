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
      "neuro_resolve_data",
      "neuro_start_research",
      "neuro_plan",
      "neuro_code",
      "neuro_validate",
      "neuro_interpret",
    ],
    ...workflowConfig,
    post_run_code_edit: {
      preferred_tool: "neuro_review_code_edit",
      diff_review: "required",
      exact_replacement_fast_path: true,
      apply_and_regenerate_after_approval: true,
      legacy_fallback: ["neuro_propose_code_update", "neuro_review_code_update"],
    },
    continuation_tool: "neuro_continue_research",
    legacy_compatibility: ["neuro_start_run", "neuro_resume_run"],
    note: "Disabled optional tools are disabled by user configuration, not because the tool is broken. Continue the required spine without placeholder context for disabled tools.",
  };
}

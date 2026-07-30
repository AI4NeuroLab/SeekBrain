import { Text } from "@earendil-works/pi-tui";
import { basename, dirname } from "node:path";

type Json = Record<string, any>;

function detailsFrom(result: Json): Json {
  return result?.details && typeof result.details === "object" ? result.details : {};
}

function rawResult(result: Json): string {
  const details = detailsFrom(result);
  if (Object.keys(details).length > 0) return JSON.stringify(details, null, 2);
  return String(result?.content?.find((item: Json) => item.type === "text")?.text || "");
}

function compactPath(value: unknown): string {
  const path = String(value || "");
  if (!path) return "";
  const parent = basename(dirname(path));
  const leaf = basename(path);
  return parent && parent !== "." ? `…/${parent}/${leaf}` : leaf;
}

function compactText(value: unknown, limit = 120): string {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

function enabledCount(optional: unknown): { enabled: number; total: number } {
  const values = optional && typeof optional === "object" ? Object.values(optional) : [];
  return { enabled: values.filter((value) => value === "enabled").length, total: values.length };
}

function textComponent(lines: string[], theme: Json) {
  return new Text(lines.filter(Boolean).map((line, index) => index === 0 ? theme.fg("toolOutput", line) : theme.fg("muted", line)).join("\n"), 0, 0);
}

function expandedComponent(result: Json, theme: Json) {
  return new Text(theme.fg("toolOutput", rawResult(result)), 0, 0);
}

function count(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function summary(value: unknown): string {
  return compactText(value, 180);
}

function warningSuffix(details: Json): string {
  const warnings = Array.isArray(details.warnings) ? details.warnings : Array.isArray(details.result?.warnings) ? details.result.warnings : [];
  return warnings.length > 0 ? ` · ${warnings.length} warning${warnings.length === 1 ? "" : "s"}` : "";
}

function failureResult(toolName: string, details: Json, theme: Json) {
  const blocked = details.blocked_by_human_review === true || details.blocked_by_validation_policy === true;
  const title = blocked ? `○ ${toolName} blocked` : `✗ ${toolName} failed`;
  const reason = details.error || details.message || details.rag_error || "The tool did not complete successfully.";
  const next = details.next_step?.tool || details.next_tool;
  return textComponent([
    title,
    summary(reason),
    next ? `Next: ${next}` : "",
    "Ctrl+O for full details",
  ], theme);
}

function skippedResult(toolName: string, details: Json, theme: Json) {
  return textComponent([
    `○ ${toolName} skipped by configuration`,
    summary(details.message || details.reason),
    "Ctrl+O for full details",
  ], theme);
}

function lifecycleResult(action: string, details: Json, theme: Json) {
  const round = String(details.round_name || basename(String(details.run_dir || "")) || details.run_id || "run");
  const researchRoute = details.research_route && typeof details.research_route === "object" ? details.research_route : {};
  if (researchRoute.route === "needs_clarification") {
    return textComponent([
      "○ Input clarification required",
      summary(researchRoute.reason || researchRoute.message),
      `${summary(researchRoute.recommended_action || "Verify that the supplied dataset and metadata match the research question, or revise the question.") } · Ctrl+O for details`,
    ], theme);
  }
  if (researchRoute.route === "research_planning") {
    const approved = researchRoute.decision === "yes" && researchRoute.needs_user_review === false;
    return textComponent([
      `${approved ? "✓" : "○"} ${action} ${round} · Research Planning ${approved ? "requested" : "recommended"}`,
      summary(researchRoute.reason),
      approved ? "Continue to hierarchical research plan generation · Ctrl+O for details" : "User decision required · Ctrl+O for details",
    ], theme);
  }
  return textComponent([
    `✓ ${action} ${round}`,
    details.question ? `Task: ${compactText(details.question)}` : "",
    details.run_dir ? `Workdir: ${compactPath(details.run_dir)} · Ctrl+O for details` : "Ctrl+O for details",
  ], theme);
}

function expandedStartResearchResult(details: Json, theme: Json) {
  const route = details.research_route && typeof details.research_route === "object" ? details.research_route : {};
  const optional = details.workflow_config?.optional && typeof details.workflow_config.optional === "object"
    ? Object.entries(details.workflow_config.optional)
        .filter(([, status]) => status === "enabled")
        .map(([name]) => name)
    : [];
  return textComponent([
    `Research started · ${String(details.round_name || "round1")}`,
    details.run_id ? `Run: ${details.run_id}` : "",
    details.run_dir ? `Workdir: ${details.run_dir}` : "",
    optional.length ? `Enabled options: ${optional.join(", ")}` : "",
    route.route === "needs_clarification" ? `Assessment: ${summary(route.reason || route.message)}` : "",
    route.route === "needs_clarification"
      ? `Required action: ${summary(route.recommended_action || "Verify that the supplied dataset and metadata match the research question, or revise the question.")}`
      : "",
    route.assessment_path ? `Assessment record: ${route.assessment_path}` : "",
  ], theme);
}

function reviewResult(details: Json, theme: Json) {
  const decision = String(details.decision || details.review?.status || "recorded");
  const rawStage = String(details.stage || details.required_stage || "plan");
  const stage = rawStage === "plan" ? "Methodological schema" : rawStage;
  const icon = decision === "approve" || decision === "approved" ? "✓" : decision === "feedback" ? "↻" : "○";
  return textComponent([
    `${icon} ${stage} review: ${decision}`,
    details.feedback ? `Feedback: ${summary(details.feedback)}` : summary(details.message),
    details.plan_path ? `Schema: ${compactPath(details.plan_path)} · Ctrl+O for details` : "Ctrl+O for details",
  ], theme);
}

function targetedSkillResult(details: Json, theme: Json) {
  const paths = Array.isArray(details.recipe_paths) ? details.recipe_paths : Array.isArray(details.skill_paths) ? details.skill_paths : [];
  const names = paths.map((path: unknown) => basename(String(path))).filter(Boolean);
  const repository = details.repository_reference || {};
  const repositoryUrl = String(repository.repository_url || "");
  const repositoryName = repositoryUrl.replace(/\/$/, "").replace(/^https?:\/\/(?:www\.)?github\.com\//i, "")
    || String(repository.repository_key || "").replace(/^github\.com\//i, "");
  const repositorySource = details.source === "repository_reference" || details.source === "validated_repository_recipe";
  const state = details.source === "repository_reference" ? "found in an external repository"
    : details.source === "validated_repository_recipe" ? "reused from validated repository scripts"
      : details.source === "crystallized" || details.source === "generated_from_rag" || details.generated === true
        ? "crystallized from literature and code"
        : details.source === "repertoire" || details.source === "existing_skill"
          ? "retrieved from the Neuroscience Analysis Repertoire"
          : "not found";
  const referenceNames = (Array.isArray(repository.reference_files) ? repository.reference_files : Array.isArray(details.reference_paths) ? details.reference_paths : [])
    .map((path: unknown) => basename(String(path))).filter(Boolean);
  return textComponent([
    `${details.matched === true ? "✓" : "○"} Analysis recipe ${state}`,
    repositorySource
      ? `Repository: ${repositoryName || "repository"}${referenceNames.length ? ` · Reference: ${referenceNames.slice(0, 2).join(", ")}` : ""}`
      : names.length > 0 ? `Recipes: ${names.join(", ")}` : "No matching analysis recipe found",
    `${count(details.reference_paths)} references${warningSuffix(details)} · Ctrl+O for details`,
  ], theme);
}

function deepResearchResult(details: Json, theme: Json) {
  const sources = Number(details.source_count ?? details.rag?.source_count ?? 0);
  const ragOk = details.rag_ok ?? details.rag?.ok;
  return textComponent([
    `${ragOk === false ? "○" : "✓"} Deep research complete · ${sources} source${sources === 1 ? "" : "s"}`,
    summary(details.result?.summary || (ragOk === false ? details.rag_error || "No usable Paper RAG evidence" : "")),
    details.context_path ? `Context: ${compactPath(details.context_path)}${warningSuffix(details)} · Ctrl+O for details` : `Ctrl+O for details`,
  ], theme);
}

function dataResolveResult(details: Json, theme: Json) {
  const reused = details.source === "cache";
  return textComponent([
    `✓ Dataset profile ${reused ? "reused" : "generated"}`,
    details.summary ? summary(details.summary) : `Dataset: ${basename(String(details.data_dir || ""))}`,
    details.metadata_path ? `Metadata: ${compactPath(details.metadata_path)}${warningSuffix(details)} · Ctrl+O for details` : "Ctrl+O for details",
  ], theme);
}

function researchPlanningResult(toolName: string, details: Json, theme: Json) {
  if (toolName === "seekbrain_planning_generate" && details.progress === true) {
    return textComponent([
      details.stage === "research_survey" ? "○ Research Survey · building global background" : "○ Research Planning · generating hierarchical research plan",
      summary(details.message),
    ], theme);
  }
  if (toolName === "seekbrain_planning_assess") {
    const planning = details.route === "research_planning";
    const clarification = details.route === "needs_clarification";
    return textComponent([
      `${planning || clarification ? "○" : "✓"} Planning assessment · ${clarification ? "input clarification required" : planning ? "Research Planning recommended" : "direct analysis workflow"}`,
      summary(details.reason),
      clarification ? "Correct the question or metadata before continuing · Ctrl+O for details" : planning ? "User decision required · Ctrl+O for details" : "Continue to Recipe · Ctrl+O for details",
    ], theme);
  }
  if (toolName === "seekbrain_planning_decision_review" || toolName === "seekbrain_planning_decision_record") {
    if (details.needs_text_review === true) {
      return textComponent([
        "○ Research Planning · decision required",
        summary(details.message),
        `Next: ${details.next_tool || "await user response"} · Ctrl+O for details`,
      ], theme);
    }
    return textComponent([
      `✓ Research Planning · ${details.decision === "yes" ? "approved" : "direct analysis workflow selected"}`,
      summary(details.message),
      `Next: ${details.next_tool || "seekbrain_recipe_retrieve"} · Ctrl+O for details`,
    ], theme);
  }
  if (toolName === "seekbrain_planning_peer_review") {
    if (details.skipped === true) {
      return textComponent([
        "○ Hierarchical research plan peer review skipped by configuration",
        `${Number(details.subquestion_count || 0)} subquestions · ${Number(details.task_count || 0)} tasks`,
        `Next: ${details.next_tool || "seekbrain_planning_researcher_review"} · Ctrl+O for details`,
      ], theme);
    }
    if (details.verdict === "blocked") {
      return textComponent([
        "○ Hierarchical research plan blocked by data feasibility",
        summary(details.blocked_reason || details.summary),
        `${summary(details.recommended_action)} · Ctrl+O for details`,
      ], theme);
    }
    if (details.needs_text_review === true) {
      return textComponent([
        "○ Hierarchical research plan reviewed · researcher decision required",
        `${Number(details.subquestion_count || 0)} subquestions · ${Number(details.task_count || 0)} tasks · ${Number(details.unresolved_issue_count || 0)} unresolved issues`,
        `Next: ${details.next_tool || "seekbrain_planning_researcher_decision_record"} · Ctrl+O for details`,
      ], theme);
    }
    if (details.decision) {
      const revised = details.decision === "revise";
      const cancelled = details.decision === "cancel";
      return textComponent([
        revised ? "↻ Hierarchical research plan revised · review again" : cancelled ? "○ Hierarchical research plan retained · execution cancelled" : "✓ Hierarchical research plan reviewed and approved",
        `${Number(details.subquestion_count || 0)} subquestions · ${Number(details.task_count || 0)} tasks · ${Number(details.unresolved_issue_count || 0)} unresolved issues`,
        `Next: ${details.next_tool || (cancelled ? "none" : "seekbrain_analysis_tasks_prepare")} · Ctrl+O for details`,
      ], theme);
    }
    return textComponent([
      `✓ Hierarchical research plan reviewed · ${details.verdict}${details.refined ? " · refined once" : ""}`,
      `${Number(details.subquestion_count || 0)} subquestions · ${Number(details.task_count || 0)} tasks · ${Number(details.unresolved_issue_count || 0)} unresolved issues`,
      details.research_plan_path ? `Plan: ${compactPath(details.research_plan_path)} · Ctrl+O for details` : "Ctrl+O for details",
    ], theme);
  }
  if (toolName === "seekbrain_planning_researcher_review" || toolName === "seekbrain_planning_researcher_decision_record") {
    if (details.needs_text_review === true) {
      return textComponent([
        "○ Hierarchical research plan · researcher decision required",
        summary(details.message),
        `Next: ${details.next_tool || "seekbrain_planning_researcher_decision_record"} · Ctrl+O for details`,
      ], theme);
    }
    const revised = details.decision === "revise";
    const cancelled = details.decision === "cancel";
    return textComponent([
      revised ? "↻ Hierarchical research plan revised · review again" : cancelled ? "○ Hierarchical research plan retained · execution cancelled" : "✓ Hierarchical research plan approved",
      revised ? summary(details.feedback_response || details.message) : summary(details.message),
      details.research_plan_path ? `Plan: ${compactPath(details.research_plan_path)} · Ctrl+O for details` : "Ctrl+O for details",
    ], theme);
  }
  if (toolName === "seekbrain_analysis_tasks_prepare") {
    return textComponent([
      `✓ Analysis tasks ${details.reused ? "restored" : "prepared"} · ${Number(details.task_count || 0)} child runs`,
      details.next_task ? `Next: ${details.next_task.task_id} · ${summary(details.next_task.question)}` : "",
      details.task_manifest_path ? `Manifest: ${compactPath(details.task_manifest_path)} · Ctrl+O for details` : "Ctrl+O for details",
    ], theme);
  }
  return textComponent([
    `✓ Hierarchical research plan drafted · ${Number(details.subquestion_count ?? count(details.subquestions))} subquestions · ${Number(details.task_count ?? 0)} analysis tasks`,
    details.research_survey ? `Survey: ${String(details.research_survey.status || "ready")} · ${Number(details.research_survey.source_count || 0)} sources${details.research_survey.reused ? " · reused" : ""}` : "",
    summary(details.research_plan?.planning_rationale),
    details.research_plan_path ? `Plan: ${compactPath(details.research_plan_path)} · Ctrl+O for details` : "Ctrl+O for details",
  ], theme);
}

function researchExecutionResult(toolName: string, details: Json, theme: Json) {
  if (toolName === "seekbrain_execution_run") {
    if (details.progress === true) {
      const marker = (value: unknown) => ["matched", "not_found", "complete", "ready", "approved"].includes(String(value))
        ? "✓" : String(value) === "skipped" ? "–" : ["running", "queued", "revision_required"].includes(String(value)) ? "●" : String(value) === "failed" ? "✗" : "○";
      const taskLines = (Array.isArray(details.task_progress) ? details.task_progress : []).map((task: Json) =>
        `${String(task.task_id)} · Recipe ${marker(task.skill)} · Formulation ${marker(task.plan)} · Review ${marker(task.review)} · Code & Execute ${marker(task.code)} · Validation ${marker(task.validate)} · Figure Refinement ${marker(task.refine)} · Interpretation ${marker(task.interpret)}`);
      return textComponent([
        "○ Analysis Execution Engine",
        summary(details.message),
        ...taskLines,
      ], theme);
    }
    const summaries = (Array.isArray(details.results) ? details.results : []).filter((item: Json) => item.ok === true)
      .map((item: Json) => `${String(item.task_id)} · ${summary(item.plan_summary)}`);
    return textComponent([
      `${details.ok ? "✓" : "○"} Analysis Execution Engine · ${Number(details.planned_count || 0)} formulated · ${Number(details.executed_count || 0)} completed${details.execution_failed_count ? ` · ${Number(details.execution_failed_count)} attention required` : ""}`,
      ...summaries,
      details.next_review ? `Next review: ${details.next_review.task_id} · queue ${Number(details.review_queue_length || 0)}` : "No methodological-schema review is currently waiting",
      "Ctrl+O for full details",
    ], theme);
  }
  if (toolName === "seekbrain_execution_schema_review") {
    return textComponent([
      details.queue_empty ? "○ No methodological schema is waiting for review" : `✓ Methodological schema review · ${String(details.decision || "recorded")}`,
      details.task_id ? `Task: ${details.task_id}` : "",
      details.next_review ? `Next review: ${details.next_review.task_id}` : "Review queue is clear",
      "Ctrl+O for full details",
    ], theme);
  }
  const counts = details.task_status_counts && typeof details.task_status_counts === "object"
    ? Object.entries(details.task_status_counts).map(([status, value]) => `${status} ${value}`).join(" · ")
    : "";
  const limits = details.limits || {};
  return textComponent([
    toolName === "seekbrain_execution_initialize"
      ? `✓ Analysis Execution Engine ${details.reused ? "restored" : "initialized"} · ${Number(details.task_count || 0)} tasks`
      : `○ Analysis Execution Engine · ${String(details.status || "unknown")}`,
    counts,
    `Parallel limits: Formulation ${Number(limits.planning_concurrency || 0)} · Execution ${Number(limits.execution_concurrency || 0)}`,
    details.report_hint ? String(details.report_hint) : "",
    "Ctrl+O for full details",
  ], theme);
}

function stageResult(stage: string, details: Json, theme: Json) {
  const nested = details.result && typeof details.result === "object" ? details.result : {};
  const path = details.plan_path || details.validation_path || details.interpretation_path || details.image_analysis_path || details.conclusions_path || details.output_path;
  const warnings = warningSuffix(details);
  const extra: string[] = [];
  if (stage === "Analytical Formulation" && details.human_review?.needs_user_review === true) extra.push("Researcher review required");
  if (stage === "Code Generation & Execution") {
    const artifacts = Array.isArray(details.artifacts) ? details.artifacts : [];
    const names = artifacts.slice(0, 5).map((artifact: Json) => artifact.name || basename(String(artifact.path || ""))).filter(Boolean);
    extra.push(`${artifacts.length} artifact${artifacts.length === 1 ? "" : "s"}${names.length > 0 ? `: ${names.join(", ")}` : ""}`);
  }
  if (stage === "Validation") {
    const passed = nested.pass === true;
    const issues = count(nested.blocking_issues) + count(nested.overall_mismatches);
    extra.push(`${passed ? "Passed" : "Needs revision"}${nested.route ? ` · ${nested.route}` : ""}${issues > 0 ? ` · ${issues} issues` : ""}`);
  }
  if (stage === "Figure Refinement" && details.refined_figure_path) extra.push(`Figure: ${compactPath(details.refined_figure_path)}${details.fast_pass ? " · fast pass" : ""}`);
  if (stage === "Result Interpretation") {
    extra.push(`${count(nested.conclusions)} conclusions · ${count(details.next_research_directions || nested.next_research_directions)} next directions`);
    if (details.report_hint) extra.push(String(details.report_hint));
  }
  return textComponent([
    `✓ ${stage} complete${warnings}`,
    summary(nested.review_summary || nested.summary || details.summary),
    ...extra,
    path ? `Output: ${compactPath(path)} · Ctrl+O for details` : "Ctrl+O for details",
  ], theme);
}

function proposedCodeResult(details: Json, theme: Json) {
  return textComponent([
    "✓ Code update proposal prepared",
    summary(details.summary),
    details.code_path ? `Code: ${basename(String(details.code_path))}` : "",
    details.diff_path ? `Diff: ${compactPath(details.diff_path)} · Ctrl+O for details` : "Ctrl+O for details",
  ], theme);
}

export function renderSeekBrainResult(toolName: string) {
  return (result: Json, options: Json, theme: Json) => {
    const details = detailsFrom(result);
    if (options.expanded) {
      if (toolName === "seekbrain_research_start") return expandedStartResearchResult(details, theme);
      return expandedComponent(result, theme);
    }
    if (details.skipped === true || details.skipped_by_config === true) return skippedResult(toolName, details, theme);
    if (
      details.needs_text_review === true
      && (
        toolName === "seekbrain_planning_decision_review"
        || toolName === "seekbrain_planning_decision_record"
        || toolName === "seekbrain_planning_peer_review"
        || toolName === "seekbrain_planning_researcher_review"
        || toolName === "seekbrain_planning_researcher_decision_record"
      )
    ) return researchPlanningResult(toolName, details, theme);
    if (details.progress !== true && details.ok !== true) return failureResult(toolName, details, theme);
    switch (toolName) {
      case "seekbrain_system_check":
        return textComponent([`✓ SeekBrain extension ready · ${Number(details.run_count || 0)} indexed runs`, "Ctrl+O for details"], theme);
      case "seekbrain_system_capabilities":
        return renderCapabilitiesResult(result, options, theme);
      case "seekbrain_research_start":
        return lifecycleResult("Started", details, theme);
      case "seekbrain_research_continue":
        return lifecycleResult("Created", details, theme);
      case "seekbrain_run_start":
        return lifecycleResult("Started", details, theme);
      case "seekbrain_run_resume":
        return renderResumeRunResult(result, options, theme);
      case "seekbrain_review_approve":
      case "seekbrain_review_feedback":
      case "seekbrain_formulation_researcher_review":
        return reviewResult(details, theme);
      case "seekbrain_formulation_update":
        return textComponent(["✓ Methodological schema updated · Researcher review required", summary(details.result?.review_summary || details.message), details.plan_path ? `Schema: ${compactPath(details.plan_path)} · Ctrl+O for details` : "Ctrl+O for details"], theme);
      case "seekbrain_code_update_propose":
        return proposedCodeResult(details, theme);
      case "seekbrain_recipe_retrieve":
        return targetedSkillResult(details, theme);
      case "seekbrain_deep_research":
        return deepResearchResult(details, theme);
      case "seekbrain_data_resolve":
        return dataResolveResult(details, theme);
      case "seekbrain_planning_assess":
      case "seekbrain_planning_decision_review":
      case "seekbrain_planning_decision_record":
      case "seekbrain_planning_generate":
      case "seekbrain_planning_peer_review":
      case "seekbrain_planning_researcher_review":
      case "seekbrain_planning_researcher_decision_record":
      case "seekbrain_analysis_tasks_prepare":
        return researchPlanningResult(toolName, details, theme);
      case "seekbrain_execution_initialize":
      case "seekbrain_execution_run":
      case "seekbrain_execution_schema_review":
        return researchExecutionResult(toolName, details, theme);
      case "seekbrain_report_evidence_compile":
        return textComponent([
          `✓ Research Planning evidence compiled · ${Number(details.round_count || 0)} rounds from ${Number(details.task_count || 0)} tasks · ${Number(details.subquestion_count || 0)} sub-questions · ${Number(details.figure_count || 0)} figures`,
          details.report_dir ? `Report workspace: ${compactPath(details.report_dir)}` : "",
          "Report Agent has not been called · Ctrl+O for full details",
        ], theme);
      case "seekbrain_execution_tasks_run":
        if (details.progress === true) {
          const marker = (value: unknown) => ["complete", "skipped"].includes(String(value))
            ? "✓" : ["running", "revision_required"].includes(String(value)) ? "●" : String(value) === "failed" ? "✗" : "○";
          const taskLines = (Array.isArray(details.task_progress) ? details.task_progress : []).map((task: Json) => {
            const attempt = Number(task.code_attempt || 0) > 1 ? ` (${Number(task.code_attempt)})` : "";
            return `${String(task.task_id)} · Code & Execute ${marker(task.code)}${attempt} · Validation ${marker(task.validate)} · Figure Refinement ${marker(task.refine)} · Interpretation ${marker(task.interpret)}`;
          });
          return textComponent(["○ Executing Analysis Tasks", summary(details.message), ...taskLines], theme);
        }
        return textComponent([
          `${details.ok ? "✓" : "○"} Analysis task batch complete · ${Number(details.executed_count || 0)} completed · ${Number(details.failed_count || 0)} attention required`,
          details.task_status_counts ? Object.entries(details.task_status_counts).map(([status, value]) => `${status} ${value}`).join(" · ") : "",
          `Execution state: ${String(details.status || "unknown")} · Ctrl+O for full details`,
        ], theme);
      case "seekbrain_report_generate":
        if (details.progress === true) {
          return textComponent([
            "○ Research Planning report · hierarchical synthesis",
            Number(details.round_count || 0) > 0 ? `${Number(details.round_count)} selected rounds from ${Number(details.task_count || 0)} tasks` : "",
            summary(details.message || "Synthesizing hierarchical evidence"),
            "Provenance will be validated before report artifacts are written.",
          ], theme);
        }
        return textComponent([
          `✓ Scientific report generated · ${Number(details.round_count || 0)} rounds from ${Number(details.task_count || 0)} tasks · ${String(details.report_scope || "partial")} scope · ${Number(details.figure_count || 0)} figures`,
          details.title ? `Title: ${summary(details.title)}` : "",
          details.pdf_generated === true && details.pdf_path ? `PDF: ${compactPath(details.pdf_path)}` : "",
          details.pdf_generated === false && details.pdf_note ? `PDF: ${summary(details.pdf_note)}` : "",
          details.report_path ? `Report: ${compactPath(details.report_path)} · Ctrl+O for details` : "Ctrl+O for details",
        ], theme);
      case "seekbrain_formulation_generate":
        return stageResult("Analytical Formulation", details, theme);
      case "seekbrain_code_execute":
        return stageResult("Code Generation & Execution", details, theme);
      case "seekbrain_validation_run":
        return stageResult("Validation", details, theme);
      case "seekbrain_figure_refine":
        return stageResult("Figure Refinement", details, theme);
      case "seekbrain_interpretation_run":
        return stageResult("Result Interpretation", details, theme);
      default:
        return textComponent([`✓ ${toolName} complete${warningSuffix(details)}`, summary(details.summary || details.message), "Ctrl+O for full details"], theme);
    }
  };
}

export function renderCapabilitiesResult(result: Json, options: Json, theme: Json) {
  if (options.expanded) return expandedComponent(result, theme);
  const details = detailsFrom(result);
  if (details.ok !== true) {
    return textComponent([`✗ SeekBrain capability check failed`, compactText(details.error || details.message)], theme);
  }
  const optional = enabledCount(details.optional);
  const gates = details.human_review?.enabled === true
    ? Object.entries(details.human_review?.gates || {}).filter(([, enabled]) => enabled === true).map(([name]) => name)
    : [];
  const review = details.human_review?.enabled === true
    ? `Review: ${gates.length > 0 ? gates.join(", ") : "enabled"}`
    : "Review: off";
  return textComponent([
    `✓ SeekBrain ready · Optional ${optional.enabled}/${optional.total} · ${review}`,
    "Ctrl+O for full capability details",
  ], theme);
}

export function renderResumeRunResult(result: Json, options: Json, theme: Json) {
  if (options.expanded) return expandedComponent(result, theme);
  const details = detailsFrom(result);
  if (details.ok !== true) {
    return textComponent(["✗ Could not resume research run", compactText(details.error || details.message)], theme);
  }
  const round = basename(String(details.run_dir || "")) || String(details.run_id || "run");
  return textComponent([
    `↻ Resumed ${round}`,
    details.question ? `Task: ${compactText(details.question)}` : "",
    details.run_dir ? `Workdir: ${compactPath(details.run_dir)} · Ctrl+O for details` : "Ctrl+O for details",
  ], theme);
}

export function renderCodeEditCompletionResult(result: Json, options: Json, theme: Json) {
  if (options.expanded) return expandedComponent(result, theme);
  const details = detailsFrom(result);
  const execution = details.execution && typeof details.execution === "object" ? details.execution : {};
  const artifacts = Array.isArray(details.artifacts) ? details.artifacts : [];
  const artifactNames = artifacts.map((artifact: Json) => artifact.name || basename(String(artifact.path || ""))).filter(Boolean);
  const duration = Number.isFinite(execution.duration_ms) ? ` · ${(execution.duration_ms / 1000).toFixed(2)}s` : "";
  if (details.ok !== true) {
    return textComponent([
      `✗ Code edit ${compactText(details.status || "failed")}${duration}`,
      compactText(details.error || details.message || execution.error || "Regeneration or verification did not succeed."),
      execution.stderr_path ? `Log: ${compactPath(execution.stderr_path)} · Ctrl+O for details` : "Ctrl+O for details",
    ], theme);
  }
  const action = details.status === "verified" ? "applied and verified" : "applied";
  return textComponent([
    `✓ Code edit ${action}${duration}`,
    details.code_path ? `Code: ${basename(String(details.code_path))}` : "",
    artifactNames.length > 0 ? `Regenerated: ${artifactNames.join(", ")}` : "",
    `Ctrl+O for execution and artifact details`,
  ], theme);
}

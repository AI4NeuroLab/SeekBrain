import { describe, expect, it } from "vitest";
import { renderCodeEditResult } from "../../src/extension/tui/code-review-tui.ts";
import { renderCapabilitiesResult, renderResumeRunResult, renderSeekBrainResult } from "../../src/extension/tui/compact-tool-results.ts";

const theme = {
  fg: (_color: string, value: string) => value,
  bg: (_color: string, value: string) => value,
  bold: (value: string) => value,
};

function rendered(component: { render(width: number): string[] }) {
  return component.render(160).join("\n");
}

function result(details: Record<string, unknown>) {
  return {
    content: [{ type: "text", text: JSON.stringify(details, null, 2) }],
    details,
  };
}

describe("compact Neuro tool results", () => {
  it("summarizes capabilities and preserves full details when expanded", () => {
    const value = result({
      ok: true,
      optional: { deep_research: "enabled", targeted_skill: "enabled" },
      human_review: { enabled: true, gates: { plan: true, code: false } },
      required_spine: ["seekbrain_formulation_generate", "seekbrain_code_execute"],
    });

    const compact = rendered(renderCapabilitiesResult(value, { expanded: false }, theme));
    expect(compact).toContain("SeekBrain ready · Optional 2/2 · Review: plan");
    expect(compact).not.toContain("required_spine");

    const expanded = rendered(renderCapabilitiesResult(value, { expanded: true }, theme));
    expect(expanded).toContain('"required_spine"');
    expect(expanded).toContain('"seekbrain_formulation_generate"');
  });

  it("shows a compact resumed-run summary", () => {
    const value = result({
      ok: true,
      run_id: "20260721-152638-round1",
      run_dir: "/tmp/results/research-koninck/round1",
      question: "Remove the title from the existing figure.",
      state_path: "/tmp/results/research-koninck/round1/state.json",
    });

    const compact = rendered(renderResumeRunResult(value, { expanded: false }, theme));
    expect(compact).toContain("Resumed round1");
    expect(compact).toContain("Task: Remove the title");
    expect(compact).toContain("…/research-koninck/round1");
    expect(compact).not.toContain("state_path");
  });

  it("folds research-route decisions into the start card", () => {
    const mismatch = rendered(renderSeekBrainResult("seekbrain_research_start")(result({
      ok: true,
      round_name: "round1",
      research_route: {
        route: "needs_clarification",
        dataset_summary: "Adult-mouse Neuropixels electrophysiology and behavior.",
        question_requirements: "Developmental visual-cortex transcriptomics before and after eye opening.",
        reason: "The available modality and developmental scope do not support the requested comparison.",
        recommended_action: "Provide matching transcriptomic metadata or revise the question for the current dataset.",
      },
    }), { expanded: false }, theme));
    expect(mismatch).toContain("Input clarification required");
    expect(mismatch).toContain("The available modality and developmental scope do not support the requested comparison.");
    expect(mismatch).toContain("Provide matching transcriptomic metadata or revise the question for the current dataset.");
    expect(mismatch).not.toContain("Available data:");
    expect(mismatch).not.toContain("Required evidence:");
    expect(mismatch).not.toContain("needs_clarification");
    expect(mismatch).not.toContain("run_id");

    const expandedMismatch = rendered(renderSeekBrainResult("seekbrain_research_start")(result({
      ok: true,
      round_name: "round1",
      run_id: "run-1",
      run_dir: "/tmp/run-1",
      workflow_config: { optional: { research_planning: "enabled" } },
      research_route: {
        route: "needs_clarification",
        reason: "The available data cannot answer the transcriptomic question.",
        recommended_action: "Verify the metadata or revise the question.",
        assessment_path: "/tmp/run-1/research_planning_assessment.json",
      },
    }), { expanded: true }, theme));
    expect(expandedMismatch).toContain("Required action: Verify the metadata or revise the question.");
    expect(expandedMismatch).not.toContain('"research_route"');

    const planning = rendered(renderSeekBrainResult("seekbrain_research_start")(result({
      ok: true,
      round_name: "round1",
      research_route: { route: "research_planning", reason: "The question requires three independent evidence workstreams." },
    }), { expanded: false }, theme));
    expect(planning).toContain("Research Planning recommended");
    expect(planning).toContain("User decision required");

    const explicitlyRequested = rendered(renderSeekBrainResult("seekbrain_research_start")(result({
      ok: true,
      round_name: "planning",
      research_route: {
        route: "research_planning",
        reason: "The user requested structured research decomposition.",
        decision: "yes",
        needs_user_review: false,
        planning_consent: "explicit_request",
      },
    }), { expanded: false }, theme));
    expect(explicitlyRequested).toContain("Research Planning requested");
    expect(explicitlyRequested).toContain("Continue to hierarchical research plan generation");

    const textFallback = rendered(renderSeekBrainResult("seekbrain_planning_decision_review")(result({
      ok: false,
      needs_text_review: true,
      next_tool: "seekbrain_planning_decision_record",
      message: "Interactive selector is unavailable.",
    }), { expanded: false }, theme));
    expect(textFallback).toContain("Research Planning · decision required");
    expect(textFallback).not.toContain("direct analysis workflow selected");
  });

  it("summarizes a verified code edit instead of dumping artifact checks", () => {
    const value = result({
      ok: true,
      status: "verified",
      code_path: "/tmp/run/generated_code.py",
      execution: {
        duration_ms: 1456,
        artifact_checks: [{ path: "/tmp/run/figure.png", exists: true, updated: true }],
      },
      artifacts: [
        { name: "figure.png", path: "/tmp/run/figure.png" },
        { name: "figure.pdf", path: "/tmp/run/figure.pdf" },
      ],
    });

    const compact = rendered(renderCodeEditResult(value, { expanded: false, isPartial: false }, theme, { expanded: false }));
    expect(compact).toContain("Code edit applied and verified · 1.46s");
    expect(compact).toContain("Regenerated: figure.png, figure.pdf");
    expect(compact).not.toContain("artifact_checks");

    const expanded = rendered(renderCodeEditResult(value, { expanded: true, isPartial: false }, theme, { expanded: true }));
    expect(expanded).toContain('"artifact_checks"');
  });

  it.each([
    ["seekbrain_data_resolve", { ok: true, source: "cache", data_dir: "/data/fish", metadata_path: "/tmp/seekbrain/datasets/fish/metadata.json", warnings: [] }, "Dataset profile reused"],
    ["seekbrain_recipe_retrieve", { ok: true, matched: true, source: "existing_skill", skill_paths: ["/skills/fc_matrix"], reference_paths: ["/ref/a.md"] }, "Analysis recipe retrieved from the Neuroscience Analysis Repertoire"],
    ["seekbrain_deep_research", { ok: true, rag_ok: false, source_count: 0, rag_error: "Paper RAG base URL is not configured", context_path: "/run/deep_research_context.md" }, "Deep research complete · 0 sources"],
    ["seekbrain_planning_generate", { ok: true, subquestion_count: 2, task_count: 3, research_plan: { planning_rationale: "Complementary branches" }, draft_plan_path: "/run/research_plan/draft_plan.json" }, "Hierarchical research plan drafted · 2 subquestions · 3 analysis tasks"],
    ["seekbrain_planning_peer_review", { ok: true, verdict: "revise", refined: true, decision: "approve", subquestion_count: 2, task_count: 3, unresolved_issue_count: 0, final_plan_path: "/run/research_plan/research_plan.json", next_tool: "seekbrain_analysis_tasks_prepare" }, "Hierarchical research plan reviewed and approved"],
    ["seekbrain_planning_peer_review", { ok: true, verdict: "accept", needs_text_review: true, subquestion_count: 2, task_count: 3, unresolved_issue_count: 0, next_tool: "seekbrain_planning_researcher_decision_record" }, "researcher decision required"],
    ["seekbrain_planning_researcher_review", { ok: true, decision: "revise", feedback_response: "Sharpened SQ2", final_plan_path: "/run/research_plan/research_plan.json" }, "Hierarchical research plan revised · review again"],
    ["seekbrain_planning_researcher_review", { ok: false, needs_text_review: true, next_tool: "seekbrain_planning_researcher_decision_record", message: "Interactive selector is unavailable." }, "researcher decision required"],
    ["seekbrain_planning_researcher_decision_record", { ok: true, decision: "approve", final_plan_path: "/run/research_plan/research_plan.json" }, "Hierarchical research plan approved"],
    ["seekbrain_analysis_tasks_prepare", { ok: true, reused: false, task_count: 3, next_task: { task_id: "SQ1-T1", question: "Test branch one" }, task_manifest_path: "/run/research_plan/task_manifest.json" }, "Analysis tasks prepared · 3 child runs"],
    ["seekbrain_formulation_generate", { ok: true, plan_path: "/run/plan.md", result: { summary: "Compute FC matrices", warnings: [] }, human_review: { needs_user_review: true } }, "Researcher review required"],
    ["seekbrain_code_execute", { ok: true, result: { summary: "Generated the analysis" }, artifacts: [{ name: "figure.png" }, { name: "statistics.json" }] }, "2 artifacts: figure.png, statistics.json"],
    ["seekbrain_validation_run", { ok: true, validation_path: "/run/validation.json", result: { pass: false, route: "retry_code", blocking_issues: ["bad labels"], overall_mismatches: [] } }, "Needs revision · retry_code · 1 issues"],
    ["seekbrain_interpretation_run", { ok: true, interpretation_path: "/run/interpretation.json", result: { summary: "Connectivity increased", conclusions: ["one", "two"] }, next_research_directions: [{ title: "next" }] }, "2 conclusions · 1 next directions"],
  ])("renders a compact %s result", (toolName, details, expected) => {
    const output = rendered(renderSeekBrainResult(toolName)(result(details), { expanded: false }, theme));
    expect(output).toContain(expected);
    expect(output).not.toContain('"ok"');
  });

  it("keeps skipped and blocked states concise but explicit", () => {
    const skipped = rendered(renderSeekBrainResult("seekbrain_figure_refine")(result({
      ok: true,
      skipped: true,
      skipped_by_config: true,
      message: "seekbrain_figure_refine is disabled by user configuration",
    }), { expanded: false }, theme));
    expect(skipped).toContain("skipped by configuration");

    const blocked = rendered(renderSeekBrainResult("seekbrain_code_execute")(result({
      ok: false,
      blocked_by_human_review: true,
      message: "Plan approval is required",
      next_tool: "seekbrain_code_execute",
    }), { expanded: false }, theme));
    expect(blocked).toContain("seekbrain_code_execute blocked");
    expect(blocked).toContain("Plan approval is required");
  });

  it("renders partial progress as running instead of failed", () => {
    const planning = rendered(renderSeekBrainResult("seekbrain_planning_generate")(result({
      progress: true,
      stage: "research_tree",
      message: "Generating the hierarchical research plan.",
    }), { expanded: false, isPartial: true }, theme));
    expect(planning).toContain("Research Planning · generating hierarchical research plan");
    expect(planning).not.toContain("failed");

    const report = rendered(renderSeekBrainResult("seekbrain_report_generate")(result({
      progress: true,
      stage: "generating",
      message: "Synthesizing selected evidence.",
    }), { expanded: false, isPartial: true }, theme));
    expect(report).toContain("Scientific report · generating");
    expect(report).not.toContain("failed");

    const failure = rendered(renderSeekBrainResult("seekbrain_planning_generate")(result({
      ok: false,
      error: "Research-tree preparation did not complete.",
    }), { expanded: false, isPartial: false }, theme));
    expect(failure).toContain("seekbrain_planning_generate failed");
    expect(failure).toContain("Research-tree preparation did not complete.");
  });
});

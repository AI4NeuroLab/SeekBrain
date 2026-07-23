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
      required_spine: ["neuro_plan", "neuro_code"],
    });

    const compact = rendered(renderCapabilitiesResult(value, { expanded: false }, theme));
    expect(compact).toContain("SeekBrain ready · Optional 2/2 · Review: plan");
    expect(compact).not.toContain("required_spine");

    const expanded = rendered(renderCapabilitiesResult(value, { expanded: true }, theme));
    expect(expanded).toContain('"required_spine"');
    expect(expanded).toContain('"neuro_plan"');
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
    const mismatch = rendered(renderSeekBrainResult("neuro_start_research")(result({
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

    const expandedMismatch = rendered(renderSeekBrainResult("neuro_start_research")(result({
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

    const planning = rendered(renderSeekBrainResult("neuro_start_research")(result({
      ok: true,
      round_name: "round1",
      research_route: { route: "research_planning", reason: "The question requires three independent evidence workstreams." },
    }), { expanded: false }, theme));
    expect(planning).toContain("Research Planning review suggested");
    expect(planning).toContain("User decision required");
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
    ["neuro_resolve_data", { ok: true, source: "cache", data_dir: "/data/fish", metadata_path: "/tmp/seekbrain/datasets/fish/metadata.json", warnings: [] }, "Dataset metadata reused"],
    ["resolve_targeted_skill", { ok: true, matched: true, source: "existing_skill", skill_paths: ["/skills/fc_matrix"], reference_paths: ["/ref/a.md"] }, "Targeted skill matched · existing_skill"],
    ["neuro_deep_research", { ok: true, rag_ok: false, source_count: 0, rag_error: "Paper RAG base URL is not configured", context_path: "/run/deep_research_context.md" }, "Deep research complete · 0 sources"],
    ["neuro_prepare_subquestions", { ok: true, subquestion_count: 2, task_count: 3, research_plan: { planning_rationale: "Complementary branches" }, draft_plan_path: "/run/research_plan/draft_plan.json" }, "Research tree drafted · 2 subquestions · 3 tasks"],
    ["neuro_review_research_plan", { ok: true, verdict: "revise", refined: true, subquestion_count: 2, task_count: 3, unresolved_issue_count: 0, final_plan_path: "/run/research_plan/research_plan.json" }, "Research tree reviewed · revise · refined once"],
    ["neuro_review_research_tree", { ok: true, decision: "revise", feedback_response: "Sharpened SQ2", final_plan_path: "/run/research_plan/research_plan.json" }, "Research tree revised · review again"],
    ["neuro_materialize_research_tasks", { ok: true, reused: false, task_count: 3, next_task: { task_id: "SQ1-T1", question: "Test branch one" }, task_manifest_path: "/run/research_plan/task_manifest.json" }, "Research tasks prepared · 3 child runs"],
    ["neuro_plan", { ok: true, plan_path: "/run/plan.md", result: { summary: "Compute FC matrices", warnings: [] }, human_review: { needs_user_review: true } }, "Human review required"],
    ["neuro_code", { ok: true, result: { summary: "Generated the analysis" }, artifacts: [{ name: "figure.png" }, { name: "statistics.json" }] }, "2 artifacts: figure.png, statistics.json"],
    ["neuro_validate", { ok: true, validation_path: "/run/validation.json", result: { pass: false, route: "retry_code", blocking_issues: ["bad labels"], overall_mismatches: [] } }, "Needs revision · retry_code · 1 issues"],
    ["neuro_interpret", { ok: true, interpretation_path: "/run/interpretation.json", result: { summary: "Connectivity increased", conclusions: ["one", "two"] }, next_research_directions: [{ title: "next" }] }, "2 conclusions · 1 next directions"],
  ])("renders a compact %s result", (toolName, details, expected) => {
    const output = rendered(renderSeekBrainResult(toolName)(result(details), { expanded: false }, theme));
    expect(output).toContain(expected);
    expect(output).not.toContain('"ok"');
  });

  it("keeps skipped and blocked states concise but explicit", () => {
    const skipped = rendered(renderSeekBrainResult("neuro_refine_image")(result({
      ok: true,
      skipped: true,
      skipped_by_config: true,
      message: "neuro_refine_image is disabled by user configuration",
    }), { expanded: false }, theme));
    expect(skipped).toContain("skipped by configuration");

    const blocked = rendered(renderSeekBrainResult("neuro_code")(result({
      ok: false,
      blocked_by_human_review: true,
      message: "Plan approval is required",
      next_tool: "neuro_code",
    }), { expanded: false }, theme));
    expect(blocked).toContain("neuro_code blocked");
    expect(blocked).toContain("Plan approval is required");
  });
});

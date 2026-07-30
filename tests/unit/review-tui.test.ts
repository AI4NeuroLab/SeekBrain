import { describe, expect, it } from "vitest";
import { createCodeReviewDetails, parsedDiff } from "../../src/extension/tui/code-review-tui.ts";
import { dependencyInstallReviewTitle, researchPlanningReviewTitle, researchTreeReviewTitle, selectBinaryReview, selectDependencyInstallReview, selectResearchTreeReview, selectYesNoReview, taskPlanReviewTitle } from "../../src/extension/tui/review-selectors.ts";
import { registerTransparencyCardRenderers } from "../../src/extension/tui/transparency-card.ts";

describe("review TUI adapters", () => {
  it("registers durable research and skill transparency entries when supported", () => {
    const types: string[] = [];
    registerTransparencyCardRenderers({ registerEntryRenderer(type) { types.push(type); } });
    expect(types).toEqual(["seekbrain-research-card", "seekbrain-skill-card"]);
    expect(() => registerTransparencyCardRenderers({})).not.toThrow();
  });

  it("builds the stable diff view model", () => {
    const diff = parsedDiff("a\nb\n", "a\nc\n");
    expect(diff).toMatchObject({ added: 1, removed: 1, chars: 8 });
    const details = createCodeReviewDetails({ codePath: "/run/analysis.py", diffPath: "/run/diff.patch", summary: "change", oldCode: "a\n", proposedCode: "b\n" });
    expect(details).toMatchObject({ _type: "neuroCodeUpdateReview", language: "python", codePath: "/run/analysis.py", diffPath: "/run/diff.patch" });
  });

  it("normalizes unavailable, approval and feedback selector outcomes", async () => {
    const input = { title: "Review?", approveLabel: "Yes, apply", feedbackTitle: "Feedback", feedbackPlaceholder: "Explain" };
    expect(await selectBinaryReview({}, input)).toEqual({ decision: "unavailable" });
    expect(await selectBinaryReview({ ui: { select: async () => "Yes, apply" } }, input)).toEqual({ decision: "approve" });
    expect(await selectBinaryReview({ ui: { select: async () => "No, change", input: async () => " revise labels " } }, input)).toEqual({ decision: "feedback", feedback: "revise labels" });
    expect(await selectBinaryReview({ ui: { select: async () => "No, change", input: async () => "" } }, input)).toEqual({ decision: "feedback_empty" });
  });

  it("supports a strict yes/no planning decision without requesting feedback", async () => {
    expect(await selectYesNoReview({}, { title: "Use Research Planning?" })).toEqual({ decision: "unavailable" });
    expect(await selectYesNoReview({ ui: { select: async () => "Yes, use Research Planning" } }, { title: "Use Research Planning?", yesLabel: "Yes, use Research Planning", noLabel: "No, continue normally" })).toEqual({ decision: "yes" });
    expect(await selectYesNoReview({ ui: { select: async () => "No, continue normally" } }, { title: "Use Research Planning?", yesLabel: "Yes, use Research Planning", noLabel: "No, continue normally" })).toEqual({ decision: "no" });
    expect(await selectYesNoReview({ ui: { select: async () => "Agent-Full-Auto" } }, { title: "Use Research Planning?", autoLabel: "Agent-Full-Auto" })).toEqual({ decision: "agent_full_auto" });
    expect(await selectYesNoReview({ ui: { confirm: async () => true } }, { title: "Use Research Planning?" })).toEqual({ decision: "yes" });
    expect(await selectYesNoReview({ ui: { confirm: async () => false } }, { title: "Use Research Planning?" })).toEqual({ decision: "no" });
  });

  it("uses explicit package-install permission labels", async () => {
    let options: string[] = [];
    const context = { ui: { select: async (_title: string, values: string[]) => { options = values; return values[1]; } } };
    expect(await selectDependencyInstallReview(context, { title: "Install scipy?", yesLabel: "Yes, run pip install scipy" })).toEqual({ decision: "yes_to_all" });
    expect(options).toEqual([
      "Yes, run pip install scipy",
      "Yes, allow all pip installs for this run",
      "No, use installed packages only",
    ]);
    expect(await selectDependencyInstallReview(
      { ui: { select: async () => "Yes, run pip install scipy" } },
      { title: "Install scipy?", yesLabel: "Yes, run pip install scipy" },
    )).toEqual({ decision: "yes" });
    expect(await selectDependencyInstallReview({ ui: { select: async () => "No, use installed packages only" } }, { title: "Install scipy?" })).toEqual({ decision: "no" });
    expect(await selectDependencyInstallReview(
      { ui: { select: async () => "Yes, allow all pip installs for all remaining tasks" } },
      { title: "Install scipy?", yesToAllLabel: "Yes, allow all pip installs for all remaining tasks" },
    )).toEqual({ decision: "yes_to_all" });
  });

  it("shows the exact package, environment and serialized queue position", () => {
    const title = dependencyInstallReviewTitle({
      moduleName: "sklearn",
      packageName: "scikit-learn",
      taskId: "SQ1-T1",
      parentRunId: "planning-run",
      environment: { description: "conda environment InternAgent (/envs/InternAgent)" },
      installCommand: "/envs/InternAgent/bin/python -m pip install scikit-learn",
      evidence: "ModuleNotFoundError: No module named 'sklearn'",
      queueLength: 2,
    });
    expect(title).toContain("Install missing Python package 'scikit-learn'?");
    expect(title).toContain("Analysis task: SQ1-T1");
    expect(title).toContain("every remaining analysis task in this Research Planning run");
    expect(title).toContain("conda environment InternAgent");
    expect(title).toContain("Install review queue: 1 of 2");
  });

  it("offers approve, revise and retain choices for the final research tree", async () => {
    const input = { title: "Review the structured research plan?", feedbackTitle: "Scientific feedback", feedbackPlaceholder: "Describe changes" };
    expect(await selectResearchTreeReview({}, input)).toEqual({ decision: "unavailable" });
    expect(await selectResearchTreeReview({ ui: { select: async () => "Approve — begin analysis task execution" } }, input)).toEqual({ decision: "approve" });
    expect(await selectResearchTreeReview({ ui: { select: async () => "Revise — provide scientific feedback", input: async () => " sharpen SQ2 " } }, input)).toEqual({ decision: "feedback", feedback: "sharpen SQ2" });
    expect(await selectResearchTreeReview({ ui: { select: async () => "Cancel — retain the plan without execution" } }, input)).toEqual({ decision: "cancel" });
    expect(await selectResearchTreeReview({ ui: { select: async (_title: string, options: string[]) => {
      expect(options).toContain("Restore previous Plan version");
      return "Restore previous Plan version";
    } } }, { ...input, rollbackAvailable: true })).toEqual({ decision: "restore_previous" });
  });

  it("keeps the current Research Plan visible inside a bounded revision panel", async () => {
    let rendered: string[] = [];
    const context = {
      ui: {
        select: async () => "Revise — provide scientific feedback",
        custom: async (factory: any) => {
          const component = factory({ requestRender() {} }, { fg: (_name: string, value: string) => value, bg: (_name: string, value: string) => value, bold: (value: string) => value }, {}, () => {});
          rendered = component.render(72);
          return "sharpen SQ2";
        },
      },
    };
    const result = await selectResearchTreeReview(context, {
      title: "Review the structured research plan?\nSchema: /runs/example/plan.md\nSQ1 · First branch\nSQ2 · Second branch",
      feedbackTitle: "Scientific feedback",
      feedbackPlaceholder: "Describe changes",
    });
    expect(result).toEqual({ decision: "feedback", feedback: "sharpen SQ2" });
    expect(rendered.join("\n")).toContain("╭─ REVISION MODE ");
    expect(rendered.join("\n")).toContain("SQ2 · Second branch");
    expect(rendered.join("\n")).toContain("YOUR REVISION REQUEST");
    expect(rendered.join("\n")).not.toContain("The current version stays active until you submit.");
    expect(rendered.join("\n")).not.toContain("CURRENT PLAN");
    expect(rendered.join("\n")).not.toContain("Schema: /runs/example/plan.md");
    expect(rendered.join("\n")).not.toContain("Scientific feedback");
    expect(rendered.join("\n")).not.toContain("Describe changes");
    expect(rendered.join("\n")).toContain("│");
    expect(rendered.join("\n")).toContain("╰─");
  });

  it("summarizes the scientific tree before final human review", () => {
    const title = researchTreeReviewTitle({
      research_goal: "Determine whether structure and sensorimotor function jointly organize FC.",
      subquestions: [
        { id: "SQ1", question: "How strongly does SC explain FC?", tasks: [{ id: "SQ1-T1", title: "Quantify robust SC-FC coupling" }] },
        { id: "SQ2", question: "Do response profiles explain network roles?", tasks: [{ id: "SQ2-T1", title: "Model light, dark, and motor features" }] },
      ],
      synthesis_strategy: "Compare independent and joint explanatory support.",
    }, { reviewer_critique: { verdict: "accept" }, automatic_refinement_count: 1, unresolved_issues: [] });
    expect(title).not.toContain("Review the hierarchical research plan?");
    expect(title).toContain("Overall goal: Determine whether structure");
    expect(title).toContain("SQ1 · How strongly does SC explain FC?");
    expect(title).toContain("SQ1-T1 · Quantify robust SC-FC coupling");
    expect(title).toContain("SQ2-T1 · Model light, dark, and motor features");
    expect(title).toContain("Synthesis: Compare independent and joint explanatory support.");
    expect(title).toContain("Reviewer: accept · one refinement applied · 0 unresolved blocking issues");
  });

  it("shows a compact scientific summary for each queued methodological schema", () => {
    const title = taskPlanReviewTitle({
      task_id: "SQ1-T1",
      plan_path: "/runs/SQ1-T1/round1/plan.md",
      plan_summary: "Fit SC-FC models with node-label permutation and robustness checks.",
      skill_summary: "Matched structural_functional_connectivity",
      deep_research_summary: "3 sources synthesized",
      task: {
        title: "Quantify structural constraints",
        biological_hypothesis: "Anatomical connectivity constrains functional connectivity.",
        expected_evidence: "Stable positive SC-FC effects and reusable residuals.",
      },
      plan_warnings: ["Atlas labels must match the retained matrix order."],
    }, 2);
    expect(title).toContain("SQ1-T1 · Quantify structural constraints");
    expect(title).toContain("Plan: Fit SC-FC models");
    expect(title).toContain("Warning: Atlas labels must match");
    expect(title).toContain("Plan file: /runs/SQ1-T1/round1/plan.md");
    expect(title).not.toContain("Hypothesis:");
    expect(title).not.toContain("Expected evidence:");
    expect(title).not.toContain("Deep Research:");
    expect(title).not.toContain("Analysis recipe:");
    expect(title).not.toContain("Revision:");
    expect(title).toContain("Queue: 1 of 2");
  });

  it("shows only the recommendation above the Research Planning decision", () => {
    const title = researchPlanningReviewTitle({
      reason: "The conclusion requires independent workstreams.",
      dataset_summary: "Matched developmental transcriptomics with cell-type annotations.",
      question_requirements: "Compare shared and lineage-specific maturation programs.",
      evidence_dimensions: ["excitatory neurons", "inhibitory and glial cells", "donor robustness"],
      inferred_scientific_goal: "Synthesize whether maturation is coordinated across lineages.",
    });
    expect(title).not.toContain("Recommendation:");
    expect(title).toContain("The conclusion requires independent workstreams.");
    expect(title).toContain("Research Planning will decompose these evidence dimensions into independently testable subquestions");
    expect(title).not.toContain("Available evidence:");
    expect(title).not.toContain("Question scope:");
    expect(title).not.toContain("Evidence workstreams:");
    expect(title).not.toContain("Synthesis objective:");
  });
});

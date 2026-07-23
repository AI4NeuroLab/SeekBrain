import { describe, expect, it } from "vitest";
import { createCodeReviewDetails, parsedDiff } from "../../src/extension/tui/code-review-tui.ts";
import { researchPlanningReviewTitle, researchTreeReviewTitle, selectBinaryReview, selectResearchTreeReview, selectYesNoReview, taskPlanReviewTitle } from "../../src/extension/tui/review-selectors.ts";
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
    expect(await selectYesNoReview({ ui: { confirm: async () => true } }, { title: "Use Research Planning?" })).toEqual({ decision: "yes" });
    expect(await selectYesNoReview({ ui: { confirm: async () => false } }, { title: "Use Research Planning?" })).toEqual({ decision: "no" });
  });

  it("offers approve, revise and retain choices for the final research tree", async () => {
    const input = { title: "Review the structured research plan?", feedbackTitle: "Scientific feedback", feedbackPlaceholder: "Describe changes" };
    expect(await selectResearchTreeReview({}, input)).toEqual({ decision: "unavailable" });
    expect(await selectResearchTreeReview({ ui: { select: async () => "Approve — begin task execution" } }, input)).toEqual({ decision: "approve" });
    expect(await selectResearchTreeReview({ ui: { select: async () => "Revise — provide scientific feedback", input: async () => " sharpen SQ2 " } }, input)).toEqual({ decision: "feedback", feedback: "sharpen SQ2" });
    expect(await selectResearchTreeReview({ ui: { select: async () => "Cancel — retain the plan without execution" } }, input)).toEqual({ decision: "cancel" });
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
    expect(title).toContain("Overall goal: Determine whether structure");
    expect(title).toContain("SQ1 · How strongly does SC explain FC?");
    expect(title).toContain("SQ1-T1 · Quantify robust SC-FC coupling");
    expect(title).toContain("SQ2-T1 · Model light, dark, and motor features");
    expect(title).toContain("Synthesis: Compare independent and joint explanatory support.");
    expect(title).toContain("Reviewer: accept · one refinement applied · 0 unresolved blocking issues");
  });

  it("shows a compact scientific summary for each queued task Plan", () => {
    const title = taskPlanReviewTitle({
      task_id: "SQ1-T1",
      plan_summary: "Fit SC-FC models with node-label permutation and robustness checks.",
      skill_summary: "Matched structural_functional_connectivity",
      deep_research_summary: "3 sources synthesized",
      task: {
        title: "Quantify structural constraints",
        biological_hypothesis: "Anatomical connectivity constrains functional connectivity.",
        expected_evidence: "Stable positive SC-FC effects and reusable residuals.",
      },
    }, 2);
    expect(title).toContain("Review task plan SQ1-T1?");
    expect(title).toContain("Hypothesis: Anatomical connectivity");
    expect(title).toContain("Analysis: Fit SC-FC models");
    expect(title).toContain("Skill: Matched structural_functional_connectivity");
    expect(title).toContain("Review queue: 1 of 2");
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

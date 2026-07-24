type Json = Record<string, any>;

export type ReviewSelection =
  | { decision: "unavailable" }
  | { decision: "approve" }
  | { decision: "feedback"; feedback: string }
  | { decision: "feedback_empty" }
  | { decision: "cancel" };

export type YesNoSelection =
  | { decision: "unavailable" }
  | { decision: "yes" }
  | { decision: "no" }
  | { decision: "cancel" };

export type TaskPlanReviewSelection =
  | { decision: "unavailable" }
  | { decision: "approve" }
  | { decision: "approve_remaining" }
  | { decision: "feedback"; feedback: string }
  | { decision: "feedback_empty" }
  | { decision: "cancel" };

export function researchPlanningReviewTitle(assessment: Json, summary?: string): string {
  const reason = String(assessment.reason || summary || "SeekBrain identified multiple evidence workstreams.").slice(0, 520);
  const planningEffect = /[\u3400-\u9fff]/.test(reason)
    ? "Research Planning will decompose these evidence dimensions into independently testable subquestions and synthesize them into an overall conclusion."
    : "Research Planning will decompose these evidence dimensions into independently testable subquestions before synthesizing the overall conclusion.";
  return [
    "Use Research Planning for this question?",
    reason,
    planningEffect,
  ].filter(Boolean).join("\n");
}

function compactReviewLine(value: unknown, limit = 180): string {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > limit ? `${text.slice(0, Math.max(0, limit - 1)).trimEnd()}…` : text;
}

export function researchTreeReviewTitle(plan: Json, planning: Json = {}): string {
  const subquestions = Array.isArray(plan.subquestions) ? plan.subquestions : [];
  const taskCount = subquestions.reduce((total: number, item: Json) => total + (Array.isArray(item.tasks) ? item.tasks.length : 0), 0);
  const lines = [
    "Review the hierarchical research plan?",
    "",
    `Overall goal: ${compactReviewLine(plan.research_goal, 220)}`,
  ];
  for (const [index, subquestion] of subquestions.entries()) {
    const id = String(subquestion.id || `SQ${index + 1}`);
    lines.push("", `${id} · ${compactReviewLine(subquestion.question)}`);
    for (const [taskIndex, task] of (Array.isArray(subquestion.tasks) ? subquestion.tasks : []).entries()) {
      const taskId = String(task.id || `${id}-T${taskIndex + 1}`);
      lines.push(`  ${taskId} · ${compactReviewLine(task.title || task.analysis_question, 160)}`);
    }
  }
  if (plan.synthesis_strategy) lines.push("", `Synthesis: ${compactReviewLine(plan.synthesis_strategy, 220)}`);
  const unresolved = Array.isArray(planning.unresolved_issues) ? planning.unresolved_issues.length : 0;
  lines.push(
    "",
    `${subquestions.length} scientific subquestions · ${taskCount} actionable analysis tasks`,
    `Reviewer: ${String(planning.reviewer_critique?.verdict || "complete")}${planning.automatic_refinement_count ? " · one refinement applied" : ""} · ${unresolved} unresolved blocking issues`,
  );
  return lines.filter((line, index) => line || lines[index - 1] !== "").join("\n");
}

export function taskPlanReviewTitle(item: Json, queueLength: number): string {
  const task = item.task || item;
  return [
    `Review methodological schema ${String(item.task_id || task.task_id || "")}?`,
    "",
    compactReviewLine(task.title || task.question || item.plan_summary, 220),
    task.biological_hypothesis ? `Hypothesis: ${compactReviewLine(task.biological_hypothesis, 220)}` : "",
    item.plan_summary ? `Methodological schema: ${compactReviewLine(item.plan_summary, 260)}` : task.analysis_strategy ? `Methodological schema: ${compactReviewLine(task.analysis_strategy, 260)}` : "",
    task.expected_evidence ? `Expected evidence: ${compactReviewLine(task.expected_evidence, 220)}` : "",
    item.skill_summary ? `Analysis recipe: ${compactReviewLine(item.skill_summary, 160)}` : "",
    item.deep_research_summary ? `Deep Research: ${compactReviewLine(item.deep_research_summary, 160)}` : "",
    "",
    `Review queue: 1 of ${queueLength}`,
  ].filter(Boolean).join("\n");
}

export async function selectYesNoReview(context: Json, input: {
  title: string;
  yesLabel?: string;
  noLabel?: string;
}): Promise<YesNoSelection> {
  if (process.env.SEEKBRAIN_NON_INTERACTIVE === "1") return { decision: "unavailable" };
  const yes = input.yesLabel || "Yes";
  const no = input.noLabel || "No";
  if (context?.ui?.select) {
    const choice = await context.ui.select(input.title, [yes, no]);
    if (choice === yes || choice?.startsWith("Yes")) return { decision: "yes" };
    if (choice === no || choice?.startsWith("No")) return { decision: "no" };
    return { decision: "cancel" };
  }
  if (context?.ui?.confirm) {
    const accepted = await context.ui.confirm(input.title, "Proceed with Research Planning?");
    return { decision: accepted ? "yes" : "no" };
  }
  return { decision: "unavailable" };
}

export async function selectBinaryReview(context: Json, input: {
  title: string;
  approveLabel: string;
  feedbackLabel?: string;
  feedbackTitle: string;
  feedbackPlaceholder: string;
}): Promise<ReviewSelection> {
  if (!context?.ui?.select || process.env.SEEKBRAIN_NON_INTERACTIVE === "1") return { decision: "unavailable" };
  const choice = await context.ui.select(input.title, [input.approveLabel, input.feedbackLabel || "No, and tell SeekBrain what to do differently"]);
  if (choice?.startsWith("Yes")) return { decision: "approve" };
  if (choice?.startsWith("No")) {
    const feedback = String(await context.ui.input(input.feedbackTitle, input.feedbackPlaceholder) || "").trim();
    return feedback ? { decision: "feedback", feedback } : { decision: "feedback_empty" };
  }
  return { decision: "cancel" };
}

export async function selectResearchTreeReview(context: Json, input: {
  title: string;
  feedbackTitle: string;
  feedbackPlaceholder: string;
}): Promise<ReviewSelection> {
  if (!context?.ui?.select || process.env.SEEKBRAIN_NON_INTERACTIVE === "1") return { decision: "unavailable" };
  const approve = "Approve — begin analysis task execution";
  const revise = "Revise — provide scientific feedback";
  const cancel = "Cancel — retain the plan without execution";
  const choice = await context.ui.select(input.title, [approve, revise, cancel]);
  if (choice === approve) return { decision: "approve" };
  if (choice === revise) {
    const feedback = String(await context.ui.input(input.feedbackTitle, input.feedbackPlaceholder) || "").trim();
    return feedback ? { decision: "feedback", feedback } : { decision: "feedback_empty" };
  }
  return { decision: "cancel" };
}

export async function selectTaskPlanReview(context: Json, input: {
  title: string;
  feedbackTitle: string;
  feedbackPlaceholder: string;
}): Promise<TaskPlanReviewSelection> {
  if (!context?.ui?.select || process.env.SEEKBRAIN_NON_INTERACTIVE === "1") return { decision: "unavailable" };
  const approve = "Approve this schema";
  const revise = "Request changes";
  const approveRemaining = "Approve this and all remaining schemas";
  const choice = await context.ui.select(input.title, [approve, revise, approveRemaining]);
  if (choice === approve) return { decision: "approve" };
  if (choice === approveRemaining) return { decision: "approve_remaining" };
  if (choice === revise) {
    const feedback = String(await context.ui.input(input.feedbackTitle, input.feedbackPlaceholder) || "").trim();
    return feedback ? { decision: "feedback", feedback } : { decision: "feedback_empty" };
  }
  return { decision: "cancel" };
}

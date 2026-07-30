import { Input, truncateToWidth, visibleWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";

type Json = Record<string, any>;

export type ReviewSelection =
  | { decision: "unavailable" }
  | { decision: "approve" }
  | { decision: "restore_previous" }
  | { decision: "feedback"; feedback: string }
  | { decision: "feedback_empty" }
  | { decision: "cancel" };

export type BinaryReviewSelection = ReviewSelection;

export type YesNoSelection =
  | { decision: "unavailable" }
  | { decision: "yes" }
  | { decision: "agent_full_auto" }
  | { decision: "no" }
  | { decision: "cancel" };

export type TaskPlanReviewSelection =
  | { decision: "unavailable" }
  | { decision: "approve" }
  | { decision: "approve_remaining" }
  | { decision: "restore_previous" }
  | { decision: "feedback"; feedback: string }
  | { decision: "feedback_empty" }
  | { decision: "cancel" };

export type DependencyInstallSelection =
  | { decision: "unavailable" }
  | { decision: "yes" }
  | { decision: "yes_to_all" }
  | { decision: "no" }
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
  const warnings = Array.isArray(item.plan_warnings)
    ? item.plan_warnings.map((warning: unknown) => compactReviewLine(warning, 240)).filter(Boolean)
    : [];
  return [
    `${String(item.task_id || task.task_id || "")} · ${compactReviewLine(task.title || task.question || "Analysis task", 180)}`,
    "",
    item.plan_summary ? `Plan: ${compactReviewLine(item.plan_summary, 420)}` : task.analysis_strategy ? `Plan: ${compactReviewLine(task.analysis_strategy, 420)}` : "",
    ...warnings.map((warning: string) => `Warning: ${warning}`),
    item.plan_path ? `Plan file: ${String(item.plan_path)}` : "",
    "",
    `Queue: 1 of ${queueLength}`,
  ].filter(Boolean).join("\n");
}

async function inputWithReviewContext(context: Json, input: {
  reviewText: string;
  feedbackTitle: string;
  feedbackPlaceholder: string;
}): Promise<string | undefined> {
  if (!context?.ui?.custom) return context?.ui?.input?.(input.feedbackTitle, input.feedbackPlaceholder);
  return context.ui.custom((tui: Json, theme: Json, _keybindings: unknown, done: (value: string | undefined) => void) => {
    const editor = new Input();
    editor.focused = true;
    editor.onSubmit = (value: string) => done(value.trim() || undefined);
    editor.onEscape = () => done(undefined);
    return {
      focused: true,
      handleInput(data: string) {
        editor.handleInput(data);
        tui.requestRender();
      },
      render(width: number): string[] {
        const frameWidth = Math.max(24, width);
        const innerWidth = Math.max(1, frameWidth - 2);
        const fit = (value: string) => truncateToWidth(value, innerWidth, "", true);
        const row = (value = "", background?: string) => {
          const content = fit(value);
          const filled = background && typeof theme.bg === "function" ? theme.bg(background, content) : content;
          return theme.fg("borderAccent", "│") + filled + theme.fg("borderAccent", "│");
        };
        const divider = () => theme.fg("borderMuted", `├${"─".repeat(innerWidth)}┤`);
        const title = theme.bold(theme.fg("accent", " REVISION MODE "));
        const titleFill = Math.max(0, innerWidth - visibleWidth(title) - 1);
        const top = theme.fg("borderAccent", "╭─") + title + theme.fg("borderAccent", `${"─".repeat(titleFill)}╮`);
        const bottom = theme.fg("borderAccent", `╰${"─".repeat(innerWidth)}╯`);
        // The selector keeps the canonical Schema path for quick inspection,
        // but the revision card spends its space on the Plan content itself.
        const planLines = input.reviewText
          .split("\n")
          .filter((line) => !/^\s*(?:Schema|Plan file):\s*[/\\]/i.test(line))
          .flatMap((line) => line ? wrapTextWithAnsi(line, Math.max(1, innerWidth - 4)) : [""]);
        const editorLines = editor.render(Math.max(1, innerWidth - 4));
        return [
          top,
          ...planLines.map((line) => row(`  ${theme.fg("text", line)}`, "customMessageBg")),
          divider(),
          row(`  ${theme.bold(theme.fg("accent", "YOUR REVISION REQUEST"))}`, "selectedBg"),
          ...editorLines.map((line) => row(`  ${line}`, "selectedBg")),
          divider(),
          row([
            `  ${theme.fg("success", "Enter")} ${theme.fg("dim", "submit")}`,
            `  ${theme.fg("warning", "Esc")} ${theme.fg("dim", "return without changes")}`,
          ].filter(Boolean).join(" ")),
          bottom,
        ];
      },
      invalidate() { editor.invalidate(); },
    };
  }, { overlay: true, overlayOptions: { width: "94%", maxHeight: "96%", anchor: "center", margin: 1 } });
}

export function dependencyInstallReviewTitle(request: Json): string {
  const scope = request.taskId
    ? `Analysis task: ${String(request.taskId)}`
    : request.runId ? `Run: ${String(request.runId)}` : "";
  return [
    `Install missing Python package '${String(request.packageName || "")}'?`,
    "",
    `Missing module: ${String(request.moduleName || "")}`,
    `Target: ${String(request.environment?.description || "current Python environment")}`,
    `Command: ${String(request.installCommand || "")}`,
    scope,
    request.evidence ? `Detected from: ${compactReviewLine(request.evidence, 260)}` : "",
    request.parentRunId ? "Allow-all scope: every remaining analysis task in this Research Planning run." : "",
    "",
    `Install review queue: 1 of ${Math.max(1, Number(request.queueLength || 1))}`,
  ].filter(Boolean).join("\n");
}

export async function selectYesNoReview(context: Json, input: {
  title: string;
  yesLabel?: string;
  autoLabel?: string;
  noLabel?: string;
}): Promise<YesNoSelection> {
  if (process.env.SEEKBRAIN_NON_INTERACTIVE === "1") return { decision: "unavailable" };
  const yes = input.yesLabel || "Yes";
  const auto = input.autoLabel;
  const no = input.noLabel || "No";
  if (context?.ui?.select) {
    const choice = await context.ui.select(input.title, [yes, ...(auto ? [auto] : []), no]);
    if (choice === yes || choice?.startsWith("Yes")) return { decision: "yes" };
    if (auto && choice === auto) return { decision: "agent_full_auto" };
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
  restorePreviousLabel?: string;
  feedbackTitle: string;
  feedbackPlaceholder: string;
}): Promise<BinaryReviewSelection> {
  if (!context?.ui?.select || process.env.SEEKBRAIN_NON_INTERACTIVE === "1") return { decision: "unavailable" };
  const options = [input.approveLabel, input.feedbackLabel || "No, and tell SeekBrain what to do differently"];
  if (input.restorePreviousLabel) options.push(input.restorePreviousLabel);
  const choice = await context.ui.select(input.title, options);
  if (choice?.startsWith("Yes")) return { decision: "approve" };
  if (input.restorePreviousLabel && choice === input.restorePreviousLabel) return { decision: "restore_previous" };
  if (choice?.startsWith("No")) {
    const feedback = String(await inputWithReviewContext(context, { reviewText: input.title, feedbackTitle: input.feedbackTitle, feedbackPlaceholder: input.feedbackPlaceholder }) || "").trim();
    return feedback ? { decision: "feedback", feedback } : { decision: "feedback_empty" };
  }
  return { decision: "cancel" };
}

export async function selectResearchTreeReview(context: Json, input: {
  title: string;
  feedbackTitle: string;
  feedbackPlaceholder: string;
  rollbackAvailable?: boolean;
}): Promise<ReviewSelection> {
  if (!context?.ui?.select || process.env.SEEKBRAIN_NON_INTERACTIVE === "1") return { decision: "unavailable" };
  const approve = "Approve — begin analysis task execution";
  const revise = "Revise — provide scientific feedback";
  const restorePrevious = "Restore previous Plan version";
  const cancel = "Cancel — retain the plan without execution";
  const choice = await context.ui.select(input.title, [approve, revise, ...(input.rollbackAvailable ? [restorePrevious] : []), cancel]);
  if (choice === approve) return { decision: "approve" };
  if (choice === restorePrevious) return { decision: "restore_previous" };
  if (choice === revise) {
    const feedback = String(await inputWithReviewContext(context, { reviewText: input.title, feedbackTitle: input.feedbackTitle, feedbackPlaceholder: input.feedbackPlaceholder }) || "").trim();
    return feedback ? { decision: "feedback", feedback } : { decision: "feedback_empty" };
  }
  return { decision: "cancel" };
}

export async function selectTaskPlanReview(context: Json, input: {
  title: string;
  feedbackTitle: string;
  feedbackPlaceholder: string;
  rollbackAvailable?: boolean;
}): Promise<TaskPlanReviewSelection> {
  if (!context?.ui?.select || process.env.SEEKBRAIN_NON_INTERACTIVE === "1") return { decision: "unavailable" };
  const approve = "Approve this schema";
  const revise = "Request changes";
  const restorePrevious = "Restore previous Plan version";
  const approveRemaining = "Approve this and all remaining schemas";
  const choice = await context.ui.select(input.title, [approve, revise, ...(input.rollbackAvailable ? [restorePrevious] : []), approveRemaining]);
  if (choice === approve) return { decision: "approve" };
  if (choice === approveRemaining) return { decision: "approve_remaining" };
  if (choice === restorePrevious) return { decision: "restore_previous" };
  if (choice === revise) {
    const feedback = String(await inputWithReviewContext(context, { reviewText: input.title, feedbackTitle: input.feedbackTitle, feedbackPlaceholder: input.feedbackPlaceholder }) || "").trim();
    return feedback ? { decision: "feedback", feedback } : { decision: "feedback_empty" };
  }
  return { decision: "cancel" };
}

export async function selectDependencyInstallReview(context: Json, input: {
  title: string;
  yesLabel?: string;
  yesToAllLabel?: string;
}): Promise<DependencyInstallSelection> {
  if (!context?.ui?.select || process.env.SEEKBRAIN_NON_INTERACTIVE === "1") return { decision: "unavailable" };
  const yes = input.yesLabel || "Yes, run pip install";
  const yesToAll = input.yesToAllLabel || "Yes, allow all pip installs for this run";
  const no = "No, use installed packages only";
  const choice = await context.ui.select(input.title, [yes, yesToAll, no]);
  if (choice === yesToAll) return { decision: "yes_to_all" };
  if (choice === yes) return { decision: "yes" };
  if (choice === no) return { decision: "no" };
  return { decision: "cancel" };
}

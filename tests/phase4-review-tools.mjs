import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createJiti } from "jiti";

const root = new URL("../", import.meta.url);
const extensionSource = await readFile(new URL("src/extension/seekbrain-runtime.ts", root), "utf8");
const researchPlanningSource = await readFile(new URL("src/extension/runtime/stages/research-planning-tools.ts", root), "utf8");
const reviewToolsSource = await readFile(new URL("src/extension/runtime/stages/review-tools.ts", root), "utf8");
const codeReviewToolsSource = await readFile(new URL("src/extension/runtime/stages/code-review-tools.ts", root), "utf8");
const workflowSource = await readFile(new URL("src/workflows/seekbrain/review-workflow.ts", root), "utf8");
const selectorSource = await readFile(new URL("src/extension/tui/review-selectors.ts", root), "utf8");
assert.match(reviewToolsSource, /workflow\.approveStage/);
assert.match(reviewToolsSource, /workflow\.recordStageFeedback/);
assert.match(reviewToolsSource, /workflow\.updatePlan/);
assert.match(codeReviewToolsSource, /workflow\.(proposeCodeEdit|applyCodeEdit|requestCodeChanges)/);
assert.match(reviewToolsSource, /selectBinaryReview/);
assert.match(codeReviewToolsSource, /selectBinaryReview/);
assert.match(researchPlanningSource, /let researcherReview = await presentResearchTreeReview\(params\.run_id, signal, ctx\)/);
assert.doesNotMatch(extensionSource, /ui\.(select|input)/);
assert.doesNotMatch(researchPlanningSource, /ui\.(select|input)/);
assert.doesNotMatch(reviewToolsSource, /ui\.(select|input)/);
assert.doesNotMatch(codeReviewToolsSource, /ui\.(select|input)/);
assert.match(selectorSource, /ui\.select/);
assert.doesNotMatch(workflowSource, /ExtensionAPI|pi\.registerTool|ui\.select|LazyDiffComponent/);

const cwd = await mkdtemp(join(tmpdir(), "seekbrain-review-tool-contract-"));
const previousRoot = process.env.SEEKBRAIN_ROOT;
const previousUser = process.env.SEEKBRAIN_USER_CONFIG;
const previousNonInteractive = process.env.SEEKBRAIN_NON_INTERACTIVE;
process.env.SEEKBRAIN_ROOT = cwd;
process.env.SEEKBRAIN_USER_CONFIG = join(cwd, "missing-user.yaml");
process.env.SEEKBRAIN_NON_INTERACTIVE = "1";
const tools = [];
const pi = { on() {}, registerCommand() {}, registerTool(tool) { tools.push(tool); }, async appendEntry() {}, sendMessage() {} };
try {
  const jiti = createJiti(import.meta.url);
  const { default: registerSeekBrain } = await jiti.import("../src/extension/index.ts");
  await registerSeekBrain(pi);
  const byName = Object.fromEntries(tools.map((tool) => [tool.name, tool]));
  const ctx = { cwd, hasUI: false };
  const started = await byName.seekbrain_run_start.execute("start", { work_dir: "run", question: "question" }, undefined, undefined, ctx);
  const runId = started.details.run_id;
  const approved = await byName.seekbrain_review_approve.execute("approve", { run_id: runId, stage: "plan" }, undefined, undefined, ctx);
  assert.equal(approved.details.review.status, "approved");
  const feedback = await byName.seekbrain_review_feedback.execute("feedback", { run_id: runId, stage: "plan", feedback: "revise" }, undefined, undefined, ctx);
  assert.equal(feedback.details.review.status, "changes_requested");
  const updated = await byName.seekbrain_formulation_update.execute("update", { run_id: runId, plan_markdown: "# Revised" }, undefined, undefined, ctx);
  assert.equal(updated.details.revision, 2);
  const review = await byName.seekbrain_formulation_researcher_review.execute("review", { run_id: runId }, undefined, undefined, ctx);
  assert.equal(review.details.needs_text_review, true);

  const planningRun = await byName.seekbrain_run_start.execute("planning-start", { work_dir: "planning-run", question: "Compare complementary evidence streams." }, undefined, undefined, ctx);
  const planningRunId = planningRun.details.run_id;
  const planningStatePath = join(cwd, "planning-run", "state.json");
  const planningState = JSON.parse(await readFile(planningStatePath, "utf8"));
  const researchPlanPath = join(cwd, "planning-run", "research_plan", "research_plan.json");
  const analysisTask = (title) => ({
    id: "normalized-by-workflow",
    title,
    analysis_question: `${title}?`,
    biological_hypothesis: `${title} has a measurable effect.`,
    analysis_strategy: `Estimate the effect for ${title}.`,
    required_data: ["recorded observations"],
    expected_evidence: "A quantified effect.",
    supports_conclusion_if: "The effect is robust.",
    contradicts_conclusion_if: "The effect is absent.",
  });
  const researchPlan = {
    research_goal: "Compare complementary evidence streams.",
    planning_rationale: "The evidence streams require separate analyses.",
    subquestions: [
      {
        id: "SQ1",
        question: "Assess stream one.",
        hypothesis: "Stream one contributes evidence.",
        role_in_overall_conclusion: "Tests the first evidence branch.",
        dataset_grounding: ["stream one observations"],
        tasks: [analysisTask("Analyze stream one")],
      },
      {
        id: "SQ2",
        question: "Assess stream two.",
        hypothesis: "Stream two contributes evidence.",
        role_in_overall_conclusion: "Tests the second evidence branch.",
        dataset_grounding: ["stream two observations"],
        tasks: [analysisTask("Analyze stream two")],
      },
    ],
    synthesis_strategy: "Synthesize evidence across streams.",
  };
  await mkdir(join(cwd, "planning-run", "research_plan"), { recursive: true });
  await writeFile(researchPlanPath, `${JSON.stringify(researchPlan, null, 2)}\n`, "utf8");
  planningState.research_planning = {
    status: "ready_for_user_review",
    research_plan_path: researchPlanPath,
    reviewer_critique: { verdict: "accept" },
    unresolved_issues: [],
  };
  await writeFile(planningStatePath, `${JSON.stringify(planningState, null, 2)}\n`, "utf8");

  delete process.env.SEEKBRAIN_NON_INTERACTIVE;
  let selectorCalls = 0;
  let researchPlanChoice = 0;
  const interactiveCtx = {
    cwd,
    hasUI: true,
    ui: {
      async select(_title, options) {
        selectorCalls += 1;
        assert.deepEqual(options, [
          "Approve — begin analysis task execution",
          "Revise — provide scientific feedback",
          "Cancel — retain the plan without execution",
        ]);
        return options[researchPlanChoice];
      },
    },
  };
  const nativeReview = await byName.seekbrain_planning_researcher_review.execute("native-review", { run_id: planningRunId }, undefined, undefined, interactiveCtx);
  assert.equal(selectorCalls, 1);
  assert.equal(nativeReview.details.decision, "approve");

  const noPendingDecision = await byName.seekbrain_planning_researcher_decision_record.execute(
    "no-pending-decision",
    { run_id: planningRunId, decision: "approve", response_quote: "Approve." },
    undefined,
    undefined,
    interactiveCtx,
  );
  assert.equal(noPendingDecision.details.ok, false);

  const cancelRun = await byName.seekbrain_run_start.execute("cancel-start", { work_dir: "cancel-run", question: "Compare complementary evidence streams." }, undefined, undefined, ctx);
  const cancelRunId = cancelRun.details.run_id;
  const cancelStatePath = join(cwd, "cancel-run", "state.json");
  const cancelPlanPath = join(cwd, "cancel-run", "research_plan", "research_plan.json");
  await mkdir(join(cwd, "cancel-run", "research_plan"), { recursive: true });
  await writeFile(cancelPlanPath, `${JSON.stringify(researchPlan, null, 2)}\n`, "utf8");
  const cancelState = JSON.parse(await readFile(cancelStatePath, "utf8"));
  cancelState.research_planning = { status: "ready_for_user_review", research_plan_path: cancelPlanPath };
  await writeFile(cancelStatePath, `${JSON.stringify(cancelState, null, 2)}\n`, "utf8");
  researchPlanChoice = 2;
  const cancelled = await byName.seekbrain_planning_researcher_review.execute("cancel-review", { run_id: cancelRunId }, undefined, undefined, interactiveCtx);
  assert.equal(cancelled.details.decision, "cancel");
  assert.equal(cancelled.details.status, "cancelled_by_user");
  const callsAfterCancel = selectorCalls;
  researchPlanChoice = 0;
  const stillCancelled = await byName.seekbrain_planning_researcher_review.execute("cancel-review-again", { run_id: cancelRunId }, undefined, undefined, interactiveCtx);
  assert.equal(stillCancelled.details.decision, "cancel");
  assert.equal(selectorCalls, callsAfterCancel);

  process.env.SEEKBRAIN_NON_INTERACTIVE = "1";
  const fallbackRun = await byName.seekbrain_run_start.execute("fallback-start", { work_dir: "fallback-run", question: "Compare complementary evidence streams." }, undefined, undefined, ctx);
  const fallbackRunId = fallbackRun.details.run_id;
  const fallbackStatePath = join(cwd, "fallback-run", "state.json");
  const fallbackState = JSON.parse(await readFile(fallbackStatePath, "utf8"));
  fallbackState.research_planning = { ...planningState.research_planning, status: "ready_for_user_review" };
  await writeFile(fallbackStatePath, `${JSON.stringify(fallbackState, null, 2)}\n`, "utf8");
  const textFallback = await byName.seekbrain_planning_researcher_review.execute("text-review", { run_id: fallbackRunId }, undefined, undefined, ctx);
  assert.equal(textFallback.details.needs_text_review, true);
  const recorded = await byName.seekbrain_planning_researcher_decision_record.execute(
    "record-text-review",
    { run_id: fallbackRunId, decision: "approve", response_quote: "Approve." },
    undefined,
    undefined,
    ctx,
  );
  assert.equal(recorded.details.decision, "approve");
} finally {
  if (previousRoot === undefined) delete process.env.SEEKBRAIN_ROOT; else process.env.SEEKBRAIN_ROOT = previousRoot;
  if (previousUser === undefined) delete process.env.SEEKBRAIN_USER_CONFIG; else process.env.SEEKBRAIN_USER_CONFIG = previousUser;
  if (previousNonInteractive === undefined) delete process.env.SEEKBRAIN_NON_INTERACTIVE; else process.env.SEEKBRAIN_NON_INTERACTIVE = previousNonInteractive;
  await rm(cwd, { recursive: true, force: true });
}

console.log("Phase 4 review tools keep UI in Pi and state transitions in ReviewWorkflow");

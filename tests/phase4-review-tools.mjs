import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createJiti } from "jiti";

const root = new URL("../", import.meta.url);
const extensionSource = await readFile(new URL("src/extension/seekbrain-runtime.ts", root), "utf8");
const workflowSource = await readFile(new URL("src/workflows/seekbrain/review-workflow.ts", root), "utf8");
const selectorSource = await readFile(new URL("src/extension/tui/review-selectors.ts", root), "utf8");
assert.match(extensionSource, /reviewWorkflow\.approveStage/);
assert.match(extensionSource, /reviewWorkflow\.recordStageFeedback/);
assert.match(extensionSource, /reviewWorkflow\.updatePlan/);
assert.match(extensionSource, /reviewWorkflow\.(proposeCodeEdit|applyCodeEdit|requestCodeChanges)/);
assert.match(extensionSource, /selectBinaryReview/);
assert.match(extensionSource, /let researcherReview = await presentResearchTreeReview\(params\.run_id, signal, ctx\)/);
assert.doesNotMatch(extensionSource, /ui\.(select|input)/);
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
  planningState.research_planning = {
    status: "ready_for_user_review",
    final_plan_path: join(cwd, "planning-run", "research_plan", "research_plan.json"),
    final_plan: {
      research_goal: "Compare complementary evidence streams.",
      planning_rationale: "The evidence streams require separate analyses.",
      subquestions: [
        { id: "SQ1", question: "Assess stream one.", tasks: [{ id: "SQ1-T1", title: "Analyze stream one" }] },
        { id: "SQ2", question: "Assess stream two.", tasks: [{ id: "SQ2-T1", title: "Analyze stream two" }] },
      ],
      synthesis_strategy: "Synthesize evidence across streams.",
    },
    reviewer_critique: { verdict: "accept" },
    unresolved_issues: [],
  };
  await writeFile(planningStatePath, `${JSON.stringify(planningState, null, 2)}\n`, "utf8");

  delete process.env.SEEKBRAIN_NON_INTERACTIVE;
  let selectorCalls = 0;
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
        return options[0];
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

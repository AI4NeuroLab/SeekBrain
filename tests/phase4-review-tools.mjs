import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
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
  const started = await byName.neuro_start_run.execute("start", { work_dir: "run", question: "question" }, undefined, undefined, ctx);
  const runId = started.details.run_id;
  const approved = await byName.neuro_approve_stage.execute("approve", { run_id: runId, stage: "plan" }, undefined, undefined, ctx);
  assert.equal(approved.details.review.status, "approved");
  const feedback = await byName.neuro_record_feedback.execute("feedback", { run_id: runId, stage: "plan", feedback: "revise" }, undefined, undefined, ctx);
  assert.equal(feedback.details.review.status, "changes_requested");
  const updated = await byName.neuro_update_plan.execute("update", { run_id: runId, plan_markdown: "# Revised" }, undefined, undefined, ctx);
  assert.equal(updated.details.revision, 2);
  const review = await byName.neuro_review_plan.execute("review", { run_id: runId }, undefined, undefined, ctx);
  assert.equal(review.details.needs_text_review, true);
} finally {
  if (previousRoot === undefined) delete process.env.SEEKBRAIN_ROOT; else process.env.SEEKBRAIN_ROOT = previousRoot;
  if (previousUser === undefined) delete process.env.SEEKBRAIN_USER_CONFIG; else process.env.SEEKBRAIN_USER_CONFIG = previousUser;
  if (previousNonInteractive === undefined) delete process.env.SEEKBRAIN_NON_INTERACTIVE; else process.env.SEEKBRAIN_NON_INTERACTIVE = previousNonInteractive;
  await rm(cwd, { recursive: true, force: true });
}

console.log("Phase 4 review tools keep UI in Pi and state transitions in ReviewWorkflow");

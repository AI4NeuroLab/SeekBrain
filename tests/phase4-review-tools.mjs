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
  for (const name of ["seekbrain_review_approve", "seekbrain_review_feedback", "seekbrain_formulation_update",
    "seekbrain_formulation_researcher_review", "seekbrain_planning_peer_review", "seekbrain_planning_researcher_review",
    "seekbrain_planning_researcher_decision_record", "seekbrain_code_edit_review"]) assert.equal(byName[name], undefined);
  const started = await byName.seekbrain_research_start.execute("start", { project_dir: "study" }, undefined, undefined, { cwd, hasUI: false, sessionManager: { getBranch: () => [{ type: "message", id: "request", message: { role: "user", content: "Analyze a dataset" } }] } });
  const state = JSON.parse(await readFile(started.details.state_path, "utf8"));
  assert.equal(state.human_reviews, undefined);
  assert.equal(started.details.next_tool, "seekbrain_plan_generate");

} finally {
  if (previousRoot === undefined) delete process.env.SEEKBRAIN_ROOT; else process.env.SEEKBRAIN_ROOT = previousRoot;
  if (previousUser === undefined) delete process.env.SEEKBRAIN_USER_CONFIG; else process.env.SEEKBRAIN_USER_CONFIG = previousUser;
  if (previousNonInteractive === undefined) delete process.env.SEEKBRAIN_NON_INTERACTIVE; else process.env.SEEKBRAIN_NON_INTERACTIVE = previousNonInteractive;
  await rm(cwd, { recursive: true, force: true });
}

console.log("Phase 4 review tools keep UI in Pi and state transitions in ReviewWorkflow");

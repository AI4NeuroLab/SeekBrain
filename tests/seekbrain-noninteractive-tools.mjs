import assert from "node:assert/strict";
import { AUTOMATION_TOOLS, INTERACTIVE_TOOLS } from "../src/cli/cli.mjs";

const automation = AUTOMATION_TOOLS;
const humanReview = "neuro_approve_stage,neuro_record_feedback,neuro_review_plan,neuro_update_plan,neuro_review_research_planning,neuro_review_research_tree,neuro_review_task_plan";
const diffReview = "neuro_review_code_edit,neuro_propose_code_update,neuro_review_code_update";

assert.ok(automation, "automation toolset must be declared");
assert.equal(humanReview, "neuro_approve_stage,neuro_record_feedback,neuro_review_plan,neuro_update_plan,neuro_review_research_planning,neuro_review_research_tree,neuro_review_task_plan");
assert.equal(diffReview, "neuro_review_code_edit,neuro_propose_code_update,neuro_review_code_update");
for (const tool of [...humanReview.split(","), ...diffReview.split(",")]) {
  assert.equal(automation.split(",").includes(tool), false, `${tool} must not be exposed headlessly`);
}
assert.equal(AUTOMATION_TOOLS.split(",").includes("neuro_control_research_task"), false, "task retry/cancel requires an explicit interactive user decision");
assert.equal(INTERACTIVE_TOOLS.split(",").includes("neuro_control_research_task"), true);
for (const tool of [...humanReview.split(","), ...diffReview.split(",")]) {
  assert.equal(INTERACTIVE_TOOLS.split(",").includes(tool), true, `${tool} must remain interactive`);
}

console.log("SeekBrain non-interactive toolset excludes diff review tools");

import assert from "node:assert/strict";
import { AUTOMATION_TOOLS, INTERACTIVE_TOOLS } from "../src/cli/cli.mjs";

const automation = AUTOMATION_TOOLS;
const humanReview = "seekbrain_review_approve,seekbrain_review_feedback,seekbrain_formulation_researcher_review,seekbrain_formulation_update,seekbrain_planning_decision_review,seekbrain_planning_decision_record,seekbrain_planning_researcher_review,seekbrain_planning_researcher_decision_record,seekbrain_execution_schema_review";
const diffReview = "seekbrain_code_edit_review,seekbrain_code_update_propose,seekbrain_code_update_review";

assert.ok(automation, "automation toolset must be declared");
assert.equal(humanReview, "seekbrain_review_approve,seekbrain_review_feedback,seekbrain_formulation_researcher_review,seekbrain_formulation_update,seekbrain_planning_decision_review,seekbrain_planning_decision_record,seekbrain_planning_researcher_review,seekbrain_planning_researcher_decision_record,seekbrain_execution_schema_review");
assert.equal(diffReview, "seekbrain_code_edit_review,seekbrain_code_update_propose,seekbrain_code_update_review");
for (const tool of [...humanReview.split(","), ...diffReview.split(",")]) {
  assert.equal(automation.split(",").includes(tool), false, `${tool} must not be exposed headlessly`);
}
assert.equal(AUTOMATION_TOOLS.split(",").includes("seekbrain_analysis_task_control"), false, "task retry/cancel requires an explicit interactive user decision");
assert.equal(INTERACTIVE_TOOLS.split(",").includes("seekbrain_analysis_task_control"), false);
for (const tool of [...humanReview.split(","), ...diffReview.split(",")]) {
  assert.equal(INTERACTIVE_TOOLS.split(",").includes(tool), false, `${tool} must not be exposed in the v014 default workflow`);
}

assert.equal(AUTOMATION_TOOLS, INTERACTIVE_TOOLS);
assert.ok(AUTOMATION_TOOLS.split(",").includes("seekbrain_plan_generate"));
console.log("SeekBrain unified toolsets expose planning and execution without legacy review gates");

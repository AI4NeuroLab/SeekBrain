import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const script = await readFile(new URL("../internagent/workflow/level1.sh", import.meta.url), "utf8");
const automation = script.match(/^LEVEL1_AUTOMATION_TOOLS="([^"]+)"$/m)?.[1] || "";
const humanReview = script.match(/^LEVEL1_HUMAN_REVIEW_TOOLS="([^"]+)"$/m)?.[1] || "";
const diffReview = script.match(/^LEVEL1_DIFF_REVIEW_TOOLS="([^"]+)"$/m)?.[1] || "";

assert.ok(automation, "automation toolset must be declared");
assert.equal(humanReview, "neuro_approve_stage,neuro_record_feedback,neuro_review_plan,neuro_update_plan");
assert.equal(diffReview, "neuro_review_code_edit,neuro_propose_code_update,neuro_review_code_update");
for (const tool of [...humanReview.split(","), ...diffReview.split(",")]) {
  assert.equal(automation.split(",").includes(tool), false, `${tool} must not be exposed headlessly`);
}
assert.match(script, /--tools "\$\{LEVEL1_INTERACTIVE_TOOLS\}"/);
assert.match(script, /export NEURO_LEVEL1_NON_INTERACTIVE=1\nset_level1_resource_tools "\$\{LEVEL1_AUTOMATION_TOOLS\}"/);
assert.match(script, /Post-run diff\/code-edit review tools are intentionally unavailable/);

console.log("Level-1 non-interactive toolset excludes diff review tools");

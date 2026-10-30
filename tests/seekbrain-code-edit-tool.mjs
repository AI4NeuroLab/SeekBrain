import assert from "node:assert/strict";
import { createJiti } from "jiti";
const jiti = createJiti(import.meta.url);
const { default: register } = await jiti.import("../src/extension/index.ts");
const tools = [];
await register({ on() {}, registerCommand() {}, registerTool(tool) { tools.push(tool.name); }, async appendEntry() {}, sendMessage() {} });
for (const name of ["seekbrain_code_edit_review", "seekbrain_code_update_propose", "seekbrain_code_update_review"]) {
  assert.equal(tools.includes(name), false, "Legacy manual code-edit gates must not be part of the v014 default flow");
}
assert.ok(tools.includes("seekbrain_execution_run"));
console.log("seekbrain-014 execution has no legacy manual code-edit gate; internal edit policies remain covered separately");

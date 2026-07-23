import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const extensionSource = await readFile(new URL("src/extension/seekbrain-runtime.ts", root), "utf8");
const workflowSource = await readFile(new URL("src/workflows/seekbrain/plan-workflow.ts", root), "utf8");
const promptSource = await readFile(new URL("prompts/plan.md", root), "utf8");

assert.match(extensionSource, /planWorkflow\.execute/);
assert.match(extensionSource, /humanReviewRequired: humanGateEnabled\(config, "plan"\)/);
assert.doesNotMatch(workflowSource, /ExtensionAPI|pi\.registerTool|createAgentSession|spawn\(/);
assert.match(workflowSource, /plan\.md/);
assert.match(workflowSource, /neuro_review_plan/);
assert.match(promptSource, /add an `## Execution Strategy` section/);
assert.match(promptSource, /Do not add this section for ordinary small datasets/);

console.log("Phase 4 plan tool delegates stage behavior through the workflow boundary");

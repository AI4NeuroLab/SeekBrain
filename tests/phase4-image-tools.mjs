import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const extensionSource = await readFile(new URL("src/extension/seekbrain-runtime.ts", root), "utf8");
const workflowSource = await readFile(new URL("src/workflows/seekbrain/image-workflow.ts", root), "utf8");
const promptSource = await readFile(new URL("prompts/image_refine.md", root), "utf8");

assert.match(extensionSource, /imageWorkflow\.refine/);
assert.doesNotMatch(extensionSource, /imageWorkflow\.analyze/);
assert.match(extensionSource, /finalizeGuard:/);
assert.match(extensionSource, /fastPass: fastPassRefinedValidation/);
assert.doesNotMatch(workflowSource, /ExtensionAPI|pi\.registerTool|createAgentSession|runSubagent/);
assert.match(workflowSource, /single Figure Refinement allowance/);
assert.doesNotMatch(workflowSource, /neuro_analyze_image|image_analyses/);
assert.match(workflowSource, /Avoid reloading large source datasets or rerunning the complete analysis/);
assert.match(promptSource, /Prefer the least computationally expensive safe redraw path/);
assert.doesNotMatch(promptSource, /plot cache|refinement-only cache/);

console.log("Phase 4 image workflow owns presentation-only refinement; interpretation is a separate stage");

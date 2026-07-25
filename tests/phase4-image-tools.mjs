import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const extensionSource = await readFile(new URL("src/extension/seekbrain-runtime.ts", root), "utf8");
const serviceSource = await readFile(new URL("src/extension/runtime/create-runtime-services.ts", root), "utf8");
const toolSource = await readFile(new URL("src/extension/runtime/stages/figure-refinement-tools.ts", root), "utf8");
const workflowSource = await readFile(new URL("src/workflows/seekbrain/image-workflow.ts", root), "utf8");
const promptSource = await readFile(new URL("prompts/image_refine.md", root), "utf8");

assert.match(toolSource, /imageWorkflow\.refine/);
assert.doesNotMatch(toolSource, /imageWorkflow\.analyze/);
assert.match(serviceSource, /finalizeGuard:/);
assert.match(serviceSource, /fastPass: fastPassRefinedValidation/);
assert.doesNotMatch(toolSource, /pi\.registerTool|createAgentSession|runSubagent/);
assert.doesNotMatch(workflowSource, /ExtensionAPI|pi\.registerTool|createAgentSession|runSubagent/);
assert.match(workflowSource, /single Figure Refinement allowance/);
assert.doesNotMatch(workflowSource, /neuro_analyze_image|image_analyses/);
assert.match(workflowSource, /Avoid reloading large source datasets or rerunning the complete analysis/);
assert.match(promptSource, /Prefer the least computationally expensive safe redraw path/);
assert.doesNotMatch(promptSource, /plot cache|refinement-only cache/);

console.log("Phase 4 image workflow owns presentation-only refinement; interpretation is a separate stage");

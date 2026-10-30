import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const extensionSource = await readFile(new URL("src/extension/seekbrain-runtime.ts", root), "utf8");
const toolSource = await readFile(new URL("src/extension/runtime/stages/formulation-tools.ts", root), "utf8");
const workflowSource = await readFile(new URL("src/workflows/seekbrain/plan-workflow.ts", root), "utf8");
const promptSource = await readFile(new URL("prompts/plan.md", root), "utf8");

assert.match(toolSource, /planWorkflow\.execute/);
assert.match(toolSource, /humanReviewRequired: humanGateEnabled\(config, "plan"\)/);
assert.doesNotMatch(toolSource, /pi\.registerTool|createAgentSession|spawn\(/);
assert.doesNotMatch(workflowSource, /ExtensionAPI|pi\.registerTool|createAgentSession|spawn\(/);
assert.match(workflowSource, /plan\.md/);
assert.match(workflowSource, /seekbrain_formulation_researcher_review/);
assert.match(promptSource, /## Overview/);
assert.match(promptSource, /## Data Loading/);
assert.match(promptSource, /## Preprocessing and Analysis/);
assert.match(promptSource, /## Visualisations/);
assert.match(promptSource, /## Statistics/);
assert.match(promptSource, /## Deliverables/);
assert.match(promptSource, /## Assumptions and Warnings/);
assert.doesNotMatch(promptSource, /## Recipe Relevance/);
assert.doesNotMatch(toolSource, /data_info|analysis_recipe|methodological_schema|confidence/);
assert.doesNotMatch(workflowSource, /plan_markdown: agent\.result/);

console.log("Phase 4 plan tool delegates stage behavior through the workflow boundary");

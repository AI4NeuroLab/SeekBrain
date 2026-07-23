import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const extensionSource = await readFile(new URL("src/extension/seekbrain-runtime.ts", root), "utf8");
const workflowSource = await readFile(new URL("src/workflows/seekbrain/validate-workflow.ts", root), "utf8");

assert.match(extensionSource, /validateWorkflow\.execute/);
assert.match(extensionSource, /normalize: normalizeValidation/);
assert.match(extensionSource, /nextStep: validationNextStep/);
assert.doesNotMatch(workflowSource, /ExtensionAPI|pi\.registerTool|createAgentSession|runSubagent/);
assert.match(workflowSource, /requires vision=true/);
assert.match(workflowSource, /validation\.json/);
assert.match(workflowSource, /after_validate/);

console.log("Phase 4 validate tool delegates visual validation through the workflow boundary");

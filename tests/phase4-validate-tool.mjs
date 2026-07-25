import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const extensionSource = await readFile(new URL("src/extension/seekbrain-runtime.ts", root), "utf8");
const serviceSource = await readFile(new URL("src/extension/runtime/create-runtime-services.ts", root), "utf8");
const toolSource = await readFile(new URL("src/extension/runtime/stages/validation-tools.ts", root), "utf8");
const workflowSource = await readFile(new URL("src/workflows/seekbrain/validate-workflow.ts", root), "utf8");

assert.match(toolSource, /validateWorkflow\.execute/);
assert.match(serviceSource, /normalize: normalizeValidation/);
assert.match(serviceSource, /nextStep: validationNextStep/);
assert.doesNotMatch(toolSource, /pi\.registerTool|createAgentSession|runSubagent/);
assert.doesNotMatch(workflowSource, /ExtensionAPI|pi\.registerTool|createAgentSession|runSubagent/);
assert.match(workflowSource, /requires vision=true/);
assert.match(workflowSource, /validation\.json/);
assert.match(workflowSource, /after_validate/);

console.log("Phase 4 validate tool delegates visual validation through the workflow boundary");

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const extensionSource = await readFile(new URL("src/extension/seekbrain-runtime.ts", root), "utf8");
const workflowSource = await readFile(new URL("src/workflows/seekbrain/interpret-workflow.ts", root), "utf8");

assert.match(extensionSource, /interpretWorkflow\.execute/);
assert.match(extensionSource, /currentArtifactsValidated,/);
assert.match(extensionSource, /nextStep: validationNextStep/);
assert.doesNotMatch(workflowSource, /ExtensionAPI|pi\.registerTool|createAgentSession|runSubagent/);
assert.match(workflowSource, /Dummy\/synthetic data signals were detected/);
assert.match(workflowSource, /Unresolved validation issue/);
assert.match(workflowSource, /updateResearchRoundManifest/);

console.log("Phase 4 Interpret tool combines visual analysis, synthesis, and round completion");

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const extensionSource = await readFile(new URL("src/extension/seekbrain-runtime.ts", root), "utf8");
const serviceSource = await readFile(new URL("src/extension/runtime/create-runtime-services.ts", root), "utf8");
const toolSource = await readFile(new URL("src/extension/runtime/stages/interpretation-tools.ts", root), "utf8");
const workflowSource = await readFile(new URL("src/workflows/seekbrain/interpret-workflow.ts", root), "utf8");

assert.match(toolSource, /interpretWorkflow\.execute/);
assert.match(serviceSource, /currentArtifactsValidated,/);
assert.match(serviceSource, /nextStep: validationNextStep/);
assert.doesNotMatch(toolSource, /pi\.registerTool|createAgentSession|runSubagent/);
assert.doesNotMatch(workflowSource, /ExtensionAPI|pi\.registerTool|createAgentSession|runSubagent/);
assert.match(workflowSource, /Possible real-input substitution signals require caution/);
assert.match(workflowSource, /Unresolved validation issue/);
assert.match(workflowSource, /updateResearchRoundManifest/);
assert.doesNotMatch(workflowSource, /loadImages|imageAnalysisMarkdown|image_analysis\.md/);
assert.doesNotMatch(toolSource, /image_analysis|confidence|additional_context/);
assert.match(workflowSource, /const conclusionsPath = join\(run\.runDir, "conclusions\.json"\)/);

console.log("Phase 4 Interpret tool performs text-only synthesis and round completion");

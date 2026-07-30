import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const extensionSource = await readFile(new URL("src/extension/seekbrain-runtime.ts", root), "utf8");
const serviceSource = await readFile(new URL("src/extension/runtime/create-runtime-services.ts", root), "utf8");
const toolSource = await readFile(new URL("src/extension/runtime/stages/code-execution-tools.ts", root), "utf8");
const workflowSource = await readFile(new URL("src/workflows/seekbrain/code-workflow.ts", root), "utf8");
const promptSource = await readFile(new URL("prompts/code.md", root), "utf8");
const dependencySource = await readFile(new URL("src/extension/dependency-install.ts", root), "utf8");

assert.match(toolSource, /codeWorkflow\.execute/);
assert.match(toolSource, /planReviewRequired: humanGateEnabled\(config, "plan"\)/);
assert.match(serviceSource, /retryPolicy: codeRetryPolicy/);
assert.doesNotMatch(workflowSource, /ExtensionAPI|pi\.registerTool|createAgentSession|spawn\(/);
assert.match(workflowSource, /blocked_by_human_review/);
assert.match(workflowSource, /blocked_by_validation_policy/);
assert.match(workflowSource, /after_code_attempt_/);
assert.doesNotMatch(promptSource, /render-only/);
assert.doesNotMatch(promptSource, /plot_data|plot-only cache/);
assert.match(promptSource, /plan\.md` is the sole computational specification/);
assert.match(promptSource, /do not create an extra plotting CLI/);
assert.match(promptSource, /Do not build frameworks, checkpoint systems, manifests/);
assert.match(promptSource, /Do not run package managers/);
assert.match(promptSource, /one compact non-visual verification/);
assert.match(promptSource, /Avoid repeated[\s\S]*successful reruns/);
assert.match(toolSource, /createDependencyInstallToolResultHandler/);
assert.doesNotMatch(toolSource, /pi\.registerTool|createAgentSession|spawn\(/);
assert.match(dependencySource, /CONDA_PREFIX/);
assert.match(dependencySource, /--user/);
assert.match(dependencySource, /yes_to_all/);
assert.match(dependencySource, /SerializedReviewGate/);

console.log("Phase 4 code tool delegates stage behavior through the workflow boundary");

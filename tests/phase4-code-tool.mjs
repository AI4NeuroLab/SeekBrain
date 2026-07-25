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
assert.match(promptSource, /No additional plotting command-line interface is required/);
assert.doesNotMatch(promptSource, /plot_data|plot-only cache/);
assert.match(promptSource, /isolate plotting in clearly named[\s\S]*functions with explicit inputs/);
assert.match(promptSource, /If the methodological schema contains an `## Execution Strategy` section/);
assert.match(promptSource, /Do not introduce checkpoint frameworks, concurrency systems/);
assert.match(promptSource, /Only when the intercepted result explicitly says the researcher chose/);
assert.match(toolSource, /createDependencyInstallToolResultHandler/);
assert.doesNotMatch(toolSource, /pi\.registerTool|createAgentSession|spawn\(/);
assert.match(dependencySource, /CONDA_PREFIX/);
assert.match(dependencySource, /--user/);
assert.match(dependencySource, /yes_to_all/);
assert.match(dependencySource, /SerializedReviewGate/);

console.log("Phase 4 code tool delegates stage behavior through the workflow boundary");

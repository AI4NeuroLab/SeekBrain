import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const extensionSource = await readFile(new URL("src/extension/runtime/index.ts", root), "utf8");
const serviceSource = await readFile(new URL("src/extension/runtime/create-runtime-services.ts", root), "utf8");
const executorSource = await readFile(new URL("src/extension/runtime/create-research-task-executor.ts", root), "utf8");
const toolsSource = await readFile(new URL("src/extension/runtime/stages/research-execution-tools.ts", root), "utf8");

assert.match(serviceSource, /createResearchTaskExecutor/);
assert.match(extensionSource, /createResearchExecutionTools/);
assert.doesNotMatch(extensionSource, /const executeResearchTask:|name: "seekbrain_execution_run"/);
assert.match(executorSource, /publish\("code_started"/);
assert.match(executorSource, /publish\("validation_completed"/);
assert.match(executorSource, /publish\("refinement_completed"/);
assert.match(executorSource, /publish\("interpretation_started"/);
assert.match(toolsSource, /new SerializedReviewGate/);
assert.match(toolsSource, /claimPlanningTasks/);
assert.match(toolsSource, /claimExecutionTasks/);
assert.match(toolsSource, /createDependencyInstallToolResultHandler/);
assert.match(toolsSource, /selectTaskPlanReview/);
assert.doesNotMatch(executorSource + toolsSource, /seekbrain-runtime|runtime\/index|pi\.registerTool|createAgentSession/);
assert.doesNotMatch(executorSource, /ui\.(select|input)/);
assert.doesNotMatch(toolsSource, /ui\.(select|input)/);

console.log("Phase 6 Research Execution keeps orchestration contracts behind injected runtime ports");

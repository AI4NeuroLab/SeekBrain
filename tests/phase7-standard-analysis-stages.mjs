import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const extensionSource = await readFile(new URL("src/extension/seekbrain-runtime.ts", root), "utf8");
const stagePaths = [
  "formulation-tools.ts",
  "code-execution-tools.ts",
  "validation-tools.ts",
  "figure-refinement-tools.ts",
  "interpretation-tools.ts",
];
const stageSources = await Promise.all(stagePaths.map((path) =>
  readFile(new URL(`src/extension/runtime/stages/${path}`, root), "utf8")
));

for (const source of stageSources) {
  assert.doesNotMatch(source, /seekbrain-runtime|runtime\/index|pi\.registerTool|createAgentSession|ui\.(select|input)/);
}
assert.doesNotMatch(extensionSource, /name: "seekbrain_(formulation_generate|code_execute|validation_run|figure_refine|interpretation_run)"/);
assert.match(stageSources[0], /humanReviewRequired: humanGateEnabled\(config, "plan"\)/);
assert.match(stageSources[1], /maxAttempts: DEFAULT_MAX_CODE_ATTEMPTS/);
assert.match(stageSources[1], /createDependencyInstallToolResultHandler/);
assert.match(stageSources[2], /maxCodeAttempts: DEFAULT_MAX_CODE_ATTEMPTS/);
assert.match(stageSources[3], /enabled: workflow\.image_refine/);
assert.match(stageSources[4], /finalizeSchema: ConclusionClaimsSchema/);
const interpretationWorkflow = await readFile(new URL("src/workflows/seekbrain/interpret-workflow.ts", root), "utf8");
assert.match(interpretationWorkflow, /next_research_directions/);

console.log("Phase 7 standard analysis tools live in isolated stage factories");

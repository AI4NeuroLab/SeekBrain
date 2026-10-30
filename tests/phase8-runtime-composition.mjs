import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const compatibility = await readFile(new URL("src/extension/seekbrain-runtime.ts", root), "utf8");
const composition = await readFile(new URL("src/extension/runtime/index.ts", root), "utf8");
const services = await readFile(new URL("src/extension/runtime/create-runtime-services.ts", root), "utf8");
const session = await readFile(new URL("src/extension/runtime/create-runtime-session.ts", root), "utf8");

assert.match(compatibility, /from "\.\/runtime\/index\.ts"/);
assert.equal(compatibility.trim().split("\n").length, 2);
assert.match(composition, /createRuntimeServices/);
assert.match(composition, /createRuntimeSession/);
assert.match(composition, /registerTools\(pi, definitions\.map/);
assert.match(composition, /controller\.run\(tool\.name/);
assert.doesNotMatch(composition, /name: "seekbrain_/);
assert.match(services, /new ResearchPlanningWorkflow/);
assert.match(services, /new ResearchTaskExecutionCoordinator/);
assert.match(services, /new CodeWorkflow/);
assert.match(services, /new StudyWorkflow/);
assert.match(composition, /createUnifiedStudyTools/);
assert.match(session, /let activeRunDir/);
assert.match(session, /startConfigWatcher/);
assert.doesNotMatch(services, /from "\.\/stages\//);
assert.doesNotMatch(session, /ExtensionAPI|registerTool|registerCommand/);

console.log("Phase 8 runtime composition uses a compatibility entry, service factory, and isolated session");

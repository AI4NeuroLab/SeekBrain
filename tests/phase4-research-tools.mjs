import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createJiti } from "jiti";

const root = new URL("../", import.meta.url);
const extensionSource = await readFile(new URL("src/extension/seekbrain-runtime.ts", root), "utf8");
const recipeResearchSource = await readFile(new URL("src/extension/runtime/stages/recipe-research-tools.ts", root), "utf8");
const workflowSource = await readFile(new URL("src/workflows/seekbrain/research-skill-workflow.ts", root), "utf8");
assert.match(recipeResearchSource, /deps\.workflow\.resolveTargetedSkill/);
assert.doesNotMatch(recipeResearchSource, /deps\.workflow\.deepResearch/);
assert.doesNotMatch(recipeResearchSource, /ExtensionAPI|pi\.registerTool|createAgentSession|spawn\(/);
assert.doesNotMatch(workflowSource, /ExtensionAPI|pi\.registerTool|createAgentSession|spawn\(/);

const cwd = await mkdtemp(join(tmpdir(), "seekbrain-research-tool-contract-"));
const previousRoot = process.env.SEEKBRAIN_ROOT;
const previousUser = process.env.SEEKBRAIN_USER_CONFIG;
const previousNonInteractive = process.env.SEEKBRAIN_NON_INTERACTIVE;
const previousRunMode = process.env.SEEKBRAIN_RUN_MODE;
process.env.SEEKBRAIN_ROOT = cwd;
process.env.SEEKBRAIN_USER_CONFIG = join(cwd, "missing-user.yaml");
process.env.SEEKBRAIN_NON_INTERACTIVE = "1";
await writeFile(join(cwd, "seekbrain.config.yaml"), `
literature:
  paper_source: ailab_rag
workflow:
  seekbrain:
    research_planning_strategy: creative
    deep_research:
      max_rounds: 3
    targeted_skill_match: false
    targeted_skill_generate: false
`);

const tools = [];
const pi = {
  on() {}, registerCommand() {}, registerTool(tool) { tools.push(tool); },
  async appendEntry() {}, sendMessage() {},
};
try {
  const jiti = createJiti(import.meta.url);
  const { default: registerSeekBrain } = await jiti.import("../src/extension/index.ts");
  await registerSeekBrain(pi);
  const byName = Object.fromEntries(tools.map((tool) => [tool.name, tool]));
  const startParameters = JSON.stringify(byName.seekbrain_research_start.parameters);
  assert.doesNotMatch(startParameters, /planning_assessment|task_brief|execution_topology/);
  assert.doesNotMatch(startParameters, /evidence_workstreams|requires_cross_workstream_synthesis/);
  const ctx = { cwd, hasUI: false, sessionManager: { getBranch: () => [{ type: "message", id: "request", message: { role: "user", content: "Classify RNA barcodes in fish neurons." } }] } };
  process.env.SEEKBRAIN_RUN_MODE = "standard";
  const directStart = await byName.seekbrain_research_start.execute("direct-start", {
    project_dir: "direct-project",
  }, undefined, undefined, ctx);
  assert.equal(directStart.details.next_tool, "seekbrain_plan_generate");
  assert.equal(directStart.details.research_route, undefined);
  const state = JSON.parse(await readFile(directStart.details.state_path, "utf8"));
  assert.equal(state.flow_version, "0.1.4");
  assert.equal(state.research_planning, undefined);
  assert.equal(state.task_brief, undefined);
  assert.equal(byName.seekbrain_recipe_retrieve, undefined);
  assert.equal(byName.seekbrain_deep_research, undefined);
  assert.equal(byName.seekbrain_creative_search, undefined);
  assert.ok(byName.seekbrain_plan_generate);
  assert.ok(byName.seekbrain_research_decide);
  await assert.rejects(byName.seekbrain_research_decide.execute("blocked", { round: 1, action: "finish", reason: "No work" }, undefined, undefined, ctx), /unavailable in Research/);
  const { getModeController } = await jiti.import("../src/extension/runtime/mode-controller.ts");
  getModeController(pi).mode = "deep-research";
  const deepStatus = await byName.seekbrain_run_resume.execute("deep-resume", { project_path: directStart.details.project_dir }, undefined, undefined, ctx);
  assert.equal(deepStatus.details.deep_research.phase, "plan");
  assert.equal(deepStatus.details.next_tool, "seekbrain_plan_generate");

} finally {
  if (previousRoot === undefined) delete process.env.SEEKBRAIN_ROOT; else process.env.SEEKBRAIN_ROOT = previousRoot;
  if (previousUser === undefined) delete process.env.SEEKBRAIN_USER_CONFIG; else process.env.SEEKBRAIN_USER_CONFIG = previousUser;
  if (previousNonInteractive === undefined) delete process.env.SEEKBRAIN_NON_INTERACTIVE; else process.env.SEEKBRAIN_NON_INTERACTIVE = previousNonInteractive;
  if (previousRunMode === undefined) delete process.env.SEEKBRAIN_RUN_MODE; else process.env.SEEKBRAIN_RUN_MODE = previousRunMode;
  await rm(cwd, { recursive: true, force: true });
}

console.log("Phase 4 research and skill tools execute through injected workflow ports");

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createJiti } from "jiti";

const root = new URL("../", import.meta.url);
const extensionSource = await readFile(new URL("src/extension/runtime/index.ts", root), "utf8");
const workflowSource = await readFile(new URL("src/workflows/seekbrain/run-lifecycle.ts", root), "utf8");
assert.match(extensionSource, /new RunLifecycleWorkflow\(runRepository\)/);
assert.doesNotMatch(extensionSource, /function startResearchProject|function continueResearch/);
assert.doesNotMatch(workflowSource, /pi\.registerTool|ExtensionAPI|createAgentSession/);

const tools = [];
const pi = {
  on() {},
  registerCommand() {},
  registerTool(tool) { tools.push(tool); },
  async appendEntry() {},
  sendMessage() {},
};
const previous = process.env.SEEKBRAIN_NON_INTERACTIVE;
const previousUserConfig = process.env.SEEKBRAIN_USER_CONFIG;
const previousProjectConfig = process.env.SEEKBRAIN_CONFIG;
process.env.SEEKBRAIN_NON_INTERACTIVE = "1";
const cwd = await mkdtemp(join(tmpdir(), "seekbrain-phase4-contract-"));
process.env.SEEKBRAIN_USER_CONFIG = join(cwd, "missing-user-config.yaml");
process.env.SEEKBRAIN_CONFIG = join(cwd, "project-config.yaml");
await writeFile(process.env.SEEKBRAIN_CONFIG, "workflow:\n  seekbrain:\n    research_planning: false\n", "utf8");
try {
  const jiti = createJiti(import.meta.url);
  const { default: registerSeekBrain } = await jiti.import("../src/extension/index.ts");
  await registerSeekBrain(pi);
  const byName = Object.fromEntries(tools.map((tool) => [tool.name, tool]));
  assert.deepEqual(tools.filter((tool) => typeof tool.renderResult !== "function").map((tool) => tool.name), [], "every SeekBrain tool must have a compact result renderer");
  const ctx = { cwd, hasUI: false };

  const first = await byName.seekbrain_research_start.execute("start", {
    project_dir: "project",
    question: "first round",
    background: "user-supplied scientific context",
    data_info: "locked metadata",
  }, undefined, undefined, ctx);
  assert.equal(first.details.round_number, 1);
  assert.equal(first.details.workflow_config.optional.deep_research, "disabled_no_literature_provider");
  assert.equal(first.details.workflow_config.optional.research_planning, "disabled_by_user_config");
  assert.deepEqual(first.details.research_route, {
    enabled: false,
    route: "standard",
    needs_user_review: false,
    needs_user_clarification: false,
    next_tool: "seekbrain_recipe_retrieve",
  });
  const firstState = JSON.parse(await readFile(join(first.details.run_dir, "state.json"), "utf8"));
  assert.equal(firstState.user_background, "user-supplied scientific context");

  const resumed = await byName.seekbrain_run_resume.execute("resume", {
    work_dir: join(cwd, "project", "round1"),
    question: "updated first round",
  }, undefined, undefined, ctx);
  assert.equal(resumed.details.run_id, first.details.run_id);
  assert.equal(resumed.details.workflow_config.optional.targeted_skill, "enabled");

  const second = await byName.seekbrain_research_continue.execute("continue", {
    source_path: join(cwd, "project"),
    direction: "second round",
  }, undefined, undefined, ctx);
  assert.equal(second.details.parent_run_id, first.details.run_id);
  assert.equal(second.details.round_number, 2);
  const secondState = JSON.parse(await readFile(join(second.details.run_dir, "state.json"), "utf8"));
  assert.equal(secondState.user_background, "user-supplied scientific context");
  assert.equal(typeof second.details.workflow_config.human_review.enabled, "boolean");

  const ping = await byName.seekbrain_system_check.execute("ping", {}, undefined, undefined, ctx);
  assert.equal(ping.details.run_count, 2);
  const capabilities = await byName.seekbrain_system_capabilities.execute("capabilities", {}, undefined, undefined, ctx);
  assert.equal(capabilities.details.ok, true);
  assert.equal(capabilities.details.continuation_tool, "seekbrain_research_continue");
} finally {
  if (previous === undefined) delete process.env.SEEKBRAIN_NON_INTERACTIVE;
  else process.env.SEEKBRAIN_NON_INTERACTIVE = previous;
  if (previousUserConfig === undefined) delete process.env.SEEKBRAIN_USER_CONFIG;
  else process.env.SEEKBRAIN_USER_CONFIG = previousUserConfig;
  if (previousProjectConfig === undefined) delete process.env.SEEKBRAIN_CONFIG;
  else process.env.SEEKBRAIN_CONFIG = previousProjectConfig;
  await rm(cwd, { recursive: true, force: true });
}

console.log("Phase 4 system and lifecycle tools execute through the workflows boundary");

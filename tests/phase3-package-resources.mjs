import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { createJiti } from "jiti";
import { buildPiLaunchSpec, parseArgs, resolveRuntimePaths } from "../src/cli/cli.mjs";

const root = new URL("../", import.meta.url);
const manifest = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
const defaultConfigText = await readFile(new URL("config/default.yaml", root), "utf8");
const defaultConfig = parseYaml(defaultConfigText);
const runtimeSource = await readFile(new URL("src/extension/runtime/index.ts", root), "utf8");
const entrySource = await readFile(new URL("src/extension/index.ts", root), "utf8");

assert.doesNotMatch(defaultConfigText, /neuro-proxy|claude-opus|gemini-3|deepseek-v4|glm-5/i);
assert.equal(defaultConfig.models.length, 0);
for (const agent of Object.values(defaultConfig.agents)) {
  assert.equal(agent.provider, undefined);
  assert.equal(agent.model, undefined);
}
assert.equal(defaultConfig.workflow.seekbrain.targeted_skill_match, true);
assert.equal(defaultConfig.workflow.seekbrain.targeted_skill_generate, true);
assert.equal(defaultConfig.workflow.seekbrain.research_planning, true);
assert.equal(defaultConfig.workflow.seekbrain.research_survey, true);
assert.equal(defaultConfig.workflow.seekbrain.deep_research, false);
assert.deepEqual(defaultConfig.literature, { providers: {} });
assert.equal(defaultConfig.agents.seekbrain_survey.rag.top_k, 4);
assert.deepEqual(defaultConfig.workflow.seekbrain.research_execution, { planning_concurrency: 3, execution_concurrency: 2 });
assert.equal(defaultConfig.agents.seekbrain_research_route.thinking, "low");
assert.deepEqual(defaultConfig.modules.targeted_skill.resource_filter, { suffixes: [".md", ".py"], max_files: 5 });
assert.ok(manifest.files.includes("library/skills/trajectory"));

for (const prompt of [
  "entry", "data_resolve", "plan", "code", "validate", "image_refine", "interpret",
  "continue", "deep_research", "research_survey", "save_skill", "report",
]) {
  await readFile(new URL(`prompts/${prompt}.md`, root), "utf8");
}

assert.match(runtimeSource, /const PACKAGE_ROOT =/);
assert.match(runtimeSource, /const PROJECT_ROOT =/);
assert.match(runtimeSource, /config", "default\.yaml/);
assert.match(runtimeSource, /join\(PACKAGE_ROOT, "prompts"\)/);
assert.doesNotMatch(runtimeSource, /extensions\/seekbrain/);
assert.match(entrySource, /"prompts", "entry\.md"/);
assert.doesNotMatch(entrySource, /"extensions", "seekbrain", "prompts"/);
assert.ok(!manifest.files.includes("config.yaml"));
assert.ok(!manifest.files.includes("extensions/seekbrain"));

const projectRoot = await mkdtemp(join(tmpdir(), "seekbrain-phase3-project-"));
try {
  const projectConfig = join(projectRoot, "custom.yaml");
  await writeFile(projectConfig, "workflow:\n  seekbrain:\n    image_refine: false\n");
  const parsed = parseArgs([
    "run", "--query", "question", "--dataset", "{}",
    "--cwd", projectRoot, "--work-dir", "runs/example", "--config", "custom.yaml",
  ]);
  const spec = buildPiLaunchSpec(parsed, { cwd: "/" });
  const paths = resolveRuntimePaths();
  assert.equal(spec.cwd, projectRoot);
  assert.equal(spec.env.SEEKBRAIN_PROJECT_ROOT, projectRoot);
  assert.equal(spec.env.SEEKBRAIN_RUN_ROOT, join(projectRoot, "runs/example"));
  assert.equal(spec.env.SEEKBRAIN_CONFIG, projectConfig);
  assert.equal(paths.entryPrompt, new URL("prompts/entry.md", root).pathname);
  assert.ok(spec.args.includes(paths.entryPrompt));

  const jiti = createJiti(import.meta.url);
  const { ConfigLoader } = await jiti.import("../src/core/index.ts");
  const config = await new ConfigLoader({
    defaultConfigPath: new URL("config/default.yaml", root).pathname,
    projectConfigPath: projectConfig,
    env: {},
  }).load();
  assert.equal(config.workflow.seekbrain.image_refine, false);
  assert.equal(config.agents.seekbrain_validate.vision, true);
  assert.equal(config.agents.seekbrain_validate.provider, undefined);
} finally {
  await rm(projectRoot, { recursive: true, force: true });
}

console.log("Phase 3 package resources and provider-neutral layered configuration are cwd-independent");

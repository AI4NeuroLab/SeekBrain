import { fileURLToPath } from "node:url";
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
assert.equal(defaultConfig.workflow.seekbrain.rag_recipe_crystallization, false);
assert.equal(defaultConfig.workflow.seekbrain.research_planning, true);
assert.equal(defaultConfig.workflow.seekbrain.research_planning_strategy, "standard");
assert.equal(defaultConfig.workflow.seekbrain.research_survey, true);
assert.equal(defaultConfig.workflow.seekbrain.research_planning_peer_review, true);
assert.deepEqual(defaultConfig.workflow.seekbrain.deep_research, { max_rounds: 3 });
assert.equal(defaultConfig.workflow.seekbrain.image_refine, false);
assert.deepEqual(defaultConfig.literature, { providers: {} });
assert.equal(defaultConfig.agents.seekbrain_survey.rag.top_k, 4);
assert.deepEqual(defaultConfig.workflow.seekbrain.research_execution, { planning_concurrency: 3, execution_concurrency: 2 });
assert.deepEqual(Object.fromEntries(Object.entries(defaultConfig.agents).map(([name, agent]) => [name, agent.thinking])), {
  seekbrain: "medium",
  seekbrain_default: "off",
  seekbrain_data_resolve: "low",
  seekbrain_task_brief: "off",
  seekbrain_research_route: "low",
  seekbrain_research_planning: "high",
  seekbrain_survey: "medium",
  seekbrain_research_reviewer: "high",
  seekbrain_skill_match: "low",
  seekbrain_recipe_scout_triage: "low",
  seekbrain_recipe_scout_finalize: "low",
  seekbrain_skill_context: "off",
  seekbrain_skill_generate: "medium",
  seekbrain_skill_revise: "medium",
  seekbrain_plan: "high",
  seekbrain_formulation: "high",
  seekbrain_code: "medium",
  seekbrain_validate: "medium",
  seekbrain_interpret: "high",
  seekbrain_report: "high",
  seekbrain_refine_image: "low",
  seekbrain_save_skill: "off",
});
assert.equal(defaultConfig.agents.seekbrain_interpret.vision, true);
assert.deepEqual(defaultConfig.modules.targeted_skill.resource_filter, { suffixes: [".md", ".py"], max_files: 5 });
assert.equal(defaultConfig.modules.targeted_skill.resolution_mode, "recipe_scout_v2");
assert.deepEqual(defaultConfig.modules.targeted_skill.compatibility.scout, {
  rag_rounds: 2,
  initial_rag_top_k: 8,
  retry_rag_top_k: 4,
  local_top_k: 8,
  repository_inspections: 4,
  initial_inspection_limit: 3,
  inspection_concurrency: 2,
  selected_methods: 2,
});
assert.ok(manifest.files.includes("recipes"));

for (const prompt of [
  "assistant", "research", "data_resolve", "task_brief", "plan", "code", "validate", "image_refine", "interpret",
  "continue", "research_route", "research_survey", "creative_research", "creative_search", "recipe_scout_query", "recipe_scout_triage", "recipe_scout_finalize", "recipe_crystallization", "save_skill", "report",
]) {
  await readFile(new URL(`prompts/${prompt}.md`, root), "utf8");
}

const entryPrompt = await readFile(new URL("prompts/research.md", root), "utf8");
assert.match(entryPrompt, /request that only profiles a dataset/);
assert.match(entryPrompt, /full request/);
assert.match(entryPrompt, /seekbrain_plan_generate/);
assert.match(entryPrompt, /seekbrain_formulation_generate/);
assert.match(entryPrompt, /flexible execution DAG/);
assert.match(entryPrompt, /Partial results are allowed/);
assert.doesNotMatch(entryPrompt, /seekbrain_creative_search|seekbrain_planning_assess|seekbrain_planning_peer_review/);
for (const name of ["scientific_plan", "task_formulation", "study_report"]) await readFile(new URL(`prompts/${name}.md`, root), "utf8");
const routePrompt = await readFile(new URL("prompts/research_route.md", root), "utf8");
assert.match(routePrompt, /Perform only three jobs:/);
assert.match(routePrompt, /Classify the broad execution topology needed before Recipe retrieval/);

assert.match(runtimeSource, /const PACKAGE_ROOT =/);
assert.match(runtimeSource, /const PROJECT_ROOT =/);
assert.match(runtimeSource, /config", "default\.yaml/);
assert.match(runtimeSource, /join\(PACKAGE_ROOT, "prompts"\)/);
assert.doesNotMatch(runtimeSource, /extensions\/seekbrain/);
assert.match(entrySource, /"assistant\.md"/);
assert.match(entrySource, /"research\.md"/);
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
  assert.equal(paths.entryPrompt, undefined);
  assert.ok(!spec.args.includes("--prompt-template"));
  assert.doesNotMatch(spec.args.at(-1), /^\/entry/);

  const jiti = createJiti(import.meta.url);
  const { ConfigLoader } = await jiti.import("../src/core/index.ts");
  const config = await new ConfigLoader({
    defaultConfigPath: fileURLToPath(new URL("config/default.yaml", root)),
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

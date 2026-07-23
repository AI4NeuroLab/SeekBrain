import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createJiti } from "jiti";

const root = new URL("../", import.meta.url);
const extensionSource = await readFile(new URL("src/extension/seekbrain-runtime.ts", root), "utf8");
const workflowSource = await readFile(new URL("src/workflows/seekbrain/research-skill-workflow.ts", root), "utf8");
assert.match(extensionSource, /researchSkillWorkflow\.resolveTargetedSkill/);
assert.match(extensionSource, /researchSkillWorkflow\.deepResearch/);
assert.doesNotMatch(workflowSource, /ExtensionAPI|pi\.registerTool|createAgentSession|spawn\(/);

const cwd = await mkdtemp(join(tmpdir(), "seekbrain-research-tool-contract-"));
const previousRoot = process.env.SEEKBRAIN_ROOT;
const previousUser = process.env.SEEKBRAIN_USER_CONFIG;
const previousNonInteractive = process.env.SEEKBRAIN_NON_INTERACTIVE;
process.env.SEEKBRAIN_ROOT = cwd;
process.env.SEEKBRAIN_USER_CONFIG = join(cwd, "missing-user.yaml");
process.env.SEEKBRAIN_NON_INTERACTIVE = "1";
await writeFile(join(cwd, "seekbrain.config.yaml"), `
literature:
  paper_source: ailab_rag
workflow:
  seekbrain:
    deep_research: false
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
  const ctx = { cwd, hasUI: false };
  const started = await byName.neuro_start_run.execute("start", { work_dir: "run", question: "question" }, undefined, undefined, ctx);
  const skill = await byName.resolve_targeted_skill.execute("skill", { run_id: started.details.run_id }, undefined, undefined, ctx);
  const research = await byName.neuro_deep_research.execute("research", { run_id: started.details.run_id }, undefined, undefined, ctx);
  assert.equal(skill.details.skipped_by_config, true);
  assert.equal(skill.details.config_key, "workflow.seekbrain.targeted_skill_match/targeted_skill_generate");
  assert.equal(research.details.skipped_by_config, true);
  assert.equal(research.details.config_key, "workflow.seekbrain.deep_research");
} finally {
  if (previousRoot === undefined) delete process.env.SEEKBRAIN_ROOT; else process.env.SEEKBRAIN_ROOT = previousRoot;
  if (previousUser === undefined) delete process.env.SEEKBRAIN_USER_CONFIG; else process.env.SEEKBRAIN_USER_CONFIG = previousUser;
  if (previousNonInteractive === undefined) delete process.env.SEEKBRAIN_NON_INTERACTIVE; else process.env.SEEKBRAIN_NON_INTERACTIVE = previousNonInteractive;
  await rm(cwd, { recursive: true, force: true });
}

console.log("Phase 4 research and skill tools execute through injected workflow ports");

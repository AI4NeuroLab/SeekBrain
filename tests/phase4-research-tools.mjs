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
assert.match(recipeResearchSource, /deps\.workflow\.deepResearch/);
assert.doesNotMatch(recipeResearchSource, /ExtensionAPI|pi\.registerTool|createAgentSession|spawn\(/);
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
  const recommended = await byName.seekbrain_research_start.execute("recommended", {
    project_dir: "recommended-project",
    question: "Integrate structural, functional, and molecular evidence.",
    planning_assessment: {
      route: "research_planning",
      reason: "The conclusion requires multiple evidence workstreams.",
      evidence_dimensions: ["structure", "function", "molecular evidence"],
    },
  }, undefined, undefined, ctx);
  assert.equal(recommended.details.research_route.assessment_source, "orchestrator");
  assert.equal(recommended.details.research_route.needs_user_review, true);
  assert.equal(recommended.details.research_route.next_tool, "seekbrain_planning_decision_review");
  const textFallback = await byName.seekbrain_planning_decision_review.execute(
    "review-unavailable",
    { run_id: recommended.details.run_id },
    undefined,
    undefined,
    ctx,
  );
  assert.equal(textFallback.details.needs_text_review, true);
  const recorded = await byName.seekbrain_planning_decision_record.execute(
    "record-text-decision",
    { run_id: recommended.details.run_id, decision: "yes", response_quote: "Yes" },
    undefined,
    undefined,
    ctx,
  );
  assert.equal(recorded.details.decision_source, "chat_response");
  assert.equal(recorded.details.next_tool, "seekbrain_planning_generate");

  const explicitQuestion = "Use Research Planning for this study.";
  const explicitlyRequested = await byName.seekbrain_research_start.execute("explicit", {
    project_dir: "explicit-project",
    question: explicitQuestion,
    planning_assessment: {
      route: "research_planning",
      reason: "The user explicitly selected Research Planning.",
      explicit_request_quote: explicitQuestion,
    },
  }, undefined, undefined, ctx);
  assert.equal(explicitlyRequested.details.research_route.planning_consent, "explicit_request");
  assert.equal(explicitlyRequested.details.research_route.needs_user_review, false);
  assert.equal(explicitlyRequested.details.research_route.next_tool, "seekbrain_planning_generate");

  const started = await byName.seekbrain_run_start.execute("start", { work_dir: "run", question: "question" }, undefined, undefined, ctx);
  const skill = await byName.seekbrain_recipe_retrieve.execute("skill", { run_id: started.details.run_id }, undefined, undefined, ctx);
  const research = await byName.seekbrain_deep_research.execute("research", { run_id: started.details.run_id }, undefined, undefined, ctx);
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

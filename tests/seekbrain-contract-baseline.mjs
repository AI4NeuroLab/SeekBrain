import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createJiti } from "jiti";

const EXPECTED_SCHEMA_HASHES = {
  seekbrain_system_check: "8243f0af367f188a376f2c17b5eabe872a2f7a979813e0d4e2be6d594c2aa259",
  seekbrain_system_capabilities: "8243f0af367f188a376f2c17b5eabe872a2f7a979813e0d4e2be6d594c2aa259",
  seekbrain_data_resolve: "4b148b74ebc53454bccdb2ca1e1e75eb4d046d2a519bb7ced098d9a49848631f",
  seekbrain_research_start: "2a8157d0a0b4155a61127f11744c2b8003a440c21c9b889e71f8dd216c50b96d",
  seekbrain_planning_assess: "afd3a292fc817b271f51cb589f13461527bf4fc25b64e2c276e77474e65f4e9c",
  seekbrain_planning_decision_review: "276339c0ea2a06acbf6f602a1fd0ac3fe470739ee6a84639847ccdde1c775cc8",
  seekbrain_planning_decision_record: "2c7e1690b0e3b7a529dd84d751da8709ca9751a11224508cabd2c6ad6a1bcfcd",
  seekbrain_planning_generate: "b914c8c9ed5c6a0d97a8fbd6eb363515fdc44d2d80a331b3fc2a4a6d35525c1b",
  seekbrain_planning_peer_review: "93486fac52072bcc546ae649ed5fd3c2662626f9e82abde7228c0742a813762e",
  seekbrain_planning_researcher_review: "aa55b48707d44cf0ada7d79c0dbdd7e7e27632b0a18e1e0132b17f4e62738c37",
  seekbrain_planning_researcher_decision_record: "7c9ea0114a909c508911f7d323fdece45f5aff4df32a6fde226cb164817730e0",
  seekbrain_analysis_tasks_prepare: "aa55b48707d44cf0ada7d79c0dbdd7e7e27632b0a18e1e0132b17f4e62738c37",
  seekbrain_execution_initialize: "aa55b48707d44cf0ada7d79c0dbdd7e7e27632b0a18e1e0132b17f4e62738c37",
  seekbrain_execution_run: "aa55b48707d44cf0ada7d79c0dbdd7e7e27632b0a18e1e0132b17f4e62738c37",
  seekbrain_execution_schema_review: "0d573cfed6509d3aa150cdb64b91a468659c65234f2145d79e2a5a462beb3f52",
  seekbrain_report_evidence_compile: "e98ad6ca0ce9ff57c809b7d233f51c88d88f6c07766a82a5d3c66973845abfe4",
  seekbrain_execution_tasks_run: "aa55b48707d44cf0ada7d79c0dbdd7e7e27632b0a18e1e0132b17f4e62738c37",
  seekbrain_report_generate: "e98ad6ca0ce9ff57c809b7d233f51c88d88f6c07766a82a5d3c66973845abfe4",
  seekbrain_analysis_task_control: "1046291c26c96f4dfdeb4f4d0e3ca694afc89129a6897d5ebb660f188db29ed3",
  seekbrain_research_continue: "c5fde1c0149315ebea85f8d524ba8563c50ff7e973aae6a9f4538ef34149d16e",
  seekbrain_run_start: "f33303e76c37179f34c96ec1815c49d09ab6a149aaa59a4780ec2112f5a93389",
  seekbrain_run_resume: "367d375250947fd597e4b50d7acb0bf0309364f6bd3e4ebc7456633d9c643dc2",
  seekbrain_review_approve: "c88ce1a7202d52053ef3da8dc6286285cca45c0de16f0000f437333116b6570c",
  seekbrain_review_feedback: "056e5a038a9125c0ad4990f1398f19112d4f16783bbd39ed237c1bc232e166b3",
  seekbrain_formulation_researcher_review: "276339c0ea2a06acbf6f602a1fd0ac3fe470739ee6a84639847ccdde1c775cc8",
  seekbrain_formulation_update: "f8598d09eb7efcc85e47b49bc11f7f2d7d70583d1286dc6c84d460398610a149",
  seekbrain_code_edit_review: "9d6437c746b62174cbba9f331861d23fb3da890af038b7f35f51175efd3501fd",
  seekbrain_code_update_propose: "84e67e40b9fad787fc52d8b256eb442bbad0b6e4e82bc9a8275d2be17964ca14",
  seekbrain_code_update_review: "be49a3ea4af1c879f2c9409015f35ec32d5aaa9a5261ec403c60ba74b2df548e",
  seekbrain_recipe_retrieve: "a44f5fe493988f67a92ce2e201764f50d1bda2bb931378ac552aaa62ad1650ae",
  seekbrain_deep_research: "220d14e343f883a3f2e780301e47a8ef1a4d81adcaac886cdcb7f4557aac0427",
  seekbrain_formulation_generate: "736389135757da5df9ffcf6afcb080c3c60773a5c777e88cf8f5733f2397e3b8",
  seekbrain_code_execute: "bad5d545aa22098f0f875e229e5dd1f397709059206321d504a5732855103de9",
  seekbrain_validation_run: "aec6973410f040ea623301850d157ec1b38efa7b2a54d31f84ab3ee62ce76182",
  seekbrain_figure_refine: "b36310d5d7acc43fd0d0376eca27cb6c1bacb6bb76d032baf59420c3f952646e",
  seekbrain_interpretation_run: "218367983a54d6760e7badf0cf45f83f67ea60b4fbabeb9dbb62f9e591bec2e1",
};

const withoutDescriptions = (value) => Array.isArray(value)
  ? value.map(withoutDescriptions)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.entries(value)
      .filter(([key]) => key !== "description")
      .map(([key, child]) => [key, withoutDescriptions(child)]))
    : value;

const schemaHash = (schema) => createHash("sha256")
  .update(JSON.stringify(withoutDescriptions(schema)))
  .digest("hex");

const jiti = createJiti(import.meta.url);
const { default: registerLevel1 } = await jiti.import("../src/extension/index.ts");
const tools = [];
const pi = {
  on() {},
  registerCommand() {},
  registerTool(tool) { tools.push(tool); },
  async appendEntry() {},
  sendMessage() {},
};

await registerLevel1(pi);

assert.deepEqual(
  tools.map((tool) => tool.name),
  Object.keys(EXPECTED_SCHEMA_HASHES),
  "SeekBrain tool names or registration order changed",
);
assert.deepEqual(
  Object.fromEntries(tools.map((tool) => [tool.name, schemaHash(tool.parameters)])),
  EXPECTED_SCHEMA_HASHES,
  "SeekBrain tool parameter schema changed",
);

const workRoot = await mkdtemp(join(tmpdir(), "seekbrain-contract-"));
const priorNonInteractive = process.env.SEEKBRAIN_NON_INTERACTIVE;
process.env.SEEKBRAIN_NON_INTERACTIVE = "1";

try {
  const startRun = tools.find((tool) => tool.name === "seekbrain_run_start");
  assert.ok(startRun, "seekbrain_run_start must remain registered");

  const result = await startRun.execute(
    "contract-start-run",
    { work_dir: "run", question: "Characterization baseline question" },
    new AbortController().signal,
    () => {},
    { cwd: workRoot, hasUI: false },
  );
  assert.equal(result.details.ok, true);

  const runDir = join(workRoot, "run");
  const state = JSON.parse(await readFile(join(runDir, "state.json"), "utf8"));
  assert.deepEqual(Object.keys(state).sort(), [
    "artifacts",
    "created_at",
    "deliverables",
    "question",
    "run_dir",
    "run_id",
    "schema_version",
  ]);
  assert.equal(state.schema_version, 2);
  assert.equal(state.run_dir, runDir);
  assert.equal(state.question, "Characterization baseline question");
  assert.deepEqual(state.artifacts, []);
  assert.deepEqual(state.deliverables, [
    { path: "generated_code.py", kind: "code" },
    { path: "figure.png", kind: "figure", role: "main" },
    { path: "figure.pdf", kind: "figure", role: "main_pdf", optional: true },
    { path: "statistics.json", kind: "statistics" },
  ]);
  assert.equal((await stat(join(runDir, "subagents"))).isDirectory(), true);

  const runIndex = JSON.parse(await readFile(
    join(workRoot, ".pi/seekbrain/run_index.json"),
    "utf8",
  ));
  assert.deepEqual(Object.keys(runIndex.runs), [state.run_id]);
  assert.equal(runIndex.runs[state.run_id].run_dir, runDir);
} finally {
  if (priorNonInteractive === undefined) {
    delete process.env.SEEKBRAIN_NON_INTERACTIVE;
  } else {
    process.env.SEEKBRAIN_NON_INTERACTIVE = priorNonInteractive;
  }
  await rm(workRoot, { recursive: true, force: true });
}

console.log("SeekBrain tool schemas, initial state, deliverables, and run layout match the baseline");

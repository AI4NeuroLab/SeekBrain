import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createJiti } from "jiti";

const EXPECTED_SCHEMA_HASHES = {
  seekbrain_system_check: "8243f0af367f188a376f2c17b5eabe872a2f7a979813e0d4e2be6d594c2aa259",
  seekbrain_system_capabilities: "8243f0af367f188a376f2c17b5eabe872a2f7a979813e0d4e2be6d594c2aa259",
  seekbrain_data_resolve: "1865ef6f7d7def34ceff50fd2e007c98b0600420f6505d17e4ede0cc3301b96b",
  seekbrain_research_start: "2a8157d0a0b4155a61127f11744c2b8003a440c21c9b889e71f8dd216c50b96d",
  seekbrain_planning_assess: "afd3a292fc817b271f51cb589f13461527bf4fc25b64e2c276e77474e65f4e9c",
  seekbrain_planning_decision_review: "276339c0ea2a06acbf6f602a1fd0ac3fe470739ee6a84639847ccdde1c775cc8",
  seekbrain_planning_decision_record: "685baa078a3be61b179315b29218e44dd5e7c0965467c35e5344477559231622",
  seekbrain_planning_generate: "b914c8c9ed5c6a0d97a8fbd6eb363515fdc44d2d80a331b3fc2a4a6d35525c1b",
  seekbrain_planning_peer_review: "93486fac52072bcc546ae649ed5fd3c2662626f9e82abde7228c0742a813762e",
  seekbrain_planning_researcher_review: "aa55b48707d44cf0ada7d79c0dbdd7e7e27632b0a18e1e0132b17f4e62738c37",
  seekbrain_planning_researcher_decision_record: "8d082cf6fe0d94eacb26f9b8f9fe6c4fc706374f4c18fd0a23394d654c865e66",
  seekbrain_analysis_tasks_prepare: "aa55b48707d44cf0ada7d79c0dbdd7e7e27632b0a18e1e0132b17f4e62738c37",
  seekbrain_research_extend: "87097580b7d7f8697d0f4292f41816250a3969f1e480959d5167cf035540b8e5",
  seekbrain_execution_initialize: "aa55b48707d44cf0ada7d79c0dbdd7e7e27632b0a18e1e0132b17f4e62738c37",
  seekbrain_execution_run: "aa55b48707d44cf0ada7d79c0dbdd7e7e27632b0a18e1e0132b17f4e62738c37",
  seekbrain_execution_schema_review: "cb6eb7282633d033e7ec1c4dc3e696dfc2fdb9f0fa7663f0209171879b00e901",
  seekbrain_report_evidence_compile: "b640af2fb50c1a141de92b319f1008957ad94391308a489c8da6c37f1d86b2d6",
  seekbrain_execution_tasks_run: "aa55b48707d44cf0ada7d79c0dbdd7e7e27632b0a18e1e0132b17f4e62738c37",
  seekbrain_report_generate: "b640af2fb50c1a141de92b319f1008957ad94391308a489c8da6c37f1d86b2d6",
  seekbrain_analysis_task_control: "1046291c26c96f4dfdeb4f4d0e3ca694afc89129a6897d5ebb660f188db29ed3",
  seekbrain_research_continue: "c5fde1c0149315ebea85f8d524ba8563c50ff7e973aae6a9f4538ef34149d16e",
  seekbrain_run_start: "f33303e76c37179f34c96ec1815c49d09ab6a149aaa59a4780ec2112f5a93389",
  seekbrain_run_resume: "367d375250947fd597e4b50d7acb0bf0309364f6bd3e4ebc7456633d9c643dc2",
  seekbrain_review_approve: "c88ce1a7202d52053ef3da8dc6286285cca45c0de16f0000f437333116b6570c",
  seekbrain_review_feedback: "056e5a038a9125c0ad4990f1398f19112d4f16783bbd39ed237c1bc232e166b3",
  seekbrain_formulation_researcher_review: "276339c0ea2a06acbf6f602a1fd0ac3fe470739ee6a84639847ccdde1c775cc8",
  seekbrain_formulation_update: "ad71e19e2bfd3a983c2be753c14b1f20cc9158e853cda8c48dc9696a4f3daf7c",
  seekbrain_code_edit_review: "9d6437c746b62174cbba9f331861d23fb3da890af038b7f35f51175efd3501fd",
  seekbrain_code_update_propose: "84e67e40b9fad787fc52d8b256eb442bbad0b6e4e82bc9a8275d2be17964ca14",
  seekbrain_code_update_review: "be49a3ea4af1c879f2c9409015f35ec32d5aaa9a5261ec403c60ba74b2df548e",
  seekbrain_recipe_retrieve: "4d221bf065be8f07bba7c30947356ce900725203fd1ed7cf7a8e4f0f53a4b84d",
  seekbrain_deep_research: "220d14e343f883a3f2e780301e47a8ef1a4d81adcaac886cdcb7f4557aac0427",
  seekbrain_formulation_generate: "aa55b48707d44cf0ada7d79c0dbdd7e7e27632b0a18e1e0132b17f4e62738c37",
  seekbrain_code_execute: "182e2e1218489f4a0a33471937c0ff2180c1a177504bccd2d9b278c18c7a96a2",
  seekbrain_validation_run: "aa55b48707d44cf0ada7d79c0dbdd7e7e27632b0a18e1e0132b17f4e62738c37",
  seekbrain_figure_refine: "b36310d5d7acc43fd0d0376eca27cb6c1bacb6bb76d032baf59420c3f952646e",
  seekbrain_interpretation_run: "aa55b48707d44cf0ada7d79c0dbdd7e7e27632b0a18e1e0132b17f4e62738c37",
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

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createJiti } from "jiti";

const cwd = await mkdtemp(join(tmpdir(), "seekbrain014-lifecycle-"));
const prior = { user: process.env.SEEKBRAIN_USER_CONFIG, project: process.env.SEEKBRAIN_CONFIG };
process.env.SEEKBRAIN_USER_CONFIG = join(cwd, "missing-user.yaml");
process.env.SEEKBRAIN_CONFIG = join(cwd, "missing-project.yaml");
try {
  const jiti = createJiti(import.meta.url);
  const { default: register } = await jiti.import("../src/extension/index.ts");
  const tools = [];
  await register({ on() {}, registerCommand() {}, registerTool(t) { tools.push(t); }, async appendEntry() {}, sendMessage() {} });
  const byName = Object.fromEntries(tools.map(t => [t.name, t]));
  assert.equal(byName.seekbrain_creative_search, undefined);
  assert.equal(byName.seekbrain_planning_peer_review, undefined);
  const ctx = { cwd, hasUI: false, sessionManager: { getBranch: () => [{ type: "message", id: "request", message: { role: "user", content: request } }] } };
  const request = "Analyze all donors. Relevant materials: ./Notes. Main text contains no headings.";
  const first = await byName.seekbrain_research_start.execute("start", { project_dir: "study", reference_paths: ["./Notes"] }, undefined, undefined, ctx);
  assert.equal(first.details.next_tool, "seekbrain_plan_generate");
  const state = JSON.parse(await readFile(first.details.state_path, "utf8"));
  assert.equal(state.flow_version, "0.1.4"); assert.equal(state.original_request, request);
  assert.deepEqual(state.reference_paths, [join(cwd, "Notes")]);
  assert.equal(state.execution_contract, undefined); assert.equal(state.task_brief, undefined);
  const resumed = await byName.seekbrain_run_resume.execute("resume", { project_path: "study" }, undefined, undefined, ctx);
  assert.equal(resumed.details.run_id, first.details.run_id); assert.equal(resumed.details.next_tool, "seekbrain_plan_generate");
  const duplicate = await byName.seekbrain_research_start.execute("duplicate", { project_dir: "study" }, undefined, undefined, ctx);
  assert.equal(duplicate.details.run_id, first.details.run_id);
  assert.equal(duplicate.details.reused, true);
  const ping = await byName.seekbrain_system_check.execute("ping", {}, undefined, undefined, ctx);
  assert.equal(ping.details.run_count, 1);
} finally {
  if (prior.user === undefined) delete process.env.SEEKBRAIN_USER_CONFIG; else process.env.SEEKBRAIN_USER_CONFIG = prior.user;
  if (prior.project === undefined) delete process.env.SEEKBRAIN_CONFIG; else process.env.SEEKBRAIN_CONFIG = prior.project;
  await rm(cwd, { recursive: true, force: true });
}
console.log("Unified lifecycle preserves raw requests and resumes parent studies without routing or reviews");

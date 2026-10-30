import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { default: register } = await jiti.import("../src/extension/index.ts");
const tools = [];
await register({ on() {}, registerCommand() {}, registerTool(t) { tools.push(t); }, async appendEntry() {}, sendMessage() {} });
assert.deepEqual(tools.map(t => t.name), [
  "web_search", "fetch_content", "get_search_content",
  "seekbrain_literature_search", "seekbrain_paper_read", "seekbrain_system_check", "seekbrain_data_resolve", "seekbrain_research_start", "seekbrain_plan_generate",
  "seekbrain_formulation_generate", "seekbrain_execution_run", "seekbrain_report_evidence_compile", "seekbrain_report_generate", "seekbrain_research_decide", "seekbrain_run_resume",
]);
const byName = Object.fromEntries(tools.map(t => [t.name, t]));
assert.equal(byName.seekbrain_research_start.parameters.properties.question, undefined);
assert.deepEqual(Object.keys(byName.seekbrain_plan_generate.parameters.properties), ["run_id", "project_path", "action", "output_paths", "source_paths"]);
assert.equal(byName.seekbrain_execution_run.parameters.properties.concurrency.minimum, 1);
assert.equal(byName.seekbrain_execution_run.parameters.properties.concurrency.maximum, 16);
assert.deepEqual(Object.keys(byName.seekbrain_report_generate.parameters.properties), ["run_id", "project_path", "report_goal", "report_format", "report_path", "pdf_path", "output_formats"]);
assert.equal(byName.seekbrain_report_generate.parameters.properties.report_format.properties.max_display_items.minimum, 0);
const cwd = await mkdtemp(join(tmpdir(), "seekbrain014-contract-"));
try {
  const request = "Full original request with a local dataset, optional references and custom report requirements.";
  const ctx = { cwd, hasUI: false, sessionManager: { getBranch: () => [{ type: "message", id: "request", message: { role: "user", content: request } }] } };
  const result = await byName.seekbrain_research_start.execute("start", { project_dir: "study" }, undefined, undefined, ctx);
  assert.equal(result.details.ok, true);
  const state = JSON.parse(await readFile(result.details.state_path, "utf8"));
  assert.equal(state.original_request, request);
  assert.equal(state.project_dir, undefined, "persisted state must not pin the project to an absolute output root");
  assert.equal(state.flow_version, "0.1.4"); assert.deepEqual(state.reference_paths, []);
  assert.equal(state.research_planning, undefined); assert.equal(state.task_brief, undefined);
  const resumed = await byName.seekbrain_run_resume.execute("resume", { project_path: join(cwd, "study") }, undefined, undefined, { cwd, hasUI: false });
  assert.equal(resumed.details.run_id, result.details.run_id);
} finally { await rm(cwd, { recursive: true, force: true }); }
console.log("seekbrain-014 public workflow contract and raw-request persistence verified");

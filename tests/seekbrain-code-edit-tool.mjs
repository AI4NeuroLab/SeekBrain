import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { default: registerLevel1 } = await jiti.import("../src/extension/index.ts");

const tools = new Map();
const pi = {
  on() {},
  registerCommand() {},
  registerTool(tool) { tools.set(tool.name, tool); },
  async appendEntry() {},
  sendMessage() {},
};
await registerLevel1(pi);

const tool = tools.get("seekbrain_code_edit_review");
assert.ok(tool, "seekbrain_code_edit_review must be registered");

const root = await mkdtemp(join(tmpdir(), "seekbrain-code-edit-"));
try {
  const runId = "test-code-edit-run";
  const runDir = join(root, "run");
  const codePath = join(runDir, "generated_code.py");
  const figurePath = join(runDir, "figure.png");
  await mkdir(join(root, ".pi", "seekbrain"), { recursive: true });
  await mkdir(runDir, { recursive: true });
  await writeFile(codePath, 'from pathlib import Path\nPath("figure.png").write_text("red")\n', "utf8");
  await writeFile(figurePath, "old", "utf8");
  await writeFile(join(runDir, "state.json"), JSON.stringify({
    run_id: runId,
    artifacts: [
      { name: "generated_code", path: codePath, kind: "code" },
      { name: "figure", path: figurePath, kind: "figure", produced_by: codePath },
    ],
  }), "utf8");
  await writeFile(
    join(root, ".pi", "seekbrain", "run_index.json"),
    JSON.stringify({ runs: { [runId]: { run_dir: runDir } } }),
    "utf8",
  );

  const updates = [];
  const result = await tool.execute(
    "test-call",
    {
      run_id: runId,
      code_path: codePath,
      edits: [{ find: 'write_text("red")', replace: 'write_text("blue")', expected_matches: 1 }],
      summary: "Change the test figure from red to blue.",
      change_scope: "presentation",
      rerun: true,
    },
    new AbortController().signal,
    (update) => updates.push(update),
    {
      cwd: root,
      ui: {
        async select() { return "Yes, apply and regenerate"; },
        async input() { return ""; },
      },
    },
  );

  assert.equal(result.details.ok, true);
  assert.equal(result.details.status, "verified");
  assert.match(await readFile(codePath, "utf8"), /write_text\("blue"\)/);
  assert.equal(await readFile(figurePath, "utf8"), "blue");
  assert.equal(updates[0].details.diffRenderer.ok, true, "diff renderer should be preloaded before review");
  assert.equal(updates[0].details.diff.added, 1);
  assert.equal(updates[0].details.diff.removed, 1);

  const state = JSON.parse(await readFile(join(runDir, "state.json"), "utf8"));
  const edit = state.pending_code_edits.at(-1);
  assert.equal(edit.status, "verified");
  assert.equal(state.validation_invalidations.scientific, false);
  assert.equal(state.visual_validation_invalidated_by_code_edit, true);
  assert.ok(await readFile(edit.diff_path, "utf8"));
  assert.ok(await readFile(edit.before_path, "utf8"));
  const execution = JSON.parse(await readFile(edit.execution_path, "utf8"));
  assert.equal(execution.verified, true);
  assert.equal(execution.exit_code, 0);
} finally {
  await rm(root, { recursive: true, force: true });
}

console.log("seekbrain one-call code edit tool scenario passed");

import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { helpText, main, PACKAGE_ROOT, parseArgs, VERSION } from "../src/cli/cli.mjs";

const root = new URL("../", import.meta.url);
const expectedHelp = await readFile(new URL("fixtures/seekbrain-help.txt", import.meta.url), "utf8");
const manifest = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
const migration = JSON.parse(await readFile(new URL("docs/architecture/package-migration-manifest.json", root), "utf8"));
const binSource = await readFile(new URL("bin/seekbrain.mjs", root), "utf8");

assert.equal(PACKAGE_ROOT, root.pathname.replace(/\/$/, ""));
assert.equal(VERSION, manifest.version);
assert.equal(helpText(), expectedHelp);
assert.deepEqual(parseArgs(["-h"]), { action: "help" });
assert.deepEqual(parseArgs(["--help"]), { action: "help" });
assert.deepEqual(parseArgs(["setup"]), { action: "setup" });
assert.equal(parseArgs(["setup", "--unknown"]).action, "error");
assert.deepEqual(parseArgs(["run", "--query", "question", "--dataset", "data", "--work-dir", "out"]), {
  action: "launch",
  nonInteractive: true,
  options: { piArgs: [], query: "question", dataset: "data", workDir: "out" },
});
const reportArgs = parseArgs(["report", "results/project", "--rounds", "3,4,6", "--evidence", "SQ1-T1:R2", "--goal", "Synthesize selected findings"]);
assert.equal(reportArgs.action, "launch");
assert.equal(reportArgs.nonInteractive, true);
assert.equal(reportArgs.options.reportMode, true);
assert.equal(reportArgs.options.reportProject, "results/project");
assert.deepEqual(reportArgs.options.reportSelections, ["ROUND:3", "ROUND:4", "ROUND:6", "SQ1-T1:R2"]);
assert.match(reportArgs.options.query, /Call neuro_generate_report exactly once/);
assert.equal(parseArgs(["report", "results/project"]).action, "error");
assert.equal(manifest.bin.seekbrain, "./bin/seekbrain.mjs");
assert.ok(manifest.files.includes("bin"));
assert.match(binSource, /^#!\/usr\/bin\/env node/);
assert.equal(migration.targetVersion, "0.2.0");
for (const path of ["internagent", "cases", "images", "question"]) {
  assert.ok(
    migration.entries.some((entry) => entry.path === path && entry.action === "delete"),
    `${path} must have an explicit deletion decision`,
  );
}
for (const [path, target] of [
  ["packages/core/src", "src/core"],
  ["packages/workflows/src", "src/workflows"],
  ["packages/pi-extension/src", "src/extension"],
]) {
  assert.ok(
    migration.entries.some((entry) => entry.path === path && entry.action === "migrate" && entry.target === target),
    `${path} must have a migration target`,
  );
}

function capture() {
  let stdout = "";
  let stderr = "";
  return {
    io: {
      stdout: { write(value) { stdout += value; } },
      stderr: { write(value) { stderr += value; } },
    },
    result: () => ({ stdout, stderr }),
  };
}

const workDir = await mkdtemp(join(tmpdir(), "seekbrain-cli-help-"));
const previousCwd = process.cwd();
try {
  process.chdir(workDir);
  const shortHelp = capture();
  const longHelp = capture();
  assert.equal(await main(["-h"], shortHelp.io), 0);
  assert.equal(await main(["--help"], longHelp.io), 0);
  assert.deepEqual(shortHelp.result(), { stdout: expectedHelp, stderr: "" });
  assert.deepEqual(longHelp.result(), shortHelp.result());
  assert.deepEqual(await readdir(workDir), [], "help must not write into the current directory");

  const version = capture();
  assert.equal(await main(["--version"], version.io), 0);
  assert.deepEqual(version.result(), { stdout: `${manifest.version}\n`, stderr: "" });
  assert.deepEqual(await readdir(workDir), [], "version must not write into the current directory");
} finally {
  process.chdir(previousCwd);
  await rm(workDir, { recursive: true, force: true });
}

console.log("Phase 0 SeekBrain package CLI freezes help, version, bin, and no-side-effect contracts");

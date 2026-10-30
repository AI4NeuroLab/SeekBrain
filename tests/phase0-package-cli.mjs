import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { helpText, main, PACKAGE_ROOT, parseArgs, VERSION } from "../src/cli/cli.mjs";

const root = new URL("../", import.meta.url);
const expectedHelp = await readFile(new URL("fixtures/seekbrain-help.txt", import.meta.url), "utf8");
const manifest = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
const binSource = await readFile(new URL("bin/seekbrain.mjs", root), "utf8");

assert.equal(PACKAGE_ROOT, fileURLToPath(new URL(".", root)).replace(/[\\/]$/, ""));
assert.equal(VERSION, manifest.version);
assert.equal(helpText(), expectedHelp);
assert.deepEqual(parseArgs(["-h"]), { action: "help" });
assert.deepEqual(parseArgs(["--help"]), { action: "help" });
assert.deepEqual(parseArgs(["setup"]), { action: "setup" });
assert.deepEqual(parseArgs(["resume", "session-123"]), {
  action: "launch",
  nonInteractive: false,
  options: { piArgs: ["--session", "session-123"] },
});
assert.deepEqual(parseArgs(["--session", "session-123"]), {
  action: "launch",
  nonInteractive: false,
  options: { piArgs: ["--session", "session-123"] },
});
assert.equal(parseArgs(["resume"]).action, "error");
assert.equal(parseArgs(["setup", "--unknown"]).action, "error");
assert.deepEqual(parseArgs(["run", "--query", "question", "--dataset", "data", "--work-dir", "out"]), {
  action: "launch",
  nonInteractive: true,
  options: { piArgs: [], query: "question", dataset: "data", workDir: "out" },
});
const reportArgs = parseArgs(["report", "results/project", "--goal", "Synthesize the complete Research Planning tree"]);
assert.equal(reportArgs.action, "launch");
assert.equal(reportArgs.nonInteractive, true);
assert.equal(reportArgs.options.reportMode, true);
assert.equal(reportArgs.options.reportProject, "results/project");
assert.equal(reportArgs.options.reportSelections, undefined);
assert.match(reportArgs.options.query, /Call seekbrain_report_generate exactly once/);
assert.equal(parseArgs(["report", "results/project"]).action, "launch");
assert.equal(manifest.bin.seekbrain, "./bin/seekbrain.mjs");
assert.equal(manifest.bin["seekbrain-pdf"], "./bin/seekbrain-pdf.mjs");
assert.deepEqual(manifest.piConfig, { name: "seekbrain", configDir: ".pi" });
assert.ok(manifest.files.includes("bin"));
assert.match(binSource, /^#!\/usr\/bin\/env node/);
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

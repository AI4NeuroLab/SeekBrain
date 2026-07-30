import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";

const root = process.cwd();
for (const removedPath of ["internagent", "packages", "extensions", "deprecated", "cases", "images", "question", "custom", "specs"]) {
  await assert.rejects(
    access(join(root, removedPath)),
    (error) => error?.code === "ENOENT",
    `${removedPath} must not return to the standalone package repository`,
  );
}
const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
assert.equal(manifest.workspaces, undefined);
assert.doesNotMatch(JSON.stringify(manifest.files), /extensions|packages|deprecated/);
console.log("Phase 5 removed historical sources, experiments, and evaluation data");

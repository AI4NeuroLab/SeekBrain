import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const manifest = JSON.parse(await readFile(new URL("package.json", root), "utf8"));

assert.equal(manifest.private, undefined, "the root package must be publishable");
assert.equal(manifest.workspaces, undefined, "the release must not depend on npm workspaces");
assert.equal(manifest.bin?.seekbrain, "./bin/seekbrain.mjs");
assert.deepEqual(manifest.pi?.extensions, ["./src/extension/index.ts"]);

for (const path of ["bin", "src", "prompts", "config", "README.md", "LICENSE", "NOTICE", "THIRD_PARTY_NOTICES.md"]) {
  assert.ok(manifest.files.includes(path), `package files must include ${path}`);
}
assert.ok(!manifest.files.includes("packages"), "legacy workspaces must not enter the tarball");
for (const dependency of [
  "@earendil-works/pi-coding-agent",
  "@earendil-works/pi-tui",
  "typebox",
  "yaml",
  "diff",
]) {
  assert.ok(manifest.dependencies[dependency], `${dependency} must be an explicit runtime dependency`);
}

for (const path of [
  "src/cli/cli.mjs",
  "src/core/index.ts",
  "src/workflows/index.ts",
  "src/extension/index.ts",
  "prompts/README.md",
  "config/README.md",
]) {
  await access(new URL(path, root));
}

const bin = await readFile(new URL("bin/seekbrain.mjs", root), "utf8");
const runtime = [
  await readFile(new URL("src/extension/runtime/index.ts", root), "utf8"),
  await readFile(new URL("src/extension/runtime/create-runtime-services.ts", root), "utf8"),
].join("\n");
const workflow = await readFile(new URL("src/workflows/seekbrain/run-lifecycle.ts", root), "utf8");
assert.match(bin, /\.\.\/src\/cli\/cli\.mjs/);
assert.match(runtime, /from "\.\.\/\.\.\/core\/index\.ts"/);
assert.match(runtime, /from "\.\.\/\.\.\/workflows\/index\.ts"/);
assert.doesNotMatch(runtime, /@seekbrain\//);
assert.doesNotMatch(workflow, /@seekbrain\//);

console.log("Phase 1 uses one publishable package with src-owned core, workflows, extension, and CLI");

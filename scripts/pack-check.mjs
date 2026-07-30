import assert from "node:assert/strict";
import process from "node:process";

let input = "";
for await (const chunk of process.stdin) input += chunk;
const [manifest] = JSON.parse(input);
const paths = manifest.files.map((entry) => entry.path);
const required = [
  "bin/seekbrain.mjs",
  "assets/readme/zebrafish-sc-modules-original.png",
  "assets/readme/zebrafish-sc-modules-seekbrain.png",
  "config/README.md",
  "config/default.yaml",
  "examples/zebrafish-sc-network-modules/README.md",
  "examples/zebrafish-sc-network-modules/question.txt",
  "examples/zebrafish-sc-network-modules/dataset/README.md",
  "examples/zebrafish-sc-network-modules/dataset/LICENSE_DATA.md",
  "examples/zebrafish-sc-network-modules/dataset/Files/SC_matrix_directed_terminals_expanded.npy",
  "examples/zebrafish-sc-network-modules/dataset/excluded_regions.npy",
  "LICENSE",
  "recipes/INDEX.md",
  "recipes/Single-modality/Dynamics Modality/ns_ana-zebrafish-ca-pearson-fc_matrix/SKILL.md",
  "NOTICE",
  "README.md",
  "prompts/README.md",
  "prompts/entry.md",
  "prompts/plan.md",
  "scripts/build-recipe-index.mjs",
  "src/cli/cli.mjs",
  "src/core/index.ts",
  "src/extension/index.ts",
  "src/extension/tui/usage-footer.ts",
  "src/workflows/index.ts",
];
const forbiddenFiles = [
  "config.yaml",
  "internagent/workflow/seekbrain.sh",
  "pi_run_seekbrain.sh",
  "scripts/seekbrain-config.mjs",
];
const forbiddenPrefixes = [
  ".git/",
  ".pi/",
  "deprecated/",
  "node_modules/",
  "packages/",
  "extensions/seekbrain/",
  "internagent/",
  "library/",
  "results/",
  "tests/",
];

for (const path of required) assert(paths.includes(path), `pack is missing required file: ${path}`);
for (const path of paths) {
  assert(!forbiddenFiles.includes(path), `pack contains obsolete launcher: ${path}`);
  assert(path !== ".env" && !path.startsWith(".env."), `pack contains env file: ${path}`);
  assert(
    !forbiddenPrefixes.some((prefix) => path === prefix || path.startsWith(prefix)),
    `pack contains forbidden path: ${path}`,
  );
  assert(!/^recipes\/.+\/code\//.test(path), `recipe contains obsolete code/ resource directory: ${path}`);
  assert(!path.endsWith("/RECIPE.md"), `recipe package contains obsolete RECIPE.md: ${path}`);
  assert(!path.endsWith("/.DS_Store"), `recipe package contains .DS_Store: ${path}`);
}

const skillDocuments = paths.filter((path) => path.startsWith("recipes/") && path.endsWith("/SKILL.md"));
assert.equal(skillDocuments.length, 68, `pack must contain exactly 68 Recipe SKILL.md files, found ${skillDocuments.length}`);

console.log(`Pack manifest passed: ${manifest.entryCount} files, ${manifest.size} bytes compressed.`);

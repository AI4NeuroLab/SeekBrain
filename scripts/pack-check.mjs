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
  "assets/readme/zebrafish-sc-atlas-original.png",
  "assets/readme/zebrafish-sc-atlas-seekbrain.png",
  "config/README.md",
  "config/default.yaml",
  "examples/zebrafish-sc-network-modules/README.md",
  "examples/zebrafish-sc-network-modules/question.txt",
  "examples/zebrafish-sc-network-modules/question-atlas-overlay.txt",
  "examples/zebrafish-sc-network-modules/dataset/README.md",
  "examples/zebrafish-sc-network-modules/dataset/LICENSE_DATA.md",
  "examples/zebrafish-sc-network-modules/dataset/Files/SC_matrix_directed_terminals_expanded.npy",
  "examples/zebrafish-sc-network-modules/dataset/Files/SC_matrix_undirected_terminals_expanded.npy",
  "examples/zebrafish-sc-network-modules/dataset/excluded_regions.npy",
  "examples/zebrafish-sc-network-modules/dataset/Atlas/centroids.pkl",
  "examples/zebrafish-sc-network-modules/dataset/Atlas/XY_H2BGCaMP6s.tif",
  "examples/zebrafish-sc-network-modules/dataset/Atlas/XZ_H2BGCaMP6s.tif",
  "LICENSE",
  "recipes/INDEX.md",
  "recipes/Single-modality/Dynamics Modality/ns_ana-zebrafish-ca-pearson-fc_matrix/SKILL.md",
  "NOTICE",
  "README.md",
  "prompts/README.md",
  "prompts/assistant.md",
  "prompts/research.md",
  "prompts/scientific_plan.md",
  "prompts/task_formulation.md",
  "prompts/study_code.md",
  "prompts/study_validation.md",
  "prompts/study_report.md",
  "prompts/plan.md",
  "scripts/build-recipe-index.mjs",
  "scripts/install.sh",
  "scripts/install.ps1",
  "src/cli/tool-packages.mjs",
  "src/cli/cli.mjs",
  "src/core/index.ts",
  "src/extension/index.ts",
  "src/extension/tui/usage-footer.ts",
  "src/workflows/index.ts",
  "src/workflows/unified/study-workflow.ts",
  "src/workflows/unified/interfaces.ts",
  "src/workflows/unified/outputs.ts",
  "src/cli/relay-compat.mjs",
  "src/compat/anthropic-thinking.mjs",
  "src/cli/web-launcher.mjs",
  "web/package.json",
  "web/LICENSE",
  "web/upstream.json",
  "web/bin/prepare-terminal.js",
  "web/next.config.ts",
  "web/.next-release/BUILD_ID",
  "web/.next-release/server/app/page.js",
  "web/public/offline.html",
];
const forbiddenFiles = [
  "prompts/entry.md",
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
assert(!paths.some((path) => /^assets\/tools\/(linux|darwin)-/.test(path)), "main pack must not contain platform binaries");
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
  assert(!/^web\/(?:node_modules|\.next\/|\.next-release\/cache\/)/.test(path), `pack contains WebUI development dependencies/cache: ${path}`);
}

const skillDocuments = paths.filter((path) => path.startsWith("recipes/") && path.endsWith("/SKILL.md"));
assert.equal(skillDocuments.length, 68, `pack must contain exactly 68 Recipe SKILL.md files, found ${skillDocuments.length}`);
const reportSkills = paths.filter((path) => path.startsWith("skills/report/") && path.endsWith("/SKILL.md"));
assert.equal(reportSkills.length, 14, "pack must contain 14 textbook report skills");
assert(paths.filter(path => path.startsWith("skills/report/")).every(path => path.endsWith(".md")), "textbook report skills must contain only text documentation");

console.log(`Pack manifest passed: ${manifest.entryCount} files, ${manifest.size} bytes compressed.`);

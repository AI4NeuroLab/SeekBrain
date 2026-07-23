import assert from "node:assert/strict";
import process from "node:process";

let input = "";
for await (const chunk of process.stdin) input += chunk;
const [manifest] = JSON.parse(input);
const paths = manifest.files.map((entry) => entry.path);
const required = [
  ".env.example",
  "bin/seekbrain.mjs",
  "config/README.md",
  "config/default.yaml",
  "LICENSE",
  "library/skills/trajectory/INDEX.md",
  "library/skills/trajectory/zebrafish_functional_connectivity_matrix/scripts/main.py",
  "NOTICE",
  "README.md",
  "prompts/README.md",
  "prompts/entry.md",
  "prompts/plan.md",
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
  "results/",
  "tests/",
];

for (const path of required) assert(paths.includes(path), `pack is missing required file: ${path}`);
for (const path of paths) {
  assert(!forbiddenFiles.includes(path), `pack contains obsolete launcher: ${path}`);
  assert(path === ".env.example" || (path !== ".env" && !path.startsWith(".env.")), `pack contains private env file: ${path}`);
  assert(
    !forbiddenPrefixes.some((prefix) => path === prefix || path.startsWith(prefix)),
    `pack contains forbidden path: ${path}`,
  );
  assert(!/^library\/skills\/trajectory\/[^/]+\/code\//.test(path), `trajectory contains obsolete code/ resource directory: ${path}`);
}

console.log(`Pack manifest passed: ${manifest.entryCount} files, ${manifest.size} bytes compressed.`);

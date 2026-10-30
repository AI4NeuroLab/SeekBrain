// Maintainer check: prepare tool tarballs, then verify the shared CLI baseline.
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { prependPath } from "../src/platform/environment.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
prependPath(process.env, dirname(process.execPath));
const output = process.argv[2] || join(tmpdir(), "seekbrain-windows-release");
const checks = [
  ["Prepare tool packages and lockfile", ["scripts/pack-tool-packages.mjs", output, "--update-lock"]],
  ["Typecheck", ["node_modules/typescript/bin/tsc", "--project", "tsconfig.json"]],
  ["Unit regressions", ["node_modules/vitest/vitest.mjs", "run"]],
  ["CLI contracts", ["scripts/run-tests.mjs"]],
  ["Package manifest", ["scripts/pack-dry-run.mjs"]],
];
for (const [label, args] of checks) {
  console.log(label);
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

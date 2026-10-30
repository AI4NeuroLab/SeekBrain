import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const testDirectory = new URL("../tests/", import.meta.url);
const tests = (await readdir(testDirectory))
  .filter((name) => name.endsWith(".mjs"))
  .filter((name) => process.platform !== "win32" || name !== "installer.mjs")
  .sort();

for (const test of tests) {
  console.log(`RUN tests/${test}`);
  const result = spawnSync(process.execPath, [join(fileURLToPath(testDirectory), test)], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

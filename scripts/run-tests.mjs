import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import process from "node:process";

const testDirectory = new URL("../tests/", import.meta.url);
const tests = (await readdir(testDirectory))
  .filter((name) => name.endsWith(".mjs"))
  .sort();

for (const test of tests) {
  console.log(`RUN tests/${test}`);
  const result = spawnSync(process.execPath, [join(testDirectory.pathname, test)], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

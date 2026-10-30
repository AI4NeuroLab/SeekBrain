import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { TOOL_PACKAGES } from "../src/cli/tool-packages.mjs";
import { npmInvocation } from "../src/platform/npm.mjs";

if (!process.argv[2]) throw new Error("Usage: node scripts/pack-tool-packages.mjs <output-directory> [--update-lock]");
const root = fileURLToPath(new URL("..", import.meta.url));
const output = resolve(process.argv[2]);
await mkdir(output, { recursive: true });
const main = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const lock = JSON.parse(await readFile(join(root, "package-lock.json"), "utf8"));
for (const name of Object.values(TOOL_PACKAGES)) {
  const directory = join(root, "packages", name);
  const pkg = JSON.parse(await readFile(join(directory, "package.json"), "utf8"));
  if (main.optionalDependencies[name] !== pkg.version) throw new Error(`Version mismatch for ${name}`);
  const npm = npmInvocation(["pack", "--json", "--ignore-scripts", "--pack-destination", output]);
  const packed = spawnSync(npm.command, npm.args, { cwd: directory, encoding: "utf8" });
  if (packed.error || packed.status !== 0) throw new Error(packed.error?.message ?? packed.stderr);
  const [info] = JSON.parse(packed.stdout);
  const entry = { version: pkg.version, resolved: `https://registry.npmjs.org/${name}/-/${info.filename}`, integrity: info.integrity, optional: true };
  lock.packages[`node_modules/${name}`] = { ...entry, cpu: pkg.cpu, os: pkg.os, license: pkg.license };
  if (lock.lockfileVersion < 3) lock.dependencies[name] = entry;
  console.log(`${info.filename}: ${(info.size / 1e6).toFixed(2)} MB`);
}
if (process.argv.includes("--update-lock")) {
  lock.packages[""].optionalDependencies = main.optionalDependencies;
  await writeFile(join(root, "package-lock.json"), `${JSON.stringify(lock, null, 2)}\n`);
  console.log("Updated lockfile to the exact packed artifacts. Publish these tool packages before the main package.");
}

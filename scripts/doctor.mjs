import process from "node:process";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const minimum = [22, 19, 0];
const current = process.versions.node.split(".").map(Number);
function versionAtLeast(actual, required) {
  for (let index = 0; index < required.length; index += 1) {
    if (actual[index] > required[index]) return true;
    if (actual[index] < required[index]) return false;
  }
  return true;
}

const supported = versionAtLeast(current, minimum);

if (!supported) {
  console.error(`SeekBrain requires Node.js >= ${minimum.join(".")}; current runtime is ${process.versions.node}.`);
  console.error("Install Node.js 22.19 or newer and run SeekBrain again.");
  process.exitCode = 1;
} else {
  console.log(`Node.js ${process.versions.node}: supported`);
}

const root = new URL("../", import.meta.url);
const manifest = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
const frozenDependencies = {
  "@earendil-works/pi-coding-agent": "0.80.10",
  "@earendil-works/pi-tui": "0.80.10",
};
for (const [name, expected] of Object.entries(frozenDependencies)) {
  const declared = manifest.dependencies?.[name];
  if (declared !== expected) {
    console.error(`${name}: expected frozen dependency '${expected}', found '${declared ?? "missing"}'`);
    process.exitCode = 1;
    continue;
  }
  const packagePath = `node_modules/${name}/package.json`;
  try {
    const installed = JSON.parse(await readFile(new URL(packagePath, root), "utf8"));
    console.log(`${name} ${installed.version}: installed (declared ${expected})`);
  } catch {
    console.error(`${name}: not installed; run npm install`);
    process.exitCode = 1;
  }
}

let python;
for (const command of [process.env.SEEKBRAIN_PYTHON, "python3", "python"].filter(Boolean)) {
  const result = spawnSync(command, ["--version"], { encoding: "utf8" });
  if (result.status === 0) {
    python = { command, version: (result.stdout || result.stderr).trim() };
    break;
  }
}
if (python) console.log(`${python.command}: ${python.version}`);
else {
  console.error("Python: not found; set SEEKBRAIN_PYTHON before running Code stages");
  process.exitCode = 1;
}

const providerVariables = ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GEMINI_API_KEY", "GOOGLE_API_KEY"];
const configuredProviders = providerVariables.filter((name) => Boolean(process.env[name]));
console.log(configuredProviders.length
  ? `Provider credentials: environment variables configured (${configuredProviders.join(", ")})`
  : "Provider credentials: no environment key detected; Pi auth storage may still provide credentials");

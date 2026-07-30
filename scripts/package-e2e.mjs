import assert from "node:assert/strict";
import { access, mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import process from "node:process";

const root = resolve(new URL("..", import.meta.url).pathname);
const packageManifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const temporaryRoot = await mkdtemp(join(tmpdir(), "seekbrain-package-e2e-"));
const prefix = join(temporaryRoot, "prefix");
const project = join(temporaryRoot, "project");
const cache = process.env.npm_config_cache || "/tmp/seekbrain-npm-cache";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || root,
    env: { ...process.env, npm_config_cache: cache, ...options.env },
    encoding: "utf8",
    stdio: options.stdio || "pipe",
  });
  if (result.status !== 0) {
    throw new Error([
      `${command} ${args.join(" ")} failed with ${result.status}`,
      result.stdout,
      result.stderr,
      result.error?.message,
    ].filter(Boolean).join("\n"));
  }
  return result;
}

async function countSkillDocuments(directory) {
  let count = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) count += await countSkillDocuments(join(directory, entry.name));
    else if (entry.isFile() && entry.name === "SKILL.md") count += 1;
  }
  return count;
}

try {
  await mkdir(project);
  const packed = run("npm", ["pack", "--json", "--pack-destination", temporaryRoot]);
  const [manifest] = JSON.parse(packed.stdout);
  const tarball = join(temporaryRoot, manifest.filename);
  run("npm", ["install", "--global", "--prefix", prefix, "--ignore-scripts", tarball]);
  const installedPackage = join(prefix, "lib", "node_modules", "seekbrain");
  const installedRecipes = join(installedPackage, "recipes");
  const installedExample = join(installedPackage, "examples", "zebrafish-sc-network-modules");
  await access(join(installedPackage, "assets", "readme", "zebrafish-sc-modules-original.png"));
  await access(join(installedPackage, "assets", "readme", "zebrafish-sc-modules-seekbrain.png"));
  assert.match(await readFile(join(installedRecipes, "INDEX.md"), "utf8"), /Analysis Recipe Index/);
  assert.equal(await countSkillDocuments(installedRecipes), 68);
  const exampleRecipe = join(installedRecipes, "Single-modality", "Dynamics Modality", "ns_ana-zebrafish-ca-pearson-fc_matrix");
  await access(join(exampleRecipe, "scripts", "reference_implementation.py"));
  assert.match(await readFile(join(installedExample, "question.txt"), "utf8"), /hierarchical consensus algorithm/);
  await access(join(installedExample, "dataset", "Files", "SC_matrix_directed_terminals_expanded.npy"));
  await access(join(installedExample, "dataset", "excluded_regions.npy"));
  await assert.rejects(access(join(exampleRecipe, "code", "reference_implementation.py")));
  await assert.rejects(access(join(installedPackage, "library")));

  const command = join(prefix, "bin", "seekbrain");
  assert.match(run(command, ["-h"], { cwd: project }).stdout, /^SeekBrain /);
  assert.equal(run(command, ["--version"], { cwd: project }).stdout.trim(), packageManifest.version);
  assert.match(run(command, ["doctor"], { cwd: project }).stdout, /pi-coding-agent 0\.80\.10/);

  const capturePath = join(temporaryRoot, "pi-capture.json");
  const fakePi = join(temporaryRoot, "fake-pi.mjs");
  await writeFile(fakePi, [
    "import { writeFileSync } from 'node:fs';",
    "writeFileSync(process.env.SEEKBRAIN_E2E_CAPTURE, JSON.stringify({ args: process.argv.slice(2), cwd: process.cwd(), root: process.env.SEEKBRAIN_ROOT }));",
  ].join("\n"));
  run(command, [
    "run",
    "--query", "E2E question",
    "--dataset", "{}",
    "--work-dir", "results/e2e",
    "--", "--api-key", "e2e-placeholder", "--model", "openai/e2e-model", "--offline",
  ], {
    cwd: project,
    env: {
      SEEKBRAIN_PI_CLI: fakePi,
      SEEKBRAIN_E2E_CAPTURE: capturePath,
    },
  });

  const capture = JSON.parse(await readFile(capturePath, "utf8"));
  assert.equal(capture.cwd, project);
  assert.equal(capture.root, project);
  assert.ok(capture.args.includes("--no-extensions"));
  assert.ok(capture.args.some((value) => value.endsWith("/src/extension/index.ts")));
  assert.ok(!capture.args.some((value) => value.includes("/pi-subagents/")));
  assert.ok(capture.args.some((value) => value.endsWith("/prompts/entry.md")));
  assert.ok(!capture.args.some((value) => value.includes("/extensions/seekbrain/prompts/")));
  assert.ok(capture.args.includes("--offline"));
  assert.match(capture.args.at(-1), /^\/entry E2E question/);

  console.log("SeekBrain tarball installs globally and launches package-owned Pi resources outside the source tree");
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}

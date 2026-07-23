import assert from "node:assert/strict";
import { access, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
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

try {
  await mkdir(project);
  const packed = run("npm", ["pack", "--json", "--pack-destination", temporaryRoot]);
  const [manifest] = JSON.parse(packed.stdout);
  const tarball = join(temporaryRoot, manifest.filename);
  run("npm", ["install", "--global", "--prefix", prefix, "--ignore-scripts", tarball]);
  assert.match(
    await readFile(join(prefix, "lib", "node_modules", "seekbrain", "library", "skills", "trajectory", "INDEX.md"), "utf8"),
    /Skill/i,
  );
  const installedTrajectory = join(prefix, "lib", "node_modules", "seekbrain", "library", "skills", "trajectory");
  await access(join(installedTrajectory, "zebrafish_functional_connectivity_matrix", "scripts", "main.py"));
  await assert.rejects(access(join(installedTrajectory, "zebrafish_functional_connectivity_matrix", "code", "main.py")));

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

import assert from "node:assert/strict";
import { access, mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import process from "node:process";
import { npmInvocation } from "../src/platform/npm.mjs";
import { prependPath } from "../src/platform/environment.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const packageManifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const temporaryRoot = await mkdtemp(join(tmpdir(), "seekbrain-package-e2e-"));
const prefix = join(temporaryRoot, "prefix");
const project = join(temporaryRoot, "project");
const cacheIndex = process.argv.indexOf("--cache");
const cache = cacheIndex >= 0 ? process.argv[cacheIndex + 1] : process.env.npm_config_cache || join(tmpdir(), "seekbrain-npm-cache");
const offline = process.argv.includes("--offline");
const toolsIndex = process.argv.indexOf("--tools-package");
if (toolsIndex >= 0 && !process.argv[toolsIndex + 1]) throw new Error("--tools-package requires a local tool tarball");
const toolsPackage = toolsIndex < 0 ? undefined : resolve(process.argv[toolsIndex + 1]);

function run(command, args, options = {}) {
  const invocation = command === "npm" ? npmInvocation(args) : { command, args };
  const result = spawnSync(invocation.command, invocation.args, {
    cwd: options.cwd || root,
    env: { ...prependPath({ ...process.env }, dirname(process.execPath)), npm_config_cache: cache,
      ...(offline ? { npm_config_offline: "true" } : {}), ...options.env },
    encoding: "utf8",
    stdio: options.stdio || "pipe",
  });
  if (result.error || result.status !== 0) {
    throw new Error([
      `${command} ${args.join(" ")} failed with ${result.status}`,
      result.stdout,
      result.stderr,
      result.error?.message,
    ].filter(Boolean).join("\n"));
  }
  return result;
}

function runNode(entry, args, options) {
  return run(process.execPath, [entry, ...args], options);
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
  run("npm", ["install", "--global", "--prefix", prefix, "--ignore-scripts", "--include=optional", ...(toolsPackage ? [toolsPackage] : []), tarball]);
  const installedPackage = join(prefix, ...(process.platform === "win32" ? [] : ["lib"]), "node_modules", "seekbrain");
  const installedRecipes = join(installedPackage, "recipes");
  const installedExample = join(installedPackage, "examples", "zebrafish-sc-network-modules");
  await access(join(installedPackage, "assets", "readme", "zebrafish-sc-modules-original.png"));
  await access(join(installedPackage, "assets", "readme", "zebrafish-sc-modules-seekbrain.png"));
  await access(join(installedPackage, "assets", "readme", "zebrafish-sc-atlas-original.png"));
  await access(join(installedPackage, "assets", "readme", "zebrafish-sc-atlas-seekbrain.png"));
  assert.match(await readFile(join(installedRecipes, "INDEX.md"), "utf8"), /Analysis Recipe Index/);
  assert.equal(await countSkillDocuments(installedRecipes), 76);
  const reportSkills = join(installedPackage, "skills", "report");
  assert.equal(await countSkillDocuments(reportSkills), 14);
  for (const name of await readdir(reportSkills)) assert.deepEqual(await readdir(join(reportSkills, name)), ["SKILL.md"]);
  const installedPi = join(installedPackage, "node_modules", "@earendil-works", "pi-coding-agent", "dist", "index.js");
  const { DefaultResourceLoader } = await import(pathToFileURL(installedPi).href);
  const loader = new DefaultResourceLoader({ cwd: project, agentDir: join(temporaryRoot, "pi-agent"),
    noExtensions: true, noSkills: true, noThemes: true, noPromptTemplates: true, noContextFiles: true, additionalSkillPaths: [reportSkills] });
  await loader.reload();
  assert.equal(loader.getSkills().skills.length, 14);
  assert.deepEqual(loader.getSkills().diagnostics, []);
  const exampleRecipe = join(installedRecipes, "Single-modality", "Dynamics Modality", "ns_ana-zebrafish-ca-pearson-fc_matrix");
  await access(join(exampleRecipe, "scripts", "reference_implementation.py"));
  assert.match(await readFile(join(installedExample, "question.txt"), "utf8"), /hierarchical consensus algorithm/);
  assert.match(await readFile(join(installedExample, "question-atlas-overlay.txt"), "utf8"), /top and side views/);
  await access(join(installedExample, "dataset", "Files", "SC_matrix_directed_terminals_expanded.npy"));
  await access(join(installedExample, "dataset", "Files", "SC_matrix_undirected_terminals_expanded.npy"));
  await access(join(installedExample, "dataset", "excluded_regions.npy"));
  await access(join(installedExample, "dataset", "Atlas", "centroids.pkl"));
  await access(join(installedExample, "dataset", "Atlas", "XY_H2BGCaMP6s.tif"));
  await access(join(installedExample, "dataset", "Atlas", "XZ_H2BGCaMP6s.tif"));
  await assert.rejects(access(join(exampleRecipe, "code", "reference_implementation.py")));
  await assert.rejects(access(join(installedPackage, "library")));

  const cli = join(installedPackage, "bin", "seekbrain.mjs");
  const pdf = join(installedPackage, "bin", "seekbrain-pdf.mjs");
  assert.match(runNode(cli, ["-h"], { cwd: project }).stdout, /^SeekBrain /);
  assert.equal(runNode(cli, ["--version"], { cwd: project }).stdout.trim(), packageManifest.version);
  assert.match(runNode(cli, ["doctor"], { cwd: project }).stdout, /pi-coding-agent 1\.2\.0/);
  await writeFile(join(project, "report.md"), "# Package report fixture\n\n<!-- seekbrain:abstract -->\n\nThis is a renderer fixture. It contains no scientific findings. It verifies the installed report output.\n\n<!-- seekbrain:main -->\n\nInstalled report resources resolve outside the source tree.\n\n<!-- seekbrain:end -->\n");
  runNode(pdf, [join(project, "report.md"), "--brief-communication"], { cwd: project });
  assert.equal((await readFile(join(project, "report.pdf"))).subarray(0, 5).toString(), "%PDF-");

  const capturePath = join(temporaryRoot, "pi-capture.json");
  const fakePi = join(temporaryRoot, "fake-pi.mjs");
  await writeFile(fakePi, [
    "import { writeFileSync } from 'node:fs';",
    "writeFileSync(process.env.SEEKBRAIN_E2E_CAPTURE, JSON.stringify({ args: process.argv.slice(2), cwd: process.cwd(), root: process.env.SEEKBRAIN_ROOT, interactionMode: process.env.SEEKBRAIN_INTERACTION_MODE }));",
  ].join("\n"));
  runNode(cli, [
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
  assert.ok(capture.args.some((value) => value.replace(/\\/g, "/").endsWith("/src/extension/index.ts")));
  assert.ok(!capture.args.some((value) => value.includes("/pi-subagents/")));
  assert.ok(!capture.args.includes("--prompt-template"));
  await access(join(installedPackage, "prompts", "assistant.md"));
  await access(join(installedPackage, "prompts", "research.md"));
  await assert.rejects(access(join(installedPackage, "prompts", "entry.md")));
  assert.ok(!capture.args.some((value) => value.includes("/extensions/seekbrain/prompts/")));
  assert.ok(capture.args.includes("--offline"));
  assert.match(capture.args.at(-1), /^E2E question/);

  await access(join(installedPackage, "src", "extension", "runtime", "mode-controller.ts"));
  runNode(cli, ["run", "--mode", "plan", "--query", "Write analyze.json only", "--work-dir", "results/plans", "--", "--api-key", "e2e-placeholder", "--model", "openai/e2e-model", "--offline"], {
    cwd: project, env: { SEEKBRAIN_PI_CLI: fakePi, SEEKBRAIN_E2E_CAPTURE: capturePath },
  });
  const planCapture = JSON.parse(await readFile(capturePath, "utf8"));
  assert.equal(planCapture.interactionMode, "plan");
  assert.match(planCapture.args.at(-1), /^Write analyze.json only/);
  assert.doesNotMatch(planCapture.args.at(-1), /Non-interactive|seekbrain_execution_run|^\/entry/);
  runNode(pdf, [join(project, "report.md"), "--output", join(project, "named-report.pdf")], { cwd: project });
  assert.equal((await readFile(join(project, "named-report.pdf"))).subarray(0, 5).toString(), "%PDF-");
  console.log("SeekBrain tarball installs globally and launches package-owned Pi resources outside the source tree");
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}

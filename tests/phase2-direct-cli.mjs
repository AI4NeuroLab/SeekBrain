import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildTaskPrompt,
  buildPiLaunchSpec,
  main,
  parseArgs,
  resolveRuntimePaths,
} from "../src/cli/cli.mjs";

const root = new URL("../", import.meta.url);
const source = await readFile(new URL("src/cli/cli.mjs", root), "utf8");
const piLauncherSource = await readFile(new URL("src/cli/pi-launcher.mjs", root), "utf8");
assert.doesNotMatch(source, /pi_run_seekbrain|internagent\/workflow|spawnSync\("bash"/);
assert.match(piLauncherSource, /process\.env\.PI_PACKAGE_DIR = packageRoot/);
assert.match(piLauncherSource, /process\.title = config\.APP_NAME/);
assert.match(piLauncherSource, /getQuietStartup/);
assert.match(piLauncherSource, /checkForPackageUpdates/);
assert.match(piLauncherSource, /getChangelogForDisplay/);

const paths = resolveRuntimePaths();
assert.match(paths.piCli, /src\/cli\/pi-launcher\.mjs$/);
assert.match(paths.seekbrainExtension, /src\/extension\/index\.ts$/);
assert.deepEqual(parseArgs(["resume", "session-123"]).options.piArgs, ["--session", "session-123"]);
assert.deepEqual(parseArgs(["--session", "session-123"]).options.piArgs, ["--session", "session-123"]);

const parsed = parseArgs([
  "run",
  "--query", "question",
  "--dataset", "metadata",
  "--work-dir", "results/run",
  "--pi-arg", "--offline",
  "--", "--model", "provider/model",
]);
assert.equal(parsed.action, "launch");
assert.equal(parsed.nonInteractive, true);
assert.deepEqual(parsed.options.piArgs, ["--offline", "--model", "provider/model"]);

const deepResearchParsed = parseArgs(["run", "--mode", "deep-research", "--query", "Study donor differences"]);
assert.equal(deepResearchParsed.action, "launch");
assert.equal(deepResearchParsed.options.interactionMode, "deep-research");
assert.ok(buildPiLaunchSpec(deepResearchParsed, { cwd: "/tmp", homeDir: "/tmp", env: {} }).env.SEEKBRAIN_INTERACTION_MODE === "deep-research");

const researchPlanningParsed = parseArgs([
  "run",
  "--research-planning",
  "--query", "question",
  "--dataset", "metadata",
]);
assert.equal(researchPlanningParsed.options.researchPlanning, true);
assert.equal(parseArgs(["--research-planning"]).action, "error");
assert.match(parseArgs([
  "run", "--creative", "--research-planning", "--query", "question", "--dataset", "metadata",
]).message, /unknown option: --creative/);


const projectRoot = await mkdtemp(join(tmpdir(), "seekbrain-phase2-project-"));
const userHome = await mkdtemp(join(tmpdir(), "seekbrain-phase2-home-"));
try {
  const datasetDir = join(projectRoot, "raw-dataset");
  await mkdir(datasetDir);
  assert.match(buildTaskPrompt({ query: "question", dataset: datasetDir }, projectRoot), new RegExp(`Dataset directory: ${datasetDir}`));

  const userConfig = join(userHome, ".config", "seekbrain", "config.yaml");
  await mkdir(join(userHome, ".config", "seekbrain"), { recursive: true });
  await writeFile(userConfig, [
    "agents:",
    "  seekbrain:",
    "    provider: user-provider",
    "    model: user-model",
    "    thinking: medium",
    "",
  ].join("\n"));
  await writeFile(join(projectRoot, "seekbrain.config.yaml"), [
    "agents:",
    "  seekbrain:",
    "    model: project-model",
    "",
  ].join("\n"));
  const spec = buildPiLaunchSpec(parsed, { cwd: projectRoot, homeDir: userHome, env: {} });
  assert.equal(spec.command, process.execPath);
  assert.equal(spec.cwd, projectRoot);
  assert.equal(spec.env.SEEKBRAIN_ROOT, projectRoot);
  assert.equal(spec.env.SEEKBRAIN_NON_INTERACTIVE, "1");
  assert.equal(spec.env.SEEKBRAIN_RUN_MODE, "unified_auto");
  assert.equal(spec.env.PI_SKIP_VERSION_CHECK, "1");
  assert.equal(spec.args[0], paths.piCli);
  assert.ok(spec.args.includes("--no-extensions"));
  assert.ok(spec.args.includes(paths.seekbrainExtension));
  assert.ok(spec.args.includes("--mode"));
  assert.ok(spec.args.includes("json"));
  assert.ok(spec.args.includes("--offline"));
  assert.ok(spec.args.includes("provider/model"));
  assert.ok(spec.args.indexOf("user-provider") < spec.args.indexOf("provider/model"));
  assert.ok(spec.args.includes("project-model"));
  assert.ok(spec.args.includes("medium"));
  assert.equal(spec.env.SEEKBRAIN_USER_CONFIG, userConfig);
  assert.equal(spec.env.SEEKBRAIN_CONFIG, join(projectRoot, "seekbrain.config.yaml"));
  assert.match(spec.args.at(-1), /^question/);
  assert.doesNotMatch(spec.args.at(-1), /unified Plan|Non-interactive execution policy/);
  assert.ok(!spec.args.includes("--prompt-template"));

  const researchPlanningSpec = buildPiLaunchSpec(researchPlanningParsed, { cwd: projectRoot, homeDir: userHome, env: {} });
  assert.equal(researchPlanningSpec.env.SEEKBRAIN_RUN_MODE, "unified_auto");
  assert.match(researchPlanningSpec.args.at(-1), /^question/);
  assert.doesNotMatch(researchPlanningSpec.args.at(-1), /unified Plan/);

  let stdout = "";
  let stderr = "";
  const io = {
    stdout: { write(value) { stdout += value; } },
    stderr: { write(value) { stderr += value; } },
  };
  assert.equal(await main(["--unknown"], io), 2);
  assert.equal(stdout, "");
  assert.match(stderr, /unknown option/);

  stdout = "";
  stderr = "";
  await rm(join(projectRoot, "seekbrain.config.yaml"));
  assert.equal(await main(["config", "show", "--cwd", projectRoot], io, { homeDir: userHome, env: {} }), 0);
  const shown = JSON.parse(stdout);
  assert.equal(shown.projectRoot, projectRoot);
  assert.equal(shown.projectConfigExists, false);
  assert.equal(shown.userConfigExists, true);
  assert.deepEqual(shown.precedence, ["package", "user", "project", "command-line"]);
  assert.doesNotMatch(stdout, /API_KEY|apiKey|secret/i);

  stdout = "";
  stderr = "";
  assert.equal(await main([
    "run", "--query", "question", "--dataset", "{}", "--cwd", projectRoot,
  ], io, { homeDir: userHome, env: {}, autoSetup: false }), 1);
  assert.match(stderr, /Run 'seekbrain setup' first/);

  let configured = false;
  const launches = [];
  const modelRuntimeFactory = async () => ({
    getModel(provider, model) { return provider === "user-provider" && model === "user-model" ? {} : undefined; },
    hasConfiguredAuth() { return configured; },
  });
  const interactiveIo = {
    stdin: { isTTY: true },
    stdout: { isTTY: true, write() {} },
    stderr: { write(value) { stderr += value; } },
  };
  assert.equal(await main(["setup"], interactiveIo, {
    cwd: projectRoot,
    homeDir: userHome,
    env: {},
    modelRuntimeFactory,
    spawnSync(_command, _args, options) {
      launches.push(options.env.SEEKBRAIN_SETUP);
      configured = true;
      return { status: 0 };
    },
  }), 0);
  assert.deepEqual(launches, ["1"], "explicit setup must exit after the setup Pi session closes");

  stdout = "";
  stderr = "";
  assert.equal(await main(["config", "init", "--project", "--cwd", projectRoot], io, { homeDir: userHome, env: {} }), 0);
  assert.match(stdout, /Created project configuration/);
  assert.match(await readFile(join(projectRoot, "seekbrain.config.yaml"), "utf8"), /seekbrain: \{\}/);

  const secondHome = await mkdtemp(join(tmpdir(), "seekbrain-phase2-user-init-"));
  try {
    stdout = "";
    assert.equal(await main(["config", "init", "--user"], io, { homeDir: secondHome, env: {} }), 0);
    assert.match(stdout, /Created user configuration/);
    const initializedUser = await readFile(join(secondHome, ".config", "seekbrain", "config.yaml"), "utf8");
    assert.match(initializedUser, /research_planning: true/);
    assert.match(initializedUser, /research_planning_strategy: standard/);
    assert.match(initializedUser, /research_survey: false/);
    assert.match(initializedUser, /max_rounds: 3/);
    assert.match(initializedUser, /targeted_skill_generate: false/);
    assert.match(initializedUser, /seekbrain_default:/);
    assert.match(initializedUser, /base_url: ""/);
  } finally {
    await rm(secondHome, { recursive: true, force: true });
  }

  assert.equal(parseArgs(["config", "init", "--user"]).options.scope, "user");
  assert.equal(parseArgs(["config", "init", "--project"]).options.scope, "project");
  assert.equal(parseArgs(["config", "init", "--user", "--project"]).action, "error");
  assert.equal(parseArgs(["config", "show", "--user"]).action, "error");
} finally {
  await rm(projectRoot, { recursive: true, force: true });
  await rm(userHome, { recursive: true, force: true });
}

console.log("Phase 2 CLI launches package-owned Pi directly and preserves project/package boundaries");

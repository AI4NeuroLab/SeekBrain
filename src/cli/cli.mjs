import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { homedir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parse as parseYaml, parseDocument } from "yaml";
import { hasUsableModelConfiguration } from "./setup.mjs";

export const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const manifest = JSON.parse(readFileSync(join(PACKAGE_ROOT, "package.json"), "utf8"));
export const VERSION = manifest.version;

export const USER_CONFIG_TEMPLATE = `# User-wide SeekBrain overrides.
# Project seekbrain.config.yaml files and explicit CLI arguments take precedence.
# Keep credentials in Pi auth storage, SeekBrain's protected literature
# credential store, or provider environment variables, not here.

# Optional: override the persistent dataset metadata cache.
# paths:
#   dataset_cache: ~/.seekbrain/datasets

# Written by seekbrain setup after choosing Shanghai AI Lab Paper RAG, Semantic
# Scholar, PubMed, or None. Provider credentials are referenced here but stored
# separately.
literature:
  providers: {}

modules:
  targeted_skill:
    compatibility:
      candidate_pool_size: 10
      skill_top_k: 2
      prefer_repository: true
      paper_only_fallback: true

workflow:
  seekbrain:
    # Set to false to bypass the lightweight data/question routing check.
    research_planning: true
    # Global literature grounding before Research Planning generates its tree.
    # Independent from task/ordinary-run deep_research below.
    research_survey: false
    # Automatic Reviewer Agent pass over the generated plan tree.
    research_planning_peer_review: true
    # Used only after a Research Planning tree has been approved and materialized.
    research_execution:
      planning_concurrency: 3
      execution_concurrency: 2
    deep_research: false
    targeted_skill_match: true
    targeted_skill_generate: false
    image_refine: false
    save_skill: true
    transparency: true

agents:
  # seekbrain setup fills model routing automatically. Ordinary users do not
  # need to edit Pi auth.json/models.json or uncomment provider/model manually.
  seekbrain:
    # provider: your-provider
    # model: your-model
    thinking: low

  # Defaults inherited by workflow subagents unless a stage overrides them.
  seekbrain_default:
    # provider: your-provider
    # model: your-model
    thinking: off

  seekbrain_data_resolve:
    thinking: off

  seekbrain_research_route:
    thinking: off

  seekbrain_research_planning:
    thinking: high

  seekbrain_research_reviewer:
    thinking: low

  seekbrain_skill_match:
    thinking: off

  seekbrain_skill_context:
    thinking: off

  seekbrain_skill_generate:
    thinking: medium

  seekbrain_plan:
    thinking: high

  seekbrain_code:
    thinking: high

  seekbrain_validate:
    thinking: low

  seekbrain_interpret:
    thinking: high
    vision: true

  seekbrain_report:
    thinking: low

  seekbrain_refine_image:
    thinking: off

  seekbrain_save_skill:
    thinking: off

  seekbrain_deep_research:
    thinking: low
    timeout_seconds: 600
    rag:
      base_url: ""
      top_k: 4
      timeout: 600
      source_char_limit: 5000

  seekbrain_survey:
    thinking: low
    timeout_seconds: 600
    rag:
      paper_source: ailab_rag
      base_url: ""
      top_k: 4
      timeout: 600
      require_github: false
      source_char_limit: 5000
`;

export const PROJECT_CONFIG_TEMPLATE = `# Project-only SeekBrain overrides.
# Add only fields that should override the user configuration for this project.

workflow:
  seekbrain: {}

agents: {}
`;

export const INTERACTIVE_TOOLS = [
  "read", "bash", "edit", "write",
  "seekbrain_system_check", "seekbrain_system_capabilities", "seekbrain_data_resolve", "seekbrain_research_start", "seekbrain_research_continue",
  "seekbrain_run_start", "seekbrain_run_resume", "seekbrain_planning_assess", "seekbrain_planning_decision_review", "seekbrain_planning_decision_record", "seekbrain_planning_generate", "seekbrain_planning_peer_review", "seekbrain_planning_researcher_review", "seekbrain_planning_researcher_decision_record", "seekbrain_analysis_tasks_prepare", "seekbrain_research_extend", "seekbrain_execution_initialize", "seekbrain_execution_run", "seekbrain_execution_schema_review", "seekbrain_execution_tasks_run", "seekbrain_analysis_task_control", "seekbrain_report_evidence_compile", "seekbrain_report_generate", "seekbrain_recipe_retrieve", "seekbrain_deep_research",
  "seekbrain_formulation_generate", "seekbrain_code_execute", "seekbrain_validation_run", "seekbrain_figure_refine", "seekbrain_interpretation_run",
  "seekbrain_review_approve", "seekbrain_review_feedback", "seekbrain_formulation_researcher_review",
  "seekbrain_formulation_update", "seekbrain_code_edit_review", "seekbrain_code_update_propose",
  "seekbrain_code_update_review",
].join(",");

export const AUTOMATION_TOOLS = [
  "read", "bash", "edit", "write",
  "seekbrain_system_check", "seekbrain_system_capabilities", "seekbrain_data_resolve", "seekbrain_research_start", "seekbrain_research_continue",
  "seekbrain_run_start", "seekbrain_run_resume", "seekbrain_planning_assess", "seekbrain_planning_generate", "seekbrain_planning_peer_review", "seekbrain_analysis_tasks_prepare", "seekbrain_research_extend", "seekbrain_execution_initialize", "seekbrain_execution_run", "seekbrain_execution_tasks_run", "seekbrain_report_evidence_compile", "seekbrain_report_generate", "seekbrain_recipe_retrieve", "seekbrain_deep_research",
  "seekbrain_formulation_generate", "seekbrain_code_execute", "seekbrain_validation_run", "seekbrain_figure_refine", "seekbrain_interpretation_run",
].join(",");

export function helpText(version = VERSION) {
  return `SeekBrain ${version}

Usage:
  seekbrain [options] [-- <pi-args...>]
  seekbrain resume <session-id|path>
  seekbrain run [options] [-- <pi-args...>]
  seekbrain report <research-planning-project-path>
  seekbrain setup
  seekbrain doctor
  seekbrain config <show|list|get|set|unset|init> [options]

Commands:
  resume <session>      Resume a SeekBrain conversation session
  run                  Run a non-interactive analysis task
  report <project>     Generate a Research Planning report from eligible task rounds
  setup                Configure model routing and a literature provider
  doctor               Check Node, Pi, Python, and package dependencies
  config show          Show configuration paths; add --effective for merged values
  config list [prefix] List effective public configuration values and their sources
  config get <key>     Show one effective value and its source
  config set <key> <value> Set a sparse user override (or use --project)
  config unset <key>   Remove a user override (or use --project)
  config init --user   Create the user-wide configuration template
  config init --project Create the project override template (default scope)

Options:
  -h, --help           Show this help and exit
  -V, -v, --version    Show version and exit
  --cwd <path>         Project working directory
  --config <path>      Project configuration file
  --user               Use user scope for config init/set/unset (set/unset default)
  --project            Use project scope for config init/set/unset
  --effective          Show the fully merged configuration (config show only)
  --query <text>       Research question
  --dataset <path>     Dataset directory, metadata JSON file, or JSON content
  --work-dir <path>    Output directory
  --path <text>        Extra path or access notes
  --goal <text>        Optional report synthesis goal (report only)
  --session <id|path>  Resume a SeekBrain conversation session
  --session-dir <dir>  Override the session storage directory
  --pi-arg <value>     Forward one argument to Pi (repeatable)
  -- <pi-args...>      Forward all remaining arguments to Pi

Examples:
  seekbrain
  seekbrain resume 019f8f34-818f-708b-88bc-6018e6d67524
  seekbrain --session 019f8f34-818f-708b-88bc-6018e6d67524
  seekbrain setup
  seekbrain -- --model provider/model
  seekbrain run --query "Compare the conditions" --dataset metadata.json --work-dir results/example
  seekbrain report results/research-planning-project
  seekbrain config show
  seekbrain config show --effective
  seekbrain config list modules.targeted_skill
  seekbrain config get modules.targeted_skill.relevance_threshold
  seekbrain config set modules.targeted_skill.relevance_threshold 0.5
  seekbrain config unset modules.targeted_skill.relevance_threshold
  seekbrain config init --user
  seekbrain config init --project
`;
}

function parseValue(args, index, option) {
  const value = args[index + 1];
  if (value === undefined || value === "--") {
    return { error: `${option} requires a value` };
  }
  return { value, next: index + 1 };
}

export function parseArgs(input) {
  if (input.includes("-h") || input.includes("--help")) return { action: "help" };
  if (input.includes("-V") || input.includes("-v") || input.includes("--version")) return { action: "version" };

  const args = [...input];
  let command = "interactive";
  let configCommand;
  if (args[0] === "resume" || args[0] === "run" || args[0] === "report" || args[0] === "setup" || args[0] === "doctor" || args[0] === "config") {
    command = args.shift();
  }
  let resumeTarget;
  if (command === "resume" && args[0] && !args[0].startsWith("-")) resumeTarget = args.shift();
  let reportProject;
  if (command === "report" && args[0] && !args[0].startsWith("-")) reportProject = args.shift();
  if (command === "config") configCommand = args.shift();
  if (command === "doctor" && args.length > 0) {
    return { action: "error", message: `unknown doctor option: ${args[0]}`, code: 2 };
  }
  if (command === "doctor") return { action: "doctor" };
  if (command === "setup" && args.length > 0) {
    return { action: "error", message: `unknown setup option: ${args[0]}`, code: 2 };
  }
  if (command === "setup") return { action: "setup" };
  if (command === "config" && !["show", "list", "get", "set", "unset", "init"].includes(configCommand)) {
    return { action: "error", message: "config requires 'show', 'list', 'get', 'set', 'unset', or 'init'", code: 2 };
  }

  const options = { piArgs: [] };
  const positionals = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--") {
      options.piArgs.push(...args.slice(index + 1));
      break;
    }
    if (arg === "--session" || arg === "--session-dir") {
      if (command !== "interactive" && !(command === "resume" && arg === "--session-dir")) {
        return { action: "error", message: `${arg} is only valid for an interactive SeekBrain session`, code: 2 };
      }
      const parsed = parseValue(args, index, arg);
      if (parsed.error) return { action: "error", message: parsed.error, code: 2 };
      index = parsed.next;
      options.piArgs.push(arg, parsed.value);
      continue;
    }
    if (arg === "--user" || arg === "--project") {
      if (command !== "config" || !["init", "set", "unset"].includes(configCommand)) {
        return { action: "error", message: `${arg} is only valid with 'config init', 'config set', or 'config unset'`, code: 2 };
      }
      const scope = arg.slice(2);
      if (options.scope && options.scope !== scope) {
        return { action: "error", message: `${configCommand} accepts only one of --user or --project`, code: 2 };
      }
      options.scope = scope;
      continue;
    }
    if (arg === "--effective") {
      if (command !== "config" || configCommand !== "show") {
        return { action: "error", message: "--effective is only valid with 'config show'", code: 2 };
      }
      options.effective = true;
      continue;
    }
    const key = {
      "--cwd": "cwd",
      "--config": "config",
      "--query": "query",
      "--dataset": "dataset",
      "--work-dir": "workDir",
      "--work_dir": "workDir",
      "--path": "extraPath",
      "--goal": "reportGoal",
      "--pi-arg": "piArg",
    }[arg];
    if (!key) {
      if (command === "config" && !arg.startsWith("-")) {
        positionals.push(arg);
        continue;
      }
      return { action: "error", message: `unknown option: ${arg}`, code: 2 };
    }
    const parsed = parseValue(args, index, arg);
    if (parsed.error) return { action: "error", message: parsed.error, code: 2 };
    index = parsed.next;
    if (key === "piArg") options.piArgs.push(parsed.value);
    else options[key] = parsed.value;
  }

  if (command === "run" && !options.query) {
    return { action: "error", message: "run requires --query", code: 2 };
  }
  if (command === "resume") {
    if (!resumeTarget) {
      return { action: "error", message: "usage: seekbrain resume <session-id|path>", code: 2 };
    }
    options.piArgs.push("--session", resumeTarget);
    return { action: "launch", nonInteractive: false, options };
  }
  if (command === "run" && !options.dataset) {
    return { action: "error", message: "run requires --dataset", code: 2 };
  }
  if (command === "report") {
    if (!reportProject) return { action: "error", message: "report requires a project path", code: 2 };
    options.reportMode = true;
    options.reportProject = reportProject;
    options.query = [
      "Generate the final SeekBrain Research Planning academic report now.",
      `Research Planning project path: ${reportProject}`,
      options.reportGoal ? `Report goal: ${options.reportGoal}` : "",
      "Call seekbrain_report_generate exactly once with this parent project path. Do not start or resume research, select individual rounds, or generate a report for a standard project.",
    ].filter(Boolean).join("\n");
    return { action: "launch", nonInteractive: true, options };
  }
  if (command === "config" && configCommand === "init" && options.scope === "user" && options.config) {
    return { action: "error", message: "--config cannot be combined with config init --user", code: 2 };
  }
  if (command === "config") {
    const expected = { show: [0, 0], init: [0, 0], list: [0, 1], get: [1, 1], set: [2, 2], unset: [1, 1] }[configCommand];
    if (positionals.length < expected[0] || positionals.length > expected[1]) {
      const usage = {
        show: "config show [--effective]",
        init: "config init [--user|--project]",
        list: "config list [prefix]",
        get: "config get <key>",
        set: "config set <key> <value> [--user|--project]",
        unset: "config unset <key> [--user|--project]",
      }[configCommand];
      return { action: "error", message: `usage: seekbrain ${usage}`, code: 2 };
    }
    if (configCommand === "list") options.prefix = positionals[0];
    if (["get", "set", "unset"].includes(configCommand)) options.key = positionals[0];
    if (configCommand === "set") options.value = positionals[1];
  }
  if (command === "config") return { action: "config", command: configCommand, options };
  return { action: "launch", nonInteractive: command === "run", options };
}

export function resolveRuntimePaths(packageRoot = PACKAGE_ROOT, env = process.env) {
  return {
    packageRoot,
    piCli: env.SEEKBRAIN_PI_CLI || join(packageRoot, "src", "cli", "pi-launcher.mjs"),
    seekbrainExtension: join(packageRoot, "src", "extension", "index.ts"),
    usageExtension: join(packageRoot, "src", "extension", "tui", "usage-footer.ts"),
    entryPrompt: join(packageRoot, "prompts", "entry.md"),
  };
}

function projectPath(value, projectRoot) {
  if (!value) return undefined;
  return isAbsolute(value) ? resolve(value) : resolve(projectRoot, value);
}

function datasetText(value, projectRoot) {
  if (!value) return "";
  const candidate = projectPath(value, projectRoot);
  if (!existsSync(candidate)) return value;
  if (statSync(candidate).isDirectory()) return `Dataset directory: ${candidate}`;
  return readFileSync(candidate, "utf8");
}

function mergeObjects(base, override) {
  const merged = { ...base };
  for (const [key, value] of Object.entries(override || {})) {
    const current = merged[key];
    const mergeable = value && typeof value === "object" && !Array.isArray(value)
      && current && typeof current === "object" && !Array.isArray(current);
    merged[key] = mergeable ? mergeObjects(current, value) : value;
  }
  return merged;
}

function readYamlObject(path) {
  if (!path || !existsSync(path)) return {};
  const parsed = parseYaml(readFileSync(path, "utf8"));
  if (parsed === null || parsed === undefined) return {};
  if (typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`configuration root must be an object: ${path}`);
  }
  return parsed;
}

function configPaths(parsed, runtime, projectRoot, env) {
  const userHome = runtime.homeDir || homedir();
  const userConfig = env.SEEKBRAIN_USER_CONFIG || join(userHome, ".config", "seekbrain", "config.yaml");
  const requestedProjectConfig = projectPath(parsed.options.config, projectRoot);
  const inheritedProjectConfig = env.SEEKBRAIN_CONFIG
    ? projectPath(env.SEEKBRAIN_CONFIG, projectRoot)
    : undefined;
  const projectConfig = requestedProjectConfig || inheritedProjectConfig || join(projectRoot, "seekbrain.config.yaml");
  const projectConfigActive = Boolean(requestedProjectConfig || inheritedProjectConfig || existsSync(projectConfig));
  return { userConfig, projectConfig, projectConfigActive };
}

function mainAgentPiArgs(packageConfig, userConfig, projectConfig, projectConfigActive) {
  const merged = mergeObjects(
    mergeObjects(readYamlObject(packageConfig), readYamlObject(userConfig)),
    projectConfigActive ? readYamlObject(projectConfig) : {},
  );
  const agent = merged?.agents?.seekbrain || {};
  const args = [];
  if (agent.provider) args.push("--provider", String(agent.provider));
  if (agent.model) args.push("--model", String(agent.model));
  if (agent.thinking) args.push("--thinking", String(agent.thinking));
  return args;
}

export function buildTaskPrompt(options, projectRoot, nonInteractive = false) {
  const sections = [options.query || ""];
  const dataset = datasetText(options.dataset, projectRoot);
  if (dataset) sections.push(`## Dataset / Metadata\n${dataset}`);
  if (options.workDir) sections.push(`## Output work directory\nUse work_dir: ${projectPath(options.workDir, projectRoot)}`);
  if (options.extraPath) sections.push(`## Extra path / access notes\n${options.extraPath}`);
  if (nonInteractive) {
    sections.push(options.reportMode
      ? "## Non-interactive report policy\nGenerate only the explicitly requested report. Do not start, continue, or resume research and do not request dataset metadata."
      : "## Non-interactive execution policy\nContinue through the workflow until seekbrain_interpretation_run succeeds and writes the final interpretation and conclusion artifacts. Do not ask follow-up questions. If blocked, report the blocking condition, missing information, and limitations.");
  }
  return sections.filter(Boolean).join("\n\n");
}

export function buildPiLaunchSpec(parsed, runtime = {}) {
  const currentDirectory = runtime.cwd || process.cwd();
  const projectRoot = projectPath(parsed.options.cwd, currentDirectory) || currentDirectory;
  const paths = runtime.paths || resolveRuntimePaths(runtime.packageRoot, runtime.env);
  for (const [name, path] of Object.entries(paths)) {
    if (name !== "packageRoot" && !existsSync(path)) throw new Error(`required ${name} not found: ${path}`);
  }

  const env = {
    ...process.env,
    ...(runtime.env || {}),
    SEEKBRAIN_ROOT: projectRoot,
    SEEKBRAIN_PROJECT_ROOT: projectRoot,
    PI_SKIP_VERSION_CHECK: "1",
  };
  const configs = configPaths(parsed, runtime, projectRoot, env);
  const configuredMainAgentArgs = mainAgentPiArgs(
    join(runtime.packageRoot || PACKAGE_ROOT, "config", "default.yaml"),
    configs.userConfig,
    configs.projectConfig,
    configs.projectConfigActive,
  );
  const args = [
    paths.piCli,
    "--approve",
    "--no-extensions",
    "--extension", paths.seekbrainExtension,
    "--extension", paths.usageExtension,
    "--no-prompt-templates",
    "--prompt-template", paths.entryPrompt,
    "--tools", parsed.nonInteractive ? AUTOMATION_TOOLS : INTERACTIVE_TOOLS,
    ...configuredMainAgentArgs,
    ...parsed.options.piArgs,
  ];
  const hasTask = parsed.options.query || parsed.options.dataset || parsed.options.workDir || parsed.options.extraPath;
  if (parsed.nonInteractive) args.push("--mode", "json");
  if (hasTask) args.push(`/entry ${buildTaskPrompt(parsed.options, projectRoot, parsed.nonInteractive)}`);

  if (parsed.nonInteractive) env.SEEKBRAIN_NON_INTERACTIVE = "1";
  if (parsed.options.workDir) env.SEEKBRAIN_RUN_ROOT = projectPath(parsed.options.workDir, projectRoot);
  env.SEEKBRAIN_USER_CONFIG = configs.userConfig;
  if (configs.projectConfigActive) env.SEEKBRAIN_CONFIG = configs.projectConfig;
  return { command: process.execPath, args, cwd: projectRoot, env, paths };
}

function lastOption(args, name) {
  let result;
  for (let index = 0; index < args.length - 1; index += 1) {
    if (args[index] === name) result = args[index + 1];
  }
  return result;
}

function spawnPi(spec, io, runtime) {
	const spawn = runtime.spawnSync || spawnSync;
	const result = spawn(spec.command, spec.args, { cwd: spec.cwd, env: spec.env, stdio: "inherit" });
	if (typeof result.status === "number") return result.status;
	if (result.error) io.stderr.write(`seekbrain: ${result.error.message}\n`);
	return 1;
}

async function runPi(parsed, io, runtime, forceSetup = false) {
  let spec;
  try {
    spec = buildPiLaunchSpec(parsed, runtime);
  } catch (error) {
    io.stderr.write(`seekbrain: ${error.message}\n`);
    return 1;
  }
  const configuredModel = lastOption(spec.args, "--model");
  const explicitApiKeyAndModel = spec.args.includes("--api-key") && Boolean(configuredModel);
  const usable = explicitApiKeyAndModel || await hasUsableModelConfiguration({
    homeDir: runtime.homeDir,
    agentDir: spec.env.PI_CODING_AGENT_DIR,
    provider: lastOption(spec.args, "--provider"),
    model: configuredModel,
    runtimeFactory: runtime.modelRuntimeFactory,
  });
  if (!usable && parsed.nonInteractive) {
    io.stderr.write("seekbrain: no authenticated Core model is configured. Run 'seekbrain setup' first.\n");
    return 1;
  }
  if (forceSetup || !usable) {
    const input = runtime.input || io.stdin;
    const output = runtime.output || io.stdout;
    if (runtime.autoSetup !== false && input?.isTTY && output?.isTTY !== false) {
      spec.env.SEEKBRAIN_SETUP = "1";
      const setupStatus = spawnPi(spec, io, runtime);
      if (setupStatus !== 0) return setupStatus;
      spec = buildPiLaunchSpec(parsed, runtime);
      const setupUsable = await hasUsableModelConfiguration({
        homeDir: runtime.homeDir,
        agentDir: spec.env.PI_CODING_AGENT_DIR,
        provider: lastOption(spec.args, "--provider"),
        model: lastOption(spec.args, "--model"),
        runtimeFactory: runtime.modelRuntimeFactory,
      });
      if (!setupUsable) {
        io.stderr.write("seekbrain: setup was not completed. Run 'seekbrain setup' to try again.\n");
        return 1;
      }
      if (forceSetup) return 0;
    } else {
      io.stderr.write("seekbrain: no authenticated Core model is configured. Run 'seekbrain setup' first.\n");
      return 1;
    }
  }
  return spawnPi(spec, io, runtime);
}

function configKeySegments(key) {
  const value = String(key || "").trim();
  if (!value || value.startsWith(".") || value.endsWith(".") || value.includes("..")) {
    throw new Error(`invalid configuration key: ${key}`);
  }
  const segments = value.split(".");
  if (segments.some((segment) => !/^[A-Za-z0-9_-]+$/.test(segment))) {
    throw new Error(`invalid configuration key: ${key}`);
  }
  return segments;
}

function valueAtPath(value, segments) {
  let current = value;
  for (const segment of segments) {
    if (!current || typeof current !== "object" || Array.isArray(current)
      || !Object.prototype.hasOwnProperty.call(current, segment)) {
      return { exists: false, value: undefined };
    }
    current = current[segment];
  }
  return { exists: true, value: current };
}

function leafConfigPaths(value, prefix = [], result = new Set()) {
  if (value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length) {
    for (const [key, child] of Object.entries(value)) leafConfigPaths(child, [...prefix, key], result);
  } else if (prefix.length) {
    result.add(prefix.join("."));
  }
  return result;
}

function effectiveConfigState(configs, packageRoot) {
  const layers = [
    { name: "package default", path: join(packageRoot, "config", "default.yaml"), active: true },
    { name: "user", path: configs.userConfig, active: existsSync(configs.userConfig) },
    { name: "project", path: configs.projectConfig, active: configs.projectConfigActive && existsSync(configs.projectConfig) },
  ].map((layer) => ({ ...layer, value: layer.active ? readYamlObject(layer.path) : {} }));
  const effective = layers.reduce((merged, layer) => layer.active ? mergeObjects(merged, layer.value) : merged, {});
  return { layers, effective };
}

function sourceForConfigPath(layers, segments) {
  return [...layers].reverse().find((layer) => layer.active && valueAtPath(layer.value, segments).exists);
}

function parseConfigOverride(raw, defaultValue, key) {
  const value = parseYaml(raw);
  if (value === undefined) throw new Error(`configuration value for '${key}' is empty`);
  if (defaultValue !== undefined) {
    const expected = Array.isArray(defaultValue) ? "array" : typeof defaultValue;
    const actual = Array.isArray(value) ? "array" : typeof value;
    if (expected !== actual) throw new Error(`'${key}' expects ${expected}, received ${actual}`);
  }
  if (key === "modules.targeted_skill.relevance_threshold"
    && (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1)) {
    throw new Error(`'${key}' must be a number between 0 and 1`);
  }
  if (key === "modules.targeted_skill.top_k"
    && (typeof value !== "number" || !Number.isInteger(value) || value < 1)) {
    throw new Error(`'${key}' must be an integer greater than or equal to 1`);
  }
  return value;
}

function writeSparseConfig(target, key, value, remove = false) {
  const segments = configKeySegments(key);
  const source = existsSync(target) ? readFileSync(target, "utf8") : "{}\n";
  const document = parseDocument(source);
  if (document.errors.length) throw new Error(`invalid YAML in ${target}: ${document.errors[0].message}`);
  if (remove) {
    if (document.getIn(segments) === undefined) return false;
    document.deleteIn(segments);
  } else {
    document.setIn(segments, value);
  }
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, document.toString());
  return true;
}

function formattedConfigValue(value) {
  return JSON.stringify(value);
}

function configResult(parsed, io, runtime) {
  const currentDirectory = runtime.cwd || process.cwd();
  const projectRoot = projectPath(parsed.options.cwd, currentDirectory) || currentDirectory;
  const env = { ...process.env, ...(runtime.env || {}) };
  const configs = configPaths(parsed, runtime, projectRoot, env);
  try {
    const packageRoot = runtime.packageRoot || PACKAGE_ROOT;
    if (parsed.command === "show" && !parsed.options.effective) {
      io.stdout.write(`${JSON.stringify({
        packageRoot,
        projectRoot,
        packageConfig: join(packageRoot, "config", "default.yaml"),
        userConfig: configs.userConfig,
        userConfigExists: existsSync(configs.userConfig),
        projectConfig: configs.projectConfig,
        projectConfigExists: existsSync(configs.projectConfig),
        precedence: ["package", "user", "project", "command-line"],
      }, null, 2)}\n`);
      return 0;
    }

    if (parsed.command === "init") {
      const scope = parsed.options.scope || "project";
      const target = scope === "user" ? configs.userConfig : configs.projectConfig;
      const template = scope === "user" ? USER_CONFIG_TEMPLATE : PROJECT_CONFIG_TEMPLATE;
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, template, { flag: "wx" });
      io.stdout.write(`Created ${scope} configuration: ${target}\n`);
      return 0;
    }

    const state = effectiveConfigState(configs, packageRoot);
    if (parsed.command === "show") {
      const paths = [...leafConfigPaths(state.effective)].sort();
      const sources = Object.fromEntries(paths.map((key) => {
        const source = sourceForConfigPath(state.layers, configKeySegments(key));
        return [key, source ? { layer: source.name, path: source.path } : null];
      }));
      io.stdout.write(`${JSON.stringify({ configuration: state.effective, sources }, null, 2)}\n`);
      return 0;
    }

    if (parsed.command === "list") {
      const prefix = String(parsed.options.prefix || "").trim();
      const paths = [...leafConfigPaths(state.effective)]
        .filter((key) => !prefix || key === prefix || key.startsWith(`${prefix}.`))
        .sort();
      if (!paths.length) throw new Error(prefix ? `no configuration keys match '${prefix}'` : "no configuration keys are available");
      for (const key of paths) {
        const segments = configKeySegments(key);
        const source = sourceForConfigPath(state.layers, segments);
        const value = valueAtPath(state.effective, segments).value;
        io.stdout.write(`${key} = ${formattedConfigValue(value)}\n  source: ${source?.name || "unknown"}${source?.path ? ` (${source.path})` : ""}\n`);
      }
      return 0;
    }

    const key = parsed.options.key;
    const segments = configKeySegments(key);
    if (parsed.command === "get") {
      const resolved = valueAtPath(state.effective, segments);
      if (!resolved.exists) throw new Error(`unknown configuration key: ${key}`);
      const source = sourceForConfigPath(state.layers, segments);
      io.stdout.write(`${key} = ${formattedConfigValue(resolved.value)}\nSource: ${source?.name || "unknown"}${source?.path ? ` (${source.path})` : ""}\n`);
      return 0;
    }

    const scope = parsed.options.scope || "user";
    const target = scope === "project" ? configs.projectConfig : configs.userConfig;
    if (parsed.command === "set") {
      const packageDefault = valueAtPath(state.layers[0].value, segments);
      const value = parseConfigOverride(parsed.options.value, packageDefault.value, key);
      writeSparseConfig(target, key, value);
      io.stdout.write(`Set ${key} = ${formattedConfigValue(value)} in ${scope} configuration: ${target}\n`);
      return 0;
    }

    if (!writeSparseConfig(target, key, undefined, true)) {
      throw new Error(`'${key}' is not set in the ${scope} configuration: ${target}`);
    }
    io.stdout.write(`Removed ${key} from ${scope} configuration: ${target}\n`);
    return 0;
  } catch (error) {
    const message = error.code === "EEXIST" ? "file already exists" : error.message;
    io.stderr.write(`seekbrain: config ${parsed.command} failed: ${message}\n`);
    return 1;
  }
}

function runDoctor(io, runtime) {
  const spawn = runtime.spawnSync || spawnSync;
  const result = spawn(process.execPath, [join(runtime.packageRoot || PACKAGE_ROOT, "scripts", "doctor.mjs")], { stdio: "inherit" });
  if (typeof result.status === "number") return result.status;
  if (result.error) {
    io.stderr.write(`seekbrain: ${result.error.message}\n`);
    return 1;
  }
  return 1;
}

export async function main(args, io = process, runtime = {}) {
  const parsed = parseArgs(args);
  if (parsed.action === "help") {
    io.stdout.write(helpText());
    return 0;
  }
  if (parsed.action === "version") {
    io.stdout.write(`${VERSION}\n`);
    return 0;
  }
  if (parsed.action === "error") {
    io.stderr.write(`seekbrain: ${parsed.message}\nRun 'seekbrain -h' for usage.\n`);
    return parsed.code;
  }
  if (parsed.action === "doctor") return runDoctor(io, runtime);
  if (parsed.action === "setup") {
    return await runPi({ action: "launch", nonInteractive: false, options: { piArgs: [] } }, io, runtime, true);
  }
  if (parsed.action === "config") return configResult(parsed, io, runtime);
  return await runPi(parsed, io, runtime);
}

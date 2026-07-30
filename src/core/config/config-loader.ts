import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import { Value } from "typebox/value";
import { SeekBrainConfigSchema, type SeekBrainConfig } from "../schemas/config.ts";

type ConfigObject = Record<string, unknown>;

export const DEFAULT_SEEKBRAIN_CONFIG: SeekBrainConfig = {
  paths: {},
  modules: {
    targeted_skill: {
      relevance_threshold: 0.5,
      top_k: 1,
      compatibility: {
        candidate_pool_size: 10,
        skill_top_k: 2,
        prefer_repository: true,
        paper_only_fallback: true,
      },
    },
  },
  literature: { providers: {} },
  workflow: {
    debug_disk_writes: false,
    seekbrain: {
      research_planning: true,
      research_survey: true,
      research_planning_peer_review: true,
      research_execution: {
        planning_concurrency: 3,
        execution_concurrency: 2,
      },
      report: {
        pdf: {
          enabled: true,
          command: "seekbrain-pdf",
          timeout_seconds: 120,
        },
      },
      deep_research: false,
      targeted_skill_match: true,
      targeted_skill_generate: true,
      rag_recipe_crystallization: false,
      image_refine: false,
      save_skill: true,
      transparency: true,
      human_review: {
        enabled: true,
        gates: { plan: true, code: false, validate: false, interpret: false },
      },
    },
  },
  agents: {},
  models: [],
};

export interface ConfigLoaderOptions {
  defaults?: ConfigObject;
  defaultConfigPath?: string;
  userConfigPath?: string;
  projectConfigPath?: string;
  env?: NodeJS.ProcessEnv;
  overrides?: ConfigObject;
}

export class ConfigValidationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Invalid SeekBrain configuration:\n${issues.join("\n")}`);
    this.name = "ConfigValidationError";
    this.issues = issues;
  }
}

function isObject(value: unknown): value is ConfigObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function mergeConfig(base: ConfigObject, override: ConfigObject): ConfigObject {
  const merged: ConfigObject = { ...base };
  for (const [key, value] of Object.entries(override)) {
    merged[key] = isObject(value) && isObject(merged[key])
      ? mergeConfig(merged[key] as ConfigObject, value)
      : value;
  }
  return merged;
}

async function readConfigFile(path: string | undefined): Promise<ConfigObject> {
  if (!path) return {};
  try {
    const parsed = parseYaml(await readFile(path, "utf8"));
    if (parsed === null || parsed === undefined) return {};
    if (!isObject(parsed)) throw new Error("configuration root must be an object");
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw new Error(`Unable to read SeekBrain config '${path}': ${String(error)}`, { cause: error });
  }
}

function environmentConfig(env: NodeJS.ProcessEnv): ConfigObject {
  const paths: ConfigObject = {};
  if (env.SEEKBRAIN_DATA_ROOT) paths.data_root = env.SEEKBRAIN_DATA_ROOT;
  if (env.SEEKBRAIN_RESULTS_ROOT) paths.results_root = env.SEEKBRAIN_RESULTS_ROOT;
  if (env.SEEKBRAIN_BENCHMARK_ROOT) paths.benchmark_root = env.SEEKBRAIN_BENCHMARK_ROOT;
  return Object.keys(paths).length ? { paths } : {};
}

function validationIssues(value: unknown): string[] {
  return [...Value.Errors(SeekBrainConfigSchema, value)].map((error) =>
    `${error.instancePath || "/"}: ${error.message}`
  );
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export class ConfigLoader {
  readonly options: ConfigLoaderOptions;

  constructor(options: ConfigLoaderOptions = {}) {
    this.options = options;
  }

  async load(runtimeOverrides: ConfigObject = {}): Promise<Readonly<SeekBrainConfig>> {
    const packageDefaults = await readConfigFile(this.options.defaultConfigPath);
    const user = await readConfigFile(this.options.userConfigPath);
    const project = await readConfigFile(this.options.projectConfigPath);
    const merged = [
      this.options.defaults ?? DEFAULT_SEEKBRAIN_CONFIG,
      packageDefaults,
      user,
      project,
      environmentConfig(this.options.env ?? process.env),
      this.options.overrides ?? {},
      runtimeOverrides,
    ].reduce((result, layer) => mergeConfig(result, layer), {});
    const issues = validationIssues(merged);
    if (issues.length) throw new ConfigValidationError(issues);
    return deepFreeze(merged) as Readonly<SeekBrainConfig>;
  }
}

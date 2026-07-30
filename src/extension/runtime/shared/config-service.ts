import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import {
  ConfigLoader,
  literatureCapabilities,
  literatureQueryConfig,
  resolveAgentConfig,
  type SeekBrainConfig,
} from "../../../core/index.ts";
import type { Json } from "../runtime-types.ts";

export interface ConfigServiceOptions {
  projectRoot: string;
  defaultConfigPath: string;
  configFile: string;
  cacheTtlMs?: number;
}

function parseEnv(text: string) {
  const values: Record<string, string> = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
}

export function createConfigService(options: ConfigServiceOptions) {
  const cacheTtlMs = options.cacheTtlMs ?? 30_000;
  let mergedConfig: Json = {};
  let configCache: Json | undefined;
  let configLoadedAt = 0;
  let configLoadedFromCwd: string | undefined;
  let configInflight: Promise<Json> | undefined;

  function invalidateConfigCache() {
    configCache = undefined;
    configLoadedAt = 0;
    configLoadedFromCwd = undefined;
    configInflight = undefined;
  }

  async function loadConfig(cwd: string) {
    const workflowCwd = options.projectRoot || cwd;
    const userConfigPath = process.env.SEEKBRAIN_USER_CONFIG
      || join(homedir(), ".config", "seekbrain", "config.yaml");
    return await new ConfigLoader({
      defaultConfigPath: options.defaultConfigPath,
      userConfigPath,
      projectConfigPath: process.env.SEEKBRAIN_CONFIG || resolve(workflowCwd, options.configFile),
      env: process.env,
    }).load() as Json;
  }

  async function loadConfigCached(cwd: string): Promise<Json> {
    const now = Date.now();
    const fresh = configCache
      && configLoadedFromCwd === cwd
      && now - configLoadedAt < cacheTtlMs;
    if (fresh) return configCache!;
    if (configInflight) return configInflight;
    configInflight = (async () => {
      try {
        const next = await loadConfig(cwd);
        configCache = next;
        configLoadedAt = Date.now();
        configLoadedFromCwd = cwd;
        mergedConfig = next;
        return next;
      } finally {
        configInflight = undefined;
      }
    })();
    return configInflight;
  }

  function debugDiskWritesEnabled(): boolean {
    return mergedConfig.workflow?.debug_disk_writes === true;
  }

  async function syncWorkflowWritePolicy(cwd: string) {
    mergedConfig = await loadConfigCached(cwd);
  }

  function seekbrainWorkflowConfig(config: Json) {
    const configured = config.workflow?.seekbrain || {};
    const boolValue = (key: string) => configured[key] !== false;
    const literature = literatureCapabilities(config);
    const humanReview = configured.human_review || {};
    const humanReviewEnabled = humanReview.enabled === true && process.env.SEEKBRAIN_NON_INTERACTIVE !== "1";
    const humanReviewGates = humanReview.gates || {};
    return {
      research_planning: configured.research_planning === true,
      research_survey: literature.research_survey,
      research_planning_peer_review: configured.research_planning_peer_review === true,
      deep_research: literature.deep_research,
      targeted_skill_match: literature.targeted_skill_match,
      targeted_skill_generate: literature.targeted_skill_generate,
      rag_recipe_crystallization: configured.rag_recipe_crystallization === true,
      literature_provider: literature.provider,
      has_literature_provider: literature.available,
      image_refine: boolValue("image_refine"),
      save_skill: boolValue("save_skill"),
      transparency: boolValue("transparency"),
      human_review: {
        enabled: humanReviewEnabled,
        gates: {
          plan: humanReviewEnabled && humanReviewGates.plan === true,
          code: humanReviewEnabled && humanReviewGates.code === true,
          validate: humanReviewEnabled && humanReviewGates.validate === true,
          interpret: humanReviewEnabled && (humanReviewGates.interpret === true || humanReviewGates.conclude === true),
        },
      },
    };
  }

  function pickAgentConfig(config: Json, agentName: string) {
    return resolveAgentConfig(config as SeekBrainConfig, agentName);
  }

  function literatureAgentConfig(config: Json, agentName: string): Json {
    const agent = pickAgentConfig(config, agentName);
    return { ...agent, rag: literatureQueryConfig(config, agent.rag || {}) };
  }

  function humanGateEnabled(config: Json, stage: string) {
    const workflow = seekbrainWorkflowConfig(config);
    const gates = workflow.human_review.gates as Record<string, boolean>;
    return workflow.human_review.enabled && gates[stage] === true;
  }

  async function loadEnv(cwd: string) {
    const env = { ...process.env };
    const candidates = [resolve(cwd, ".env"), resolve(options.projectRoot, ".env")];
    for (const path of candidates) {
      try {
        const parsed = parseEnv(await readFile(path, "utf8"));
        for (const [key, value] of Object.entries(parsed)) {
          if (env[key] === undefined || env[key] === "") env[key] = value;
        }
      } catch {
        // Missing .env files are normal.
      }
    }
    return env;
  }

  async function ensureProcessEnvFromDotenv(cwd: string) {
    const env = await loadEnv(cwd);
    for (const [key, value] of Object.entries(env)) {
      if (process.env[key] === undefined || process.env[key] === "") process.env[key] = value;
    }
  }

  return {
    invalidateConfigCache,
    loadConfig,
    loadConfigCached,
    debugDiskWritesEnabled,
    syncWorkflowWritePolicy,
    seekbrainWorkflowConfig,
    pickAgentConfig,
    literatureAgentConfig,
    humanGateEnabled,
    loadEnv,
    ensureProcessEnvFromDotenv,
  };
}

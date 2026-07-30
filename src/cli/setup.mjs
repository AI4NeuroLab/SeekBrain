import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync, chmodSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseDocument } from "yaml";

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DEFAULT_USER_CONFIG_TEMPLATE = readFileSync(join(PACKAGE_ROOT, "config", "default.yaml"), "utf8");

async function defaultRuntimeFactory(runtimeOptions) {
  const { ModelRuntime } = await import("@earendil-works/pi-coding-agent");
  return await ModelRuntime.create(runtimeOptions);
}

const CORE_AGENTS = [
  "seekbrain",
  "seekbrain_deep_research",
  "seekbrain_survey",
  "seekbrain_research_planning",
  "seekbrain_research_reviewer",
  "seekbrain_skill_match",
  "seekbrain_skill_context",
  "seekbrain_skill_generate",
  "seekbrain_plan",
  "seekbrain_code",
  "seekbrain_validate",
  "seekbrain_interpret",
];

const FAST_AGENTS = [
  "seekbrain_default",
  "seekbrain_research_route",
  "seekbrain_refine_image",
];

const AGENT_THINKING = {
  seekbrain: "low",
  seekbrain_default: "off",
  seekbrain_research_route: "off",
  seekbrain_research_planning: "high",
  seekbrain_survey: "low",
  seekbrain_research_reviewer: "low",
  seekbrain_deep_research: "low",
  seekbrain_skill_match: "off",
  seekbrain_skill_context: "off",
  seekbrain_skill_generate: "medium",
  seekbrain_plan: "high",
  seekbrain_code: "high",
  seekbrain_validate: "low",
  seekbrain_interpret: "high",
  seekbrain_refine_image: "off",
};

const OFFICIAL_PROVIDERS = {
  anthropic: { label: "Anthropic", relayId: "anthropic-relay" },
  openai: { label: "OpenAI", relayId: "openai-relay" },
  google: { label: "Google Gemini", relayId: "google-relay" },
};

const LITERATURE_PROVIDERS = {
  semantic_scholar: {
    label: "Semantic Scholar",
    defaultBaseUrl: "https://api.semanticscholar.org/graph/v1",
    requiresKey: true,
  },
  pubmed: {
    label: "PubMed/PMC",
    defaultBaseUrl: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils",
    requiresKey: true,
  },
  ailab_rag: {
    label: "Shanghai AI Lab Paper RAG",
    defaultBaseUrl: "",
    requiresKey: false,
  },
};

const MAINSTREAM_MODELS = {
  anthropic: [
    "claude-opus-4-8", "claude-opus-4-7", "claude-opus-4-6",
    "claude-sonnet-5", "claude-sonnet-4-6", "claude-haiku-4-5",
  ],
  openai: [
    "gpt-5.6-sol", "gpt-5.6-luna", "gpt-5.6-terra", "gpt-5.5-pro",
    "gpt-5.5", "gpt-5.4-pro", "gpt-5.4", "gpt-5.4-mini",
  ],
  google: [
    "gemini-3.5-flash", "gemini-3.1-pro-preview", "gemini-3-flash-preview",
    "gemini-2.5-pro", "gemini-2.5-flash", "gemini-flash-latest",
  ],
};

function readJson(path, fallback = {}) {
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : fallback;
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw new Error(`Unable to read JSON '${path}': ${error.message}`, { cause: error });
  }
}

function readYaml(path, fallback = {}) {
  try {
    const document = parseDocument(readFileSync(path, "utf8"));
    if (document.errors.length) throw document.errors[0];
    const parsed = document.toJS();
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : fallback;
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw new Error(`Unable to read YAML '${path}': ${error.message}`, { cause: error });
  }
}

function atomicWrite(path, content, mode) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(temporary, content, "utf8");
  if (mode !== undefined) chmodSync(temporary, mode);
  renameSync(temporary, path);
}

function normalizeUrl(value) {
  const normalized = String(value).trim();
  if (!normalized) throw new Error("Base URL is required");
  const url = new URL(normalized);
  if (!/^https?:$/.test(url.protocol)) throw new Error("Base URL must use http:// or https://");
  return url.toString().replace(/\/$/, "");
}

function customModel(id, vision) {
  return {
    id,
    name: id,
    reasoning: true,
    input: vision ? ["text", "image"] : ["text"],
    contextWindow: 200000,
    maxTokens: 32000,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  };
}

function catalogModel(model) {
  return {
    id: model.id,
    name: model.name || model.id,
    reasoning: Boolean(model.reasoning),
    input: [...(model.input || ["text"])],
    contextWindow: model.contextWindow,
    maxTokens: model.maxTokens,
    cost: structuredClone(model.cost),
  };
}

export function relayProviderConfig({ name, baseUrl, api, models, modelIds = [], visionModelIds = new Set() }) {
  return {
    name,
    baseUrl: normalizeUrl(baseUrl),
    api,
    ...(api === "openai-completions" ? {
      authHeader: true,
      compat: { supportsDeveloperRole: false, supportsReasoningEffort: false },
    } : {
      compat: { forceAdaptiveThinking: true, supportsEagerToolInputStreaming: false },
    }),
    models: models?.map(catalogModel) || modelIds.map((id) => customModel(id, visionModelIds.has(id))),
  };
}

export function applyModelRouting(document, core, fast = core) {
  for (const name of CORE_AGENTS) {
    document.setIn(["agents", name, "provider"], core.provider);
    document.setIn(["agents", name, "model"], core.model);
    document.setIn(["agents", name, "thinking"], AGENT_THINKING[name] || core.thinking || "high");
  }
  for (const name of FAST_AGENTS) {
    document.setIn(["agents", name, "provider"], fast.provider);
    document.setIn(["agents", name, "model"], fast.model);
    document.setIn(["agents", name, "thinking"], AGENT_THINKING[name] || fast.thinking || "off");
  }
  return document;
}

export function mainstreamModels(models, family) {
  const visionModels = models.filter((model) => (model.input || []).includes("image"));
  const byId = new Map(visionModels.map((model) => [model.id, model]));
  const preferred = (MAINSTREAM_MODELS[family] || []).map((id) => byId.get(id)).filter(Boolean);
  return preferred.length ? preferred : visionModels.filter((model) => model.reasoning).slice(0, 8);
}

async function collectRelay(prompter, family, provider, models) {
  const api = family === "anthropic" ? "anthropic-messages" : "openai-completions";
  const id = provider.relayId || `${family}-relay`;
  const baseUrl = normalizeUrl(await prompter.text("API base URL"));
  const selectedModels = mainstreamModels(models, family);
  if (!selectedModels.length) throw new Error(`No supported ${provider.label} models are available`);
  const key = await prompter.secret(`${provider?.label || "Custom endpoint"} API key`);
  return {
    id,
    family,
    runtimeProvider: id,
    key,
    config: relayProviderConfig({
      name: `${provider.label} custom endpoint`,
      baseUrl,
      api,
      models: selectedModels,
    }),
  };
}

async function collectProvider(prompter, runtime) {
  const family = await prompter.select("Choose a model provider", [
    { id: "anthropic", label: "Anthropic", description: "Claude models" },
    { id: "openai", label: "OpenAI", description: "GPT models" },
    { id: "google", label: "Google Gemini", description: "Gemini models" },
  ], { defaultId: "anthropic" });
  const provider = OFFICIAL_PROVIDERS[family];
  const endpoint = await prompter.select(`${provider.label} API`, [
    { id: "official", label: "Official API", description: "Recommended; uses the official URL" },
    { id: "custom", label: "Custom URL", description: "Use a relay or company gateway" },
  ], { defaultId: "official" });
  if (endpoint === "custom") {
    return await collectRelay(prompter, family, provider, runtime.getModels(family));
  }
  return {
    id: family,
    family,
    runtimeProvider: family,
    key: await prompter.secret(`${provider.label} API key`),
  };
}

export async function collectLiteratureProvider(prompter, env = process.env) {
  const source = await prompter.select("Choose a literature provider", [
    { id: "semantic_scholar", label: "Semantic Scholar - https://api.semanticscholar.org/graph/v1" },
    { id: "pubmed", label: "PubMed/PMC - https://eutils.ncbi.nlm.nih.gov/entrez/eutils" },
    { id: "ailab_rag", label: "Shanghai AI Lab Paper RAG" },
    { id: "none", label: "None", description: "Disable Research Survey, Deep Research, and Recipe Crystallization" },
  ], { defaultId: "none" });
  if (source === "none") return { source: "none", label: "None" };
  const provider = LITERATURE_PROVIDERS[source];
  if (!provider) throw new Error(`Unsupported literature provider: ${source}`);
  const deploymentBaseUrl = source === "ailab_rag" ? String(env.SEEKBRAIN_AILAB_RAG_BASE_URL || "").trim() : "";
  const baseUrl = source === "ailab_rag"
    ? normalizeUrl(String(await prompter.text(`${provider.label} base URL`, { required: !deploymentBaseUrl }) || deploymentBaseUrl))
    : provider.defaultBaseUrl;
  const credentialRef = provider.requiresKey ? `${source}_default` : undefined;
  const apiKey = provider.requiresKey ? String(await prompter.secret(`${provider.label} API key`)).trim() : "";
  if (provider.requiresKey && !apiKey) throw new Error(`${provider.label} API key is required`);
  return { source, label: provider.label, baseUrl, credentialRef, apiKey };
}

function retryAfterMs(response) {
  const value = response.headers.get("retry-after");
  if (!value) return 500;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.min(2000, Math.max(0, seconds * 1000));
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.min(2000, Math.max(0, date - Date.now())) : 500;
}

export async function validateLiteratureProvider(literature, options = {}) {
  if (!literature || literature.source === "none") return { ok: true, warnings: [] };
  const fetchImpl = options.fetchImpl || fetch;
  const sleep = options.sleep || ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const request = async () => {
    if (literature.source === "semantic_scholar") {
      const url = new URL(`${literature.baseUrl.replace(/\/$/, "")}/paper/search`);
      url.search = new URLSearchParams({ query: "neuroscience", limit: "1", fields: "paperId" }).toString();
      return await fetchImpl(url, { headers: { "x-api-key": literature.apiKey }, signal: AbortSignal.timeout(15_000) });
    }
    if (literature.source === "pubmed") {
      const url = new URL(`${literature.baseUrl.replace(/\/$/, "")}/einfo.fcgi`);
      url.search = new URLSearchParams({ db: "pubmed", retmode: "json", tool: "seekbrain", api_key: literature.apiKey }).toString();
      return await fetchImpl(url, { signal: AbortSignal.timeout(15_000) });
    }
    return await fetchImpl(`${literature.baseUrl.replace(/\/$/, "")}/queryfull`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "SeekBrain setup connectivity check", top_k: 1, require_github: false }),
      signal: AbortSignal.timeout(15_000),
    });
  };
  try {
    let response = await request();
    if (literature.source === "semantic_scholar" && response.status === 429) {
      await sleep(retryAfterMs(response));
      response = await request();
      if (response.status === 429) return { ok: true, warnings: ["Semantic Scholar is reachable but rate limited; validation will continue at runtime"] };
    }
    if (response.status === 401 || response.status === 403) return { ok: false, error: "authentication_failed", warnings: [] };
    if (!response.ok) return { ok: false, error: `connection_failed_http_${response.status}`, warnings: [] };
    if (literature.source === "pubmed") {
      const body = await response.clone().json().catch(() => ({}));
      if (body?.error) return { ok: false, error: "authentication_failed", warnings: [] };
    }
    return { ok: true, warnings: [] };
  } catch (error) {
    const timedOut = String(error).toLowerCase().includes("timeout") || error?.name === "TimeoutError";
    return { ok: false, error: timedOut ? "connection_timeout" : "connection_failed", warnings: [] };
  }
}

function friendlyProvider(provider) {
  if (provider === "anthropic") return "Anthropic";
  if (provider === "openai") return "OpenAI";
  if (provider === "google") return "Google Gemini";
  if (provider === "anthropic-proxy" || provider === "anthropic-relay") return "Custom endpoint (Anthropic-compatible)";
  if (provider === "llm-proxy" || provider === "openai-relay") return "Custom endpoint (OpenAI-compatible)";
  return "Custom endpoint";
}

export function selectableModelOptions(models) {
  return models
    .filter((model) => !String(model.provider).startsWith("neuro-"))
    .map((model) => ({
    id: `${model.provider}/${model.id}`,
    label: `${model.name || model.id} · ${friendlyProvider(model.provider)}`,
    description: `${model.reasoning ? "reasoning" : "standard"}, ${(model.input || []).includes("image") ? "vision" : "text-only"}`,
  }));
}

function existingModelConfiguration(settings, config) {
  const configuredCore = config.agents?.seekbrain || {};
  const provider = String(settings.defaultProvider || configuredCore.provider || "").trim();
  const model = String(settings.defaultModel || configuredCore.model || "").trim();
  if (!provider || !model) return undefined;
  const core = {
    provider,
    model,
    thinking: String(settings.defaultThinkingLevel || configuredCore.thinking || "high"),
  };
  const configuredFast = config.agents?.seekbrain_default || {};
  const fast = configuredFast.provider && configuredFast.model ? {
    provider: String(configuredFast.provider),
    model: String(configuredFast.model),
    thinking: String(configuredFast.thinking || "high"),
  } : core;
  return { core, fast };
}

function existingLiteratureConfiguration(config, credentialsPath, env = process.env) {
  const source = String(config.literature?.paper_source || "").trim();
  if (source === "none") {
    return { literature: { source: "none", label: "None" } };
  }
  const provider = LITERATURE_PROVIDERS[source];
  if (!provider) return undefined;
  const configured = config.literature?.providers?.[source] || {};
  const baseUrl = String(configured.base_url || provider.defaultBaseUrl).trim();
  if (!baseUrl) return undefined;
  const credentialRef = String(configured.credential_ref || `${source}_default`).trim();
  let apiKey = "";
  if (provider.requiresKey) {
    const envName = source === "semantic_scholar" ? "SEMANTIC_SCHOLAR_API_KEY" : "NCBI_API_KEY";
    apiKey = String(env[envName] || "").trim();
    if (!apiKey && credentialRef.startsWith("env:")) {
      apiKey = String(env[credentialRef.slice(4).trim()] || "").trim();
    }
    if (!apiKey) {
      const stored = readJson(config.literature?.credential_store || credentialsPath, { credentials: {} });
      apiKey = String(stored.credentials?.[credentialRef]?.api_key || "").trim();
    }
    if (!apiKey) return undefined;
  }
  return {
    literature: {
      source,
      label: provider.label,
      baseUrl,
      ...(provider.requiresKey ? { credentialRef, apiKey } : {}),
    },
  };
}

async function chooseModel(prompter, models, label) {
  const options = selectableModelOptions(models);
  if (!options.length) throw new Error("No supported vision-capable model is available");
  const reference = await prompter.select(`Choose the ${label}`, options);
  const model = models.find((candidate) => `${candidate.provider}/${candidate.id}` === reference);
  return { provider: model.provider, model: model.id, thinking: "high" };
}

function mergeProviderConfigs(modelsPath, additions) {
  const models = readJson(modelsPath, { providers: {} });
  models.providers ||= {};
  for (const addition of additions) {
    if (addition.config) models.providers[addition.id] = addition.config;
  }
  if (additions.some((addition) => addition.config)) {
    atomicWrite(modelsPath, `${JSON.stringify(models, null, 2)}\n`);
  }
}

async function persistCredentials(runtime, additions) {
  for (const addition of additions) {
    await runtime.login(addition.id, "api_key", {
      async prompt(prompt) {
        if (prompt.type === "select") return prompt.options[0]?.id || "";
        return addition.key;
      },
      notify() {},
    });
  }
}

function writeSettings(settingsPath, core) {
  const settings = readJson(settingsPath, {});
  settings.defaultProvider = core.provider;
  settings.defaultModel = core.model;
  settings.defaultThinkingLevel = core.thinking || "high";
  atomicWrite(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
}

export function applyLiteratureConfiguration(document, literature, deepResearchEnabled = false, credentialStorePath) {
  const enabled = literature.source !== "none";
  document.setIn(["literature", "paper_source"], literature.source);
  if (credentialStorePath) document.setIn(["literature", "credential_store"], credentialStorePath);
  if (enabled) {
    document.setIn(["literature", "providers", literature.source, "base_url"], literature.baseUrl);
    if (literature.credentialRef) {
      document.setIn(["literature", "providers", literature.source, "credential_ref"], literature.credentialRef);
    }
  }
  document.setIn(["workflow", "seekbrain", "research_survey"], enabled);
  document.setIn(["workflow", "seekbrain", "deep_research"], enabled && deepResearchEnabled === true);
  document.setIn(["workflow", "seekbrain", "targeted_skill_match"], true);
  document.setIn(["workflow", "seekbrain", "targeted_skill_generate"], enabled);

  // Preserve the current AILab consumers exactly until the compatibility router
  // is introduced. New providers use the global literature block later.
  if (literature.source === "ailab_rag") {
    document.setIn(["agents", "seekbrain_survey", "rag", "paper_source"], "ailab_rag");
    document.setIn(["agents", "seekbrain_survey", "rag", "base_url"], literature.baseUrl);
    document.setIn(["agents", "seekbrain_deep_research", "rag", "paper_source"], "ailab_rag");
    document.setIn(["agents", "seekbrain_deep_research", "rag", "base_url"], literature.baseUrl);
    document.setIn(["modules", "targeted_skill", "rag_base_url"], literature.baseUrl);
  }
  return document;
}

export function writeLiteratureCredentials(path, literature) {
  if (!literature.credentialRef || !literature.apiKey) return false;
  const stored = readJson(path, { version: 1, credentials: {} });
  stored.version = 1;
  stored.credentials ||= {};
  stored.credentials[literature.credentialRef] = { api_key: literature.apiKey };
  atomicWrite(path, `${JSON.stringify(stored, null, 2)}\n`, 0o600);
  return true;
}

function writeSeekBrainConfig(userConfigPath, userTemplate, core, fast, literature, credentialStorePath) {
  const source = existsSync(userConfigPath)
    ? readFileSync(userConfigPath, "utf8")
    : userTemplate || DEFAULT_USER_CONFIG_TEMPLATE;
  const document = parseDocument(source);
  if (document.errors.length) throw new Error(`Invalid SeekBrain user config: ${document.errors[0].message}`);
  applyModelRouting(document, core, fast);
  applyLiteratureConfiguration(document, literature, false, credentialStorePath);
  atomicWrite(userConfigPath, document.toString());
}

export async function runSetup(options = {}) {
  const output = options.output || { write() {} };
  const userHome = options.homeDir || homedir();
  const agentDir = options.agentDir || process.env.PI_CODING_AGENT_DIR || join(userHome, ".pi", "agent");
  const authPath = join(agentDir, "auth.json");
  const modelsPath = join(agentDir, "models.json");
  const settingsPath = join(agentDir, "settings.json");
  const userConfigPath = options.userConfigPath || process.env.SEEKBRAIN_USER_CONFIG || join(userHome, ".config", "seekbrain", "config.yaml");
  const literatureCredentialsPath = options.literatureCredentialsPath
    || process.env.SEEKBRAIN_LITERATURE_CREDENTIALS
    || join(userHome, ".config", "seekbrain", "literature-credentials.json");
  const prompter = options.prompter;
  if (!prompter) throw new Error("Setup requires the interactive Pi interface");
  const runtimeFactory = options.runtimeFactory || defaultRuntimeFactory;
  try {
    output.write("SeekBrain setup\n");
    output.write("Model credentials are stored by Pi; literature keys use SeekBrain's protected credential store. API keys are never written to YAML.\n");
    const existingConfig = readYaml(userConfigPath, {});
    const existingModels = existingModelConfiguration(readJson(settingsPath, {}), existingConfig);
    let core;
    let fast;
    if (existingModels && await prompter.confirm(
      `Keep existing model setup (${existingModels.core.provider}/${existingModels.core.model})?`,
      true,
    )) {
      ({ core, fast } = existingModels);
    } else {
      const initialRuntime = await runtimeFactory({ authPath, modelsPath, allowModelNetwork: false });
      const selectedProvider = await collectProvider(prompter, initialRuntime);
      const additions = [selectedProvider];
      mergeProviderConfigs(modelsPath, additions);
      const runtime = await runtimeFactory({ authPath, modelsPath, allowModelNetwork: false });
      await persistCredentials(runtime, additions);
      await runtime.reloadConfig();
      const available = [...await runtime.getAvailable(selectedProvider.runtimeProvider)];
      const visionModels = mainstreamModels(available, selectedProvider.family);
      if (!visionModels.length) throw new Error("No authenticated vision-capable model is available; SeekBrain validation requires image input support");
      core = await chooseModel(prompter, visionModels, "Core model");
      fast = core;
      if (await prompter.confirm("Use a separate faster/cheaper model for helper stages?", false)) {
        fast = await chooseModel(prompter, visionModels, "Fast model");
      }
    }
    let literature;
    const literatureValidator = options.literatureValidator || validateLiteratureProvider;
    const existingLiterature = existingLiteratureConfiguration(
      existingConfig,
      literatureCredentialsPath,
      options.env || process.env,
    );
    let reuseExistingLiterature = Boolean(existingLiterature) && await prompter.confirm(
      `Keep existing literature setup (${existingLiterature.literature.label})?`,
      true,
    );
    while (true) {
      if (reuseExistingLiterature) {
        literature = existingLiterature.literature;
        reuseExistingLiterature = false;
      } else {
        literature = await collectLiteratureProvider(prompter);
      }
      const validation = await literatureValidator(literature, { fetchImpl: options.fetchImpl });
      for (const warning of validation.warnings || []) output.write(`  Literature warning: ${warning}\n`);
      if (validation.ok) break;
      output.write(`  Literature validation failed: ${validation.error}. No new literature credentials were saved.\n`);
      if (!await prompter.confirm("Retry literature provider setup?", true)) {
        literature = { source: "none", label: "None" };
        break;
      }
    }
    writeSettings(settingsPath, core);
    writeLiteratureCredentials(literatureCredentialsPath, literature);
    writeSeekBrainConfig(userConfigPath, options.userTemplate, core, fast, literature, literatureCredentialsPath);
    output.write("\nSeekBrain setup complete.\n");
    output.write(`  Core: ${core.provider}/${core.model}:${core.thinking}\n`);
    output.write(`  Fast: ${fast.provider}/${fast.model}:${fast.thinking}${fast === core ? " (same as core)" : ""}\n`);
    output.write(`  Literature: ${literature.label}\n`);
    output.write(`  Research Survey: ${literature.source === "none" ? "disabled" : "enabled"}\n`);
    output.write("  Deep Research: disabled (enable manually in config if needed)\n");
    output.write(`  Recipe Crystallization: ${literature.source === "none" ? "disabled" : "enabled"}\n`);
    output.write(`  User config: ${userConfigPath}\n`);
    output.write(`  Pi agent dir: ${agentDir}\n`);
    return { ok: true, core, fast, literature_provider: literature.source, userConfigPath, agentDir };
  } finally {
    prompter.close?.();
  }
}

export async function hasUsableModelConfiguration(options = {}) {
  const userHome = options.homeDir || homedir();
  const agentDir = options.agentDir || process.env.PI_CODING_AGENT_DIR || join(userHome, ".pi", "agent");
  const settings = readJson(join(agentDir, "settings.json"), {});
  let selectedProvider = options.provider || settings.defaultProvider;
  let selectedModel = (options.model || settings.defaultModel)?.replace(/:(off|minimal|low|medium|high|xhigh|max)$/, "");
  if (!selectedProvider || !selectedModel) return false;
  if (!options.runtimeFactory) {
    const auth = readJson(join(agentDir, "auth.json"), {});
    if (auth[selectedProvider]) return true;
    const models = readJson(join(agentDir, "models.json"), {});
    const configuredKey = models.providers?.[selectedProvider]?.apiKey;
    if (typeof configuredKey === "string" && configuredKey) {
      if (configuredKey.startsWith("$") && !configuredKey.startsWith("$$")) {
        const envName = configuredKey.replace(/^\$\{?/, "").replace(/\}?$/, "");
        if (process.env[envName]) return true;
      } else {
        return true;
      }
    }
    const providerEnv = {
      anthropic: "ANTHROPIC_API_KEY",
      openai: "OPENAI_API_KEY",
      google: "GEMINI_API_KEY",
      deepseek: "DEEPSEEK_API_KEY",
      openrouter: "OPENROUTER_API_KEY",
      xai: "XAI_API_KEY",
      mistral: "MISTRAL_API_KEY",
      groq: "GROQ_API_KEY",
      cerebras: "CEREBRAS_API_KEY",
      together: "TOGETHER_API_KEY",
      fireworks: "FIREWORKS_API_KEY",
      "vercel-ai-gateway": "AI_GATEWAY_API_KEY",
      kimi: "KIMI_API_KEY",
      "kimi-coding": "KIMI_API_KEY",
    }[selectedProvider];
    return Boolean(providerEnv && process.env[providerEnv]);
  }
  try {
    const runtimeFactory = options.runtimeFactory;
    const runtime = await runtimeFactory({
      authPath: join(agentDir, "auth.json"),
      modelsPath: join(agentDir, "models.json"),
      allowModelNetwork: false,
    });
    let model = runtime.getModel(selectedProvider, selectedModel);
    if (!model && selectedModel.includes("/")) {
      const separator = selectedModel.indexOf("/");
      const candidateProvider = selectedModel.slice(0, separator);
      const candidateModel = selectedModel.slice(separator + 1);
      const candidate = runtime.getModel(candidateProvider, candidateModel);
      if (candidate) {
        selectedProvider = candidateProvider;
        model = candidate;
      }
    }
    return Boolean(model && runtime.hasConfiguredAuth(selectedProvider));
  } catch {
    return false;
  }
}

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse as parseYaml, parseDocument } from "yaml";
import { applyLiteratureConfiguration, applyModelRouting, collectLiteratureProvider, mainstreamModels, relayProviderConfig, runSetup, selectableModelOptions, validateLiteratureProvider } from "../src/cli/setup.mjs";

let shanghaiOption;
let literatureOptions;
let shanghaiUrlPrompt;
const shanghaiLiterature = await collectLiteratureProvider({
  async select(message, options) {
    assert.equal(message, "Choose a literature provider");
    literatureOptions = options;
    shanghaiOption = options.find((item) => item.id === "ailab_rag");
    return "ailab_rag";
  },
  async text(message) { shanghaiUrlPrompt = message; return ""; },
}, { SEEKBRAIN_AILAB_RAG_BASE_URL: "https://paper-rag.example" });
assert.equal(shanghaiOption.label, "Shanghai AI Lab Paper RAG");
assert.deepEqual(literatureOptions.map((item) => item.id), ["semantic_scholar", "pubmed", "ailab_rag", "none"]);
assert.equal(literatureOptions[0].label, "Semantic Scholar - https://api.semanticscholar.org/graph/v1");
assert.equal(literatureOptions[1].label, "PubMed/PMC - https://eutils.ncbi.nlm.nih.gov/entrez/eutils");
assert.ok(literatureOptions.slice(0, 3).every((item) => item.description === undefined));
assert.equal(literatureOptions[3].description, "Disable Research Survey, Deep Research, and Recipe Crystallization");
assert.equal(shanghaiLiterature.label, "Shanghai AI Lab Paper RAG");
assert.equal(shanghaiLiterature.baseUrl, "https://paper-rag.example");
assert.equal(shanghaiUrlPrompt, "Shanghai AI Lab Paper RAG base URL");
assert.doesNotMatch(shanghaiUrlPrompt, /https?:\/\//);
await assert.rejects(
  collectLiteratureProvider({
    async select() { return "ailab_rag"; },
    async text() { return ""; },
  }, {}),
  /Base URL is required/,
);

const pubmedLiterature = await collectLiteratureProvider({
  async select() { return "pubmed"; },
  async text(message) { throw new Error(`PubMed unexpectedly requested a base URL: ${message}`); },
  async secret(message) {
    assert.equal(message, "PubMed/PMC API key");
    return "pubmed-key";
  },
});
assert.equal(pubmedLiterature.baseUrl, "https://eutils.ncbi.nlm.nih.gov/entrez/eutils");
assert.equal(pubmedLiterature.apiKey, "pubmed-key");

const validationWaits = [];
let validationCalls = 0;
const semanticValidation = await validateLiteratureProvider({
  source: "semantic_scholar", baseUrl: "https://api.semanticscholar.test/graph/v1", apiKey: "validation-secret",
}, {
  sleep: async (milliseconds) => { validationWaits.push(milliseconds); },
  fetchImpl: async (_url, init) => {
    validationCalls += 1;
    assert.equal(init.headers["x-api-key"], "validation-secret");
    return validationCalls === 1
      ? new Response("limited", { status: 429, headers: { "retry-after": "1" } })
      : new Response(JSON.stringify({ data: [{ paperId: "paper" }] }), { status: 200 });
  },
});
assert.deepEqual(semanticValidation, { ok: true, warnings: [] });
assert.deepEqual(validationWaits, [1000]);
assert.doesNotMatch(JSON.stringify(semanticValidation), /validation-secret/);
const failedPubmedValidation = await validateLiteratureProvider({ source: "pubmed", baseUrl: "https://eutils.ncbi.test", apiKey: "pubmed-secret" }, {
  fetchImpl: async () => new Response("forbidden", { status: 403 }),
});
assert.deepEqual(failedPubmedValidation, { ok: false, error: "authentication_failed", warnings: [] });
assert.doesNotMatch(JSON.stringify(failedPubmedValidation), /pubmed-secret/);

const legacyLiterature = parseDocument("modules:\n  targeted_skill:\n    rag_base_url: http://legacy.example\nagents:\n  seekbrain_survey:\n    rag:\n      base_url: http://legacy.example\nworkflow:\n  seekbrain: {}\n");
applyLiteratureConfiguration(legacyLiterature, { source: "ailab_rag", baseUrl: "http://legacy.example" }, false, "/protected/literature-credentials.json");
const migratedLiterature = parseYaml(legacyLiterature.toString());
assert.equal(migratedLiterature.literature.paper_source, "ailab_rag");
assert.equal(migratedLiterature.literature.providers.ailab_rag.base_url, "http://legacy.example");
assert.equal(migratedLiterature.modules.targeted_skill.rag_base_url, "http://legacy.example");

const routed = parseDocument("workflow:\n  seekbrain:\n    deep_research: true\nagents: {}\n");
applyModelRouting(
  routed,
  { provider: "strong", model: "core", thinking: "high" },
  { provider: "quick", model: "fast", thinking: "medium" },
);
const routedConfig = parseYaml(routed.toString());
for (const agent of [
  "seekbrain", "seekbrain_deep_research", "seekbrain_survey", "seekbrain_skill_match", "seekbrain_skill_context",
  "seekbrain_skill_generate", "seekbrain_plan", "seekbrain_code", "seekbrain_validate", "seekbrain_interpret",
]) {
  assert.equal(routedConfig.agents[agent].provider, "strong");
  assert.equal(routedConfig.agents[agent].model, "core");
}
for (const agent of ["seekbrain_default", "seekbrain_refine_image"]) {
  assert.equal(routedConfig.agents[agent].provider, "quick");
  assert.equal(routedConfig.agents[agent].model, "fast");
}
assert.equal(routedConfig.workflow.seekbrain.deep_research, true);

const relay = relayProviderConfig({
  name: "Relay",
  baseUrl: "https://relay.example/v1/",
  api: "openai-completions",
  modelIds: ["relay-core", "relay-fast"],
  visionModelIds: new Set(["relay-core"]),
});
assert.equal(relay.baseUrl, "https://relay.example/v1");
assert.equal(relay.authHeader, true);
assert.deepEqual(relay.models[0].input, ["text", "image"]);
assert.deepEqual(relay.models[1].input, ["text"]);

const pricedRelay = relayProviderConfig({
  name: "Priced relay",
  baseUrl: "https://relay.example/v1",
  api: "openai-completions",
  models: [{
    id: "gpt-priced", name: "GPT Priced", reasoning: true,
    input: ["text", "image"], contextWindow: 272000, maxTokens: 128000,
    cost: { input: 5, output: 30, cacheRead: 0.5, cacheWrite: 0 },
  }],
});
assert.deepEqual(pricedRelay.models[0].cost, { input: 5, output: 30, cacheRead: 0.5, cacheWrite: 0 });
assert.equal(pricedRelay.models[0].contextWindow, 272000);

const work = await mkdtemp(join(tmpdir(), "seekbrain-setup-test-"));
const publicModels = selectableModelOptions([
  { provider: "openai", id: "gpt-vision", name: "GPT Vision", input: ["text", "image"] },
  { provider: "neuro-proxy", id: "internal", input: ["text", "image"] },
  { provider: "llm-proxy", id: "relay-model", input: ["text", "image"] },
]);
assert.deepEqual(publicModels.map((item) => item.id), ["openai/gpt-vision", "llm-proxy/relay-model"]);
assert.match(publicModels[0].label, /GPT Vision · OpenAI/);
assert.match(publicModels[1].label, /Custom endpoint/);
assert.doesNotMatch(publicModels.map((item) => item.label).join(" "), /neuro|llm-proxy/);
assert.deepEqual(mainstreamModels([
  { provider: "anthropic", id: "claude-opus-4-6", input: ["text", "image"] },
  { provider: "anthropic", id: "claude-opus-4-7", input: ["text", "image"] },
], "anthropic").map((item) => item.id), ["claude-opus-4-7", "claude-opus-4-6"]);

const selected = [];
const prompter = {
  async select(message, options) {
    if (message === "Choose a model provider") return "openai";
    if (message === "OpenAI API") return "official";
    if (message === "Choose the Core model") return "openai/core-vision";
    if (message === "Choose the Fast model") return "openai/fast-vision";
    if (message === "Choose a literature provider") return "none";
    throw new Error(`Unexpected select: ${message} (${options.map((item) => item.id).join(",")})`);
  },
  async secret() { return "test-key"; },
  async confirm(message) { return message.startsWith("Use a separate"); },
  close() {},
};
const fakeRuntime = {
  getProviders() { return []; },
  getModels() { return []; },
  hasConfiguredAuth() { return false; },
  async login(provider, type, interaction) {
    selected.push({ provider, type, key: await interaction.prompt({ type: "secret" }) });
  },
  async reloadConfig() {},
  async getAvailable() {
    return [
      { provider: "openai", id: "core-vision", reasoning: true, input: ["text", "image"] },
      { provider: "openai", id: "fast-vision", reasoning: true, input: ["text", "image"] },
      { provider: "openai", id: "text-only", reasoning: true, input: ["text"] },
    ];
  },
};
let output = "";
const result = await runSetup({
  homeDir: work,
  prompter,
  output: { write(value) { output += value; } },
  runtimeFactory: async () => fakeRuntime,
  userTemplate: "workflow:\n  seekbrain:\n    deep_research: true\nagents: {}\n",
});
assert.equal(result.ok, true);
assert.deepEqual(selected, [{ provider: "openai", type: "api_key", key: "test-key" }]);
assert.match(output, /Core: openai\/core-vision:high/);
assert.match(output, /Fast: openai\/fast-vision:high/);
assert.match(output, /Literature: None/);
const settings = JSON.parse(await readFile(join(work, ".pi", "agent", "settings.json"), "utf8"));
assert.deepEqual(settings, {
  defaultProvider: "openai",
  defaultModel: "core-vision",
  defaultThinkingLevel: "high",
});
const userConfig = parseYaml(await readFile(join(work, ".config", "seekbrain", "config.yaml"), "utf8"));
assert.equal(userConfig.agents.seekbrain.model, "core-vision");
assert.equal(userConfig.agents.seekbrain_default.model, "fast-vision");
assert.equal(userConfig.agents.seekbrain_interpret.model, "core-vision");
assert.equal(userConfig.literature.paper_source, "none");
assert.equal(userConfig.workflow.seekbrain.research_survey, false);
assert.equal(userConfig.workflow.seekbrain.deep_research, false);
assert.equal(userConfig.workflow.seekbrain.targeted_skill_match, true);
assert.equal(userConfig.workflow.seekbrain.targeted_skill_generate, false);
await rm(work, { recursive: true, force: true });

const literatureWork = await mkdtemp(join(tmpdir(), "seekbrain-literature-setup-test-"));
let secretIndex = 0;
const literaturePrompter = {
  async select(message, options) {
    if (message === "Choose a model provider") return "openai";
    if (message === "OpenAI API") return "official";
    if (message === "Choose the Core model") return "openai/core-vision";
    if (message === "Choose a literature provider") return "semantic_scholar";
    throw new Error(`Unexpected literature select: ${message} (${options.map((item) => item.id).join(",")})`);
  },
  async text() { return ""; },
  async secret() { return ["model-key", "semantic-key"][secretIndex++]; },
  async confirm() { return false; },
  close() {},
};
try {
  await runSetup({
    homeDir: literatureWork,
    prompter: literaturePrompter,
    output: { write() {} },
    runtimeFactory: async () => fakeRuntime,
    literatureValidator: async () => ({ ok: true, warnings: [] }),
    userTemplate: "workflow:\n  seekbrain: {}\nagents: {}\n",
  });
  const literatureConfig = parseYaml(await readFile(join(literatureWork, ".config", "seekbrain", "config.yaml"), "utf8"));
  const credentialsPath = join(literatureWork, ".config", "seekbrain", "literature-credentials.json");
  const credentials = JSON.parse(await readFile(credentialsPath, "utf8"));
  assert.equal(literatureConfig.literature.paper_source, "semantic_scholar");
  assert.equal(literatureConfig.literature.providers.semantic_scholar.credential_ref, "semantic_scholar_default");
  assert.equal(literatureConfig.workflow.seekbrain.research_survey, true);
  assert.equal(literatureConfig.workflow.seekbrain.deep_research, false);
  assert.equal(literatureConfig.workflow.seekbrain.targeted_skill_generate, true);
  assert.doesNotMatch(await readFile(join(literatureWork, ".config", "seekbrain", "config.yaml"), "utf8"), /semantic-key/);
  assert.equal(credentials.credentials.semantic_scholar_default.api_key, "semantic-key");
  assert.equal((await stat(credentialsPath)).mode & 0o777, 0o600);

  const configPath = join(literatureWork, ".config", "seekbrain", "config.yaml");
  const manuallyEnabled = (await readFile(configPath, "utf8")).replace("deep_research: false", "deep_research: true");
  await writeFile(configPath, manuallyEnabled, "utf8");
  const reusePrompts = [];
  const reused = await runSetup({
    homeDir: literatureWork,
    prompter: {
      async select(message) { throw new Error(`Existing setup unexpectedly selected: ${message}`); },
      async text(message) { throw new Error(`Existing setup unexpectedly requested text: ${message}`); },
      async secret(message) { throw new Error(`Existing setup unexpectedly requested a secret: ${message}`); },
      async confirm(message, defaultValue) {
        reusePrompts.push({ message, defaultValue });
        return true;
      },
      close() {},
    },
    output: { write() {} },
    runtimeFactory: async () => { throw new Error("Existing model setup unexpectedly initialized the model runtime"); },
    literatureValidator: async (literature) => {
      assert.equal(literature.source, "semantic_scholar");
      assert.equal(literature.apiKey, "semantic-key");
      return { ok: true, warnings: [] };
    },
    userTemplate: "workflow:\n  seekbrain: {}\nagents: {}\n",
  });
  assert.equal(reused.ok, true);
  assert.deepEqual(reusePrompts, [
    { message: "Keep existing model setup (openai/core-vision)?", defaultValue: true },
    { message: "Keep existing literature setup (Semantic Scholar)?", defaultValue: true },
  ]);
  const reusedConfig = parseYaml(await readFile(configPath, "utf8"));
  assert.equal(reusedConfig.workflow.seekbrain.deep_research, false);
  assert.equal((await stat(credentialsPath)).mode & 0o777, 0o600);
} finally {
  await rm(literatureWork, { recursive: true, force: true });
}

// Exercise Pi's real credential store in an isolated home. This verifies that
// setup creates auth.json through ModelRuntime.login rather than owning secret
// serialization itself.
const realWork = await mkdtemp(join(tmpdir(), "seekbrain-setup-pi-runtime-"));
const realPrompter = {
  async select(message, options) {
    if (message === "Choose a model provider") return "openai";
    if (message === "OpenAI API") return "official";
    if (message === "Choose the Core model") return options[0].id;
    if (message === "Choose a literature provider") return "none";
    throw new Error(`Unexpected real-runtime select: ${message}`);
  },
  async secret() { return "isolated-test-key"; },
  async confirm() { return false; },
  close() {},
};
try {
  await runSetup({
    homeDir: realWork,
    prompter: realPrompter,
    output: { write() {} },
    userTemplate: "workflow:\n  seekbrain:\n    deep_research: true\nagents: {}\n",
  });
  const auth = JSON.parse(await readFile(join(realWork, ".pi", "agent", "auth.json"), "utf8"));
  assert.deepEqual(auth.openai, { type: "api_key", key: "isolated-test-key" });
} finally {
  await rm(realWork, { recursive: true, force: true });
}

console.log("SeekBrain setup supports reusable credentials, saved routing, and one-shot CLI exit");

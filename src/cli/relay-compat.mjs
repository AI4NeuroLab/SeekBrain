import { existsSync, readFileSync, realpathSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// A gateway's model catalog does not establish support for Anthropic's beta
// transport. In particular, Bedrock rejects effort-only system messages.
export const ANTHROPIC_RELAY_COMPAT = Object.freeze({
  supportsMidConvoEffort: false,
  supportsMidConvoSystemMessages: false,
  supportsMidConvoToolChanges: false,
});

export function relayModel(model) {
  return model.api === "anthropic-messages"
    ? { ...model, compat: { ...model.compat, ...ANTHROPIC_RELAY_COMPAT } }
    : model;
}

/** Upgrade only SeekBrain's own relay, leaving official/custom providers intact. */
export function ensureRelayCompatibility(options = {}) {
  const env = options.env || process.env;
  const agentDir = options.agentDir || env.SEEKBRAIN_CODING_AGENT_DIR || env.PI_CODING_AGENT_DIR
    || join(options.homeDir || homedir(), ".pi", "agent");
  const configuredPath = options.modelsPath || join(agentDir, "models.json");
  if (!existsSync(configuredPath)) return false;
  const path = realpathSync(configuredPath);
  const original = readFileSync(path, "utf8");
  const config = JSON.parse(original);
  const provider = config.providers?.["anthropic-relay"];
  if (!provider || provider.api !== "anthropic-messages") return false;
  const before = JSON.stringify(provider);
  provider.compat = { ...provider.compat, ...ANTHROPIC_RELAY_COMPAT };
  provider.models = (provider.models || []).map(model => relayModel({ ...model, api: model.api || provider.api }));
  if (JSON.stringify(provider) === before) return false;
  const temporary = `${path}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(temporary, JSON.stringify(config, null, 2) + "\n", { mode: 0o600 });
  renameSync(temporary, path);
  return true;
}

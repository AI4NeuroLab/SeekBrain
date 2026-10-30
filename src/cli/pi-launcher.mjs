#!/usr/bin/env node

import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { configureBundledTools } from "./bundled-tools.mjs";
import { ensureRelayCompatibility } from "./relay-compat.mjs";
import { installAnthropicThinkingCompatibility } from "../compat/anthropic-thinking.mjs";

configureBundledTools();
ensureRelayCompatibility();

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const piEntry = fileURLToPath(import.meta.resolve("@earendil-works/pi-coding-agent"));
const piRoot = resolve(dirname(piEntry), "..");
const originalPackageDir = process.env.PI_PACKAGE_DIR;

// Pi derives its display command from package metadata at module load time.
// Load that metadata from SeekBrain so exit/resume instructions use the public
// SeekBrain command, then restore Pi's normal package root for themes and other
// bundled assets.
process.env.PI_PACKAGE_DIR = packageRoot;
const config = await import(pathToFileURL(join(piRoot, "dist", "config.js")).href);
if (originalPackageDir === undefined) delete process.env.PI_PACKAGE_DIR;
else process.env.PI_PACKAGE_DIR = originalPackageDir;

if (process.env.PI_CODING_AGENT_DIR && !process.env.SEEKBRAIN_CODING_AGENT_DIR) {
  process.env.SEEKBRAIN_CODING_AGENT_DIR = process.env.PI_CODING_AGENT_DIR;
}
if (process.env.PI_CODING_AGENT_SESSION_DIR && !process.env.SEEKBRAIN_CODING_AGENT_SESSION_DIR) {
  process.env.SEEKBRAIN_CODING_AGENT_SESSION_DIR = process.env.PI_CODING_AGENT_SESSION_DIR;
}

const [{ configureHttpDispatcher }, { SettingsManager }, { ModelRuntime }] = await Promise.all([
  import(pathToFileURL(join(piRoot, "dist", "core", "http-dispatcher.js")).href),
  import(pathToFileURL(join(piRoot, "dist", "core", "settings-manager.js")).href),
  import(pathToFileURL(join(piRoot, "dist", "core", "model-runtime.js")).href),
]);

// Pi's CLI constructs its runtime internally. Keep this shim in SeekBrain's
// process, so CLI sessions (including resume) use the same transport as the web.
installAnthropicThinkingCompatibility(ModelRuntime.prototype, { agentDir: config.getAgentDir() });

// SeekBrain owns the product shell, so Pi's generic onboarding and loaded
// resource inventory stay hidden. Passing Pi's explicit --verbose flag still
// reveals them for diagnostics.
SettingsManager.prototype.getQuietStartup = function getSeekBrainQuietStartup() {
  return true;
};

const { InteractiveMode } = await import(pathToFileURL(join(piRoot, "dist", "modes", "interactive", "interactive-mode.js")).href);
InteractiveMode.prototype.checkForPackageUpdates = async function skipSeekBrainPackageUpdateBanner() {
  return [];
};
InteractiveMode.prototype.getChangelogForDisplay = function skipSeekBrainPiChangelog() {
  return undefined;
};

const { main } = await import(pathToFileURL(join(piRoot, "dist", "main.js")).href);

process.title = config.APP_NAME;
process.env.PI_CODING_AGENT = "true";
process.emitWarning = (() => {});
configureHttpDispatcher();
await main(process.argv.slice(2));

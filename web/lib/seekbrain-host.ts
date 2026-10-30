import { ModelRuntime, type InlineExtension } from "@earendil-works/pi-coding-agent";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { sanitizeProjectCommandEnvironment } from "./project-command-env";

/** Load source with SeekBrain's own jiti; keep its large TS graph outside Next's bundler. */
let modules: ReturnType<typeof importSeekBrain> | undefined;
function loadSeekBrain() {
  return modules ??= importSeekBrain();
}

async function importSeekBrain() {
  const root = resolve(process.env.SEEKBRAIN_PACKAGE_ROOT || join(process.cwd(), ".."));
  if (JSON.parse(readFileSync(join(root, "package.json"), "utf8")).name !== "seekbrain") {
    throw new Error("SEEKBRAIN_PACKAGE_ROOT must point to the SeekBrain installation");
  }
  const loader = await import(/* webpackIgnore: true */ pathToFileURL(join(root, "src/cli/web-host.mjs")).href);
  return loader.loadSeekBrainModules(root);
}

export async function createSeekBrainHost(cwd: string, agentDir: string) {
  const api = await loadSeekBrain();
  api.ensureRelayCompatibility({ agentDir });
  const config = api.createConfigService({
    projectRoot: cwd, defaultConfigPath: join(api.root, "config/default.yaml"),
    configFile: "seekbrain.config.yaml", env: sanitizeProjectCommandEnvironment(process.env),
  });
  const env = await config.loadEnv(cwd);
  const effective = await config.loadConfig(cwd);
  const primary = effective.agents?.seekbrain ?? {};
  const runtime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: join(agentDir, "models.json"), allowModelNetwork: false });
  const extension: InlineExtension = {
    name: "seekbrain",
    factory: pi => api.register(pi, { projectRoot: cwd, env }),
  };
  return { extension, env, primary, modelRuntime: api.withModelEnvironment(runtime, env, { agentDir }) as ModelRuntime };
}

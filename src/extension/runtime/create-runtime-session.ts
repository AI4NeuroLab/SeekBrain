import { existsSync, watch, type FSWatcher } from "node:fs";
import { resolve } from "node:path";
import type { Json } from "./runtime-types.ts";

export interface RuntimeSessionDependencies {
  projectRoot: string;
  configFile: string;
  env?: NodeJS.ProcessEnv;
  invalidateConfig(): void;
  loadConfig(cwd: string): Promise<Json>;
}

export function createRuntimeSession(deps: RuntimeSessionDependencies) {
  const env = { ...(deps.env ?? process.env) };
  let activeRunDir: string | undefined;
  let configWatcher: FSWatcher | undefined;
  let configWatchedPath: string | undefined;

  const stopConfigWatcher = () => {
    if (!configWatcher) return;
    try {
      configWatcher.close();
    } catch {
      // Best-effort watcher cleanup.
    }
    configWatcher = undefined;
    configWatchedPath = undefined;
  };

  return {
    getActiveRunDir() {
      return activeRunDir;
    },

    setActiveRunDir(path: string | undefined) {
      activeRunDir = path;
    },

    startConfigWatcher(
      cwd: string,
      notify?: (message: string, level?: "info" | "warning" | "error") => void,
    ) {
      const workflowCwd = deps.projectRoot || cwd;
      const path = env.SEEKBRAIN_CONFIG || resolve(workflowCwd, deps.configFile);
      if (configWatcher && configWatchedPath === path) return;
      stopConfigWatcher();
      if (!existsSync(path)) return;
      try {
        configWatcher = watch(path, { persistent: false }, () => {
          deps.invalidateConfig();
          deps.loadConfig(cwd)
            .then(() => notify?.("SeekBrain config reloaded", "info"))
            .catch((error) => notify?.(`SeekBrain config reload failed: ${String(error)}`, "warning"));
        });
        configWatchedPath = path;
      } catch {
        // TTL-based config refresh remains available when watch is unavailable.
      }
    },

    stopConfigWatcher,
  };
}

export type RuntimeSession = ReturnType<typeof createRuntimeSession>;

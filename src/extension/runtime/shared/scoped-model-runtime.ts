import { access } from "node:fs/promises";
import { installAnthropicThinkingCompatibility } from "../../../compat/anthropic-thinking.mjs";

/** Keep provider environment overrides on a session's SDK calls, never process.env. */
export function withModelEnvironment<T extends object>(runtime: T, environment: NodeJS.ProcessEnv, options: { agentDir?: string } = {}): T {
  installAnthropicThinkingCompatibility(runtime, { agentDir: options.agentDir || environment.SEEKBRAIN_CODING_AGENT_DIR || environment.PI_CODING_AGENT_DIR });
  const env = Object.fromEntries(Object.entries(environment).filter((entry): entry is [string, string] => entry[1] !== undefined));
  const calls = new Set(["stream", "streamSimple", "complete", "completeSimple", "streamDeferred", "fetchDeferred", "cancelDeferred", "generateImages", "classify"]);
  const target = runtime as any;
  let available: any[] | undefined;
  const methods = new Map<PropertyKey, unknown>();
  return new Proxy(runtime, {
    get(_target, property) {
      if (methods.has(property)) return methods.get(property);
      const value = Reflect.get(target, property, target);
      if (typeof value !== "function") return value;
      let method;
      if (typeof property === "string" && calls.has(property)) {
        method = (model: unknown, input: unknown, options?: any) => value.call(target, model, input, { ...options, env: { ...env, ...options?.env } });
      } else if (property === "getAuth" || property === "checkAuth") {
        method = (provider: unknown, options?: any) => value.call(target, provider, { ...options, env: { ...env, ...options?.env } });
      } else if (property === "getAvailable") {
        method = async (provider?: string, options?: any) => {
          // Pi 1.2 getAvailable() does not accept env overrides, although stream/getAuth do.
          // Preserve stored-auth filtering, then add only providers authenticated by this env.
          const result = [...await value.call(target, provider, options)];
          const configured = new Set(result.map(model => model.provider));
          const stored = new Set((await target.listCredentials(options)).map((item: any) => item.providerId));
          const ctx = { env: async (name: string) => env[name], fileExists: async (path: string) => { try { await access(path); return true; } catch { return false; } } };
          for (const item of target.getProviders()) {
            if ((provider && item.id !== provider) || configured.has(item.id) || stored.has(item.id) || !item.auth.apiKey?.check) continue;
            const auth = await item.auth.apiKey.check({ ctx, credential: undefined, signal: options?.signal ?? new AbortController().signal });
            if (auth) result.push(...(item.filterModels?.(item.getModels(), undefined) ?? item.getModels()));
          }
          if (!provider) available = result;
          return result;
        };
      } else if (property === "getAvailableSnapshot") {
        method = () => available ?? value.call(target);
      } else if (property === "hasConfiguredAuth") {
        method = (provider: string) => available?.some(model => model.provider === provider) || value.call(target, provider);
      } else method = value.bind(target);
      methods.set(property, method);
      return method;
    },
  });
}

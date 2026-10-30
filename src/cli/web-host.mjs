import { createRequire } from "node:module";
import { join } from "node:path";

// Loaded by native import at runtime: Next must not rewrite createRequire/jiti.
export async function loadSeekBrainModules(root) {
  const require = createRequire(join(root, "package.json"));
  const jiti = require("jiti").createJiti(join(root, "package.json"));
  const [entry, config, scoped, relay] = await Promise.all([
    jiti.import(join(root, "src/extension/index.ts")),
    jiti.import(join(root, "src/extension/runtime/shared/config-service.ts")),
    jiti.import(join(root, "src/extension/runtime/shared/scoped-model-runtime.ts")),
    import("./relay-compat.mjs"),
  ]);
  return { root, register: entry.default, createConfigService: config.createConfigService,
    withModelEnvironment: scoped.withModelEnvironment, ensureRelayCompatibility: relay.ensureRelayCompatibility };
}

import { delimiter } from "node:path";

// Windows passes only one case-insensitive variant of each key to children.
export function mergeEnvironment(base, overrides, platform = process.platform) {
  const result = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    if (platform === "win32") {
      for (const existing of Object.keys(result)) {
        if (existing.toLowerCase() === key.toLowerCase()) delete result[existing];
      }
    }
    result[key] = value;
  }
  return result;
}

export function prependPath(env, directory, platform = process.platform) {
  const separator = platform === "win32" ? ";" : delimiter;
  const keys = Object.keys(env).filter(key => platform === "win32" ? key.toLowerCase() === "path" : key === "PATH");
  const key = keys[0] || "PATH";
  const normalize = value => platform === "win32" ? value.replace(/\\/g, "/").toLowerCase() : value;
  const entries = keys.flatMap(name => (env[name] || "").split(separator)).filter(Boolean);
  const paths = [directory, ...entries].filter((value, index, all) => all.findIndex(other => normalize(other) === normalize(value)) === index);
  for (const name of keys) delete env[name];
  env[key] = paths.join(separator);
  return env;
}

import { spawnSync } from "node:child_process";
import { posix, win32 } from "node:path";

export function pythonProcessEnvironment(env = process.env, platform = process.platform) {
  return platform === "win32" ? { PYTHONUTF8: "1", PYTHONIOENCODING: "utf-8", ...env } : env;
}

export function activePythonEnvironment(env = process.env, platform = process.platform) {
  const paths = platform === "win32" ? win32 : posix;
  const virtual = String(env.VIRTUAL_ENV || "").trim();
  const conda = String(env.CONDA_PREFIX || "").trim();
  const prefix = virtual || conda;
  if (!prefix) return undefined;
  return {
    kind: virtual ? /** @type {const} */ ("virtualenv") : /** @type {const} */ ("conda"),
    name: (!virtual && env.CONDA_DEFAULT_ENV) || paths.basename(prefix) || "active",
    python: platform === "win32"
      ? paths.join(prefix, ...(virtual ? ["Scripts", "python.exe"] : ["python.exe"]))
      : paths.join(prefix, "bin", "python"),
  };
}

export function resolvePythonCommand(env = process.env, platform = process.platform, probe = spawnSync) {
  const explicit = String(env.SEEKBRAIN_PYTHON || "").trim();
  if (explicit) return explicit;
  const active = activePythonEnvironment(env, platform);
  if (active) return active.python;
  const candidates = platform === "win32" ? ["python", "python3"] : ["python3", "python"];
  for (const command of candidates) {
    // A successful interpreter probe also excludes Windows Store aliases.
    const result = probe(command, ["-c", "import sys; print(sys.executable)"], {
      env: pythonProcessEnvironment(env, platform), encoding: "utf8", timeout: 5000, windowsHide: true,
    });
    if (!result.error && result.status === 0 && String(result.stdout || "").trim()) return String(result.stdout).trim();
  }
  return candidates[0];
}

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const root = dirname(fileURLToPath(import.meta.url));
const windows = process.platform === "win32";
const runtimePython = join(root, "runtime", "python", ...(windows ? ["python.exe"] : ["bin", "python3"]));
const manifest = JSON.parse(readFileSync(join(root, "bundle.json"), "utf8"));
const managedPython = process.env.SEEKBRAIN_INSTALL_PREFIX && join(process.env.SEEKBRAIN_INSTALL_PREFIX, "environments", `python-${manifest.python.version}`, ...(windows ? ["Scripts", "python.exe"] : ["bin", "python"]));
const fallbackPython = managedPython && existsSync(managedPython) ? managedPython : runtimePython;
const args = process.argv.slice(2), pdf = args[0] === "--pdf-command";
if (pdf) args.shift();
const env = { ...process.env };
const key = Object.keys(env).find(key => key.toLowerCase() === "path") || "PATH";
const paths = [dirname(process.execPath)];
if (windows && existsSync(join(root, "runtime", "git", "bin", "bash.exe"))) paths.push(join(root, "runtime", "git", "bin"), join(root, "runtime", "git", "cmd"));
// Explicit choices and activated user environments take precedence over the fallback.
if (!env.SEEKBRAIN_PYTHON && !env.VIRTUAL_ENV && !env.CONDA_PREFIX) {
  env.SEEKBRAIN_PYTHON = fallbackPython;
  paths.push(dirname(fallbackPython));
}
env[key] = [...paths, env[key] || ""].join(windows ? ";" : ":");
env.SEEKBRAIN_BUNDLE_ROOT = root;
const child = spawn(process.execPath, [join(root, "app", "bin", pdf ? "seekbrain-pdf.mjs" : "seekbrain.mjs"), ...args], { env, stdio: "inherit", windowsHide: false });
child.once("error", error => { console.error(error.message); process.exitCode = 1; });
child.once("exit", code => { process.exitCode = code ?? 1; });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));

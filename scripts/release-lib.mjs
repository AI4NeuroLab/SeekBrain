import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, mkdir, readFile, rename, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { windowsPowerShellEnvironment } from "../src/platform/environment.mjs";

export const ROOT = fileURLToPath(new URL("..", import.meta.url));
export const RELEASE_CONFIG = JSON.parse(await readFile(new URL("../release/targets.json", import.meta.url), "utf8"));
export function releaseVersion(value) {
  const match = typeof value === "string" && value.match(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/);
  if (!match || match[0] !== value) throw new Error("Use a version such as 0.1.4 or 0.1.4-preview.1");
  return value;
}
export function artifactName(version, target) {
  releaseVersion(version);
  const spec = RELEASE_CONFIG.targets[target];
  if (!spec) throw new Error(`Unsupported release target: ${target}`);
  const publicTarget = target.replace("darwin-", "macos-").replace("win32-", "windows-");
  return `seekbrain-${version}-${publicTarget}.${spec.extension}`;
}
export async function sha256(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}
export function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const settings = { stdio: "inherit", windowsHide: true, ...options };
    if (process.platform === "win32" && /(?:^|[\\/])powershell(?:\.exe)?$/i.test(command)) {
      settings.env = windowsPowerShellEnvironment(settings.env || process.env);
    }
    const child = spawn(command, args, settings);
    child.once("error", reject);
    child.once("exit", code => code === 0 ? resolve() : reject(new Error(`${command} failed (${code})`)));
  });
}
export async function downloadVerified(asset, cache, { offline = false } = {}) {
  if (!/^[a-f0-9]{64}$/.test(asset.sha256) || !/^https:\/\//.test(asset.url) || /[/\\]/.test(asset.file)) throw new Error("Invalid pinned upstream asset");
  await mkdir(cache, { recursive: true });
  const destination = join(cache, asset.file);
  try {
    await access(destination);
    if (await sha256(destination) !== asset.sha256) throw new Error(`SHA-256 mismatch in cache: ${asset.file}`);
    return destination;
  } catch (error) { if (error.code !== "ENOENT") throw error; }
  if (offline) throw new Error(`Offline cache is missing ${asset.file}`);
  const partial = `${destination}.${process.pid}.download`;
  try {
    await run(process.platform === "win32" ? "curl.exe" : "curl", ["--fail", "--location", "--silent", "--show-error", "--retry", "2", "--connect-timeout", "15", "--max-time", "600", "--output", partial, asset.url]);
    if (await sha256(partial) !== asset.sha256) throw new Error(`SHA-256 mismatch: ${asset.file}`);
    await rename(partial, destination);
    return destination;
  } finally { await rm(partial, { force: true }); }
}
export async function extract(archive, directory) {
  await mkdir(directory, { recursive: true });
  await run("tar", ["-xf", archive, "-C", directory]);
}
export function nodeExecutable(root, target = `${process.platform}-${process.arch}`) {
  return join(root, "runtime", "node", ...(target.startsWith("win32-") ? ["node.exe"] : ["bin", "node"]));
}
export function pythonExecutable(root, target = `${process.platform}-${process.arch}`) {
  return join(root, "runtime", "python", RELEASE_CONFIG.targets[target].pythonExecutable);
}

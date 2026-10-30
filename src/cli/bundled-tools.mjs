import { accessSync, constants, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { TOOL_PACKAGES } from "./tool-packages.mjs";
import { prependPath } from "../platform/environment.mjs";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export function configureBundledTools(env = process.env, root = packageRoot, platform = process.platform, arch = process.arch) {
  const target = `${platform}-${arch}`;
  const name = TOOL_PACKAGES[target];
  if (!name) return undefined;
  let toolRoot;
  try { toolRoot = dirname(createRequire(join(root, "package.json")).resolve(`${name}/package.json`)); }
  catch {
    // Source checkouts use the sibling packages before their first npm release.
    // This build script and packages/ are deliberately excluded from npm packs.
    if (existsSync(join(root, "scripts", "bundle-tools.mjs"))) toolRoot = join(root, "packages", name);
    else throw new Error(`Required tool package ${name} is missing. Reinstall with: npm install -g seekbrain --include=optional. Do not use --omit=optional.`);
  }
  const directory = join(toolRoot, "bin");
  for (const tool of ["fd", "rg"]) {
    try { accessSync(join(directory, platform === "win32" ? `${tool}.exe` : tool), platform === "win32" ? constants.F_OK : constants.X_OK); }
    catch { throw new Error(`${tool} in ${name} is missing or not executable. Reinstall with: npm install -g seekbrain --include=optional.`); }
  }
  prependPath(env, directory, platform);
  return directory;
}

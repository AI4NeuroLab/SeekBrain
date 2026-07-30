import { createHash, randomUUID } from "node:crypto";
import { cp, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";

type Json = Record<string, any>;

export interface SkillLibraryManagerOptions {
  packageRoot: string;
  userSkillsRoot?: string;
  packageVersion?: string;
}

const MANAGED_SCHEMA_VERSION = 2;

async function bundledRecipeDirectories(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  if (entries.some((entry) => entry.isFile() && entry.name === "SKILL.md")) return [root];
  const found: string[] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory() || entry.name.startsWith(".") || entry.name === ".cache") continue;
    found.push(...await bundledRecipeDirectories(join(root, entry.name)));
  }
  return found;
}

async function managedMarker(path: string): Promise<Json | undefined> {
  try { return JSON.parse(await readFile(path, "utf8")) as Json; }
  catch { return undefined; }
}

async function copyFlattenedRecipes(directories: string[], target: string, concurrency = 4): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, directories.length) }, async () => {
    while (next < directories.length) {
      const directory = directories[next++];
      await cp(directory, join(target, basename(directory)), { recursive: true, errorOnExist: true });
    }
  });
  await Promise.all(workers);
}

export class SkillLibraryManager {
  readonly packageRoot: string;
  readonly userSkillsRoot: string;
  readonly explicitVersion?: string;
  #inflight?: Promise<string>;

  constructor(options: SkillLibraryManagerOptions) {
    this.packageRoot = resolve(options.packageRoot);
    this.userSkillsRoot = resolve(options.userSkillsRoot || process.env.SEEKBRAIN_SKILLS_ROOT || join(homedir(), ".seekbrain", "skills"));
    this.explicitVersion = options.packageVersion;
  }

  async packageVersion(): Promise<string> {
    if (this.explicitVersion) return this.explicitVersion;
    const manifest = JSON.parse(await readFile(join(this.packageRoot, "package.json"), "utf8")) as Json;
    return String(manifest.version || "unknown");
  }

  async ensureTrajectory(): Promise<string> {
    this.#inflight ??= this.#ensureTrajectory().finally(() => { this.#inflight = undefined; });
    return await this.#inflight;
  }

  async #ensureTrajectory(): Promise<string> {
    const source = join(this.packageRoot, "recipes");
    const sourceIndex = join(source, "INDEX.md");
    if (!existsSync(sourceIndex)) throw new Error(`bundled recipe index not found: ${sourceIndex}`);
    const recipeDirectories = await bundledRecipeDirectories(source);
    if (!recipeDirectories.length) throw new Error(`bundled Recipe repertoire is empty: ${source}`);
    const recipeNames = recipeDirectories.map((directory) => basename(directory));
    if (new Set(recipeNames).size !== recipeNames.length) throw new Error("bundled Recipe repertoire contains duplicate folder names and cannot be flattened");
    const indexText = await readFile(sourceIndex, "utf8");
    const sourceIndexSha256 = createHash("sha256").update(indexText).digest("hex");
    const version = await this.packageVersion();
    const target = join(this.userSkillsRoot, "builtin", "trajectory", version);
    const marker = join(target, ".seekbrain-managed.json");
    const currentMarker = await managedMarker(marker);
    if (
      currentMarker?.schema_version === MANAGED_SCHEMA_VERSION
      && currentMarker.package_version === version
      && currentMarker.source === "seekbrain-package"
      && currentMarker.layout === "flat"
      && currentMarker.recipe_count === recipeDirectories.length
      && currentMarker.source_index_sha256 === sourceIndexSha256
      && existsSync(join(target, "INDEX.md"))
    ) return target;

    const parent = dirname(target);
    const staging = join(parent, `.trajectory-${version}-${randomUUID()}.tmp`);
    const backup = join(parent, `.trajectory-${version}-${randomUUID()}.old`);
    await mkdir(parent, { recursive: true });
    try {
      await mkdir(staging, { recursive: true });
      await copyFlattenedRecipes(recipeDirectories, staging);
      await writeFile(join(staging, "INDEX.md"), indexText, "utf8");
      await writeFile(join(staging, ".seekbrain-managed.json"), `${JSON.stringify({
        schema_version: MANAGED_SCHEMA_VERSION,
        package_version: version,
        source: "seekbrain-package",
        layout: "flat",
        recipe_count: recipeDirectories.length,
        source_index_sha256: sourceIndexSha256,
        installed_at: new Date().toISOString(),
      }, null, 2)}\n`, "utf8");

      let replaced = false;
      if (existsSync(target)) {
        if (currentMarker?.source !== "seekbrain-package") throw new Error(`refusing to replace unmanaged trajectory directory: ${target}`);
        await rename(target, backup);
        replaced = true;
      }
      try {
        await rename(staging, target);
      } catch (error) {
        if (replaced && !existsSync(target) && existsSync(backup)) await rename(backup, target);
        throw error;
      }
      if (replaced) await rm(backup, { recursive: true, force: true });
      return target;
    } catch (error) {
      await rm(staging, { recursive: true, force: true }).catch(() => undefined);
      if (existsSync(backup) && !existsSync(target)) await rename(backup, target).catch(() => undefined);
      throw error;
    }
  }
}

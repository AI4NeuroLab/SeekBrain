import { cp, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";

type Json = Record<string, any>;

export interface SkillLibraryManagerOptions {
  packageRoot: string;
  userSkillsRoot?: string;
  packageVersion?: string;
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
    const source = join(this.packageRoot, "library", "skills", "trajectory");
    if (!existsSync(join(source, "INDEX.md"))) throw new Error(`bundled trajectory skill index not found: ${source}`);
    const version = await this.packageVersion();
    const target = join(this.userSkillsRoot, "builtin", "trajectory", version);
    const marker = join(target, ".seekbrain-managed.json");
    if (existsSync(marker) && existsSync(join(target, "INDEX.md"))) return target;

    const parent = dirname(target);
    const staging = join(parent, `.trajectory-${version}-${randomUUID()}.tmp`);
    await mkdir(parent, { recursive: true });
    try {
      await cp(source, staging, { recursive: true, errorOnExist: true });
      await writeFile(join(staging, ".seekbrain-managed.json"), `${JSON.stringify({ schema_version: 1, package_version: version, source: "seekbrain-package", installed_at: new Date().toISOString() }, null, 2)}\n`, "utf8");
      try { await rename(staging, target); }
      catch (error) {
        if (existsSync(marker)) await rm(staging, { recursive: true, force: true });
        else throw error;
      }
      return target;
    } catch (error) {
      await rm(staging, { recursive: true, force: true }).catch(() => undefined);
      throw error;
    }
  }
}

import { existsSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";

export class ArtifactPathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArtifactPathError";
  }
}

export class PathPolicy {
  readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  resolve(path: string): string {
    const candidate = resolve(this.root, path);
    this.assertContained(candidate);
    return candidate;
  }

  relative(path: string): string {
    const candidate = isAbsolute(path) ? resolve(path) : this.resolve(path);
    this.assertContained(candidate);
    return relative(this.root, candidate) || ".";
  }

  contains(path: string): boolean {
    try {
      this.assertContained(isAbsolute(path) ? resolve(path) : resolve(this.root, path));
      return true;
    } catch {
      return false;
    }
  }

  private assertContained(candidate: string): void {
    const rel = relative(this.root, candidate);
    if (rel === ".." || rel.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) || isAbsolute(rel)) {
      throw new ArtifactPathError(`Artifact path escapes run directory: '${candidate}'`);
    }
    if (!existsSync(this.root)) return;
    const physicalRoot = realpathSync.native(this.root);
    let existingParent = candidate;
    while (!existsSync(existingParent) && existingParent !== dirname(existingParent)) {
      existingParent = dirname(existingParent);
    }
    const physicalParent = realpathSync.native(existingParent);
    const physicalRel = relative(physicalRoot, physicalParent);
    if (physicalRel === ".." || physicalRel.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) || isAbsolute(physicalRel)) {
      throw new ArtifactPathError(`Artifact path crosses a symlink outside the run directory: '${candidate}'`);
    }
  }
}

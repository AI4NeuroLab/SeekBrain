import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { SkillLibraryManager } from "../../src/targeted-skill/index.ts";

describe("versioned user skill library", () => {
  it("materializes bundled trajectory skills once under the unified user root", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekbrain-library-manager-"));
    const packageRoot = join(root, "package");
    const source = join(packageRoot, "recipes", "Single-modality", "Dynamics Modality", "example");
    const userRoot = join(root, "home", ".seekbrain", "skills");
    await mkdir(source, { recursive: true });
    await writeFile(join(packageRoot, "package.json"), JSON.stringify({ version: "1.2.3" }));
    await writeFile(join(packageRoot, "recipes", "INDEX.md"), "# Index\n");
    await writeFile(join(source, "SKILL.md"), "# Example\n");
    const manager = new SkillLibraryManager({ packageRoot, userSkillsRoot: userRoot });
    const first = await manager.ensureTrajectory();
    const second = await manager.ensureTrajectory();
    expect(first).toBe(join(userRoot, "builtin", "trajectory", "1.2.3"));
    expect(second).toBe(first);
    expect(await readFile(join(first, "example", "SKILL.md"), "utf8")).toContain("Example");
    expect(await readFile(join(first, "INDEX.md"), "utf8")).toBe("# Index\n");
    expect(JSON.parse(await readFile(join(first, ".seekbrain-managed.json"), "utf8"))).toMatchObject({
      schema_version: 2,
      package_version: "1.2.3",
      layout: "flat",
      recipe_count: 1,
    });
    await expect(readFile(join(first, "Single-modality", "Dynamics Modality", "example", "SKILL.md"), "utf8")).rejects.toThrow();
  });


  it("replaces a stale managed cache without preserving obsolete recipes", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekbrain-library-manager-stale-"));
    const packageRoot = join(root, "package");
    const source = join(packageRoot, "recipes", "Multimodal-joint-analysis", "Coupling", "new-recipe");
    const userRoot = join(root, "home", ".seekbrain", "skills");
    const target = join(userRoot, "builtin", "trajectory", "0.1.1");
    await mkdir(source, { recursive: true });
    await mkdir(join(target, "obsolete-recipe"), { recursive: true });
    await writeFile(join(packageRoot, "package.json"), JSON.stringify({ version: "0.1.1" }));
    await writeFile(join(packageRoot, "recipes", "INDEX.md"), "# New index\n");
    await writeFile(join(source, "SKILL.md"), "# New recipe\n");
    await writeFile(join(target, "INDEX.md"), "# Old index\n");
    await writeFile(join(target, "obsolete-recipe", "SKILL.md"), "# Obsolete\n");
    await writeFile(join(target, ".seekbrain-managed.json"), JSON.stringify({ schema_version: 1, package_version: "0.1.1", source: "seekbrain-package" }));

    const manager = new SkillLibraryManager({ packageRoot, userSkillsRoot: userRoot });
    expect(await manager.ensureTrajectory()).toBe(target);
    expect(await readFile(join(target, "new-recipe", "SKILL.md"), "utf8")).toContain("New recipe");
    await expect(readFile(join(target, "obsolete-recipe", "SKILL.md"), "utf8")).rejects.toThrow();
  });

  it("preserves direct user deletions inside an already materialized trajectory", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekbrain-library-manager-user-edit-"));
    const packageRoot = join(root, "package");
    const source = join(packageRoot, "recipes", "Single-modality", "Dynamics Modality", "example");
    const userRoot = join(root, "home", ".seekbrain", "skills");
    await mkdir(source, { recursive: true });
    await writeFile(join(packageRoot, "package.json"), JSON.stringify({ version: "1.2.3" }));
    await writeFile(join(packageRoot, "recipes", "INDEX.md"), "# Index\n");
    await writeFile(join(source, "SKILL.md"), "# Example\n");

    const manager = new SkillLibraryManager({ packageRoot, userSkillsRoot: userRoot });
    const target = await manager.ensureTrajectory();
    await rm(join(target, "example"), { recursive: true });

    expect(await manager.ensureTrajectory()).toBe(target);
    await expect(readFile(join(target, "example", "SKILL.md"), "utf8")).rejects.toThrow();
  });
});

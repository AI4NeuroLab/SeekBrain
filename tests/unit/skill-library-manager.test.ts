import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { SkillLibraryManager } from "../../src/targeted-skill/index.ts";

describe("versioned user skill library", () => {
  it("materializes bundled trajectory skills once under the unified user root", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekbrain-library-manager-"));
    const packageRoot = join(root, "package");
    const source = join(packageRoot, "library", "skills", "trajectory", "example");
    const userRoot = join(root, "home", ".seekbrain", "skills");
    await mkdir(source, { recursive: true });
    await writeFile(join(packageRoot, "package.json"), JSON.stringify({ version: "1.2.3" }));
    await writeFile(join(packageRoot, "library", "skills", "trajectory", "INDEX.md"), "# Index\n");
    await writeFile(join(source, "SKILL.md"), "# Example\n");
    const manager = new SkillLibraryManager({ packageRoot, userSkillsRoot: userRoot });
    const first = await manager.ensureTrajectory();
    const second = await manager.ensureTrajectory();
    expect(first).toBe(join(userRoot, "builtin", "trajectory", "1.2.3"));
    expect(second).toBe(first);
    expect(await readFile(join(first, "example", "SKILL.md"), "utf8")).toContain("Example");
    expect(JSON.parse(await readFile(join(first, ".seekbrain-managed.json"), "utf8"))).toMatchObject({ package_version: "1.2.3" });
  });
});

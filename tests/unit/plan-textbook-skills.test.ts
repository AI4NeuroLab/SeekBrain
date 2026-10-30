import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DefaultResourceLoader, formatSkillsForPrompt, loadSkillsFromDir } from "@earendil-works/pi-coding-agent";

describe("plan textbook skills", () => {
  const root = join(process.cwd(), "skills", "plan");

  it("discovers six portable guidance skills without redistributing textbook chapters or scans", async () => {
    const loaded = loadSkillsFromDir({ dir: root, source: "test" });
    expect(loaded.diagnostics).toEqual([]);
    expect(loaded.skills).toHaveLength(6);
    expect(new Set(loaded.skills.map(skill => skill.name)).size).toBe(6);
    for (const skill of loaded.skills) {
      const entry = await readFile(skill.filePath, "utf8");
      expect(entry).toContain("## Reading and evidence");
      expect(entry).toContain("not a textbook excerpt");
      expect(entry).not.toMatch(/references\/14\.\d+\.md|images\/page-\d+\.png/);
      expect(await readdir(skill.baseDir)).toEqual(["SKILL.md"]);
    }
  });

  it("makes the six entries discoverable from another working directory without loading chapter bodies", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "seekbrain-plan-skills-"));
    try {
      const loader = new DefaultResourceLoader({
        cwd, agentDir: join(cwd, "agent"),
        noExtensions: true, noSkills: true, noThemes: true, noPromptTemplates: true, noContextFiles: true,
        additionalSkillPaths: [root],
      });
      await loader.reload();
      const loaded = loader.getSkills();
      expect(loaded.diagnostics).toEqual([]);
      expect(loaded.skills).toHaveLength(6);
      const catalog = formatSkillsForPrompt(loaded.skills);
      for (const skill of loaded.skills) expect(catalog).toContain(skill.name);
      expect(catalog).not.toContain("references/14.13.md");
      expect(catalog).not.toContain("# 14.13 Single-cell RNA-sequencing");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

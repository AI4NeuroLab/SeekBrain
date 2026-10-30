import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DefaultResourceLoader, formatSkillsForPrompt, loadSkillsFromDir } from "@earendil-works/pi-coding-agent";

describe("report-only textbook skills", () => {
  const root = join(process.cwd(), "skills", "report");
  it("loads fourteen distinct, code-free skills through the actual Pi skill parser", async () => {
    const result = loadSkillsFromDir({ dir: root, source: "test" });
    expect(result.diagnostics).toEqual([]);
    expect(result.skills).toHaveLength(14);
    expect(new Set(result.skills.map(s => s.name)).size).toBe(14);
    for (const skill of result.skills) {
      expect(await readdir(skill.baseDir)).toEqual(["SKILL.md"]);
      expect(await readFile(skill.filePath, "utf8")).toContain("Neuroscience_Textbooks.xlsx");
    }
    const prompt = formatSkillsForPrompt(result.skills);
    expect(prompt).toContain("report-purves-neuroscience");
    expect(prompt).toContain("report-dayan-abbott");
    expect(prompt).toContain("report-wang-cognition");
    expect(prompt).not.toContain("## Interpretation focus");
  });
  it("discovers bundled report skills from a report directory outside the installation", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "seekbrain-report-skills-"));
    try {
      const loader = new DefaultResourceLoader({ cwd, agentDir: join(cwd, "agent"),
        noExtensions: true, noSkills: true, noThemes: true, noPromptTemplates: true, noContextFiles: true,
        additionalSkillPaths: [root] });
      await loader.reload();
      expect(loader.getSkills().skills).toHaveLength(14);
      expect(loader.getSkills().diagnostics).toEqual([]);
    } finally { await rm(cwd, { recursive: true, force: true }); }
  });
});

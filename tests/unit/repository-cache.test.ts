import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  lookupValidatedRepositoryScripts,
  materializeRepository,
  normalizeRepositoryIdentity,
  registerValidatedRepositoryScripts,
} from "../../src/targeted-skill/repository-cache.ts";

describe("repository-backed Recipe cache", () => {
  it("uses one durable identity for HTTPS and SSH spellings", () => {
    const expected = "github.com/example/repo";
    expect(normalizeRepositoryIdentity("https://github.com/Example/Repo.git/")).toBe(expected);
    expect(normalizeRepositoryIdentity("git@github.com:Example/Repo.git")).toBe(expected);
  });

  it("returns only registered scripts that still exist", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekbrain-repo-registry-"));
    const recipe = join(root, "skill", "SKILL.md");
    const script = join(root, "skill", "scripts", "run_analysis.py");
    await mkdir(join(root, "skill", "scripts"), { recursive: true });
    await writeFile(recipe, "# recipe\n");
    await writeFile(script, "print('validated')\n");
    const options = { cacheRoot: root };
    await registerValidatedRepositoryScripts({ repositoryUrl: "https://github.com/example/repo.git", recipePath: recipe, scriptPath: script, validationRunId: "run-1" }, options);
    await expect(lookupValidatedRepositoryScripts("git@github.com:example/repo.git", options)).resolves.toMatchObject({ script_path: script, validation_run_id: "run-1" });
    await writeFile(join(root, "validated-scripts.json"), JSON.stringify({ repositories: { "github.com/example/missing": { recipe_path: recipe, script_path: join(root, "missing.py") } } }));
    await expect(lookupValidatedRepositoryScripts("https://github.com/example/missing", options)).resolves.toBeUndefined();
  });

  it("performs one partial clone and materializes only ranked files", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekbrain-repo-materialize-"));
    const calls: string[][] = [];
    const runGit = async (args: string[]) => {
      calls.push(args);
      if (args[0] === "clone") { await mkdir(args.at(-1)!, { recursive: true }); return ""; }
      if (args[0] === "rev-parse") return "abc123\n";
      if (args[0] === "ls-tree") return "src/analysis.py\ntests/test_analysis.py\ndata/large.npy\nREADME.md\n";
      if (args[0] === "show") return args[1].endsWith("analysis.py") ? "def analyze(data):\n    return data\n" : "# repository\n";
      throw new Error(`unexpected git call ${args.join(" ")}`);
    };
    const result = await materializeRepository("https://github.com/example/repo", "run analysis", "Analysis paper", { cacheRoot: root, runGit });
    expect(result).toMatchObject({ ok: true, source_commit: "abc123", reused: false });
    expect(calls.filter((call) => call[0] === "clone")).toHaveLength(1);
    expect(calls.filter((call) => call[0] === "show").length).toBeGreaterThan(0);
    expect(calls.some((call) => call.join(" ").includes("large.npy"))).toBe(false);
    expect(await readFile(result.candidate_files[0].local_path, "utf8")).toBeTruthy();
  });

  it("coalesces concurrent materialization for the same normalized repository", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekbrain-repo-coalesce-"));
    let clones = 0;
    const runGit = async (args: string[]) => {
      if (args[0] === "clone") { clones += 1; await mkdir(args.at(-1)!, { recursive: true }); return ""; }
      if (args[0] === "rev-parse") return "abc123";
      if (args[0] === "ls-tree") return "analysis.py";
      if (args[0] === "show") return "def analyze(): pass\n";
      return "";
    };
    await Promise.all([
      materializeRepository("https://github.com/example/repo.git", "analysis", "paper", { cacheRoot: root, runGit }),
      materializeRepository("git@github.com:example/repo.git", "analysis", "paper", { cacheRoot: root, runGit }),
    ]);
    expect(clones).toBe(1);
  });
});

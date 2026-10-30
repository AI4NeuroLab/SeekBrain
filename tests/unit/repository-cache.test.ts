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
import { nonInteractiveGitEnv } from "../../src/core/non-interactive-git.ts";

describe("repository-backed Recipe cache", () => {
  it("disables terminal and AskPass authentication for Git subprocesses", () => {
    expect(nonInteractiveGitEnv({ GIT_ASKPASS: "vscode-askpass", SSH_ASKPASS: "gui-askpass" })).toMatchObject({
      GIT_TERMINAL_PROMPT: "0",
      GIT_ASKPASS: "/bin/false",
      SSH_ASKPASS: "/bin/false",
      GCM_INTERACTIVE: "Never",
    });
  });

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

  it("temporarily caches failed materialization instead of cloning the same repository again", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekbrain-repo-negative-cache-"));
    let clones = 0;
    const runGit = async (args: string[]) => {
      if (args[0] === "clone") {
        clones += 1;
        throw new Error("repository not found");
      }
      throw new Error(`unexpected git call ${args.join(" ")}`);
    };
    const options = { cacheRoot: root, runGit, failureCacheTtlMs: 60_000 };
    const first = await materializeRepository("https://github.com/example/missing", "analysis", "paper", options);
    const second = await materializeRepository("https://github.com/example/missing", "analysis", "paper", options);
    expect(first).toMatchObject({ ok: false, reused: false });
    expect(second).toMatchObject({ ok: false, reused: true });
    expect(second.error).toContain("repository not found");
    expect(clones).toBe(1);
  });

  it("extracts executable R chunks and notebook code cells before inspection", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekbrain-repo-literate-code-"));
    const notebook = JSON.stringify({ cells: [
      { cell_type: "markdown", source: ["# explanation"] },
      { cell_type: "code", source: ["predicted = classifier.predict(expression)\n"] },
    ] });
    const runGit = async (args: string[]) => {
      if (args[0] === "clone") { await mkdir(args.at(-1)!, { recursive: true }); return ""; }
      if (args[0] === "rev-parse") return "def456";
      if (args[0] === "ls-tree") return "analysis/workflow.Rmd\nanalysis/notebook.ipynb\nREADME.md\n";
      if (args[0] === "show" && args[1].endsWith("workflow.Rmd")) return "Long prose that is not executable.\n\n```{r}\nclusters <- FindClusters(object)\n```\n";
      if (args[0] === "show" && args[1].endsWith("notebook.ipynb")) return notebook;
      if (args[0] === "show") return "# repository";
      return "";
    };
    const result = await materializeRepository("https://github.com/example/literate", "subtype clustering classification", "Literate analysis", { cacheRoot: root, runGit });
    const rmd = result.candidate_files.find((file) => file.path.endsWith(".Rmd"))!;
    const ipynb = result.candidate_files.find((file) => file.path.endsWith(".ipynb"))!;
    expect(await readFile(rmd.local_path, "utf8")).toContain("Source lines");
    expect(await readFile(rmd.local_path, "utf8")).toContain("FindClusters");
    expect(await readFile(rmd.local_path, "utf8")).not.toContain("Long prose");
    expect(await readFile(ipynb.local_path, "utf8")).toContain("Notebook cell 2");
    expect(await readFile(ipynb.local_path, "utf8")).toContain("classifier.predict");
  });
});

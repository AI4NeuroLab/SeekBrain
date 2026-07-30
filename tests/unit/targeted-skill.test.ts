import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { LiteratureProviderRouter } from "../../src/literature-compat/index.ts";
import { PaperRagClient, RagSkillGenerator, TargetedSkillResolver, normalizeSmmt, ragSkillTitleCacheKey, validateSmmt, writeSkill } from "../../src/targeted-skill/index.ts";

describe("targeted skill TypeScript control plane", () => {
  it("matches a project-local skill and preserves trace artifacts", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekbrain-skill-match-"));
    const trajectory = join(root, "trajectory");
    const skill = join(trajectory, "mouse-calcium-glm");
    const trace = join(root, "trace");
    await mkdir(skill, { recursive: true });
    await writeFile(join(skill, "SKILL.md"), "---\ndescription: Analyze mouse calcium signals with GLM\n---\n# GLM\n", "utf8");
    await mkdir(join(skill, "scripts"));
    await writeFile(join(skill, "scripts", "run_analysis.py"), "print('trajectory resource')\n", "utf8");
    const resolver = new TargetedSkillResolver(new PaperRagClient());
    const result = await resolver.resolve({ question: "mouse calcium GLM analysis", root_dir: root, skill_dir: trajectory, trace_dir: trace, generate_skill_enable: false });
    expect(result).toMatchObject({ ok: true, matched: true, source: "existing_skill", generated: false });
    expect(result.skill_paths).toEqual([skill]);
    expect(result.targeted_skill).toContain("trajectory resource");
    expect(await readFile(join(trace, "targeted_skill.md"), "utf8")).toContain("mouse-calcium-glm");
  });

  it("returns a structured no-match when generation is disabled", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekbrain-skill-none-"));
    const resolver = new TargetedSkillResolver(new PaperRagClient());
    await expect(resolver.resolve({ question: "unseen method", root_dir: root, generate_skill_enable: false })).resolves.toMatchObject({ ok: true, matched: false, source: "none", targeted_skill: "", generated: false });
  });

  it("always prepares and searches the managed repertoire even with a legacy skill_dir override", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekbrain-managed-skill-"));
    const managed = join(root, "managed-trajectory");
    const skill = join(managed, "zebrafish-functional-connectivity");
    await mkdir(skill, { recursive: true });
    await writeFile(join(skill, "SKILL.md"), "---\ndescription: Compute zebrafish regional functional connectivity matrices\n---\n# Zebrafish FC\n", "utf8");
    let ensureCalls = 0;
    const resolver = new TargetedSkillResolver(new PaperRagClient(), {
      ensureTrajectoryDir: async () => {
        ensureCalls += 1;
        return managed;
      },
    });
    const result = await resolver.resolve({
      question: "compute zebrafish regional functional connectivity matrices",
      root_dir: root,
      skill_dir: join(root, "legacy-run-local-recipes"),
      generate_skill_enable: false,
    });
    expect(ensureCalls).toBe(1);
    expect(result).toMatchObject({ ok: true, matched: true, source: "existing_skill", generated: false });
    expect(result.skill_paths).toEqual([skill]);
  });

  it("lets the model return no match without exposing lexical pre-scores", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekbrain-skill-selector-"));
    const trajectory = join(root, "trajectory");
    const skill = join(trajectory, "broadly-related-skill");
    await mkdir(skill, { recursive: true });
    await writeFile(join(skill, "SKILL.md"), "---\ndescription: Broad neuroscience visualization\n---\n", "utf8");
    let selectorInput: any;
    const resolver = new TargetedSkillResolver(new PaperRagClient(), {
      selectSkills: async (input) => {
        selectorInput = input;
        return [];
      },
    });
    const result = await resolver.resolve({
      question: "specific unmatched analysis",
      root_dir: root,
      skill_dir: trajectory,
      generate_skill_enable: false,
    });
    expect(selectorInput.threshold).toBe(0.3);
    expect(selectorInput.candidates).toHaveLength(1);
    expect(selectorInput.candidates[0]).toEqual({
      name: "broadly-related-skill",
      path: skill,
      description: "Broad neuroscience visualization",
    });
    expect(result).toMatchObject({ ok: true, matched: false, source: "none" });
  });

  it("skips model matching for one strong unambiguous local recipe even when top_k allows more", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekbrain-skill-fast-match-"));
    const trajectory = join(root, "trajectory");
    const exact = join(trajectory, "zebrafish-pearson-functional-connectivity");
    const other = join(trajectory, "mouse-cell-count-visualization");
    await mkdir(exact, { recursive: true });
    await mkdir(other, { recursive: true });
    await writeFile(join(exact, "SKILL.md"), "---\ndescription: zebrafish calcium Pearson functional connectivity matrix from regional traces\n---\n", "utf8");
    await writeFile(join(other, "SKILL.md"), "---\ndescription: count mouse cells and draw a bar chart\n---\n", "utf8");
    let selectorCalls = 0;
    const resolver = new TargetedSkillResolver(new PaperRagClient(), {
      selectSkills: async () => { selectorCalls += 1; return []; },
    });
    const result = await resolver.resolve({
      question: "compute zebrafish calcium Pearson functional connectivity matrix from regional traces",
      root_dir: root,
      skill_dir: trajectory,
      trace_dir: join(root, "trace"),
      generate_skill_enable: false,
      top_k: 2,
    });
    expect(selectorCalls).toBe(0);
    expect(result).toMatchObject({ ok: true, matched: true, source: "existing_skill", skill_paths: [exact] });
    expect(JSON.parse(await readFile(result.artifacts.trace_json, "utf8"))).toMatchObject({ match_strategy: "deterministic_high_confidence" });
  });

  it("normalizes RAG results and degrades safely without configuration", async () => {
    const client = new PaperRagClient(async () => new Response(JSON.stringify({ results: [{ title: "Paper", full_text: "Method", github_links: [{ url: "https://github.com/example/repo" }] }] }), { status: 200, headers: { "content-type": "application/json" } }));
    await expect(client.query({ question: "method", base_url: "https://rag.example" })).resolves.toMatchObject({ ok: true, source_count: 1, sources: [{ source_id: "S1", title: "Paper", github_links: ["https://github.com/example/repo"] }] });
    await expect(new PaperRagClient(undefined, {}).query({ question: "method" })).resolves.toMatchObject({ ok: false, sources: [], error: "Paper RAG base URL is not configured" });
  });

  it("freezes the legacy AILab queryfull request contract", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;
    const client = new PaperRagClient(async (url, init) => {
      capturedUrl = String(url);
      capturedInit = init;
      return new Response(JSON.stringify({ results: [] }), { status: 200, headers: { "content-type": "application/json" } });
    });
    await client.query({ question: "frozen question", base_url: "http://ailab.example/", top_k: 2, require_github: true });
    expect(capturedUrl).toBe("http://ailab.example/queryfull");
    expect(capturedInit?.method).toBe("POST");
    expect(capturedInit?.headers).toEqual({ "content-type": "application/json" });
    expect(JSON.parse(String(capturedInit?.body))).toEqual({ query: "frozen question", top_k: 2, require_github: true });
  });

  it("keeps Skill retrieval on the AILab contract through the provider router", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekbrain-routed-skill-"));
    let requestBody: unknown;
    const client = new PaperRagClient(async (_url, init) => {
      requestBody = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ results: [] }), { status: 200, headers: { "content-type": "application/json" } });
    });
    const resolver = new TargetedSkillResolver(new LiteratureProviderRouter(client));
    const result = await resolver.resolve({
      question: "routed skill question",
      root_dir: root,
      skill_dir: join(root, "empty"),
      paper_source: "ailab_rag",
      base_url: "https://ailab.example",
      rag_top_k: 2,
    }, root);
    expect(requestBody).toEqual({ query: "routed skill question", top_k: 2, require_github: true });
    expect(result).toMatchObject({ ok: true, matched: false, source: "none" });
  });

  it("normalizes taxonomy and writes a reusable skill plus index", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekbrain-skill-write-"));
    const runDir = join(root, "run");
    await mkdir(runDir);
    const code = join(runDir, "generated_code.py");
    await writeFile(code, "print('analysis')\n", "utf8");
    const smmt = normalizeSmmt({ stage: "analysis", species: "mice", modality: "calcium", method: "regression", target: "neurons" });
    expect(smmt).toEqual({ stage: "ns_ana", species: "mouse", modality: "ca", method: "glm", target: "neurons" });
    expect(validateSmmt(smmt).ok).toBe(true);
    const result = await writeSkill({ root_dir: root, run_dir: runDir, run_id: "run-1", generated_code_path: code, smmt, description: "Reusable mouse calcium GLM analysis.", question: "Analyze neurons" }, root);
    expect(result).toMatchObject({ ok: true, folder_name: "ns_ana-mouse-ca-glm-neurons", pi_name: "ns-ana-mouse-ca-glm-neurons", validate_skills: { status: "passed" } });
    expect(await readFile(join(result.skill_dir, "scripts", "run_analysis.py"), "utf8")).toContain("analysis");
    expect(await readFile(join(root, ".seekbrain", "skills", "INDEX.md"), "utf8")).toContain(result.folder_name);
  });

  it("materializes only the first RAG repository and gives Plan exact files", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekbrain-rag-cache-"));
    const rag = new PaperRagClient(async () => new Response(JSON.stringify({ results: [
      { title: "Best paper", full_text: "Paper method context", github_links: ["https://github.com/example/best"] },
      { title: "Ignored paper", full_text: "Other method", github_links: ["https://github.com/example/ignored"] },
    ] }), { status: 200 }));
    const materialized: string[] = [];
    const resolver = new TargetedSkillResolver(rag, {
      lookupValidatedRepositoryScripts: async () => undefined,
      materializeRepository: async (url) => {
        materialized.push(url);
        return { ok: true, repository_key: "github.com/example/best", repository_url: url, repository_dir: join(root, "cache"), source_commit: "abc", candidate_files: [{ path: "src/analysis.py", local_path: join(root, "cache", "files", "src", "analysis.py"), summary: "def analyze(data)" }], reused: false };
      },
    });
    const result = await resolver.resolve({ question: "repository analysis", root_dir: root, skill_dir: join(root, "empty-trajectory"), base_url: "https://rag.example" }, root);
    expect(materialized).toEqual(["https://github.com/example/best"]);
    expect(result).toMatchObject({ ok: true, matched: true, source: "repository_reference", generated: false, repository_reference: { source_commit: "abc", reused_validated_scripts: false } });
    expect(result.targeted_skill).toContain(join(root, "cache", "files", "src", "analysis.py"));
  });

  it("crystallizes by GitHub repository identity only when the opt-in flag is enabled", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekbrain-rag-crystallize-"));
    const output = join(root, "from_rag");
    const skillPath = join(output, "example_best");
    await mkdir(skillPath, { recursive: true });
    await writeFile(join(skillPath, "SKILL.md"), "---\nname: example-best\ndescription: Repository Recipe\n---\n\n# Repository Recipe\n", "utf8");
    let generated = 0;
    let materialized = 0;
    const rag = new PaperRagClient(async () => new Response(JSON.stringify({ results: [
      { title: "Best paper", full_text: "Paper method context", github_links: ["https://github.com/example/best"] },
    ] }), { status: 200 }));
    const resolver = new TargetedSkillResolver(rag, {
      generatedSkillDir: output,
      ragSkillGenerator: { generate: async () => { generated += 1; return { ok: true, skill_path: skillPath, reused: true }; } } as any,
      lookupValidatedRepositoryScripts: async () => undefined,
      materializeRepository: async () => { materialized += 1; throw new Error("must not materialize before repository Recipe reuse"); },
    });
    const result = await resolver.resolve({
      question: "repository analysis",
      root_dir: root,
      skill_dir: join(root, "empty-trajectory"),
      base_url: "https://rag.example",
      repository_recipe_crystallization_enabled: true,
    }, root);
    expect(generated).toBe(1);
    expect(materialized).toBe(0);
    expect(result).toMatchObject({
      ok: true,
      matched: true,
      source: "generated_from_rag",
      generated: false,
      skill_paths: [skillPath],
      repository_reference: { reused_crystallized_recipe: true },
    });
  });

  it("reuses validated scripts for the same repository without materialization", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekbrain-rag-reuse-"));
    const rag = new PaperRagClient(async () => new Response(JSON.stringify({ results: [{ title: "Paper", full_text: "Method", github_links: ["https://github.com/example/repo.git"] }] }), { status: 200 }));
    let materializeCalls = 0;
    const resolver = new TargetedSkillResolver(rag, {
      lookupValidatedRepositoryScripts: async () => ({ repository_key: "github.com/example/repo", repository_url: "https://github.com/example/repo", recipe_path: "/skills/repo/SKILL.md", script_path: "/skills/repo/scripts/run_analysis.py", validation_run_id: "old-run", validated_at: "now" }),
      materializeRepository: async () => { materializeCalls += 1; throw new Error("must not materialize"); },
    });
    const result = await resolver.resolve({ question: "a differently worded current task", root_dir: root, skill_dir: join(root, "empty"), base_url: "https://rag.example", repository_recipe_crystallization_enabled: true }, root);
    expect(materializeCalls).toBe(0);
    expect(result).toMatchObject({ source: "validated_repository_recipe", generated: false, details: { reused_validated_scripts: true } });
    expect(result.targeted_skill).toContain("/skills/repo/scripts/run_analysis.py");
  });

  it("preserves structured paper-to-repository context, notebook code, and reproduction references", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekbrain-rag-context-"));
    const repo = "https://github.com/example/calcium-glm";
    const output = join(root, "skills");
    const clone = join(output, ".cache", ragSkillTitleCacheKey("GLM paper"), "repo_clone");
    await mkdir(clone, { recursive: true });
    await writeFile(join(clone, ".clone_done"), `${repo}\n`, "utf8");
    await writeFile(join(clone, "analysis.ipynb"), JSON.stringify({ cells: [{ cell_type: "code", source: ["def fit_glm(data):\n", "    return data\n"] }] }), "utf8");
    await writeFile(join(clone, "README.md"), "Calcium GLM analysis pipeline", "utf8");
    const generator = new RagSkillGenerator(async (input) => ({
      name: "calcium-glm",
      description: "Reproduce a calcium GLM analysis.",
      triggers: [input.question],
      tags: ["calcium", "glm"],
      skill_body: `# Calcium GLM\n\n${input.connectionAnalysis}\n\n${input.reproductionPlan}`,
      analysis_script: "def main():\n    pass\n",
    }), async (input) => ({
      repo_overview: `Repository with ${input.repositoryFiles.length} scientific files`,
      selected_files: ["analysis.ipynb"],
      matched_paper_context: "The paper fits a GLM to calcium activity.",
      matched_repo_context: "analysis.ipynb defines fit_glm.",
      connection_analysis: "The notebook function implements the paper GLM step.",
      reproduction_plan: "1. Load calcium data.\n2. Run fit_glm.\n3. Validate coefficients.",
    }));
    const result = await generator.generate({ question: "fit calcium GLM", title: "GLM paper", paperText: "Paper method", repoLink: repo, outputDir: output });
    expect(result).toMatchObject({ ok: true, reused: false });
    expect(result.skill_path).toBe(join(output, "example_calcium-glm"));
    expect(await readFile(join(result.skill_path, "references", "matched_files", "analysis.ipynb"), "utf8")).toContain("def fit_glm");
    expect(await readFile(join(result.skill_path, "references", "connection_analysis.md"), "utf8")).toContain("implements the paper GLM step");
    expect(await readFile(join(result.skill_path, "references", "reproduction_plan.md"), "utf8")).toContain("Validate coefficients");
    expect(JSON.parse(await readFile(join(result.skill_path, "metadata.json"), "utf8"))).toMatchObject({ schema_version: 2, repository_file_count: 2, matched_repo_files: ["analysis.ipynb"] });
    const reused = await generator.generate({ question: "worded differently", title: "Another title", paperText: "Other context", repoLink: repo, outputDir: output });
    expect(reused).toMatchObject({ ok: true, reused: true, skill_path: result.skill_path });
  });
});

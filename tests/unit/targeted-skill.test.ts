import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { LiteratureProviderRouter } from "../../src/literature-compat/index.ts";
import { PaperRagClient, RagSkillGenerator, TargetedSkillResolver, normalizeSmmt, ragSkillTitleCacheKey, repoIdentifier, validateSmmt, writeSkill } from "../../src/targeted-skill/index.ts";

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
    expect(selectorInput.threshold).toBe(0.6);
    expect(selectorInput.candidates).toHaveLength(1);
    expect(selectorInput.candidates[0]).toMatchObject({
      name: "broadly-related-skill",
      path: skill,
      description: "Broad neuroscience visualization",
      card: { recipe_id: "broadly-related-skill", status: "active", does: ["visualization"] },
      covers: [],
      compatibility: "unknown",
    });
    expect(selectorInput.candidates[0]).not.toHaveProperty("score");
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
    expect(requestBody).toMatchObject({ top_k: 2, require_github: true });
    expect((requestBody as any).query).toContain("Scientific objective: routed skill question");
    expect((requestBody as any).query).toContain("R1 [analysis] [priority]: routed skill question");
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

  it("keeps complementary local Recipes while sending the full contract with uncovered priorities to RAG", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekbrain-gap-rag-"));
    const trajectory = join(root, "trajectory");
    const comparison = join(trajectory, "cross-disorder-comparison");
    await mkdir(comparison, { recursive: true });
    await writeFile(join(comparison, "SKILL.md"), "---\nname: cross-disorder-comparison\ndescription: Compare diagnostic groups in human fMRI\n---\n\n# Cross-disorder comparison\n\nCompare groups and report stable disease effects.\n", "utf8");
    await writeFile(join(comparison, "recipe-card.json"), JSON.stringify({
      schema_version: 1,
      recipe_id: "cross-disorder-comparison",
      version: "1.0.0",
      status: "active",
      kind: "analysis",
      summary: "Compare diagnostic groups in human fMRI",
      aliases: [],
      does: ["group_comparison"],
      evidence_for: ["disease_related"],
      accepts: { species: ["human"], modalities: ["fmri"], observation_units: [], requires: [] },
      produces: [], use_when: [], avoid_when: [],
      source: { type: "builtin", evidence_refs: [] },
      quality: { passed_runs: 1, recipe_attributed_failures: 0 },
    }), "utf8");
    let ragQuestion = "";
    const rag = { query: async (input: any) => {
      ragQuestion = input.question;
      return { ok: true, sources: [{ title: "Cortical mapping", text: "Atlas mapping method", github_links: ["https://github.com/example/cortical-map"] }], source_count: 1, warnings: [] };
    } };
    const resolver = new TargetedSkillResolver(rag as any, {
      lookupValidatedRepositoryScripts: async () => undefined,
      materializeRepository: async (url) => ({ ok: true, repository_key: "github.com/example/cortical-map", repository_url: url, source_commit: "abc", repository_dir: join(root, "cache"), candidate_files: [{ path: "map.py", local_path: join(root, "cache", "map.py"), summary: "atlas mapping" }], reused: false }),
    });
    const result = await resolver.resolve({
      question: "Analyze disorders and save everything under /tmp/irrelevant-output",
      task_brief: {
        scientific_goal: "Compare human fMRI disorders and localize their effects.",
        biological_scope: ["human", "fMRI"],
        hard_constraints: ["Compare diagnostic groups."],
        requested_data: ["Map effects back to cortical brain regions."],
        output_preferences: [],
      },
      root_dir: root,
      skill_dir: trajectory,
      base_url: "https://rag.example",
      relevance_threshold: 0.05,
    }, root);
    expect(ragQuestion).toContain("R2 [evidence] [priority]: Map effects back to cortical brain regions.");
    expect(ragQuestion).toContain("R1 [analysis]: Compare diagnostic groups.");
    expect(ragQuestion).not.toContain("irrelevant-output");
    expect(result.skill_paths).toContain(comparison);
    expect(result.targeted_skill).toContain("Cross-disorder comparison");
    expect(result.targeted_skill).toContain("Cortical mapping");
    expect(result.recipe_set).toMatchObject({ complete: true, uncovered_requirement_ids: [] });
    expect(result.recipe_set.selected).toEqual(expect.arrayContaining([
      expect.objectContaining({ recipe_id: "cross-disorder-comparison", covers: ["R1"], source: "local" }),
      expect.objectContaining({ covers: ["R2"], source: "rag_repository" }),
    ]));
  });

  it("passes exact TaskBrief evidence and grouping requirements to RAG when there is no local match", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekbrain-full-rag-contract-"));
    let ragQuestion = "";
    const rag = { query: async (input: any) => {
      ragQuestion = input.question;
      return { ok: true, sources: [], source_count: 0, warnings: [] };
    } };
    const resolver = new TargetedSkillResolver(rag as any);
    await resolver.resolve({
      question: "compressed canonical question",
      task_brief: {
        scientific_goal: "Classify neurons by RNA barcodes.",
        biological_scope: ["Fish1-Fish3"],
        hard_constraints: [
          "Binarize continuous RNA transcript spot counts using gene and fish identities.",
          "Summarize categorical annotations by mode in consecutive 10-cell groups.",
        ],
        requested_data: ["Use brain-region annotations as aligned evidence."],
        output_preferences: ["Select one representative cell from every consecutive 130-cell expression group."],
      },
      root_dir: root,
      skill_dir: join(root, "empty"),
    }, root);
    expect(ragQuestion).toContain("continuous RNA transcript spot counts");
    expect(ragQuestion).toContain("mode in consecutive 10-cell groups");
    expect(ragQuestion).toContain("brain-region annotations");
    expect(ragQuestion).toContain("consecutive 130-cell expression group");
  });

  it("uses query-scoped reference memory to reject a known repository boundary and continues to the next candidate", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekbrain-rag-memory-boundary-"));
    const userSkillsRoot = join(root, "skills");
    const candidatePool = join(root, "candidate-pool");
    const badRepo = "https://github.com/SEU-ALLEN-codebase/ManifoldAnalysis";
    const goodRepo = "https://github.com/example/rna-barcode";
    const memoryPath = join(candidatePool, "known-manifold-boundary");
    await mkdir(memoryPath, { recursive: true });
    await writeFile(join(memoryPath, "SKILL.md"), "---\nname: manifold-morphology\ndescription: Morphology PCA and DBSCAN clustering only\n---\n", "utf8");
    await writeFile(join(memoryPath, "recipe-card.json"), JSON.stringify({
      schema_version: 1, recipe_id: "manifold-morphology", version: "1.0.0", status: "candidate", kind: "reference",
      summary: "Repository boundary: morphology analysis does not support RNA barcodes", aliases: [], does: [], evidence_for: [],
      accepts: { species: [], modalities: [], observation_units: [], requires: [] }, produces: [],
      use_when: ["Input is RNA transcript spot counts using gene barcodes"], avoid_when: [],
      source: { type: "rag", evidence_refs: [], repository_url: badRepo }, quality: { passed_runs: 0, recipe_attributed_failures: 0 },
    }), "utf8");
    const rag = new PaperRagClient(async () => new Response(JSON.stringify({ results: [
      { title: "Morphological neuron subtyping", full_text: "PCA DBSCAN morphology", github_links: [badRepo] },
      { title: "RNA barcode cell typing", full_text: "Transcriptomic RNA gene barcode classification and heatmap", github_links: [goodRepo] },
    ] }), { status: 200 }));
    const materialized: string[] = [];
    const traceDir = join(root, "trace");
    const resolver = new TargetedSkillResolver(rag, {
      userSkillsRoot,
      selectSkills: async (input) => {
        const selected = input.candidates.find((candidate) => candidate.card.source.repository_url === goodRepo)!;
        return [{ name: selected.name, path: selected.path, score: 0.95, role: "primary", reason: "covers RNA barcode analysis", covers: input.query.requirements.map((requirement) => requirement.id) }];
      },
      lookupValidatedRepositoryScripts: async () => undefined,
      materializeRepository: async (url) => {
        materialized.push(url);
        return { ok: true, repository_key: url.toLowerCase(), repository_url: url, repository_dir: join(root, "cache", repoIdentifier(url)), source_commit: "abc", candidate_files: [{ path: "analysis.py", local_path: join(root, "cache", repoIdentifier(url), "analysis.py"), summary: "RNA barcode analysis" }], reused: false };
      },
    });
    const result = await resolver.resolve({
      question: "Classify fish neurons from RNA transcript counts and draw an annotated heatmap.",
      task_brief: {
        scientific_goal: "Classify fish neurons using RNA gene barcodes.",
        biological_scope: ["fish neurons"],
        hard_constraints: ["Classify neurons from RNA transcript spot counts using gene barcodes."],
        requested_data: [],
        output_preferences: ["Display an annotated gene-expression heatmap."],
      },
      root_dir: root,
      skill_dir: candidatePool,
      base_url: "https://rag.example",
      trace_dir: traceDir,
    }, root);
    expect(materialized).toEqual([goodRepo]);
    expect(result.recipe_set.selected).toEqual([expect.objectContaining({ repository_url: goodRepo })]);
    const trace = JSON.parse(await readFile(join(traceDir, "trace.json"), "utf8"));
    expect(trace.repository_identity_checks).toContainEqual(expect.objectContaining({
      recipe_id: "manifold-morphology",
      decision: "rejected_known_boundary",
      memory_source: "candidate_pool",
      matched_boundary_when: ["Input is RNA transcript spot counts using gene barcodes"],
    }));
  });

  it("replaces failed repository candidates lazily, admits only executable Recipes, and allows uncovered requirements", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekbrain-lazy-rag-cover-"));
    const repos = {
      boundaryOne: "https://github.com/example/not-rna-one",
      boundaryTwo: "https://github.com/example/not-rna-two",
      clustering: "https://github.com/example/rna-clustering",
      mapping: "https://github.com/example/brain-region-mapping",
    };
    const generatedRoot = join(root, "generated");
    const generatedPaths = new Map<string, string>();
    const cards = [
      { repo: repos.boundaryOne, id: "not-rna-one", kind: "reference", summary: "No executable RNA clustering capability", does: [], use_when: ["Cluster cells from RNA expression profiles"] },
      { repo: repos.boundaryTwo, id: "not-rna-two", kind: "reference", summary: "No executable brain-region mapping capability", does: [], use_when: ["Render an annotated spatial map of brain regions"] },
      { repo: repos.clustering, id: "rna-clustering", kind: "analysis", summary: "Cluster cells from RNA expression profiles", does: ["clustering"], use_when: ["RNA expression cell clustering"] },
      { repo: repos.mapping, id: "brain-region-mapping", kind: "visualization", summary: "Render an annotated spatial map of brain regions", does: ["spatial_mapping", "regional_localization", "visualization"], use_when: ["Annotated brain-region mapping"] },
    ];
    for (const item of cards) {
      const path = join(generatedRoot, item.id);
      generatedPaths.set(item.repo, path);
      await mkdir(path, { recursive: true });
      await writeFile(join(path, "SKILL.md"), `---\nname: ${item.id}\ndescription: ${item.summary}\n---\n\n# ${item.summary}\n\n## Procedure\n\n1. Apply the supported repository operation.\n`, "utf8");
      await writeFile(join(path, "recipe-card.json"), JSON.stringify({
        schema_version: 1,
        recipe_id: item.id,
        version: "1.0.0",
        status: "candidate",
        kind: item.kind,
        summary: item.summary,
        aliases: [],
        does: item.does,
        evidence_for: [],
        accepts: { species: [], modalities: [], observation_units: [], requires: [] },
        produces: [],
        use_when: item.use_when,
        avoid_when: [],
        source: { type: "rag", evidence_refs: [], repository_url: item.repo },
        quality: { passed_runs: 0, recipe_attributed_failures: 0 },
      }), "utf8");
    }

    const rag = new PaperRagClient(async () => new Response(JSON.stringify({ results: [
      { title: "Unsupported RNA candidate", full_text: "Cluster cells from RNA expression profiles", github_links: [repos.boundaryOne] },
      { title: "Unsupported mapping candidate", full_text: "Render an annotated spatial map of brain regions", github_links: [repos.boundaryTwo] },
      { title: "RNA clustering implementation", full_text: "Cluster cells from RNA expression profiles", github_links: [repos.clustering] },
      { title: "Brain-region mapping implementation", full_text: "Render an annotated spatial map of brain regions", github_links: [repos.mapping] },
    ] }), { status: 200 }));
    const generatedRepos: string[] = [];
    const traceDir = join(root, "trace");
    const resolver = new TargetedSkillResolver(rag, {
      selectSkills: async (input) => {
        const first = input.candidates.find((candidate) => candidate.card.source.repository_url === repos.boundaryOne)!;
        const second = input.candidates.find((candidate) => candidate.card.source.repository_url === repos.boundaryTwo)!;
        return [
          { name: first.name, path: first.path, score: 0.99, role: "primary", reason: "initial RAG choice", covers: ["R1"] },
          { name: second.name, path: second.path, score: 0.98, role: "visualization", reason: "initial RAG choice", covers: ["R2"] },
        ];
      },
      ragSkillGenerator: {
        generate: async (input: any) => {
          generatedRepos.push(input.repoLink);
          if (input.repoLink === repos.boundaryOne) throw new Error("repository inspection failed");
          return { ok: true, skill_path: generatedPaths.get(input.repoLink), reused: false };
        },
      } as any,
      lookupValidatedRepositoryScripts: async () => undefined,
      materializeRepository: async () => { throw new Error("crystallized candidates must not fall back to repository references"); },
    });
    const result = await resolver.resolve({
      question: "Cluster RNA cells, map them to brain regions, and estimate temporal trajectories.",
      task_brief: {
        scientific_goal: "Cluster RNA cells, map them to brain regions, and estimate temporal trajectories.",
        biological_scope: [],
        hard_constraints: [
          "Cluster cells from RNA expression profiles.",
          "Estimate longitudinal temporal dynamics over repeated time points.",
        ],
        requested_data: [],
        output_preferences: ["Render an annotated spatial map of brain regions."],
      },
      root_dir: root,
      skill_dir: join(root, "empty"),
      base_url: "https://rag.example",
      top_k: 3,
      rag_top_k: 4,
      repository_recipe_crystallization_enabled: true,
      trace_dir: traceDir,
    }, root);

    expect(new Set(generatedRepos.slice(0, 2))).toEqual(new Set([repos.boundaryOne, repos.boundaryTwo]));
    expect(new Set(generatedRepos.slice(2))).toEqual(new Set([repos.clustering, repos.mapping]));
    expect(result).toMatchObject({
      matched: true,
      source: "composed_recipe_set",
      recipe_set: { complete: false, uncovered_requirement_ids: ["R2"] },
      details: { repository_inspection_count: 4, repository_candidate_pool_size: 4 },
    });
    expect(result.recipe_set.selected).toEqual(expect.arrayContaining([
      expect.objectContaining({ recipe_id: "rna-clustering", covers: ["R1"], source: "repository_memory" }),
      expect.objectContaining({ recipe_id: "brain-region-mapping", covers: ["R3"], source: "repository_memory" }),
    ]));
    expect(result.recipe_set.selected.map((selection: any) => selection.recipe_id)).not.toContain("not-rna-one");
    expect(result.recipe_set.selected.map((selection: any) => selection.recipe_id)).not.toContain("not-rna-two");
    const trace = JSON.parse(await readFile(join(traceDir, "trace.json"), "utf8"));
    expect(trace.repository_identity_checks.filter((check: any) => check.decision === "repository_candidate_failed")).toHaveLength(1);
    expect(trace.repository_identity_checks.filter((check: any) => check.decision === "rejected_non_executable_reference")).toHaveLength(1);
    expect(trace.repository_identity_checks.filter((check: any) => check.decision === "accepted_executable_recipe")).toHaveLength(2);
  });

  it("composes two complementary RAG repositories into one formal Recipe set", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekbrain-rag-plus-rag-"));
    const analysisRepo = "https://github.com/example/rna-classifier";
    const visualizationRepo = "https://github.com/example/annotated-heatmap";
    const rag = new PaperRagClient(async () => new Response(JSON.stringify({ results: [
      { title: "RNA barcode classifier", full_text: "Classify transcriptomic cells with binary gene barcodes", github_links: [analysisRepo] },
      { title: "Annotated expression heatmap", full_text: "Render aligned subtype and brain-region annotation tracks", github_links: [visualizationRepo] },
    ] }), { status: 200 }));
    const materialized: string[] = [];
    const resolver = new TargetedSkillResolver(rag, {
      selectSkills: async (input) => {
        const analysis = input.candidates.find((candidate) => candidate.card.source.repository_url === analysisRepo)!;
        const visualization = input.candidates.find((candidate) => candidate.card.source.repository_url === visualizationRepo)!;
        return [
          { name: analysis.name, path: analysis.path, score: 0.95, role: "primary", reason: "covers classification", covers: ["R1"] },
          { name: visualization.name, path: visualization.path, score: 0.9, role: "visualization", reason: "covers visualization", covers: ["R2"] },
        ];
      },
      lookupValidatedRepositoryScripts: async () => undefined,
      materializeRepository: async (url) => {
        materialized.push(url);
        const name = repoIdentifier(url);
        return { ok: true, repository_key: name, repository_url: url, repository_dir: join(root, "cache", name), source_commit: "abc", candidate_files: [{ path: "method.py", local_path: join(root, "cache", name, "method.py"), summary: name }], reused: false };
      },
    });
    const result = await resolver.resolve({
      question: "Classify RNA barcodes and visualize aligned annotations.",
      task_brief: {
        scientific_goal: "Classify RNA barcodes and visualize aligned annotations.",
        biological_scope: [],
        hard_constraints: ["Classify cells using binary RNA gene barcodes."],
        requested_data: [],
        output_preferences: ["Display aligned subtype and brain-region annotation tracks."],
      },
      root_dir: root,
      skill_dir: join(root, "empty"),
      base_url: "https://rag.example",
      top_k: 3,
    }, root);
    expect(materialized).toEqual([analysisRepo, visualizationRepo]);
    expect(result).toMatchObject({ source: "composed_recipe_set", recipe_set: { complete: true, uncovered_requirement_ids: [] } });
    expect(result.recipe_set.selected).toEqual([
      expect.objectContaining({ covers: ["R1"], source: "rag_repository", repository_url: analysisRepo }),
      expect.objectContaining({ covers: ["R2"], source: "rag_repository", repository_url: visualizationRepo }),
    ]);
    expect(result.repository_references).toHaveLength(2);
  });

  it("crystallizes by GitHub repository identity only when the opt-in flag is enabled", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekbrain-rag-crystallize-"));
    const output = join(root, "from_rag");
    const skillPath = join(root, "crystallized", "example_best");
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

  it("reuses an exact repository candidate before crystallization or materialization", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekbrain-rag-memory-reuse-"));
    const output = join(root, "from_rag");
    const repo = "https://github.com/example/best";
    const skillPath = join(output, repoIdentifier(repo));
    await mkdir(skillPath, { recursive: true });
    await writeFile(join(skillPath, "SKILL.md"), "---\nname: example-best\ndescription: Repository analysis method\n---\n\n# Repository Recipe\n", "utf8");
    await writeFile(join(skillPath, "recipe-card.json"), JSON.stringify({
      schema_version: 1, recipe_id: "example-best", version: "1.0.0", status: "candidate", kind: "analysis",
      summary: "Repository analysis method", aliases: [], does: ["feature_extraction"], evidence_for: [],
      accepts: { species: [], modalities: [], observation_units: [], requires: [] }, produces: [], use_when: ["repository analysis"], avoid_when: [],
      source: { type: "rag", evidence_refs: [], repository_url: repo }, quality: { passed_runs: 0, recipe_attributed_failures: 0 },
    }), "utf8");
    let generated = 0;
    let materialized = 0;
    const rag = new PaperRagClient(async () => new Response(JSON.stringify({ results: [
      { title: "Best paper", full_text: "Repository analysis method", github_links: [repo] },
    ] }), { status: 200 }));
    const resolver = new TargetedSkillResolver(rag, {
      generatedSkillDir: output,
      ragSkillGenerator: { generate: async () => { generated += 1; throw new Error("must reuse repository memory"); } } as any,
      lookupValidatedRepositoryScripts: async () => undefined,
      materializeRepository: async () => { materialized += 1; throw new Error("must reuse repository memory"); },
    });
    const result = await resolver.resolve({ question: "repository analysis", root_dir: root, skill_dir: join(root, "empty"), base_url: "https://rag.example", repository_recipe_crystallization_enabled: true }, root);
    expect(generated).toBe(0);
    expect(materialized).toBe(0);
    expect(result).toMatchObject({ source: "existing_skill", skill_paths: [skillPath], recipe_set: { selected: [{ source: "repository_memory" }] } });
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
    expect(JSON.parse(await readFile(join(result.skill_path, "metadata.json"), "utf8"))).toMatchObject({ schema_version: 3, repository_file_count: 2, matched_repo_files: ["analysis.ipynb"], lifecycle: { status: "candidate", eligible_for_repertoire_retrieval: false }, quality_gate: { passed: true } });
    expect(JSON.parse(await readFile(join(result.skill_path, "recipe-card.json"), "utf8"))).toMatchObject({ schema_version: 1, status: "candidate", source: { type: "rag" } });
    expect(JSON.parse(await readFile(join(result.skill_path, "references", "evidence_manifest.json"), "utf8"))).toMatchObject({ schema_version: 1, evidence_level: "repository_backed", repository: { url: repo, files: [{ path: "analysis.ipynb" }] } });
    const reused = await generator.generate({ question: "worded differently", title: "Another title", paperText: "Other context", repoLink: repo, outputDir: output });
    expect(reused).toMatchObject({ ok: true, reused: true, skill_path: result.skill_path });
  });
});

import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RecipeScoutV2, buildScoutScientificQuery, normalizeScoutScientificQuery } from "../../src/targeted-skill/index.ts";

const FISH_QUESTION = "To classify neurons from fish 1-3 into molecular subtypes, analyze the per-neuron continuous RNA transcript spot-count matrix, together with gene identities, fish identities, and brain-region annotations. Define molecular subtypes by co-expression of multiple genes after binarizing their mRNA transcript counts. Retain cfos in the 41-gene binary expression matrix for display, but exclude it from the 40-gene barcode used to define molecular subtype identity. Visualize the binary expression matrix with neurons ordered by their derived subtype labels, alongside aligned subtype-color and brain-region annotation vectors. For clarity, summarize categorical annotations every 10 cells using the mode and sample the binary expression matrix every 130 cells using a representative cell from each group.";

const FISH_BRIEF = {
  raw_question: FISH_QUESTION,
  scientific_goal: "Classify fish 1-3 neurons into molecular subtypes using multi-gene co-expression after binarizing continuous RNA transcript spot counts.",
  intent_mode: "focused_analysis",
  intent_status: "ready",
  biological_scope: ["zebrafish neurons from fish 1-3"],
  requested_data: ["Per-neuron continuous RNA spot counts", "Gene, fish, and brain-region identities"],
  hard_constraints: ["Exclude cfos from subtype identity while retaining it for display", "Summarize annotations every 10 cells using the mode"],
  output_preferences: ["Sample the binary expression matrix every 130 cells using one representative cell per group"],
};

const FISH_INTERPRETATION = {
  objective: "Classify zebrafish neurons into molecular subtypes using multi-gene co-expression.",
  biological_scope: ["zebrafish neurons from fish 1-3"],
  data_abstraction: ["continuous RNA transcript spot-count matrix", "per-neuron observations"],
  hard_constraints: ["Exclude cfos from subtype identity while retaining it for display"],
  output_preferences: ["Ordered binary expression matrix with aligned annotations", "Sample the binary expression matrix every 130 cells"],
  species: ["zebrafish"],
  species_evidence: ["The question analyzes neurons from fish 1-3 and metadata identifies zebrafish."],
  query_text: "zebrafish molecular subtype classification multi-gene expression",
  method_query_text: "zebrafish single-neuron co-expression clustering marker analysis",
};

async function writeBoundaryRecipe(root: string, repositoryUrl: string): Promise<string> {
  const path = join(root, "manifold-boundary");
  await mkdir(path, { recursive: true });
  await writeFile(join(path, "SKILL.md"), "---\ndescription: Manifold analysis boundary for calcium imaging\n---\n\n# ManifoldAnalysis boundary\n", "utf8");
  await writeFile(join(path, "recipe-card.json"), `${JSON.stringify({
    schema_version: 1,
    recipe_id: "manifold-analysis-boundary",
    version: "1.0.0",
    status: "active",
    kind: "reference",
    summary: "A calcium-imaging manifold workflow that is not an RNA subtype analysis Recipe.",
    aliases: [],
    does: [],
    evidence_for: [],
    accepts: { species: ["zebrafish"], modalities: ["calcium"], observation_units: ["neurons"], requires: [] },
    produces: [],
    use_when: ["RNA transcript spot counts require molecular subtype classification"],
    avoid_when: ["The input modality is RNA transcript spot counts"],
    source: { type: "rag", evidence_refs: [], repository_url: repositoryUrl },
    quality: { passed_runs: 0, recipe_attributed_failures: 0 },
  }, null, 2)}\n`, "utf8");
  return path;
}

async function writeDirectLocalRecipe(root: string): Promise<string> {
  const path = join(root, "direct-consensus");
  await mkdir(join(path, "scripts"), { recursive: true });
  await writeFile(join(path, "SKILL.md"), "# Direct consensus Recipe\n\nLoad zebrafish structural connectivity, compute iterative Louvain co-assignment, apply Ward clustering, and render a dendrogram.\n", "utf8");
  await writeFile(join(path, "scripts", "main.py"), "coassignment = compute_coassignment_probability(sc)\nZ = linkage(1 - coassignment, method='ward')\ndendrogram(Z)\n", "utf8");
  await writeFile(join(path, "recipe-card.json"), `${JSON.stringify({
    schema_version: 1,
    recipe_id: "direct-zebrafish-consensus",
    version: "1.0.0",
    status: "active",
    kind: "analysis",
    summary: "Iterative Louvain co-assignment and Ward consensus clustering for zebrafish structural connectivity.",
    aliases: [],
    does: ["clustering", "connectivity"],
    evidence_for: [],
    accepts: { species: ["zebrafish"], modalities: ["connectome"], observation_units: ["region"], requires: ["connectivity_matrix"] },
    produces: ["cluster_assignments", "result_matrix"],
    use_when: ["Identify consensus modules from a zebrafish structural connectivity matrix"],
    avoid_when: ["The input modality is structural connectivity"],
    source: { type: "builtin", evidence_refs: ["SKILL.md", "scripts/main.py"] },
    quality: { passed_runs: 0, recipe_attributed_failures: 0 },
  }, null, 2)}\n`, "utf8");
  return path;
}

describe("RecipeScoutV2", () => {
  it("uses the original question as a facet-free fallback instead of rule matching", () => {
    const query = buildScoutScientificQuery({
      question: "generate structural connectivity modules",
      task_brief: FISH_BRIEF,
      scientific_background: "gene expression",
    });
    expect(query.query_text).toBe("generate structural connectivity modules");
    expect(query.method_query_text).toBe("generate structural connectivity modules");
    expect(query.species).toEqual([]);
    expect(query.data_abstraction).toEqual([]);
  });

  it("normalizes a model-generated query while keeping the raw question authoritative", () => {
    const query = normalizeScoutScientificQuery(FISH_INTERPRETATION, FISH_QUESTION);
    expect(query.raw_question).toBe(FISH_QUESTION);
    expect(query.species).toEqual(["zebrafish"]);
    expect(query.query_text).toBe(FISH_INTERPRETATION.query_text);
    expect(query.method_query_text).toBe(FISH_INTERPRETATION.method_query_text);
  });

  it("does not enable species hard filtering without explicit model evidence", () => {
    const query = normalizeScoutScientificQuery({
      ...FISH_INTERPRETATION,
      species: ["mouse"],
      species_evidence: [],
    }, FISH_QUESTION);
    expect(query.species).toEqual([]);
  });

  it("passes only the original question and dataset metadata to the query interpreter", async () => {
    let received: any;
    const scout = new RecipeScoutV2({ query: async () => ({ ok: true, sources: [], warnings: [] }) } as any, {
      interpretScientificQuery: async (input) => {
        received = input;
        return FISH_INTERPRETATION;
      },
    });
    await scout.resolve({
      question: "generate structural connectivity modules",
      dataset_metadata: "{\"species\":\"zebrafish\"}",
      scientific_background: "must not be forwarded",
      literature_queries: ["must not be forwarded"],
      skill_enable: false,
    });
    expect(received).toEqual({
      question: "generate structural connectivity modules",
      dataset_metadata: "{\"species\":\"zebrafish\"}",
    });
  });

  it("preserves a finalizer-selected local Recipe without modality elimination or post-finalizer rejudgment", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekbrain-scout-direct-local-"));
    const recipePath = await writeDirectLocalRecipe(root);
    const scout = new RecipeScoutV2({ query: async () => ({ ok: true, sources: [], warnings: [] }) } as any, {
      interpretScientificQuery: async () => ({
        ...FISH_INTERPRETATION,
        query_text: "zebrafish structural connectivity consensus modules",
        method_query_text: "iterative Louvain co-assignment Ward dendrogram",
      }),
      triageCandidates: async (input) => ({ decisions: input.candidates.map((candidate) => ({ candidate_id: candidate.candidate_id, inspect: true, priority: 100, reason: "inspect direct local Recipe" })) }),
      finalizeCandidates: async (input) => ({
        selected: [{
          candidate_id: input.candidates.find((candidate) => candidate.recipe_path === recipePath)!.candidate_id,
          role: "scientific_backbone",
          transfer_level: "direct",
          evidence_strength: "strong",
          reason: "directly implements the requested workflow",
          executable_capabilities: ["iterative Louvain co-assignment", "Ward clustering", "dendrogram"],
          adaptation_gaps: [],
        }],
      }),
    });
    try {
      const result = await scout.resolve({
        question: "Identify zebrafish structural connectivity modules with iterative Louvain and Ward clustering.",
        dataset_metadata: "{\"species\":\"zebrafish\"}",
        root_dir: root,
        skill_dir: recipePath,
        paper_source: "none",
        literature_provider: "none",
        scout_rag_rounds: 1,
      }, root);
      expect(result.method_pack.primary).toMatchObject({ recipe_path: recipePath, transfer_level: "direct" });
      expect(result.method_pack.primary.executable_capabilities).toEqual(expect.arrayContaining(["Ward clustering"]));
      expect(result.method_pack).not.toHaveProperty("classifications");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("finds the fish molecular-subtype backbone, applies exact repository boundary memory, and keeps task-specific gaps downstream", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekbrain-scout-fish-"));
    const trajectory = join(root, "trajectory");
    const traceDir = join(root, "trace");
    const repos = {
      manifold: "https://github.com/example/ManifoldAnalysis",
      anneser: "https://github.com/Anneser/zebrafishTelencephalon",
      rgc: "https://github.com/shekharlab/ZebrafishRGC",
      mfish: "https://github.com/AllenInstitute/mfishtools",
    };
    await writeBoundaryRecipe(trajectory, repos.manifold);
    const ragCalls: any[] = [];
    const materialized: string[] = [];
    const rag = {
      query: async (input: any) => {
        ragCalls.push(input);
        return {
          ok: true,
          warnings: [],
          sources: [
            { source_id: "S1", title: "Manifold dynamics", text: "Zebrafish neural manifolds from calcium imaging.", github_links: [repos.manifold] },
            { source_id: "S2", title: "Telencephalon molecular identities", text: "Single-neuron gene co-expression and molecular identity analysis in zebrafish telencephalon.", github_links: [repos.anneser] },
            { source_id: "S3", title: "Zebrafish retinal ganglion cell atlas", text: "Molecular subtype discovery and marker-expression analysis for zebrafish neurons.", github_links: [repos.rgc] },
            { source_id: "S4", title: "mFISH tools", text: "Barcode and transcript-count utilities for multiplexed FISH measurements.", github_links: [repos.mfish] },
          ],
        };
      },
    };
    const scout = new RecipeScoutV2(rag as any, {
      userSkillsRoot: join(root, "skills"),
      interpretScientificQuery: async () => ({
        ...FISH_INTERPRETATION,
        method_query_text: "zebrafish binary gene expression barcode molecular subtype discovery",
      }),
      materializeRepository: async (url) => {
        materialized.push(url);
        const name = url.split("/").pop()!;
        const repositoryDir = join(root, "repositories", name);
        const localPath = join(repositoryDir, "analysis.R");
        await mkdir(repositoryDir, { recursive: true });
        const source = url === repos.anneser
          ? "clusters <- FindClusters(expression)\npheatmap(expression)\n"
          : url === repos.rgc
            ? "markers <- FindAllMarkers(expression)\npredicted <- predict(classifier, expression)\n"
            : "binary <- expression > 0\n";
        await writeFile(localPath, source, "utf8");
        return {
          ok: true,
          repository_key: url.toLowerCase(),
          repository_url: url,
          repository_dir: repositoryDir,
          source_commit: "abc123",
          candidate_files: [{ path: "analysis.R", local_path: localPath, summary: "cluster_subtypes(binary_expression)" }],
          tree_paths: ["README.md", "analysis.R"],
          reused: false,
        };
      },
      triageCandidates: async (input) => ({
        decisions: input.candidates.map((candidate) => {
          if (candidate.known_boundary) return { candidate_id: candidate.candidate_id, role: "reject", transfer_level: "none", inspect: false, priority: 0, reason: "known non-executable boundary", failure_code: "no_executable_workflow" } as const;
          const repositories = [candidate.repository_url, ...(candidate.repository_options || []).map((option) => option.repository_url)].filter(Boolean);
          if (repositories.includes(repos.manifold)) return candidate.origin === "rag_paper"
            ? { candidate_id: candidate.candidate_id, role: "adapter", transfer_level: "structural", inspect: true, priority: 110, reason: "expand so exact boundary memory can be applied" } as const
            : { candidate_id: candidate.candidate_id, role: "reject", transfer_level: "none", inspect: false, priority: 0, reason: "known local boundary", failure_code: "no_executable_workflow" } as const;
          if (repositories.includes(repos.anneser)) return { candidate_id: candidate.candidate_id, role: "scientific_backbone", transfer_level: "near", inspect: true, priority: 100, reason: "central molecular-subtype workflow" } as const;
          if (repositories.includes(repos.rgc)) return { candidate_id: candidate.candidate_id, role: "supporting", transfer_level: "structural", inspect: true, priority: 90, reason: "complementary subtype-marker workflow" } as const;
          return { candidate_id: candidate.candidate_id, role: "adapter", transfer_level: "structural", inspect: true, priority: 80, reason: "possible barcode adapter" } as const;
        }),
      }),
      finalizeCandidates: async (input) => {
        const id = (url: string) => input.candidates.find((candidate) => candidate.repository_url === url)!.candidate_id;
        return {
          selected: [
            {
              candidate_id: id(repos.anneser),
              role: "scientific_backbone",
              transfer_level: "near",
              reason: "best transferable scientific backbone",
              adaptation_gaps: ["binarize spot counts", "exclude cfos from identity but retain it for display", "apply the 10/130 display sampling rules"],
            },
            {
              candidate_id: id(repos.rgc),
              role: "supporting",
              transfer_level: "structural",
              reason: "complementary marker/subtype organization",
              adaptation_gaps: ["adapt the repository's expression input contract"],
            },
          ],
        };
      },
    });
    try {
      const result = await scout.resolve({
        question: FISH_QUESTION,
        task_brief: FISH_BRIEF,
        scientific_background: "Multi-gene FISH spot counts from larval zebrafish neurons.",
        root_dir: root,
        skill_dir: trajectory,
        trace_dir: traceDir,
        paper_source: "ailab_rag",
        literature_provider: "ailab_rag",
        base_url: "https://rag.example",
      }, root);
      expect(result).toMatchObject({ ok: true, matched: true, source: "method_pack", generated: false, resolution_mode: "recipe_scout_v2" });
      expect(result.method_pack.primary.repository_url).toBe(repos.anneser);
      expect(result.method_pack.supporting.repository_url).toBe(repos.rgc);
      expect(result.method_pack.downstream_constraints.join(" ")).toContain("every 130 cells");
      expect(result.method_pack.primary.adaptation_gaps.join(" ")).toContain("exclude cfos");
      expect(materialized).toEqual(expect.arrayContaining([repos.anneser, repos.rgc, repos.mfish]));
      expect(materialized).not.toContain(repos.manifold);
      expect(ragCalls.length).toBeGreaterThanOrEqual(2);
      expect(ragCalls.slice(0, 2)).toEqual(expect.arrayContaining([
        expect.objectContaining({ top_k: 8, candidate_pool_size: 8, require_github: false, question: result.method_pack.scientific_query.query_text }),
        expect.objectContaining({ top_k: 8, candidate_pool_size: 8, require_github: true, question: result.method_pack.scientific_query.method_query_text }),
      ]));
      expect(ragCalls.every((call) => !call.question.includes("every 130 cells"))).toBe(true);
      expect(result.recipe_set).toMatchObject({ compatibility_projection: true, complete: true });
      expect(result.recipe_set.selected).toHaveLength(2);
      expect(result.recipe_set).not.toHaveProperty("uncovered_requirement_ids");
      expect(result.recipe_set.selected[0]).not.toHaveProperty("covers");
      expect(JSON.parse(await readFile(join(traceDir, "method_pack.json"), "utf8"))).toMatchObject({ status: "matched" });
      const trace = JSON.parse(await readFile(join(traceDir, "recipe_scout_trace.json"), "utf8"));
      expect(trace).toMatchObject({ resolution_mode: "recipe_scout_v2", budgets: { repository_inspections: 4 } });
      expect(trace.candidates.every((candidate: any) => /^(?:repo|local|paper):[a-f0-9]{16}$/.test(candidate.candidate_id))).toBe(true);
      expect(trace.paper_candidates).toHaveLength(4);
      expect(trace.paper_candidates.every((candidate: any) => candidate.retrieval.length >= 2)).toBe(true);
      expect(trace.repository_expansions).toEqual(expect.arrayContaining([
        expect.objectContaining({ repository_url: repos.manifold, action: "known_boundary" }),
      ]));
      expect(await readFile(join(traceDir, "method_guidance.md"), "utf8")).toContain("Scientific backbone");
      expect(await readFile(join(traceDir, "method_guidance.md"), "utf8")).toContain("Relevant Paper method evidence");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("triages Top-8 Papers before repository expansion so one Paper's six links cannot crowd out later Papers", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekbrain-scout-paper-groups-"));
    const anneser = "https://github.com/Anneser/zebrafishTelencephalon";
    const rgc = "https://github.com/shekharlab/ZebrafishRGC";
    const nblastRepositories = Array.from({ length: 6 }, (_, index) => `https://github.com/example/nblast-${index + 1}`);
    const sources = [
      { source_id: "P1", title: "NBLAST morphology resources", text: "Neuron morphology matching from reconstructions.", github_links: nblastRepositories },
      { source_id: "P2", title: "Unrelated atlas one", text: "Reference resource.", github_links: ["https://github.com/example/atlas-one"] },
      { source_id: "P3", title: "Unrelated atlas two", text: "Reference resource.", github_links: ["https://github.com/example/atlas-two"] },
      { source_id: "P4", title: "Cluster evaluation", text: "Generic clustering stability.", github_links: ["https://github.com/example/cluster-eval"] },
      { source_id: "P5", title: "Zebrafish telencephalon molecular identities", text: "Gene-expression clustering, marker identities, and ordered subtype heatmaps.", github_links: [anneser] },
      { source_id: "P6", title: "Zebrafish retinal ganglion cell atlas", text: "Molecular subtype discovery, markers, and expression matrices.", github_links: [rgc] },
      { source_id: "P7", title: "Morphology projection", text: "Anatomical morphology projection.", github_links: ["https://github.com/example/morphology"] },
      { source_id: "P8", title: "Upstream converter", text: "Input conversion only.", github_links: ["https://github.com/example/converter"] },
    ];
    const calls: any[] = [];
    const triageInputs: any[] = [];
    const materialized: string[] = [];
    const scout = new RecipeScoutV2({
      query: async (input: any) => {
        calls.push(input);
        return { ok: true, warnings: [], sources };
      },
    } as any, {
      materializeRepository: async (url) => {
        materialized.push(url);
        const directory = join(root, url.endsWith("ZebrafishRGC") ? "rgc" : "anneser");
        const path = join(directory, "analysis.R");
        await mkdir(directory, { recursive: true });
        const source = url === anneser
          ? "clusters <- FindClusters(object)\nHeatmap(expression_matrix)\n"
          : "markers <- FindAllMarkers(object)\npredicted <- predict(classifier, expression_matrix)\n";
        await writeFile(path, source, "utf8");
        return { ok: true, repository_key: url.toLowerCase(), repository_url: url, candidate_files: [{ path: "analysis.R", local_path: path, summary: "subtype analysis" }], tree_paths: ["analysis.R"], reused: false };
      },
      triageCandidates: async (input) => {
        triageInputs.push(input);
        return {
          decisions: input.candidates.map((candidate) => {
            const repositories = (candidate.repository_options || []).map((option) => option.repository_url);
            if (repositories.includes(anneser)) return { candidate_id: candidate.candidate_id, role: "scientific_backbone", transfer_level: "near", inspect: true, priority: 100, reason: "central subtype workflow" } as const;
            if (repositories.includes(rgc)) return { candidate_id: candidate.candidate_id, role: "supporting", transfer_level: "structural", inspect: true, priority: 90, reason: "complementary subtype markers" } as const;
            return { candidate_id: candidate.candidate_id, role: "reject", transfer_level: "none", inspect: false, priority: 0, reason: "not central" } as const;
          }),
        };
      },
      finalizeCandidates: async (input) => {
        const anneserCandidate = input.candidates.find((candidate) => candidate.repository_url === anneser)!;
        const rgcCandidate = input.candidates.find((candidate) => candidate.repository_url === rgc)!;
        return {
          selected: [
            { candidate_id: anneserCandidate.candidate_id, role: "scientific_backbone", transfer_level: "near", reason: "best backbone", adaptation_gaps: ["adapt spot-count binarization"] },
            { candidate_id: rgcCandidate.candidate_id, role: "supporting", transfer_level: "structural", reason: "useful supporting marker logic", adaptation_gaps: [] },
          ],
        };
      },
    });
    try {
      const result = await scout.resolve({
        question: FISH_QUESTION,
        task_brief: FISH_BRIEF,
        scientific_background: "Multi-gene FISH spot counts from larval zebrafish neurons.",
        root_dir: root,
        skill_dir: join(root, "empty"),
        paper_source: "ailab_rag",
        literature_provider: "ailab_rag",
      }, root);
      expect(calls).toHaveLength(2);
      expect(triageInputs).toHaveLength(1);
      expect(triageInputs[0].candidates).toHaveLength(8);
      expect(triageInputs[0].candidates.every((candidate: any) => candidate.origin === "rag_paper")).toBe(true);
      expect(triageInputs[0].candidates.find((candidate: any) => candidate.title === "NBLAST morphology resources").repository_options).toHaveLength(6);
      expect(materialized).toEqual(expect.arrayContaining([anneser, rgc]));
      expect(materialized).toHaveLength(2);
      expect(result.method_pack.primary.repository_url).toBe(anneser);
      expect(result.method_pack.supporting.repository_url).toBe(rgc);
      expect(result.details.repository_inspection_count).toBe(2);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("admits an executable structural method when only task-specific adaptations are missing", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekbrain-scout-structural-reference-"));
    const repositoryUrl = "https://github.com/example/structural-subtype-workflow";
    const scout = new RecipeScoutV2({
      query: async () => ({ ok: true, warnings: [], sources: [{ source_id: "P1", title: "Structural subtype workflow", text: "Gene-expression clustering, marker extraction, and heatmap ordering.", github_links: [repositoryUrl] }] }),
    } as any, {
      materializeRepository: async (url) => {
        const directory = join(root, "repository");
        const path = join(directory, "analysis.R");
        await mkdir(directory, { recursive: true });
        await writeFile(path, "clusters <- cluster(expression)\nmarkers <- markers(clusters)\nheatmap(expression)\n", "utf8");
        return { ok: true, repository_key: url.toLowerCase(), repository_url: url, candidate_files: [{ path: "analysis.R", local_path: path, summary: "clustering markers heatmap" }], tree_paths: ["analysis.R"], reused: false };
      },
      triageCandidates: async (input) => ({ decisions: input.candidates.map((candidate) => ({ candidate_id: candidate.candidate_id, role: "scientific_backbone", transfer_level: "structural", inspect: true, priority: 100, reason: "inspect transferable subtype logic" })) }),
      finalizeCandidates: async (input) => ({
        selected: [{
          candidate_id: input.candidates[0].candidate_id,
          role: "scientific_backbone",
          transfer_level: "structural",
          evidence_strength: "strong",
          reason: "transferable executable subtype workflow",
          executable_capabilities: ["gene-expression clustering", "marker extraction", "ordered heatmap"],
          adaptation_gaps: ["binarize spot counts", "apply cfos exclusion", "apply 10/130 display sampling"],
        }],
      }),
    });
    try {
      const result = await scout.resolve({
        question: FISH_QUESTION,
        task_brief: FISH_BRIEF,
        scientific_background: "Multi-gene FISH spot counts from larval zebrafish neurons.",
        root_dir: root,
        skill_dir: join(root, "empty"),
        paper_source: "ailab_rag",
        literature_provider: "ailab_rag",
        scout_rag_rounds: 1,
      }, root);
      expect(result.matched).toBe(true);
      expect(result.method_pack.primary).toMatchObject({ repository_url: repositoryUrl, transfer_level: "structural" });
      expect(result.method_pack.primary.adaptation_gaps).toEqual(expect.arrayContaining(["binarize spot counts", "apply cfos exclusion", "apply 10/130 display sampling"]));
      expect(result.method_pack.primary.executable_capabilities).toEqual(expect.arrayContaining(["gene-expression clustering", "marker extraction"]));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("preserves the finalizer's round-two selection without deterministic reranking", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekbrain-scout-incumbent-"));
    const incumbentRepo = "https://github.com/example/incumbent-subtypes";
    const challengerRepo = "https://github.com/example/weaker-challenger";
    let ragCalls = 0;
    const scout = new RecipeScoutV2({
      query: async () => {
        ragCalls += 1;
        return {
          ok: true,
          warnings: [],
          sources: ragCalls <= 2
            ? [{ source_id: "P1", title: "Incumbent subtype workflow", text: "Molecular subtype clustering, marker analysis, and ordered heatmaps.", github_links: [incumbentRepo] }]
            : [{ source_id: "P2", title: "Challenger clustering workflow", text: "Generic expression clustering.", github_links: [challengerRepo] }],
        };
      },
    } as any, {
      materializeRepository: async (url) => {
        const directory = join(root, url === incumbentRepo ? "incumbent" : "challenger");
        const path = join(directory, "analysis.R");
        await mkdir(directory, { recursive: true });
        await writeFile(path, url === incumbentRepo
          ? "clusters <- FindClusters(object)\nmarkers <- FindAllMarkers(object)\nHeatmap(expression)\n"
          : "clusters <- FindClusters(object)\n", "utf8");
        return { ok: true, repository_key: url.toLowerCase(), repository_url: url, candidate_files: [{ path: "analysis.R", local_path: path, summary: "subtype workflow" }], tree_paths: ["analysis.R"], reused: false };
      },
      triageCandidates: async (input) => ({ decisions: input.candidates.map((candidate) => ({ candidate_id: candidate.candidate_id, inspect: true, priority: 1, reason: "inspect", role: "scientific_backbone", transfer_level: "structural" })) }),
      finalizeCandidates: async (input) => {
        const incumbent = input.candidates.find((candidate) => candidate.repository_url === incumbentRepo);
        const challenger = input.candidates.find((candidate) => candidate.repository_url === challengerRepo);
        return {
          selected: [{
            candidate_id: input.round === 2 && challenger ? challenger.candidate_id : incumbent!.candidate_id,
            role: "scientific_backbone" as const,
            transfer_level: "structural" as const,
            evidence_strength: "strong" as const,
            reason: input.round === 2 ? "try the new challenger" : "initial incumbent",
            executable_capabilities: ["subtype clustering"],
            adaptation_gaps: [],
          }],
          ...(input.round === 1 ? { retry_mode: "improvement" as const, unresolved_gap: "seek a closer subtype method" } : {}),
        };
      },
    });
    try {
      const result = await scout.resolve({
        question: FISH_QUESTION,
        root_dir: root,
        skill_dir: join(root, "empty"),
        paper_source: "ailab_rag",
        literature_provider: "ailab_rag",
      }, root);
      expect(ragCalls).toBe(3);
      expect(result.method_pack.primary.repository_url).toBe(challengerRepo);
      expect(result.method_pack.retry).toMatchObject({ performed: true, mode: "improvement" });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("replaces an incumbent when an improvement challenger has a better method fit", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekbrain-scout-challenger-"));
    const incumbentRepo = "https://github.com/example/structural-incumbent";
    const challengerRepo = "https://github.com/example/near-challenger";
    let ragCalls = 0;
    const scout = new RecipeScoutV2({
      query: async () => {
        ragCalls += 1;
        return { ok: true, warnings: [], sources: ragCalls <= 2
          ? [{ source_id: "P1", title: "Structural subtype method", text: "Generic expression clustering.", github_links: [incumbentRepo] }]
          : [{ source_id: "P2", title: "Near subtype method", text: "Single-neuron molecular classification and markers.", github_links: [challengerRepo] }] };
      },
    } as any, {
      materializeRepository: async (url) => {
        const directory = join(root, url === incumbentRepo ? "incumbent" : "challenger");
        const path = join(directory, "analysis.R");
        await mkdir(directory, { recursive: true });
        await writeFile(path, url === incumbentRepo ? "clusters <- FindClusters(object)\n" : "markers <- FindAllMarkers(object)\npredicted <- predict(classifier, expression)\n", "utf8");
        return { ok: true, repository_key: url.toLowerCase(), repository_url: url, candidate_files: [{ path: "analysis.R", local_path: path, summary: "subtype method" }], tree_paths: ["analysis.R"], reused: false };
      },
      triageCandidates: async (input) => ({ decisions: input.candidates.map((candidate) => ({ candidate_id: candidate.candidate_id, inspect: true, priority: 1, reason: "inspect" })) }),
      finalizeCandidates: async (input) => {
        const incumbent = input.candidates.find((candidate) => candidate.repository_url === incumbentRepo);
        const challenger = input.candidates.find((candidate) => candidate.repository_url === challengerRepo);
        return {
          selected: [{
            candidate_id: challenger?.candidate_id || incumbent!.candidate_id,
            role: "scientific_backbone" as const,
            transfer_level: challenger ? "near" as const : "structural" as const,
            evidence_strength: "strong" as const,
            reason: challenger ? "closer method" : "initial method",
            executable_capabilities: ["subtype clustering"],
            adaptation_gaps: [],
          }],
          ...(input.round === 1 ? { retry_mode: "improvement" as const, unresolved_gap: "seek a closer method" } : {}),
        };
      },
    });
    try {
      const result = await scout.resolve({ question: FISH_QUESTION, root_dir: root, skill_dir: join(root, "empty"), paper_source: "ailab_rag", literature_provider: "ailab_rag" }, root);
      expect(ragCalls).toBe(3);
      expect(result.method_pack.primary.repository_url).toBe(challengerRepo);
      expect(result.method_pack.retry).toMatchObject({ performed: true, mode: "improvement" });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("uses one failure-directed RAG retry with Top-4 and stays inside the shared inspection budget", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekbrain-scout-retry-"));
    const calls: any[] = [];
    const badRepo = "https://github.com/example/upstream-only";
    const goodRepo = "https://github.com/example/subtype-backbone";
    const retryQuery = "neuronal molecular subtype discovery from binary gene-expression barcodes executable repository";
    const rag = {
      query: async (input: any) => {
        calls.push(input);
        return {
          ok: true,
          warnings: [],
          sources: input.question === retryQuery
            ? [{ source_id: "S2", title: "Subtype discovery", text: "Cluster binary gene-expression barcodes into neuronal molecular subtypes.", github_links: [goodRepo] }]
            : [{ source_id: "S1", title: "Preprocessing only", text: "Normalize input counts.", github_links: [badRepo] }],
        };
      },
    };
    const scout = new RecipeScoutV2(rag as any, {
      interpretScientificQuery: async () => ({
        ...FISH_INTERPRETATION,
        method_query_text: "zebrafish binary gene expression barcode molecular subtype discovery",
      }),
      materializeRepository: async (url) => {
        const directory = join(root, url.endsWith("upstream-only") ? "bad" : "good");
        const path = join(directory, "analysis.py");
        await mkdir(directory, { recursive: true });
        await writeFile(path, url === badRepo ? "def normalize(x): return x\n" : "def discover_subtypes(binary_gene_matrix): return labels\n", "utf8");
        return { ok: true, repository_key: url.toLowerCase(), repository_url: url, candidate_files: [{ path: "analysis.py", local_path: path, summary: "analysis function" }], tree_paths: ["analysis.py"], reused: false };
      },
      triageCandidates: async (input) => ({ decisions: input.candidates.map((candidate) => ({ candidate_id: candidate.candidate_id, role: "scientific_backbone", transfer_level: "structural", inspect: true, priority: 10, reason: "inspect initial candidate" })) }),
      finalizeCandidates: async (input) => {
        const good = input.candidates.find((candidate) => candidate.repository_url === goodRepo);
        if (input.round === 1 || !good) return {
          selected: [],
          retry_query: retryQuery,
          retry_reason: "the first repository only preprocesses counts",
        };
        return {
          selected: [{ candidate_id: good.candidate_id, role: "scientific_backbone", transfer_level: "near", reason: "retry found the missing backbone", adaptation_gaps: [] }],
        };
      },
    });
    try {
      const result = await scout.resolve({
        question: FISH_QUESTION,
        task_brief: FISH_BRIEF,
        scientific_background: "Multi-gene FISH spot counts from larval zebrafish neurons.",
        root_dir: root,
        skill_dir: join(root, "empty"),
        paper_source: "ailab_rag",
        literature_provider: "ailab_rag",
        base_url: "https://rag.example",
      }, root);
      expect(result).toMatchObject({ matched: true, method_pack: { primary: { repository_url: goodRepo } }, details: { rag_round_count: 2 } });
      expect(calls).toHaveLength(3);
      expect(calls.slice(0, 2).every((call) => call.top_k === 8)).toBe(true);
      expect(new Set(calls.slice(0, 2).map((call) => call.question)).size).toBe(2);
      expect(calls[2]).toMatchObject({ top_k: 4, question: retryQuery });
      expect(result.details.rag_query_count).toBe(3);
      expect(result.details.repository_inspection_count).toBeLessThanOrEqual(4);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("does not use inspector capability judgments to trigger automatic backfill", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekbrain-scout-backfill-"));
    const repositories = [1, 2, 3, 4].map((index) => `https://github.com/example/candidate-${index}`);
    const materialized: string[] = [];
    const sources = [
      { source_id: "P0", title: "Methods paper without code", text: "A relevant conceptual molecular subtype method without a repository." },
      ...repositories.map((repository, index) => ({
        source_id: `P${index + 1}`,
        title: `Candidate ${index + 1}`,
        text: index === 3 ? "Executable molecular subtype clustering." : "Potential expression workflow.",
        github_links: [repository],
      })),
    ];
    const scout = new RecipeScoutV2({ query: async () => ({ ok: true, warnings: [], sources }) } as any, {
      materializeRepository: async (url) => {
        materialized.push(url);
        const directory = join(root, url.slice(url.lastIndexOf("/") + 1));
        const path = join(directory, "analysis.R");
        await mkdir(directory, { recursive: true });
        await writeFile(path, url === repositories[3] ? "clusters <- FindClusters(expression_object)\n" : "normalize_input <- function(x) x\n", "utf8");
        return { ok: true, repository_key: url.toLowerCase(), repository_url: url, candidate_files: [{ path: "analysis.R", local_path: path, summary: "analysis" }], tree_paths: ["analysis.R"], reused: false };
      },
      triageCandidates: async (input) => ({
        decisions: input.candidates.map((candidate) => ({
          candidate_id: candidate.candidate_id,
          inspect: true,
          priority: candidate.title.startsWith("Candidate") ? 1 - Number(candidate.title.slice(-1)) / 10 : 1,
          reason: "scientifically eligible",
        })),
      }),
      finalizeCandidates: async (input) => {
        const good = input.candidates.find((candidate) => candidate.repository_url === repositories[3]);
        return {
          selected: good ? [{
            candidate_id: good.candidate_id,
            role: "scientific_backbone" as const,
            transfer_level: "near" as const,
            evidence_strength: "moderate" as const,
            reason: "backfilled executable method",
            executable_capabilities: ["clustering"],
            adaptation_gaps: [],
          }] : [],
        };
      },
    });
    try {
      const result = await scout.resolve({
        question: FISH_QUESTION,
        root_dir: root,
        skill_dir: join(root, "empty"),
        paper_source: "ailab_rag",
        literature_provider: "ailab_rag",
        scout_rag_rounds: 1,
      }, root);
      expect(materialized).toEqual(repositories.slice(0, 3));
      expect(result.details.repository_inspection_count).toBe(3);
      expect(result.matched).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RagRecipeSearchService, extractMethodsSection, normalizeRepositoryRoot } from "../../src/formulation-recipe/rag-recipe-search.ts";
import { createRagRecipeSearchTool } from "../../src/formulation-recipe/rag-recipe-search-tool.ts";
import { RagRecipeGenerationService } from "../../src/formulation-recipe/rag-recipe-generation.ts";
import { createRagRecipeGenerationTool } from "../../src/formulation-recipe/rag-recipe-generation-tool.ts";

function parsed(result: any) { return JSON.parse(result.content[0].text); }

const methods = `# Abstract\nA short abstract.\n\n# Methods\n${"Method evidence for acquisition, preprocessing, modelling, statistics, and validation. ".repeat(12)}\n\n# Data analysis\nThe analysis used reproducible source code.\n\n# Data and code availability\nhttps://github.com/example/neuro-method\n\n# References\nReferences.`;

describe("Formulation RAG Recipe tools", () => {
  it("extracts full Methods boundaries and normalizes repository roots", () => {
    const section = extractMethodsSection(methods);
    expect(section?.heading).toBe("Methods");
    expect(section?.content).toContain("Data analysis");
    expect(section?.content).not.toContain("Data and code availability");
    expect(normalizeRepositoryRoot("https://github.com/example/neuro-method/tree/main/src")?.url).toBe("https://github.com/example/neuro-method");
    expect(normalizeRepositoryRoot("https://gitlab.com/group/subgroup/project/-/blob/main/a.py")?.url).toBe("https://gitlab.com/group/subgroup/project");
  });

  it("returns one persisted candidate per paper-repository pair without cloning", async () => {
    const runDir = await mkdtemp(join(tmpdir(), "seekbrain-rag-search-"));
    const checked: string[] = [];
    try {
      const service = new RagRecipeSearchService({
        runDir,
        resolveConfig: async () => ({ provider: "ailab_rag", baseUrl: "http://rag", topK: 4 }),
        client: {
          query: async () => [{
            paper_id: "ailab_rag:p1", track_id: "p1", title: "A repository method", full_text: methods,
            doi: "10.1/example", github_links: ["https://github.com/example/neuro-method", "https://github.com/example/neuro-method/tree/main"],
          }],
        } as any,
        reachability: { check: async (url) => { checked.push(url); return { reachable: true }; } },
        findExisting: async () => [],
      });
      const tool = createRagRecipeSearchTool(service);
      const value = parsed(await tool.execute("search", { query: "neural population method" }));
      expect(value.ok).toBe(true);
      expect(value.candidates).toHaveLength(1);
      expect(value.candidates[0]).toMatchObject({ repository: { url: "https://github.com/example/neuro-method", reachable: true } });
      expect(value.candidates[0].paper.methods.content).toContain("Data analysis");
      expect(checked).toEqual(["https://github.com/example/neuro-method"]);
      const restored = await service.store.findCandidate(value.candidates[0].candidate_id);
      expect(restored?.paper.title).toBe("A repository method");
      expect(await readFile(restored!.methods_path, "utf8")).toContain("Method evidence");
    } finally { await rm(runDir, { recursive: true, force: true }); }
  });

  it("generates a candidate Skill from exact selected repository paths and enforces the two-call budget", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekbrain-rag-generate-"));
    const runDir = join(root, "run");
    const fromRagRoot = join(root, "skills", "from_rag");
    await mkdir(runDir, { recursive: true });
    try {
      const search = new RagRecipeSearchService({
        runDir,
        resolveConfig: async () => ({ provider: "ailab_rag", baseUrl: "http://rag" }),
        client: { query: async () => [{ paper_id: "ailab_rag:p1", track_id: "p1", title: "Neural method", full_text: methods, github_links: ["https://github.com/example/neuro-method"] }] } as any,
        reachability: { check: async () => ({ reachable: true }) },
        findExisting: async () => [],
      });
      const artifact = await search.search("classify neural states");
      const gitCalls: string[][] = [];
      const service = new RagRecipeGenerationService({
        runDir,
        fromRagRoot,
        runGit: async (args) => {
          gitCalls.push(args);
          if (args[0] === "rev-parse") return "abc123\n";
          if (args[0] === "ls-tree") return "README.md\nsrc/model.py\nsrc/unused.py\n";
          if (args[0] === "show" && args[1] === "HEAD:README.md") return "# Neuro method\nUse src/model.py.";
          if (args[0] === "show" && args[1] === "HEAD:src/model.py") return "def fit_states(x):\n    return x\n";
          if (args[0] === "show") throw new Error("unexpected source read");
          return "";
        },
        models: {
          selectExisting: async (input) => ({ matched_adaptation_id: input.adaptations[0]?.adaptation_id || null, reason: "same scientific objective" }),
          createAdaptation: async () => ({
            adaptation_id: "neural-state-classification", objective: "Classify neural states", query_scope: "neural state data",
            required_inputs: ["neural feature matrix"], selected_repository_paths: ["src/model.py"], operations: ["fit state model"],
            expected_outputs: ["state labels"], validation_criteria: ["stable labels"], adaptation_gaps: [],
          }),
          generateSkill: async () => ({
            name: "neural-state-classification", description: "Classify neural states with repository-backed modelling.",
            triggers: ["classify neural states"], tags: ["neuroscience", "classification"],
            skill_body: "# Neural state classification\n\n## Procedure\n1. Load the neural feature matrix.\n2. Fit the repository-backed state model.\n\n## Known boundaries\nThe adaptation code has not passed SeekBrain Validation.",
            analysis_script: "def run(features):\n    return features\n", script_extension: "py",
            recipe_card: {
              recipe_id: "neural-state-classification", version: "0.1.0", kind: "analysis", summary: "Classify neural states.", aliases: [],
              does: ["decoding"], evidence_for: ["latent_state"], accepts: { species: [], modalities: [], observation_units: ["neuron"], requires: ["feature_matrix"] },
              produces: ["state_labels"], use_when: ["Neural states need classification."], avoid_when: ["No neural feature matrix is available."],
            },
          }),
        },
      });
      const tool = createRagRecipeGenerationTool(service);
      const first = parsed(await tool.execute("generate-1", { candidate_ids: [artifact.candidates[0].candidate_id] }));
      expect(first.ok).toBe(true);
      expect(first.recipes[0]).toMatchObject({ recipe_id: "neural-state-classification", reused: false, status: "candidate" });
      expect(first.recipes[0].recipe_path).toMatch(/SKILL\.md$/);
      expect(gitCalls.filter((args) => args[0] === "show").map((args) => args[1])).toEqual(["HEAD:README.md", "HEAD:src/model.py"]);
      expect(gitCalls.some((args) => args.includes("src/unused.py"))).toBe(false);

      const second = parsed(await tool.execute("generate-2", { candidate_ids: [artifact.candidates[0].candidate_id] }));
      expect(second.ok).toBe(true);
      expect(second.recipes[0].reused).toBe(true);
      const third = parsed(await tool.execute("generate-3", { candidate_ids: [artifact.candidates[0].candidate_id] }));
      expect(third).toMatchObject({ ok: false, error_code: "recipe_generation_call_limit_exceeded", allowed_calls: 2, used_calls: 2 });
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("exposes only query and candidate_ids as model arguments", () => {
    const searchTool: any = createRagRecipeSearchTool({} as any);
    const generationTool: any = createRagRecipeGenerationTool({} as any);
    expect(Object.keys(searchTool.parameters.properties)).toEqual(["query"]);
    expect(Object.keys(generationTool.parameters.properties)).toEqual(["candidate_ids"]);
  });
});

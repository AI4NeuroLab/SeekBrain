import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { PaperRecord, RepositoryCandidate } from "../../src/literature-compat/contracts.ts";
import { MemoryCache } from "../../src/literature-compat/cache.ts";
import { discoverPaperRepositories, extractRepositoryCandidates } from "../../src/literature-compat/shared/repository-extractor.ts";
import { normalizeRepositoryUrl, RepositoryValidator } from "../../src/literature-compat/shared/repository-validator.ts";
import { RagSkillGenerator, TargetedSkillResolver } from "../../src/targeted-skill/index.ts";

function paper(id: string, repositories: RepositoryCandidate[] = []): PaperRecord {
  return {
    provider: "semantic_scholar",
    providerId: id,
    title: `Paper ${id}`,
    abstract: `Method evidence for paper ${id}`,
    authors: [],
    doi: `10.1000/${id}`,
    repositoryCandidates: repositories,
  };
}

describe("Phase 5 repository evidence", () => {
  it("extracts explicit paper repositories and classifies dependencies and citations separately", () => {
    expect(extractRepositoryCandidates("Our source code is available at https://github.com/lab/analysis.", "abstract")[0]).toMatchObject({
      url: "https://github.com/lab/analysis", relation: "paper_analysis_code", discoverySource: "abstract",
    });
    expect(extractRepositoryCandidates("The analysis uses the NumPy package from https://github.com/numpy/numpy.", "abstract")[0].relation).toBe("dependency");
    expect(extractRepositoryCandidates("Previous work and cited code: https://github.com/other/prior.", "pmc_full_text")[0].relation).toBe("cited_resource");
    expect(discoverPaperRepositories({ ...paper("one"), abstract: "Code available at https://github.com/lab/tool", fullText: "Code available at https://github.com/lab/tool" })).toHaveLength(1);
  });

  it("normalizes repository roots and validates only explicitly associated live repositories", async () => {
    expect(normalizeRepositoryUrl("https://github.com/Lab/Repo/tree/main/src")).toBe("https://github.com/Lab/Repo");
    expect(normalizeRepositoryUrl("https://github.com/Lab")).toBeUndefined();
    expect(normalizeRepositoryUrl("https://example.org/Lab/Repo")).toBeUndefined();
    const run = vi.fn(async () => true);
    const validator = new RepositoryValidator({ run, cache: new MemoryCache(), timeoutMs: 500 });
    const candidate = { url: "https://github.com/Lab/Repo/tree/main", relation: "paper_analysis_code", discoverySource: "abstract" } as const;
    await expect(validator.validate(candidate)).resolves.toEqual({ ok: true, url: "https://github.com/Lab/Repo" });
    await expect(validator.validate(candidate)).resolves.toEqual({ ok: true, url: "https://github.com/Lab/Repo" });
    expect(run).toHaveBeenCalledOnce();
    await expect(validator.validate({ ...candidate, relation: "dependency" })).resolves.toEqual({ ok: false, reason: "association_unverified" });
  });
});

describe("Phase 5 slim external Recipe selection", () => {
  const repo = (name: string): RepositoryCandidate => ({ url: `https://github.com/lab/${name}`, relation: "paper_analysis_code", discoverySource: "abstract" });
  const validate = async (candidate: RepositoryCandidate) => ({ ok: true, url: candidate.url });

  it("uses only the first verified repository and does not generate a speculative Skill", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekbrain-phase5-slim-"));
    const materialized: string[] = [];
    const resolver = new TargetedSkillResolver({ query: async () => ({ ok: true, papers: [paper("one", [repo("one")]), paper("two", [repo("two")])], sources: [], source_count: 2, warnings: [] }) }, {
      validateRepository: validate,
      lookupValidatedRepositoryScripts: async () => undefined,
      materializeRepository: async (url) => {
        materialized.push(url);
        return { ok: true, repository_key: "github.com/lab/one", repository_url: url, source_commit: "abc", candidate_files: [{ path: "analysis.py", local_path: join(root, "analysis.py"), summary: "analysis implementation" }], reused: false };
      },
    });
    const result = await resolver.resolve({ question: "external method", root_dir: root, skill_dir: join(root, "empty"), paper_source: "semantic_scholar" }, root);
    expect(materialized).toEqual(["https://github.com/lab/one"]);
    expect(result).toMatchObject({ ok: true, matched: true, generated: false, source: "repository_reference" });
  });

  it("reuses a registered validated script without materializing the repository", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekbrain-phase5-reuse-"));
    let materializeCalls = 0;
    const resolver = new TargetedSkillResolver({ query: async () => ({ ok: true, papers: [paper("one", [repo("one")])], sources: [], source_count: 1, warnings: [] }) }, {
      validateRepository: validate,
      lookupValidatedRepositoryScripts: async () => ({ repository_key: "github.com/lab/one", repository_url: "https://github.com/lab/one", recipe_path: "/skills/one/SKILL.md", script_path: "/skills/one/scripts/run_analysis.py", validation_run_id: "prior", validated_at: "now" }),
      materializeRepository: async () => { materializeCalls += 1; throw new Error("unexpected materialization"); },
    });
    const result = await resolver.resolve({ question: "different current wording", root_dir: root, skill_dir: join(root, "empty"), paper_source: "semantic_scholar" }, root);
    expect(materializeCalls).toBe(0);
    expect(result).toMatchObject({ generated: false, source: "validated_repository_recipe", details: { reused_validated_scripts: true } });
  });

  it("keeps one compact paper reference when no repository is available", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekbrain-phase5-paper-"));
    const resolver = new TargetedSkillResolver({ query: async () => ({ ok: true, papers: [paper("one"), paper("two")], sources: [], source_count: 2, warnings: [] }) }, { validateRepository: validate });
    const result = await resolver.resolve({ question: "paper method", root_dir: root, skill_dir: join(root, "empty"), paper_source: "semantic_scholar" }, root);
    expect(result).toMatchObject({ matched: true, generated: false, source: "paper_reference" });
    expect(result.targeted_skill).toContain("Paper one");
    expect(result.targeted_skill).not.toContain("Paper two");
  });
});

describe("RagSkillGenerator paper-only mode", () => {
  it("writes only paper evidence and metadata without scripts or repository context", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekbrain-paper-only-skill-"));
    const result = await new RagSkillGenerator().generate({
      question: "paper method",
      title: "Paper-only method",
      paperText: "The paper describes a statistical procedure but provides no implementation repository.",
      evidenceLevel: "paper_only",
      provider: "pubmed",
      pmid: "123",
      pmcid: "PMC456",
      outputDir: root,
    });
    expect(result).toMatchObject({ ok: true, evidence_level: "paper_only" });
    expect((await readdir(result.skill_path)).sort()).toEqual(["SKILL.md", "metadata.json", "references"].sort());
    expect((await readdir(join(result.skill_path, "references"))).sort()).toEqual(["paper_context.md"]);
    expect(existsSync(join(result.skill_path, "scripts"))).toBe(false);
    expect(existsSync(join(result.skill_path, "references", "repo_context.md"))).toBe(false);
    expect(await readFile(join(result.skill_path, "SKILL.md"), "utf8")).toContain("No associated implementation repository was verified");
    expect(JSON.parse(await readFile(join(result.skill_path, "metadata.json"), "utf8"))).toMatchObject({
      evidence_level: "paper_only", provider: "pubmed", pmid: "123", pmcid: "PMC456", repository_url: null, scripts_available: false,
    });
  });
});

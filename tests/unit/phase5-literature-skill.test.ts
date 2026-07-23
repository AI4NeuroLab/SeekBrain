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

class RecordingGenerator extends RagSkillGenerator {
  calls: Array<Record<string, any>> = [];

  override async generate(input: Parameters<RagSkillGenerator["generate"]>[0]) {
    this.calls.push(input);
    const skillPath = join(input.outputDir, `skill-${this.calls.length}`);
    await mkdir(skillPath, { recursive: true });
    await writeFile(join(skillPath, "SKILL.md"), `# ${input.title}\n`);
    return { ok: true, skill_path: skillPath, reused: false, evidence_level: input.evidenceLevel };
  }
}

async function resolveExternal(papers: PaperRecord[], validator: (candidate: RepositoryCandidate) => Promise<any>) {
  const root = await mkdtemp(join(tmpdir(), "seekbrain-phase5-resolver-"));
  const generator = new RecordingGenerator();
  const resolver = new TargetedSkillResolver({ query: async () => ({ ok: true, papers, sources: [], source_count: papers.length, warnings: [] }) }, {
    generatedSkillDir: join(root, "skills"),
    ragSkillGenerator: generator,
    validateRepository: validator,
  });
  const result = await resolver.resolve({
    question: "external method",
    root_dir: root,
    skill_dir: join(root, "empty"),
    paper_source: "semantic_scholar",
    compatibility: { candidate_pool_size: 10, skill_top_k: 2, prefer_repository: true, paper_only_fallback: true },
  }, root);
  return { root, generator, result };
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

describe("Phase 5 external Skill selection", () => {
  const repo = (name: string): RepositoryCandidate => ({ url: `https://github.com/lab/${name}`, relation: "paper_analysis_code", discoverySource: "abstract" });
  const validate = async (candidate: RepositoryCandidate) => ({ ok: true, url: candidate.url });

  it("selects two repository-backed Skills when two live associated repositories exist", async () => {
    const { generator, result } = await resolveExternal([paper("one", [repo("one")]), paper("two", [repo("two")])], validate);
    expect(result).toMatchObject({ ok: true, matched: true, generated: true });
    expect(generator.calls.map((call) => call.evidenceLevel)).toEqual(["repository_backed", "repository_backed"]);
  });

  it("fills one missing repository slot with a distinct paper-only Skill", async () => {
    const { generator, result } = await resolveExternal([paper("one", [repo("one")]), paper("two")], validate);
    expect(generator.calls.map((call) => ({ title: call.title, evidence: call.evidenceLevel, repo: call.repoLink }))).toEqual([
      { title: "Paper one", evidence: "repository_backed", repo: "https://github.com/lab/one" },
      { title: "Paper two", evidence: "paper_only", repo: undefined },
    ]);
    expect(result.details).toMatchObject({ paper_source: "semantic_scholar", retrieved_count: 2, repository_candidate_count: 1, repository_skill_count: 1, paper_only_skill_count: 1 });
  });

  it("does not generate the same normalized repository twice", async () => {
    const shared = repo("shared");
    const { generator } = await resolveExternal([paper("one", [shared]), paper("two", [shared])], validate);
    expect(generator.calls.map((call) => ({ evidence: call.evidenceLevel, repo: call.repoLink }))).toEqual([
      { evidence: "repository_backed", repo: "https://github.com/lab/shared" },
      { evidence: "paper_only", repo: undefined },
    ]);
  });

  it("generates two paper-only Skills when no associated repository is available", async () => {
    const { generator } = await resolveExternal([paper("one"), paper("two")], validate);
    expect(generator.calls.map((call) => call.evidenceLevel)).toEqual(["paper_only", "paper_only"]);
  });

  it("never duplicates a sole usable paper and generates nothing without usable evidence", async () => {
    const single = await resolveExternal([paper("one")], validate);
    expect(single.generator.calls).toHaveLength(1);
    expect(single.result.warnings).toContain("Only one usable paper was retrieved; one Skill was generated without duplication");
    const empty = await resolveExternal([], validate);
    expect(empty.generator.calls).toHaveLength(0);
    expect(empty.result).toMatchObject({ ok: true, matched: false, generated: false });
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

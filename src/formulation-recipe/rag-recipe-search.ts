import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { atomicWriteJson } from "../core/index.ts";
import { nonInteractiveGitEnv } from "../core/non-interactive-git.ts";
import { FormulationFullTextClient } from "../formulation-literature/full-text-client.ts";
import { extractPaperAbstract } from "../formulation-literature/literature-store.ts";
import type { FormulationLiteratureRuntimeConfig, FullTextPaper } from "../formulation-literature/types.ts";
import { normalizeRepositoryIdentity } from "../targeted-skill/repository-cache.ts";

export interface ExtractedMethods {
  heading: string;
  content: string;
  subsection_headings: string[];
}

export interface ExistingRepositoryAdaptationSummary {
  adaptation_id: string;
  recipe_path: string;
  status: "candidate" | "provisional" | "active";
  adaptation_code_available: boolean;
  generated_code_available: boolean;
  source_commit?: string;
}

export interface RagRecipeCandidate {
  candidate_id: string;
  paper_id: string;
  paper_identity: string;
  paper: {
    title: string;
    abstract: string;
    methods: ExtractedMethods;
    published_at?: string;
    venue?: string;
    doi?: string;
    pmid?: string;
    pmcid?: string;
    url?: string;
  };
  repository: {
    url: string;
    repository_key: string;
    reachable: true;
  };
  methods_path: string;
  existing_from_rag?: ExistingRepositoryAdaptationSummary[];
}

export interface RagRecipeSearchArtifact {
  schema_version: 1;
  search_id: string;
  query: string;
  created_at: string;
  candidates: RagRecipeCandidate[];
  rejected_repositories: Array<{ url: string; reason: "unsupported_url" | "unreachable" | "timeout" }>;
  filtered_papers: Array<{ paper_id: string; title: string; reason: string }>;
}

export interface RepositoryReachability {
  check(url: string, signal?: AbortSignal): Promise<{ reachable: boolean; reason?: "unreachable" | "timeout" }>;
}

const METHOD_START = /^(?:materials?\s+and\s+methods?|methods?|star\s+methods|experimental\s+procedures?|methodology)$/i;
const METHOD_STOP = /^(?:data\s+and\s+code\s+availability|data\s+availability|code\s+availability|acknowledg(?:e)?ments?|additional\s+information|author\s+contributions?|competing\s+interests?|conflicts?\s+of\s+interest|references|bibliography|supplementary\s+information)$/i;
const SUPPORTED_HOSTS = new Set(["github.com", "gitlab.com", "bitbucket.org", "codeberg.org"]);

function compact(value: unknown): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function heading(line: string): string | undefined {
  const value = line.trim();
  const markdown = /^#{1,6}\s+(.+?)\s*#*$/.exec(value)?.[1];
  if (markdown) return compact(markdown);
  if (value.length >= 3 && value.length <= 100 && (/^[A-Z][A-Z\s/&:-]+$/.test(value) || METHOD_START.test(value) || METHOD_STOP.test(value))) return compact(value);
  return undefined;
}

export function extractMethodsSection(fullText: string): ExtractedMethods | undefined {
  const lines = String(fullText || "").replace(/\r\n/g, "\n").split("\n");
  let start = -1;
  let startHeading = "";
  const subsections: string[] = [];
  let end = lines.length;
  for (let index = 0; index < lines.length; index += 1) {
    const current = heading(lines[index]);
    if (!current) continue;
    if (start < 0 && METHOD_START.test(current)) {
      start = index + 1;
      startHeading = current;
      continue;
    }
    if (start >= 0) {
      if (METHOD_STOP.test(current)) { end = index; break; }
      if (!METHOD_START.test(current)) subsections.push(current);
    }
  }
  if (start < 0) return undefined;
  const content = lines.slice(start, end).join("\n").trim();
  if (content.replace(/\s+/g, " ").length < 400) return undefined;
  return { heading: startHeading, content, subsection_headings: [...new Set(subsections)].slice(0, 80) };
}

function repositoryUrls(paper: FullTextPaper): string[] {
  const inline = paper.full_text.match(/https?:\/\/(?:www\.)?(?:github\.com|gitlab\.com|bitbucket\.org|codeberg\.org)\/[^\s)\]}>;,"']+/gi) || [];
  return [...new Set([...paper.github_links, ...inline].map((url) => url.replace(/[.]+$/, "")))];
}

export function normalizeRepositoryRoot(raw: string): { url: string; repository_key: string } | undefined {
  try {
    const parsed = new URL(raw.replace(/^git\+/, ""));
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (!SUPPORTED_HOSTS.has(host)) return undefined;
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length < 2) return undefined;
    const rootSegments = host === "gitlab.com"
      ? segments.slice(0, segments.includes("-") ? segments.indexOf("-") : segments.length)
      : segments.slice(0, 2);
    if (rootSegments.length < 2) return undefined;
    rootSegments[rootSegments.length - 1] = rootSegments[rootSegments.length - 1].replace(/\.git$/i, "");
    const url = `https://${host}/${rootSegments.join("/")}`;
    return { url, repository_key: normalizeRepositoryIdentity(url) };
  } catch {
    return undefined;
  }
}

function paperIdentity(paper: FullTextPaper): string {
  return compact(paper.doi || paper.pmid || paper.pmcid || paper.track_id || paper.title).toLowerCase();
}

function stableId(prefix: string, value: string): string {
  return `${prefix}-${createHash("sha256").update(value).digest("hex").slice(0, 16)}`;
}

export class GitRepositoryReachability implements RepositoryReachability {
  constructor(readonly timeoutMs = 20_000) {}

  async check(url: string, signal?: AbortSignal): Promise<{ reachable: boolean; reason?: "unreachable" | "timeout" }> {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, this.timeoutMs);
    const abort = () => controller.abort(signal?.reason);
    if (signal?.aborted) abort(); else signal?.addEventListener("abort", abort, { once: true });
    try {
      return await new Promise((done) => {
        const child = spawn("git", ["ls-remote", url, "HEAD"], {
          stdio: ["ignore", "pipe", "ignore"],
          signal: controller.signal,
          env: nonInteractiveGitEnv(),
        });
        let output = "";
        child.stdout.on("data", (chunk) => { output = (output + String(chunk)).slice(-1000); });
        child.on("error", () => done({ reachable: false, reason: timedOut ? "timeout" : "unreachable" }));
        child.on("close", (code) => done(code === 0 && output.trim() ? { reachable: true } : { reachable: false, reason: timedOut ? "timeout" : "unreachable" }));
      });
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    }
  }
}

export class RagRecipeSearchStore {
  readonly root: string;
  constructor(readonly runDir: string) { this.root = join(runDir, "recipe_rag_searches"); }

  async persist(artifact: RagRecipeSearchArtifact): Promise<void> {
    const directory = join(this.root, artifact.search_id);
    await mkdir(directory, { recursive: true });
    for (const candidate of artifact.candidates) {
      await writeFile(candidate.methods_path, candidate.paper.methods.content, "utf8");
    }
    await atomicWriteJson(join(directory, "search.json"), artifact);
  }

  async findCandidate(candidateId: string): Promise<RagRecipeCandidate | undefined> {
    return (await this.findCandidateContext(candidateId))?.candidate;
  }

  async findCandidateContext(candidateId: string): Promise<{ candidate: RagRecipeCandidate; query: string } | undefined> {
    let entries;
    try { entries = await readdir(this.root, { withFileTypes: true }); } catch { return undefined; }
    for (const entry of entries.sort((a, b) => b.name.localeCompare(a.name))) {
      if (!entry.isDirectory()) continue;
      try {
        const artifact = JSON.parse(await readFile(join(this.root, entry.name, "search.json"), "utf8")) as RagRecipeSearchArtifact;
        const candidate = artifact.candidates.find((item) => item.candidate_id === candidateId);
        if (candidate) return { candidate, query: artifact.query };
      } catch { /* try the next persisted search */ }
    }
    return undefined;
  }
}

export interface RagRecipeSearchOptions {
  runDir: string;
  resolveConfig(): Promise<FormulationLiteratureRuntimeConfig>;
  findExisting(repositoryKey: string): Promise<ExistingRepositoryAdaptationSummary[]>;
  client?: FormulationFullTextClient;
  reachability?: RepositoryReachability;
  methodsOutputCharLimit?: number;
}

export class RagRecipeSearchService {
  readonly store: RagRecipeSearchStore;
  constructor(readonly options: RagRecipeSearchOptions) { this.store = new RagRecipeSearchStore(options.runDir); }

  async search(query: string, signal?: AbortSignal): Promise<RagRecipeSearchArtifact> {
    const config = await this.options.resolveConfig();
    if (config.provider !== "ailab_rag" || !config.baseUrl) throw new Error("AILab full-text literature RAG is required for repository-backed Skill search.");
    const client = this.options.client || new FormulationFullTextClient();
    const papers = await client.query({
      baseUrl: config.baseUrl,
      query,
      topK: Math.max(1, Number(config.topK || 6)),
      timeoutMs: Math.max(1_000, Number(config.timeoutMs || 600_000)),
      requireGithub: true,
      signal,
    });
    const searchId = stableId(`search-${Date.now()}`, query);
    const directory = join(this.store.root, searchId);
    const rejected: RagRecipeSearchArtifact["rejected_repositories"] = [];
    const filtered: RagRecipeSearchArtifact["filtered_papers"] = [];
    const seeds: Array<{ paper: FullTextPaper; methods: ExtractedMethods; repository: { url: string; repository_key: string } }> = [];
    const seen = new Set<string>();
    for (const paper of papers) {
      const methods = extractMethodsSection(paper.full_text);
      if (!methods) { filtered.push({ paper_id: paper.paper_id, title: paper.title, reason: "usable Methods section not found" }); continue; }
      for (const rawUrl of repositoryUrls(paper)) {
        const repository = normalizeRepositoryRoot(rawUrl);
        if (!repository) { rejected.push({ url: rawUrl, reason: "unsupported_url" }); continue; }
        const key = `${paperIdentity(paper)}\n${repository.repository_key}`;
        if (seen.has(key)) continue;
        seen.add(key);
        seeds.push({ paper, methods, repository });
      }
    }
    const reachability = this.options.reachability || new GitRepositoryReachability();
    const checked = await Promise.all(seeds.map(async (seed) => ({ seed, result: await reachability.check(seed.repository.url, signal) })));
    const candidates: RagRecipeCandidate[] = [];
    for (const { seed, result } of checked) {
      if (!result.reachable) { rejected.push({ url: seed.repository.url, reason: result.reason || "unreachable" }); continue; }
      const identity = paperIdentity(seed.paper);
      const candidateId = stableId("candidate", `${identity}\n${seed.repository.repository_key}`);
      const methodsPath = join(directory, `${candidateId}.methods.md`);
      const existing = await this.options.findExisting(seed.repository.repository_key);
      candidates.push({
        candidate_id: candidateId,
        paper_id: seed.paper.paper_id,
        paper_identity: identity,
        paper: {
          title: seed.paper.title,
          abstract: extractPaperAbstract(seed.paper.full_text),
          methods: seed.methods,
          ...(seed.paper.published_at ? { published_at: seed.paper.published_at } : {}),
          ...(seed.paper.venue ? { venue: seed.paper.venue } : {}),
          ...(seed.paper.doi ? { doi: seed.paper.doi } : {}),
          ...(seed.paper.pmid ? { pmid: seed.paper.pmid } : {}),
          ...(seed.paper.pmcid ? { pmcid: seed.paper.pmcid } : {}),
          ...(seed.paper.url ? { url: seed.paper.url } : {}),
        },
        repository: { ...seed.repository, reachable: true },
        methods_path: methodsPath,
        ...(existing.length ? { existing_from_rag: existing } : {}),
      });
    }
    const artifact: RagRecipeSearchArtifact = {
      schema_version: 1,
      search_id: searchId,
      query,
      created_at: new Date().toISOString(),
      candidates,
      rejected_repositories: rejected,
      filtered_papers: filtered,
    };
    await this.store.persist(artifact);
    return artifact;
  }
}

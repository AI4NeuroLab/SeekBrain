import type { PaperRecord, RepositoryCandidate } from "../contracts.ts";

const REPOSITORY_URL = /https?:\/\/(?:www\.)?(?:github\.com|gitlab\.com|bitbucket\.org|codeberg\.org)\/[^\s<>{}\[\]"']+/gi;

function trimUrl(value: string): string {
  return value.replace(/[),.;:!?]+$/g, "");
}

function relation(context: string): RepositoryCandidate["relation"] {
  const lower = context.toLowerCase();
  if (/\b(?:cited|citation|references?|previous work|prior work|based on|case study)\b/.test(lower)) return "cited_resource";
  if (/\b(?:supplement|supplementary|supporting code|replication of paper figures)\b/.test(lower)) return "supplementary_code";
  if (/\b(?:model|network weights|checkpoint)\b/.test(lower) && /\b(?:code|source|implementation|available|repository)\b/.test(lower)) return "paper_model_code";
  if (/\b(?:our code|source code|analysis code|implementation|software|toolbox|pipeline|scripts?|code is|code and data|available at|repository)\b/.test(lower)) return "paper_analysis_code";
  if (/\b(?:dependenc|requires|built with|uses the|used the|we used|was used|used to|algorithm|library|package)\b/.test(lower)) return "dependency";
  return "unknown";
}

export function extractRepositoryCandidates(
  text: string | undefined,
  discoverySource: RepositoryCandidate["discoverySource"],
): RepositoryCandidate[] {
  if (!text) return [];
  const found: RepositoryCandidate[] = [];
  for (const match of text.matchAll(REPOSITORY_URL)) {
    const url = trimUrl(match[0]);
    const start = Math.max(0, (match.index || 0) - 180);
    const end = Math.min(text.length, (match.index || 0) + match[0].length + 180);
    const classificationStart = Math.max(0, (match.index || 0) - 100);
    const classificationEnd = Math.min(text.length, (match.index || 0) + match[0].length + 100);
    const evidenceContext = text.slice(start, end).replace(/\s+/g, " ").trim();
    const classificationContext = text.slice(classificationStart, classificationEnd).replace(/\s+/g, " ").trim();
    found.push({ url, discoverySource, relation: relation(classificationContext), evidenceContext });
  }
  return found;
}

export function discoverPaperRepositories(paper: PaperRecord): RepositoryCandidate[] {
  const candidates = [
    ...extractRepositoryCandidates(paper.abstract, "abstract"),
    ...extractRepositoryCandidates(paper.fullText, "pmc_full_text"),
  ];
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = candidate.url.toLowerCase().replace(/\/$/, "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

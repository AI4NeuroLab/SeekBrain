import { randomUUID } from "node:crypto";

export interface PaperRagInput {
  question?: string;
  query?: string;
  top_k?: number;
  rag_base_url?: string;
  base_url?: string;
  rag_timeout?: number;
  timeout?: number;
  source_char_limit?: number;
  require_github?: boolean;
}

function normalizeGithubLinks(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((link) => {
    if (typeof link === "string" && link.trim()) return [link];
    if (link && typeof link === "object" && "url" in link) {
      const url = String((link as { url?: unknown }).url || "").trim();
      return url ? [url] : [];
    }
    return [];
  });
}

export interface PaperSource {
  source_id: string;
  title: string;
  pub_time: unknown;
  magazine: unknown;
  github_links: string[];
  text: string;
}

type Json = Record<string, any>;

export function normalizePaperResults(raw: unknown, sourceCharLimit = 5000): PaperSource[] {
  const nested = raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Json).results ?? raw
    : raw;
  if (!Array.isArray(nested)) return [];
  const seen = new Set<string>();
  const sources: PaperSource[] = [];
  for (const item of nested) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const value = item as Json;
    const title = String(value.title ?? "").trim();
    const text = String(value.full_text ?? value.content ?? value.text ?? "").trim();
    const key = title.toLowerCase() || text.slice(0, 200).toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    sources.push({
      source_id: `S${sources.length + 1}`,
      title: title || "(untitled paper)",
      pub_time: value.pub_time ?? "",
      magazine: value.magazine ?? "",
      github_links: normalizeGithubLinks(value.github_links),
      text: text.slice(0, sourceCharLimit),
    });
  }
  return sources;
}

export class PaperRagClient {
  constructor(
    readonly fetchImpl: typeof fetch = fetch,
    readonly env: NodeJS.ProcessEnv = process.env,
  ) {}

  async query(input: PaperRagInput, _cwd?: string, signal?: AbortSignal): Promise<Json> {
    const traceId = randomUUID();
    const question = String(input.question ?? input.query ?? "").trim();
    if (!question) {
      return { ok: false, trace_id: traceId, sources: [], warnings: ["question/query is required"], error: "question/query is required" };
    }
    const baseUrl = String(input.rag_base_url ?? input.base_url ?? this.env.PAPER_RAG_BASE_URL ?? "").trim();
    if (!baseUrl) {
      return { ok: false, trace_id: traceId, sources: [], warnings: ["Paper RAG query failed"], error: "Paper RAG base URL is not configured" };
    }
    const timeoutSeconds = Number(input.rag_timeout ?? input.timeout ?? 600);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error("Paper RAG request timed out")), Math.max(1, timeoutSeconds) * 1000);
    const abort = () => controller.abort(signal?.reason);
    signal?.addEventListener("abort", abort, { once: true });
    try {
      const response = await this.fetchImpl(`${baseUrl.replace(/\/$/, "")}/queryfull`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          query: question,
          top_k: Number(input.top_k ?? 4),
          require_github: input.require_github === true,
        }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Paper RAG returned HTTP ${response.status}`);
      const raw = await response.json();
      const sources = normalizePaperResults(raw, Number(input.source_char_limit ?? 5000));
      return {
        ok: true,
        trace_id: traceId,
        sources,
        source_count: sources.length,
        warnings: sources.length ? [] : ["Paper RAG returned no usable sources"],
      };
    } catch (error) {
      return { ok: false, trace_id: traceId, sources: [], warnings: ["Paper RAG query failed"], error: String(error) };
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    }
  }
}

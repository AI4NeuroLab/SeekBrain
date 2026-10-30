import { createHash } from "node:crypto";
import type { FullTextPaper, FullTextQueryOptions, Json } from "./types.ts";

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.flatMap((item) => {
    if (typeof item === "string") return item.trim() ? [item.trim()] : [];
    if (item && typeof item === "object") {
      const url = String((item as Json).url || "").trim();
      return url ? [url] : [];
    }
    return [];
  }))];
}

function records(raw: unknown): Json[] {
  const value = raw && typeof raw === "object" && !Array.isArray(raw)
    ? ((raw as Json).results ?? (raw as Json).data ?? raw)
    : raw;
  return Array.isArray(value)
    ? value.filter((item): item is Json => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    : [];
}

function fallbackTrackId(title: string, fullText: string): string {
  return createHash("sha256").update(`${title}\n${fullText}`).digest("hex").slice(0, 24);
}

export class FormulationFullTextClient {
  constructor(readonly fetchImpl: typeof fetch = fetch) {}

  async query(options: FullTextQueryOptions): Promise<FullTextPaper[]> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error("Literature search timed out")), options.timeoutMs);
    const abort = () => controller.abort(options.signal?.reason);
    if (options.signal?.aborted) abort();
    else options.signal?.addEventListener("abort", abort, { once: true });
    try {
      const response = await this.fetchImpl(`${options.baseUrl.replace(/\/$/, "")}/queryfull`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: options.query, top_k: options.topK, require_github: options.requireGithub === true }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Literature provider returned HTTP ${response.status}`);
      const raw = await response.json();
      return records(raw).flatMap((record) => {
        const title = String(record.title || "").trim();
        const fullText = String(record.full_text ?? record.content ?? record.text ?? "");
        if (!fullText.trim() && !String(record.abstract || "").trim()) return [];
        const trackId = String(record.track_id ?? record.paper_id ?? record.id ?? "").trim()
          || fallbackTrackId(title, fullText);
        const similarity = Number(record.similarity_score);
        return [{
          paper_id: `ailab_rag:${trackId}`,
          track_id: trackId,
          title: title || "(untitled paper)",
          full_text: fullText,
          ...(String(record.abstract || "").trim() ? { abstract: String(record.abstract).trim() } : {}),
          ...(Array.isArray(record.authors) ? { authors: record.authors.map((author: unknown) => typeof author === "string" ? author : String((author as Json)?.name || "")).filter(Boolean) } : {}),
          ...(Number.isFinite(similarity) ? { similarity_score: similarity } : {}),
          ...(String(record.pub_time ?? record.published_at ?? record.year ?? "").trim()
            ? { published_at: String(record.pub_time ?? record.published_at ?? record.year).trim() }
            : {}),
          ...(String(record.magazine ?? record.venue ?? "").trim()
            ? { venue: String(record.magazine ?? record.venue).trim() }
            : {}),
          ...(String(record.doi ?? "").trim() ? { doi: String(record.doi).trim() } : {}),
          ...(String(record.pmid ?? "").trim() ? { pmid: String(record.pmid).trim() } : {}),
          ...(String(record.pmcid ?? "").trim() ? { pmcid: String(record.pmcid).trim() } : {}),
          ...(String(record.url ?? "").trim() ? { url: String(record.url).trim() } : {}),
          github_links: strings(record.github_links),
        }];
      });
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
    }
  }
}

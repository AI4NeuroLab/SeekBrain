import type { PaperRagInput } from "../targeted-skill/rag-client.ts";
import type {
  PublicWebSearchClient,
  PublicWebSearchInput,
  PublicWebSearchItem,
  PublicWebSearchResult,
} from "./public-web-search.ts";

type Json = Record<string, any>;

export interface RagFirstScientificSearchOptions {
  cwd: string;
  retrieveRag(input: PaperRagInput, cwd?: string, signal?: AbortSignal): Promise<Json>;
  resolveRagInput(): Promise<PaperRagInput>;
  ncsSupplement: PublicWebSearchClient;
}

function compact(value: unknown, limit: number): string {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function ragItems(result: Json, limit: number): PublicWebSearchItem[] {
  const sources = Array.isArray(result.sources) ? result.sources : [];
  return sources.slice(0, limit).flatMap((source: Json) => {
    const title = compact(source?.title, 500);
    const snippet = compact(source?.text || source?.full_text || source?.abstract, 4_000);
    if (!title && !snippet) return [];
    return [{
      title: title || "(untitled RAG paper)",
      url: "",
      snippet,
      site: "ailab-rag",
      ...(source?.magazine ? { venue: compact(source.magazine, 300) } : {}),
      ...(source?.pub_time ? { published_at: compact(source.pub_time, 100) } : {}),
    }];
  });
}

function dedupe(items: PublicWebSearchItem[], limit: number): PublicWebSearchItem[] {
  const seen = new Set<string>();
  const output: PublicWebSearchItem[] = [];
  for (const item of items) {
    const key = compact(item.url, 1_000).toLocaleLowerCase()
      || compact(item.title, 500).toLocaleLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(item);
    if (output.length >= limit) break;
  }
  return output;
}

/** Literature RAG is the default source. The calling Search Agent explicitly
 * requests bounded Nature/Science/Cell search when another attempt needs it. */
export class RagFirstScientificSearchClient implements PublicWebSearchClient {
  constructor(readonly options: RagFirstScientificSearchOptions) {}

  async search(input: PublicWebSearchInput, signal?: AbortSignal): Promise<PublicWebSearchResult> {
    const query = compact(input.query, 2_000);
    const limit = Math.min(10, Math.max(1, Number(input.limit || 6)));
    const strategy = input.source_strategy === "include_ncs" || input.source_strategy === "ncs_only"
      ? input.source_strategy
      : "rag_first";
    if (!query) return { ok: false, provider: "ailab_rag+ncs_crossref", results: [], error: "query is required" };

    let ragResult: Json = { ok: false, sources: [], warnings: [] };
    if (strategy !== "ncs_only") {
      try {
        const configured = await this.options.resolveRagInput();
        ragResult = await this.options.retrieveRag({
          ...configured,
          question: query,
          query,
          top_k: limit,
          require_github: false,
          source_char_limit: 4_000,
        }, this.options.cwd, signal);
      } catch (error) {
        ragResult = { ok: false, sources: [], warnings: ["Literature RAG failed"], error: String(error) };
      }
    }

    const primary = ragItems(ragResult, limit);
    let supplement: PublicWebSearchResult | undefined;
    if (strategy === "ncs_only" || strategy === "include_ncs") {
      const requestedNcs = strategy === "include_ncs"
        ? Math.min(2, limit)
        : Math.max(1, limit - primary.length);
      supplement = await this.options.ncsSupplement.search({
        query,
        limit: requestedNcs,
      }, signal);
    }

    const supplementalItems = supplement?.results || [];
    const primaryLimit = strategy === "include_ncs"
      ? Math.max(0, limit - supplementalItems.length)
      : limit;
    const results = dedupe([...primary.slice(0, primaryLimit), ...supplementalItems], limit);
    const warnings = [
      ...(Array.isArray(ragResult.warnings) ? ragResult.warnings.map(String) : []),
      ...(supplement && Array.isArray(supplement.warnings) ? supplement.warnings.map(String) : []),
    ];
    return {
      ok: results.length > 0,
      provider: strategy === "ncs_only"
        ? "ncs_crossref"
        : supplement ? "ailab_rag+ncs_crossref" : "ailab_rag",
      results,
      warnings,
      ...(!results.length ? { error: compact(ragResult.error || supplement?.error || "No scientific inspiration sources found", 2_000) } : {}),
    };
  }
}

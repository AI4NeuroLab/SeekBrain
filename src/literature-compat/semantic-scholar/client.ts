import { literatureResponseCache, type MemoryCache } from "../cache.ts";
import { sharedRetryQueue, type RetryQueue } from "../rate-limiter.ts";

type Json = Record<string, any>;

export interface SemanticScholarClientOptions {
  baseUrl?: string;
  apiKey?: string;
  credentialIdentity: string;
  fetchImpl?: typeof fetch;
  cache?: MemoryCache;
  queue?: RetryQueue;
  timeoutSeconds?: number;
}

const SEARCH_FIELDS = [
  "paperId", "title", "abstract", "year", "venue", "authors", "externalIds", "openAccessPdf", "url", "tldr",
].join(",");

export class SemanticScholarClient {
  readonly baseUrl: string;
  readonly apiKey?: string;
  readonly credentialIdentity: string;
  readonly fetchImpl: typeof fetch;
  readonly cache: MemoryCache;
  readonly queue: RetryQueue;
  readonly timeoutSeconds: number;

  constructor(options: SemanticScholarClientOptions) {
    this.baseUrl = String(options.baseUrl || "https://api.semanticscholar.org/graph/v1").replace(/\/$/, "");
    this.apiKey = options.apiKey;
    this.credentialIdentity = options.credentialIdentity;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.cache = options.cache ?? literatureResponseCache;
    this.queue = options.queue ?? sharedRetryQueue(options.credentialIdentity, {
      minimumIntervalMs: 1000,
      maxRetries: 3,
      baseDelayMs: 1000,
    });
    this.timeoutSeconds = Math.max(1, options.timeoutSeconds ?? 60);
  }

  async search(query: string, limit: number, signal?: AbortSignal): Promise<Json[]> {
    const url = new URL(`${this.baseUrl}/paper/search`);
    url.search = new URLSearchParams({ query, limit: String(limit), fields: SEARCH_FIELDS }).toString();
    const cacheKey = `semantic-scholar:search:v2:${this.credentialIdentity}:${this.baseUrl}:${url.searchParams.toString()}`;
    return await this.cache.getOrLoad(cacheKey, async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(new Error("Semantic Scholar request timed out")), this.timeoutSeconds * 1000);
      const abort = () => controller.abort(signal?.reason);
      signal?.addEventListener("abort", abort, { once: true });
      try {
        const response = await this.queue.schedule(() => this.fetchImpl(url, {
          headers: this.apiKey ? { "x-api-key": this.apiKey } : {},
          signal: controller.signal,
        }));
        if (!response.ok) throw new Error(`Semantic Scholar returned HTTP ${response.status}`);
        const body = await response.json() as Json;
        return Array.isArray(body.data) ? body.data : [];
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
      }
    });
  }
}

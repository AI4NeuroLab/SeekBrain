import { literatureResponseCache, type MemoryCache } from "../cache.ts";
import { sharedRetryQueue, type RetryQueue } from "../rate-limiter.ts";

type Json = Record<string, any>;

export interface PubMedClientOptions {
  baseUrl?: string;
  apiKey: string;
  credentialIdentity: string;
  tool?: string;
  email?: string;
  fetchImpl?: typeof fetch;
  cache?: MemoryCache;
  queue?: RetryQueue;
  timeoutSeconds?: number;
}

export class PubMedClient {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly credentialIdentity: string;
  readonly tool: string;
  readonly email?: string;
  readonly fetchImpl: typeof fetch;
  readonly cache: MemoryCache;
  readonly queue: RetryQueue;
  readonly timeoutSeconds: number;

  constructor(options: PubMedClientOptions) {
    this.baseUrl = String(options.baseUrl || "https://eutils.ncbi.nlm.nih.gov/entrez/eutils").replace(/\/$/, "");
    this.apiKey = options.apiKey;
    this.credentialIdentity = options.credentialIdentity;
    this.tool = String(options.tool || "seekbrain").trim() || "seekbrain";
    this.email = String(options.email || "").trim() || undefined;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.cache = options.cache ?? literatureResponseCache;
    this.queue = options.queue ?? sharedRetryQueue(options.credentialIdentity);
    this.timeoutSeconds = Math.max(1, options.timeoutSeconds ?? 60);
  }

  async requestJson(endpoint: string, parameters: Record<string, string>, signal?: AbortSignal): Promise<Json> {
    const body = await this.request(endpoint, { ...parameters, retmode: "json" }, signal);
    return JSON.parse(body) as Json;
  }

  async requestXml(endpoint: string, parameters: Record<string, string>, signal?: AbortSignal): Promise<string> {
    return await this.request(endpoint, { ...parameters, retmode: "xml" }, signal);
  }

  async search(query: string, limit: number, signal?: AbortSignal): Promise<string[]> {
    const body = await this.requestJson("esearch.fcgi", { db: "pubmed", term: query, retmax: String(limit), sort: "relevance" }, signal);
    return Array.isArray(body.esearchresult?.idlist) ? body.esearchresult.idlist.map(String).filter(Boolean) : [];
  }

  async summary(pmids: string[], signal?: AbortSignal): Promise<Json> {
    if (!pmids.length) return {};
    return await this.requestJson("esummary.fcgi", { db: "pubmed", id: pmids.join(",") }, signal);
  }

  async fetchArticles(pmids: string[], signal?: AbortSignal): Promise<string> {
    if (!pmids.length) return "";
    return await this.requestXml("efetch.fcgi", { db: "pubmed", id: pmids.join(",") }, signal);
  }

  private async request(endpoint: string, parameters: Record<string, string>, signal?: AbortSignal): Promise<string> {
    const publicParameters = {
      ...parameters,
      tool: this.tool,
      ...(this.email ? { email: this.email } : {}),
    };
    const cacheParameters = new URLSearchParams(publicParameters).toString();
    const cacheKey = `pubmed:eutils:v1:${this.credentialIdentity}:${this.baseUrl}:${endpoint}:${cacheParameters}`;
    return await this.cache.getOrLoad(cacheKey, async () => {
      const url = new URL(`${this.baseUrl}/${endpoint}`);
      url.search = new URLSearchParams({ ...publicParameters, api_key: this.apiKey }).toString();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(new Error("PubMed request timed out")), this.timeoutSeconds * 1000);
      const abort = () => controller.abort(signal?.reason);
      signal?.addEventListener("abort", abort, { once: true });
      try {
        const response = await this.queue.schedule(() => this.fetchImpl(url, { signal: controller.signal }));
        if (!response.ok) throw new Error(`PubMed returned HTTP ${response.status}`);
        return await response.text();
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
      }
    });
  }
}

import { literatureResponseCache, type MemoryCache } from "../cache.ts";
import { sharedRetryQueue, type RetryQueue } from "../rate-limiter.ts";

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

export interface PmcEnricherOptions {
  fetchImpl?: typeof fetch;
  cache?: MemoryCache;
  queue?: RetryQueue;
  baseUrl?: string;
  timeoutSeconds?: number;
}

export class PmcEnricher {
  readonly fetchImpl: typeof fetch;
  readonly cache: MemoryCache;
  readonly queue: RetryQueue;
  readonly baseUrl: string;
  readonly timeoutSeconds: number;

  constructor(options: PmcEnricherOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.cache = options.cache ?? literatureResponseCache;
    this.queue = options.queue ?? sharedRetryQueue("pmc:public");
    this.baseUrl = options.baseUrl || "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
    this.timeoutSeconds = Math.max(1, options.timeoutSeconds ?? 60);
  }

  async fullText(pmcid: string, signal?: AbortSignal): Promise<string | undefined> {
    const normalized = String(pmcid).toUpperCase().replace(/^PMC/, "").trim();
    if (!/^\d+$/.test(normalized)) return undefined;
    return await this.cache.getOrLoad(`pmc:xml:v1:PMC${normalized}`, async () => {
      const url = new URL(`${this.baseUrl.replace(/\/$/, "")}/efetch.fcgi`);
      url.search = new URLSearchParams({ db: "pmc", id: normalized, retmode: "xml" }).toString();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(new Error("PMC request timed out")), this.timeoutSeconds * 1000);
      const abort = () => controller.abort(signal?.reason);
      signal?.addEventListener("abort", abort, { once: true });
      try {
        const response = await this.queue.schedule(() => this.fetchImpl(url, { signal: controller.signal }));
        if (!response.ok) throw new Error(`PMC returned HTTP ${response.status}`);
        const text = decodeXml(await response.text());
        return text || undefined;
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
      }
    });
  }
}

export { decodeXml as decodePmcXml };

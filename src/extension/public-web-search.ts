export interface PublicWebSearchInput {
  query: string;
  limit?: number;
  source_strategy?: "rag_first" | "include_ncs" | "ncs_only";
}

export interface PublicWebSearchItem {
  title: string;
  url: string;
  snippet: string;
  site?: string;
  venue?: string;
  published_at?: string;
  source_family?: "nature" | "science" | "cell" | "preprint";
}

export interface PublicWebSearchResult {
  ok: boolean;
  provider: string;
  results: PublicWebSearchItem[];
  warnings?: string[];
  error?: string;
}

export interface PublicWebSearchClient {
  search(input: PublicWebSearchInput, signal?: AbortSignal): Promise<PublicWebSearchResult>;
}

function stripMarkdown(value: string): string {
  return value
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`#]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeBingRedirect(value: string): string {
  try {
    const url = new URL(value);
    if (!/\.bing\.com$/i.test(url.hostname)) return value;
    const encoded = url.searchParams.get("u") || "";
    if (!encoded.startsWith("a1")) return value;
    const decoded = Buffer.from(encoded.slice(2), "base64url").toString("utf8");
    return /^https?:\/\//i.test(decoded) ? decoded : value;
  } catch {
    return value;
  }
}

export function parseJinaBingResults(markdown: string, limit = 6): PublicWebSearchItem[] {
  const pattern = /(?:^|\n)(?:\d+\.)\s+##\s+\[([^\]]+)\]\((https?:\/\/[^)]+)\)\s*\n\n([\s\S]*?)(?=\n\n\d+\.\s+##|$)/g;
  const results: PublicWebSearchItem[] = [];
  const seen = new Set<string>();
  for (const match of markdown.matchAll(pattern)) {
    const url = decodeBingRedirect(String(match[2] || "").trim());
    if (!/^https?:\/\//i.test(url) || seen.has(url)) continue;
    seen.add(url);
    let site: string | undefined;
    try { site = new URL(url).hostname.replace(/^www\./, ""); } catch {}
    results.push({
      title: stripMarkdown(String(match[1] || "")),
      url,
      snippet: stripMarkdown(String(match[3] || "")).slice(0, 1_500),
      ...(site ? { site } : {}),
    });
    if (results.length >= Math.max(1, limit)) break;
  }
  return results;
}

/**
 * Keyless preview backend for public Web search. It reads Bing's public result
 * page through Jina Reader. Production deployments should inject a supported
 * Web Search API client when stronger availability guarantees are required.
 */
export class JinaBingPublicWebSearchClient implements PublicWebSearchClient {
  constructor(
    readonly fetchImpl: typeof fetch = fetch,
    readonly endpoint = "https://r.jina.ai/http://www.bing.com/search",
  ) {}

  async search(input: PublicWebSearchInput, signal?: AbortSignal): Promise<PublicWebSearchResult> {
    const query = String(input.query || "").replace(/\s+/g, " ").trim();
    if (!query) return { ok: false, provider: "jina_bing_preview", results: [], error: "query is required" };
    try {
      const url = `${this.endpoint}?q=${encodeURIComponent(query)}`;
      const response = await this.fetchImpl(url, {
        headers: { accept: "text/plain", "user-agent": "SeekBrain/0.1 scientific-inspiration-preview" },
        signal,
      });
      if (!response.ok) throw new Error(`Public Web search returned HTTP ${response.status}`);
      const markdown = await response.text();
      const results = parseJinaBingResults(markdown, Math.min(10, Math.max(1, Number(input.limit || 6))));
      const warnings = results.length ? [] : ["Public Web search returned no parseable results"];
      return { ok: results.length > 0, provider: "jina_bing_preview", results, warnings };
    } catch (error) {
      return {
        ok: false,
        provider: "jina_bing_preview",
        results: [],
        warnings: ["Public Web search failed"],
        error: String(error),
      };
    }
  }
}

function firstText(value: unknown): string {
  return Array.isArray(value) ? String(value[0] || "").trim() : String(value || "").trim();
}

function stripTags(value: unknown): string {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function publicationDate(item: Record<string, any>): string | undefined {
  const parts = item.published?.["date-parts"]?.[0] || item.published_print?.["date-parts"]?.[0];
  if (!Array.isArray(parts) || !parts.length) return undefined;
  const [year, month = 1, day = 1] = parts.map(Number);
  if (!Number.isFinite(year)) return undefined;
  return [String(year).padStart(4, "0"), String(month).padStart(2, "0"), String(day).padStart(2, "0")].join("-");
}

function trustedFamily(item: Record<string, any>): "nature" | "science" | "cell" | undefined {
  const doi = String(item.DOI || "").toLocaleLowerCase();
  const venue = firstText(item["container-title"]).toLocaleLowerCase();
  if (venue === "scientific reports" || venue === "humanities and social sciences communications") return undefined;
  if (doi.startsWith("10.1038/") || /^nature(?:\s|$)/.test(venue)) return "nature";
  if (doi.startsWith("10.1126/") || venue === "science" || venue.startsWith("science ")) return "science";
  const cellVenues = [
    "cell", "neuron", "immunity", "current biology", "cancer cell", "molecular cell", "developmental cell",
    "cell systems", "cell metabolism", "cell host & microbe", "cell genomics", "cell reports", "trends in",
    "iscience", "joule", "matter", "one earth", "med", "chem",
  ];
  if (cellVenues.some((name) => venue === name || venue.startsWith(`${name} `))) return "cell";
  return undefined;
}

export interface TrustedPublisherWebSearchOptions {
  fetchImpl?: typeof fetch;
  endpoint?: string;
  monthsBack?: number;
  candidateRows?: number;
  now?: () => Date;
}

/** Searches recent public Crossref metadata, retaining only official
 * Nature-, Science-, and Cell-family papers. */
export class TrustedPublisherWebSearchClient implements PublicWebSearchClient {
  readonly fetchImpl: typeof fetch;
  readonly endpoint: string;
  readonly monthsBack: number;
  readonly candidateRows: number;
  readonly now: () => Date;

  constructor(options: TrustedPublisherWebSearchOptions = {}) {
    this.fetchImpl = options.fetchImpl || fetch;
    this.endpoint = options.endpoint || "https://api.crossref.org/works";
    this.monthsBack = Math.max(1, Number(options.monthsBack || 24));
    this.candidateRows = Math.min(1_000, Math.max(20, Number(options.candidateRows || 100)));
    this.now = options.now || (() => new Date());
  }

  async search(input: PublicWebSearchInput, signal?: AbortSignal): Promise<PublicWebSearchResult> {
    const query = String(input.query || "").replace(/\s+/g, " ").trim();
    if (!query) return { ok: false, provider: "crossref_nature_science_cell", results: [], error: "query is required" };
    const until = this.now();
    const from = new Date(until);
    from.setUTCMonth(from.getUTCMonth() - this.monthsBack);
    const date = (value: Date) => value.toISOString().slice(0, 10);
    const url = new URL(this.endpoint);
    url.search = new URLSearchParams({
      "query.bibliographic": query,
      filter: `from-pub-date:${date(from)},until-pub-date:${date(until)},type:journal-article`,
      rows: String(this.candidateRows),
      select: "DOI,title,published,URL,publisher,container-title,abstract",
      sort: "relevance",
    }).toString();
    try {
      const response = await this.fetchImpl(url, {
        headers: { accept: "application/json", "user-agent": "SeekBrain/0.1 (scientific-inspiration-preview)" },
        signal,
      });
      if (!response.ok) throw new Error(`Crossref returned HTTP ${response.status}`);
      const payload = await response.json() as Record<string, any>;
      const results: PublicWebSearchItem[] = [];
      const seen = new Set<string>();
      for (const item of Array.isArray(payload.message?.items) ? payload.message.items : []) {
        const family = trustedFamily(item);
        if (!family) continue;
        const doi = String(item.DOI || "").trim();
        const landingUrl = doi ? `https://doi.org/${doi}` : String(item.URL || "").trim();
        if (!landingUrl || seen.has(landingUrl)) continue;
        seen.add(landingUrl);
        const venue = firstText(item["container-title"]);
        results.push({
          title: firstText(item.title) || "(untitled paper)",
          url: landingUrl,
          snippet: stripTags(item.abstract),
          site: "doi.org",
          ...(venue ? { venue } : {}),
          ...(publicationDate(item) ? { published_at: publicationDate(item) } : {}),
          source_family: family,
        });
        if (results.length >= Math.min(20, Math.max(1, Number(input.limit || 6)))) break;
      }
      return {
        ok: results.length > 0,
        provider: "crossref_nature_science_cell",
        results,
        warnings: results.length ? [] : [`No Nature/Science/Cell-family paper matched within the last ${this.monthsBack} months`],
      };
    } catch (error) {
      return {
        ok: false,
        provider: "crossref_nature_science_cell",
        results: [],
        warnings: ["Trusted publisher Web search failed"],
        error: String(error),
      };
    }
  }
}

import { createRequire } from "node:module";
import { homedir } from "node:os";
import { join } from "node:path";
import { mkdir, readFile, readdir, stat, unlink, writeFile, rename } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Type } from "typebox";
import type { ExistingPiCustomTool } from "./existing-pi-agent-adapter.ts";

type Json = Record<string, any>;
export const WEB_TOOL_NAMES = ["web_search", "fetch_content", "get_search_content"] as const;
const TTL = 60 * 60 * 1000;
const MAX_ENTRIES = 128;
const MAX_BYTES = 64 * 1024 * 1024;
const MAX_ENTRY_BYTES = 4 * 1024 * 1024;
const validId = (id: unknown): id is string => typeof id === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(id);
let upstreamPromise: Promise<Json> | undefined;

// The pinned upstream ships its host-neutral core as TypeScript. Use the same
// loader dependency as the pinned Pi SDK; never initialize the upstream UI extension.
async function loadUpstream(): Promise<Json> {
  return upstreamPromise ||= (async () => {
    const require = createRequire(import.meta.url);
    const { createJiti } = require("jiti");
    const jiti = createJiti(import.meta.url);
    const [core, storage] = await Promise.all([
      jiti.import("pi-web-access/web-tool-core.ts"),
      jiti.import("pi-web-access/storage.ts"),
    ]);
    return { ...core, storage };
  })().catch(error => { upstreamPromise = undefined; throw error; });
}

export interface WebAccessOptions { cacheDir?: string; loadUpstream?: () => Promise<Json>; now?: () => number; isEnabled?: () => boolean | Promise<boolean> }
export function createWebAccessTools(options: WebAccessOptions = {}): ExistingPiCustomTool[] {
  const cacheDir = options.cacheDir || join(homedir(), ".cache", "seekbrain", "web");
  const now = options.now || Date.now;
  let corePromise: Promise<Json> | undefined;
  // Cache writes must not fail a successful search. Bound both the on-disk
  // cache and the upstream in-memory results owned by this runtime.
  const owned = new Map<string, number>();
  let writes = Promise.resolve();
  async function prune(upstream: Json) {
    const entries = await Promise.all((await readdir(cacheDir)).filter(name => /^[\w-]+\.json$/.test(name)).map(async name => {
      const path = join(cacheDir, name), info = await stat(path);
      return { path, id: name.slice(0, -5), time: info.mtimeMs, size: info.size };
    }));
    entries.sort((a, b) => b.time - a.time);
    let bytes = 0;
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]; bytes += entry.size;
      if (now() - entry.time >= TTL || i >= MAX_ENTRIES || bytes > MAX_BYTES) {
        await unlink(entry.path).catch(() => {});
        if (owned.has(entry.id)) { upstream.storage.deleteResult(entry.id); owned.delete(entry.id); }
      }
    }
    for (const [id, time] of owned) if (now() - time >= TTL || owned.size > MAX_ENTRIES) { upstream.storage.deleteResult(id); owned.delete(id); }
  }
  function persist(data: Json, upstream: Json) {
    if (!validId(data.id)) return;
    owned.set(data.id, now());
    for (const [id, time] of owned) if (now() - time >= TTL || owned.size > MAX_ENTRIES) { upstream.storage.deleteResult(id); owned.delete(id); }
    const serialized = JSON.stringify(data);
    writes = writes.then(async () => {
      await mkdir(cacheDir, { recursive: true, mode: 0o700 });
      if (Buffer.byteLength(serialized) <= MAX_ENTRY_BYTES) {
        const temporary = join(cacheDir, `${data.id}.${randomUUID()}.tmp`);
        try {
          await writeFile(temporary, serialized, { mode: 0o600, flag: "wx" });
          await rename(temporary, join(cacheDir, `${data.id}.json`));
        } finally { await unlink(temporary).catch(() => {}); }
      }
      await prune(upstream);
    }).catch(() => {});
  }
  async function runtime() {
    return corePromise ||= (async () => {
      const upstream = await (options.loadUpstream || loadUpstream)();
      const core = upstream.createWebToolCore({
        settings: {
          toolNames: upstream.DEFAULT_TOOL_NAMES,
          enabledTools: { webSearch: true, fetchContent: true, getSearchContent: true, sourceCheck: false },
          maxInlineContentChars: 12_000,
          fetchModes: { defaultMode: "readable", allowedModes: ["readable", "raw"] },
        },
        storeFetchedContent(id: string, data: Json) { upstream.storage.storeResult(id, data); persist(data, upstream); },
        publishResult(data: Json) { persist(data, upstream); },
        extractOptions: { rejectDirectImages: "Use the existing read tool for downloaded images." },
      });
      return { upstream, core };
    })().catch(error => { corePromise = undefined; throw error; });
  }
  async function execute(method: string, params: Json, signal?: AbortSignal, update?: any) {
    try {
      signal?.throwIfAborted();
      if (options.isEnabled && !await options.isEnabled()) throw new Error("Web tools are disabled by workflow.seekbrain.web_search=false.");
      signal?.throwIfAborted();
      const { upstream, core } = await runtime();
      await writes;
      if (method === "getSearchContent") {
        if (!validId(params.responseId)) throw new Error("Invalid responseId. Use an ID returned by a web tool.");
        const memory = upstream.storage.getResult(params.responseId);
        if (!memory) {
          try {
            const data = JSON.parse(await readFile(join(cacheDir, `${params.responseId}.json`), "utf8"));
            if (data.id === params.responseId && Number.isFinite(data.timestamp) && now() - data.timestamp < TTL) {
              upstream.storage.storeResult(data.id, data); owned.set(data.id, data.timestamp);
              for (const id of owned.keys()) if (owned.size > MAX_ENTRIES) { upstream.storage.deleteResult(id); owned.delete(id); }
            }
          } catch { /* expired/missing cache is reported below */ }
        } else if (now() - memory.timestamp >= TTL) upstream.storage.deleteResult(params.responseId);
        const cached = upstream.storage.getResult(params.responseId);
        if (!cached) throw new Error("Cached web content is missing or expired. Search or fetch the source URL again; use URLs, not cache IDs, as references.");
        if (params.queryIndex === undefined && params.urlIndex === undefined && !params.url) {
          if (cached.type === "search" && cached.queries?.length === 1) params = { ...params, queryIndex: 0 };
          if (cached.type === "fetch" && cached.urls?.length === 1) params = { ...params, urlIndex: 0 };
        }
      }
      const input = method === "webSearch" ? { ...params, provider: "exa", numResults: params.numResults ?? 5 } : params;
      const result = await core[method](input, signal, { onUpdate: update, awaitContent: true });
      await writes;
      signal?.throwIfAborted();
      // Preserve source snippets in the first response; the upstream compact
      // presentation may otherwise show only titles and URLs.
      if (method === "webSearch" && result.structuredContent?.queries) {
        const text = result.structuredContent.queries.map((query: Json) => [
          `Query: ${query.query} (Exa)`, query.error ? `Error: ${query.error}` : "",
          ...query.results.map((source: Json, i: number) => `${i + 1}. ${source.title}\n${source.url}\n${String(source.snippet || "").slice(0, 1200)}`),
          query.answer ? `Retrieved excerpts:\n${query.answer.slice(0, 6000)}` : "",
        ].filter(Boolean).join("\n\n")).join("\n\n");
        result.content = [{ type: "text", text: `${text.slice(0, 11000)}\n\nresponseId: ${result.structuredContent.responseId}\nRead a source with fetch_content, or retrieve stored results with get_search_content. Cite source URLs.` }];
      }
      if (method === "fetchContent") {
        const text = result.content.filter((part: Json) => part.type === "text").map((part: Json) => part.text).join("\n");
        if (text.length > 12000) result.content = [{ type: "text", text: `${text.slice(0, 11000)}\n\n[Display truncated.] responseId: ${result.structuredContent?.responseId || result.details?.responseId}\nUse get_search_content to read the full cached document in pages or find passages.` }];
      }
      return upstream.markToolError(result);
    } catch (error) {
      signal?.throwIfAborted();
      const message = error instanceof Error ? error.message : String(error);
      return { isError: true, content: [{ type: "text", text: `Web retrieval failed: ${message}` }], details: { error: message } };
    }
  }
  const url = Type.String({ minLength: 1, description: "Public HTTP(S) URL." });
  return [
    { name: "web_search", label: "Web Search", description: "Search the web with Exa and return source titles, URLs and snippets. No search API key is required by default. Does not generate an extra model summary.",
      promptSnippet: "Search the web for external information and current research progress.",
      promptGuidelines: ["Use web_search when external information is useful. Follow up with fetch_content to read a source. Cite URLs actually consulted; cached responseIds are temporary."],
      parameters: Type.Object({ query: Type.String({ minLength: 1 }), numResults: Type.Optional(Type.Integer({ minimum: 1, maximum: 20 })), recencyFilter: Type.Optional(Type.Union([Type.Literal("day"), Type.Literal("week"), Type.Literal("month"), Type.Literal("year")])), domainFilter: Type.Optional(Type.Array(Type.String())), category: Type.Optional(Type.String()) }, { additionalProperties: false }),
      execute: (_id: string, params: Json, signal?: AbortSignal, update?: any) => execute("webSearch", params, signal, update) },
    { name: "fetch_content", label: "Read Web Page", description: "Fetch public web pages as readable content, retaining full text for get_search_content. Does not answer questions or generate summaries.",
      promptSnippet: "Read a source URL returned by web search or supplied by the user.",
      parameters: Type.Object({ url, mode: Type.Optional(Type.Union([Type.Literal("readable"), Type.Literal("raw")])) }, { additionalProperties: false }),
      execute: (_id: string, params: Json, signal?: AbortSignal, update?: any) => {
        const parsed = new URL(params.url);
        if (!["https:", "http:"].includes(parsed.protocol)) throw new Error("Use a public HTTP(S) URL; read local files with the existing read tool.");
        if (/(^|\.)(youtube\.com|youtu\.be)$/.test(parsed.hostname) || /\.(mp4|mov|webm|avi)$/i.test(parsed.pathname)) throw new Error("This tool reads web documents; video analysis is not enabled.");
        return execute("fetchContent", params, signal, update);
      } },
    { name: "get_search_content", label: "Read Cached Web Content", description: "Read a bounded page or find passages in cached search results and web content. Cache expires after one hour; refetch a URL if unavailable.",
      parameters: Type.Object({ responseId: Type.String({ minLength: 1 }), queryIndex: Type.Optional(Type.Integer({ minimum: 0 })), urlIndex: Type.Optional(Type.Integer({ minimum: 0 })), url: Type.Optional(url), offset: Type.Optional(Type.Integer({ minimum: 0 })), limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 12000 })), findText: Type.Optional(Type.String({ minLength: 1, maxLength: 500 })), findMode: Type.Optional(Type.Union([Type.Literal("exact"), Type.Literal("case-insensitive"), Type.Literal("fuzzy")])) }, { additionalProperties: false }),
      execute: (_id: string, params: Json, signal?: AbortSignal) => execute("getSearchContent", params, signal) },
  ];
}

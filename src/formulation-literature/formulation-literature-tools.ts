import { Type } from "typebox";
import type { ExistingPiCustomTool } from "../extension/existing-pi-agent-adapter.ts";
import { FormulationFullTextClient } from "./full-text-client.ts";
import { FormulationLiteratureStore } from "./literature-store.ts";
import type { FullTextPaper, FormulationLiteratureRuntimeConfig, StoredPaper } from "./types.ts";

export interface FormulationLiteratureToolsOptions {
  cacheDir?: string;
  retrievePapers?(config: FormulationLiteratureRuntimeConfig, query: string, signal?: AbortSignal): Promise<FullTextPaper[]>;
  resolveConfig(): Promise<FormulationLiteratureRuntimeConfig>;
  client?: FormulationFullTextClient;
  store?: FormulationLiteratureStore;
}

function toolResult(value: Record<string, unknown>, isError = false) {
  return {
    content: [{ type: "text", text: JSON.stringify(value) }],
    details: value,
    isError,
  };
}

function paperMetadata(paper: StoredPaper) {
  const { full_text_path, full_text_chars, ...metadata } = paper;
  return metadata;
}

export function createFormulationLiteratureTools(options: FormulationLiteratureToolsOptions): ExistingPiCustomTool[] {
  const client = options.client || new FormulationFullTextClient();
  const store = options.store || new FormulationLiteratureStore(options.cacheDir);

  const search: ExistingPiCustomTool = {
    name: "seekbrain_literature_search",
    label: "Search scientific literature",
    description: "Search scientific papers relevant to the current research question. Returns paper titles, abstracts or labeled previews, bibliographic metadata, full-text availability, and paper IDs.",
    promptSnippet: "Find scientific papers, abstracts or previews, and paper IDs.",
    promptGuidelines: ["Use the seekbrain_literature_search tool to find scientific literature relevant to the current research question. It returns paper titles, abstracts or labeled previews, bibliographic metadata, and paper IDs. Follow up with seekbrain_paper_read when you need the available full content of a specific paper, and cite the relevant papers."],
    parameters: Type.Object({ query: Type.String({ minLength: 1 }) }, { additionalProperties: false }),
    async execute(_toolCallId: string, params: { query: string }, signal?: AbortSignal) {
      const query = String(params.query || "").trim();
      if (!query) return toolResult({ ok: false, error: "query is required" }, true);
      try {
        const config = await options.resolveConfig();
        if (!config.provider || config.provider === "none" || (config.provider !== "ailab_rag" && !options.retrievePapers)) {
          return toolResult({ ok: false, error: `Literature search is unavailable for provider '${config.provider || "none"}'.` }, true);
        }
        if (config.provider === "ailab_rag" && !config.baseUrl) return toolResult({ ok: false, error: "AILab literature base URL is not configured." }, true);
        const papers = options.retrievePapers
          ? await options.retrievePapers(config, query, signal)
          : await client.query({
          baseUrl: config.baseUrl,
          query,
          topK: Math.max(1, Number(config.topK || 4)),
          timeoutMs: Math.max(1_000, Number(config.timeoutMs || 600_000)),
          signal,
        });
        const stored = await store.persistSearch(query, papers);
        return toolResult({
          ok: true,
          query,
          papers: stored.map(paperMetadata),
        });
      } catch (error) {
        return toolResult({ ok: false, error: error instanceof Error ? error.message : String(error) }, true);
      }
    },
  };

  const read: ExistingPiCustomTool = {
    name: "seekbrain_paper_read",
    label: "Read scientific paper",
    description: "Retrieve the available full content of a paper returned by seekbrain_literature_search.",
    promptSnippet: "Read the available full content of a paper by its paper ID.",
    promptGuidelines: ["Use the seekbrain_paper_read tool to retrieve the available full content of a specific paper returned by seekbrain_literature_search. Cite the paper when you use its content."],
    parameters: Type.Object({ paper_id: Type.String({ minLength: 1 }) }, { additionalProperties: false }),
    async execute(_toolCallId: string, params: { paper_id: string }) {
      const paperId = String(params.paper_id || "").trim();
      if (!paperId) return toolResult({ ok: false, error: "paper_id is required" }, true);
      try {
        const restored = await store.readPaper(paperId);
        if (!restored) return toolResult({ ok: false, error: `Unknown paper_id '${paperId}'. Search for the paper first.` }, true);
        const config = await options.resolveConfig();
        const limit = Math.max(1_000, Number(config.readOutputCharLimit || 50_000));
        const metadata = paperMetadata(restored.paper);
        if (!restored.paper.full_text_available) {
          return toolResult({ ok: false, ...metadata, error: "The provider supplied no full text for this paper; only the available metadata and abstract are cached." }, true);
        }
        return toolResult({
          ok: true,
          ...metadata,
          full_text: restored.full_text.slice(0, limit),
          truncated: restored.full_text.length > limit,
          full_text_chars: restored.full_text.length,
          full_text_path: restored.paper.full_text_path,
        });
      } catch (error) {
        return toolResult({ ok: false, error: error instanceof Error ? error.message : String(error) }, true);
      }
    },
  };

  return [search, read];
}

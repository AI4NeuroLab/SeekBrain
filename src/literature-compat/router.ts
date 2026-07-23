import type { PaperRagClient } from "../targeted-skill/rag-client.ts";
import type { LiteratureProviderId, LiteratureQueryClient, LiteratureQueryInput, LiteratureQueryResult } from "./contracts.ts";

type ProviderClients = Partial<Record<Exclude<LiteratureProviderId, "ailab_rag" | "none">, LiteratureQueryClient>>;

function requestedProvider(input: LiteratureQueryInput): LiteratureProviderId {
  const value = String(input.literature_provider || input.paper_source || "ailab_rag").trim();
  if (value === "semantic_scholar" || value === "pubmed" || value === "none") return value;
  return "ailab_rag";
}

function unavailable(provider: LiteratureProviderId, error: string): LiteratureQueryResult {
  return {
    ok: false,
    paper_source: provider,
    sources: [],
    source_count: 0,
    warnings: [error],
    error,
  };
}

/**
 * Dispatch boundary for literature retrieval.
 *
 * The Shanghai AI Lab branch deliberately delegates the original input directly
 * to PaperRagClient. Do not normalize or rewrite that branch in this router.
 */
export class LiteratureProviderRouter implements LiteratureQueryClient {
  constructor(
    readonly ailabClient: PaperRagClient,
    readonly providerClients: ProviderClients = {},
  ) {}

  async query(input: LiteratureQueryInput, cwd?: string, signal?: AbortSignal): Promise<LiteratureQueryResult> {
    const provider = requestedProvider(input);
    if (provider === "ailab_rag") return await this.ailabClient.query(input, cwd, signal);
    if (provider === "none") return unavailable(provider, "Literature retrieval is disabled because no provider is configured");
    const client = this.providerClients[provider];
    if (!client) return unavailable(provider, `${provider} literature retrieval is not implemented in this build`);
    return await client.query(input, cwd, signal);
  }
}

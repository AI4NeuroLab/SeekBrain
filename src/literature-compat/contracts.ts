import type { PaperRagInput } from "../targeted-skill/rag-client.ts";

export type LiteratureProviderId = "ailab_rag" | "semantic_scholar" | "pubmed" | "none";

export interface LiteratureQueryInput extends PaperRagInput {
  /** Include original selected records for the shared search/read tool cache. */
  include_papers?: boolean;
  paper_source?: LiteratureProviderId;
  literature_provider?: LiteratureProviderId;
  credential_ref?: string;
  credential_store?: string;
  candidate_pool_size?: number;
  query_variant_count?: number;
  literature_queries?: string[];
  tool?: string;
  email?: string;
}

export type LiteratureQueryResult = Record<string, any>;

export interface RepositoryCandidate {
  url: string;
  discoverySource: "abstract" | "pmc_full_text" | "provider_metadata";
  relation:
    | "paper_analysis_code"
    | "paper_model_code"
    | "supplementary_code"
    | "dependency"
    | "cited_resource"
    | "unknown";
  reachable?: boolean;
  evidenceContext?: string;
}

export interface PaperRecord {
  provider: "semantic_scholar" | "pubmed";
  providerId: string;
  title: string;
  abstract?: string;
  fullText?: string;
  authors: string[];
  year?: number;
  venue?: string;
  doi?: string;
  pmid?: string;
  pmcid?: string;
  openAccessPdf?: string;
  repositoryCandidates: RepositoryCandidate[];
  relevanceScore?: number;
}

export interface LiteratureQueryClient {
  query(input: LiteratureQueryInput, cwd?: string, signal?: AbortSignal): Promise<LiteratureQueryResult>;
}

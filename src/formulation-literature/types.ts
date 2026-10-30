export type Json = Record<string, unknown>;

export interface FullTextPaper {
  paper_id: string;
  track_id: string;
  title: string;
  full_text: string;
  abstract?: string;
  authors?: string[];
  similarity_score?: number;
  published_at?: string;
  venue?: string;
  doi?: string;
  pmid?: string;
  pmcid?: string;
  url?: string;
  github_links: string[];
}

export interface StoredPaper extends Omit<FullTextPaper, "full_text"> {
  abstract: string;
  preview?: string;
  full_text_available: boolean;
  full_text_path: string;
  full_text_chars: number;
}

export interface FullTextQueryOptions {
  baseUrl: string;
  query: string;
  topK: number;
  timeoutMs: number;
  requireGithub?: boolean;
  signal?: AbortSignal;
}

export interface FormulationLiteratureRuntimeConfig {
  provider: string;
  baseUrl: string;
  topK?: number;
  timeoutMs?: number;
  readOutputCharLimit?: number;
}

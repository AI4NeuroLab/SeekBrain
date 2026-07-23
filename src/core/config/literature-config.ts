type Json = Record<string, any>;

export type LiteratureProvider = "ailab_rag" | "semantic_scholar" | "pubmed" | "none";

const PROVIDERS = new Set<LiteratureProvider>(["ailab_rag", "semantic_scholar", "pubmed", "none"]);

function nonEmpty(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function resolveLiteratureProvider(config: Json): LiteratureProvider {
  const explicit = String(config.literature?.paper_source || "").trim() as LiteratureProvider;
  if (PROVIDERS.has(explicit)) return explicit;

  // Backward compatibility: configurations created before literature.paper_source
  // keep using AILab when any legacy RAG base URL is present.
  const legacyUrls = [
    config.modules?.targeted_skill?.rag_base_url,
    config.modules?.targeted_skill?.base_url,
    config.agents?.seekbrain_survey?.rag?.base_url,
    config.agents?.seekbrain_deep_research?.rag?.base_url,
  ];
  return legacyUrls.some(nonEmpty) ? "ailab_rag" : "none";
}

export function literatureCapabilities(config: Json) {
  const provider = resolveLiteratureProvider(config);
  const available = provider !== "none";
  const workflow = config.workflow?.seekbrain || {};
  return {
    provider,
    available,
    research_survey: available && workflow.research_survey !== false,
    deep_research: available && workflow.deep_research === true,
    targeted_skill_match: workflow.targeted_skill_match !== false,
    targeted_skill_generate: available && workflow.targeted_skill_generate !== false,
  };
}

export function literatureQueryConfig(config: Json, legacy: Json = {}): Json {
  const provider = resolveLiteratureProvider(config);
  const configured = config.literature?.providers?.[provider];
  const providerConfig = configured && typeof configured === "object" ? configured : {};
  const baseUrl = String(providerConfig.base_url || legacy.rag_base_url || legacy.base_url || "").trim();
  const compatibility = provider === "semantic_scholar" || provider === "pubmed" ? {
    ...(providerConfig.credential_ref ? { credential_ref: providerConfig.credential_ref } : {}),
    ...(providerConfig.timeout_seconds ? { timeout: providerConfig.timeout_seconds } : {}),
    ...(providerConfig.candidate_pool_size ? { candidate_pool_size: providerConfig.candidate_pool_size } : {}),
    ...(providerConfig.query_variant_count ? { query_variant_count: providerConfig.query_variant_count } : {}),
    ...(providerConfig.tool ? { tool: providerConfig.tool } : {}),
    ...(providerConfig.email ? { email: providerConfig.email } : {}),
  } : {};
  return {
    ...legacy,
    ...compatibility,
    paper_source: provider,
    literature_provider: provider,
    ...(config.literature?.credential_store ? { credential_store: config.literature.credential_store } : {}),
    ...(baseUrl ? { base_url: baseUrl, rag_base_url: baseUrl } : {}),
  };
}

# Literature provider compatibility: final implementation plan

Status: implementation complete; Phases 1–6 complete
Recorded: 2026-07-22
Updated: 2026-07-23
Supersedes: `docs/architecture/pubmed-skill-compatibility-plan.md`

## 1. Decision

SeekBrain will keep the existing Shanghai AI Lab paths for Skill, Deep Research and
Research Survey unchanged. PubMed/PMC and Semantic Scholar support will be
implemented as additive compatibility components and will run only when the
user explicitly selects one of those providers.

Setup selects exactly one literature provider for the initial configuration:

- `ailab_rag`
- `semantic_scholar`
- `pubmed`
- `none`

The selected provider is independent from the model provider. Advanced manual
configuration may override the literature provider per consumer later, but the
initial setup writes one shared choice for Skill, Deep Research and Survey.

## 2. Non-negotiable invariants

1. The Shanghai AI Lab request, response normalization, Skill generation, Deep Research
   and Survey behavior remain on the existing code path.
2. Missing `paper_source` remains compatible with existing installations and
   resolves to `ailab_rag` only when a valid legacy Shanghai AI Lab URL is present.
3. PubMed and Semantic Scholar do not reuse the Shanghai AI Lab query format. Each gets a
   provider-specific query planner and client.
4. PubMed and Semantic Scholar return compatibility results shaped like the
   current `PaperRagClient` result so existing downstream agents do not need to
   understand provider APIs.
5. Repository discovery never treats every GitHub URL as paper code. It records
   whether a link is paper analysis code, model code, supplementary code, a
   dependency, a cited resource or unknown.
6. Repository-backed Skill generation requires a live repository explicitly
   associated with the paper.
7. Failure to find a repository is not a workflow failure. PubMed and Semantic
   Scholar fall back to paper-only Skills when usable papers exist.
8. No Skill may be fabricated when no usable paper was retrieved.
9. Literature credentials never enter YAML, logs, traces, cache keys or generated
   Skill content.
10. Provider absence is represented explicitly as `paper_source: none`; it is
    not inferred repeatedly from request failures.

## 3. Current behavior that must be accounted for

The current TypeScript Skill resolver:

- calls Shanghai AI Lab with `require_github=true`;
- discards every source whose `github_links` is empty;
- invokes `RagSkillGenerator` only with a repository URL;
- always writes `scripts/run_analysis.py` for a generated RAG Skill.

Consequently, true paper-only Skill generation does not currently exist in
SeekBrain and must be added for the PubMed and Semantic Scholar compatibility
paths by extending the existing `RagSkillGenerator` with an explicit no-repository
mode. A second generator class is not required. The original
Intern-NeuroScientist paper-only behavior is not evidence that the current
TypeScript path already supports it.

The current public configuration also sets `deep_research: true`. The target
provider-neutral default in this plan is `false`; implementation must update the
package defaults, CLI template, config-loader defaults and affected tests
together.

## 4. Additive architecture

```text
consumer request
    |
    v
LiteratureProviderRouter
    |
    +-- ailab_rag ---------> existing PaperRagClient and existing workflows
    |
    +-- semantic_scholar --> new compatibility component
    |
    +-- pubmed ------------> new compatibility component
    |
    +-- none --------------> disabled capability result; no network call
```

Do not first migrate Shanghai AI Lab into a new generalized provider framework. The router
must delegate the Shanghai AI Lab branch directly to the existing client. This limits the
regression surface to one dispatch boundary.

Suggested layout:

```text
src/literature-compat/
├── router.ts
├── contracts.ts
├── credentials.ts
├── cache.ts
├── rate-limiter.ts
├── semantic-scholar/
│   ├── client.ts
│   ├── query-planner.ts
│   └── retriever.ts
├── pubmed/
│   ├── client.ts
│   ├── query-planner.ts
│   └── retriever.ts
└── shared/
    ├── pmc-enricher.ts
    ├── repository-extractor.ts
    ├── repository-classifier.ts
    └── repository-validator.ts
```

Only PubMed and Semantic Scholar import `literature-compat/shared`. Shanghai AI Lab must
not acquire a dependency on the compatibility component.

## 5. Provider-specific retrieval

### 5.1 Shanghai AI Lab Paper RAG

The existing behavior is frozen:

```text
original scientific question
  -> POST {base_url}/queryfull
  -> existing top_k and require_github behavior
  -> existing normalization
  -> existing consumer path
```

No new query planner, PMC enrichment, repository classifier, retry queue or
paper-only generator is inserted into the Shanghai AI Lab branch in this project.

### 5.2 Semantic Scholar

Semantic Scholar uses several compact natural-language queries rather than the
full execution prompt or one over-constrained keyword string.

Example intents:

```text
domain: Drosophila head direction
modality: Drosophila EPG calcium imaging
mechanism: Drosophila bump attractor visual cues
```

The retriever:

1. executes a small bounded set of query variants;
2. uses a shared per-key queue and bounded 429 retry policy;
3. merges candidates by PaperId, DOI, PMID and normalized title;
4. locally reranks candidates against the complete scientific question;
5. retains abstracts, DOI, PMID, PMCID and open-access links;
6. enriches selected candidates through PMC when PMCID is available;
7. extracts and classifies repository links;
8. validates repository reachability for Skill only.

The Wilson feasibility test established that a broad query can return 20
candidates, 11 of those candidates can expose PMCID values, and PMC enrichment
can recover multiple live paper-associated GitHub repositories. Semantic
Scholar therefore acts as discovery/ranking; it is not expected to expose every
repository directly in its abstract response.

### 5.3 PubMed/PMC

PubMed uses provider-native fielded Boolean queries. Synonyms are joined with
`OR`; scientific concepts are joined with `AND`.

```text
Drosophila[Title/Abstract]
AND ("head direction"[Title/Abstract] OR heading[Title/Abstract])
AND (cue[Title/Abstract] OR landmark[Title/Abstract])
```

The retriever:

1. creates precise, balanced and broader Boolean variants;
2. calls ESearch for a candidate PMID pool;
3. calls ESummary/EFetch for metadata, abstract, DOI and PMCID;
4. fetches PMC XML when available;
5. extracts and classifies repository links from the full text;
6. validates repository reachability for Skill only;
7. merges and reranks candidates against the complete scientific question.

PubMed and Semantic Scholar may share PMC enrichment and repository processing,
but they must not share a query planner.

## 6. Consumer policies

### 6.1 Skill

Shanghai AI Lab continues on the existing resolver path.

For PubMed and Semantic Scholar:

```text
retrieve 10 candidate papers (configurable)
  -> rerank by scientific and method relevance
  -> enrich candidates until two Skills can be selected
  -> prefer live paper-associated repositories
  -> generate repository-backed Skills where possible
  -> fill remaining slots with paper-only Skills
```

Default compatibility policy:

```yaml
candidate_pool_size: 10
skill_top_k: 2
prefer_repository: true
paper_only_fallback: true
```

Fallback outcomes:

| Retrieved evidence | Generated result |
|---|---|
| At least two suitable live repositories | Two repository-backed Skills |
| One suitable repository plus usable papers | One repository-backed and one paper-only Skill |
| No suitable repository but at least two usable papers | Two paper-only Skills |
| Only one usable paper | One paper-only Skill plus a warning; never duplicate it |
| No usable paper | No generated Skill; continue without a generated Skill |

The existing `RagSkillGenerator` is extended to accept `repoLink?: string` and
an explicit `evidenceLevel`. When `repoLink` is absent it skips clone, repository
matching and script emission, and writes:

```text
<skill>/
├── SKILL.md
├── metadata.json
└── references/
    └── paper_context.md
```

It must not create `scripts/`, placeholder scripts, repository context or claims
that paper procedures have already been implemented. Its metadata includes:

```yaml
evidence_level: paper_only
provider: semantic_scholar | pubmed
doi: optional
pmid: optional
pmcid: optional
repository_url: null
scripts_available: false
```

Do not use a fabricated sentinel such as `https://github.com/NONE`. The current
generator would attempt to clone it, record a false repository provenance,
label the result repository-backed and emit a placeholder script. Compatibility
sources without a repository keep `github_links: []`; after ranking, the
resolver invokes the existing generator with `repoLink: undefined` and
`evidenceLevel: "paper_only"`.

### 6.2 Deep Research

Deep Research never requires a repository. PubMed/Semantic compatibility output
is normalized into the existing `sources` contract and passed to the existing
Deep Research Agent.

The provider-neutral default is disabled. Selecting a literature provider makes
Deep Research available but does not automatically enable it; setup presents an
explicit toggle whose default remains off.

### 6.3 Research Survey

Survey never requires a repository. When a provider is configured, Survey is
enabled by default and receives provider-compatible background sources before
the Research Planning tree is generated.

When no provider is configured, Survey is disabled rather than invoked with an
empty endpoint. Research Planning continues without global literature context.

## 7. No-provider capability matrix

When `paper_source: none`, effective runtime behavior is:

```yaml
workflow:
  seekbrain:
    deep_research: false
    research_survey: false
    targeted_skill_match: true
    targeted_skill_generate: false
```

This means:

- trajectory Skill matching remains available;
- configured expert Skill matching remains available under the existing rules;
- no Paper RAG request is attempted;
- no new content is written to `~/.seekbrain/skills/from_rag`;
- `from_rag` is not added as an existing-Skill search directory;
- Deep Research is skipped with reason `no_literature_provider`;
- Survey is skipped with reason `no_literature_provider`;
- Research Planning continues normally without survey context.

Runtime derives these effective gates even if stale YAML incorrectly leaves a
feature enabled:

```text
effective_deep_research = configured_deep_research && provider != none
effective_research_survey = configured_research_survey && provider != none
effective_rag_skill_generation = targeted_skill_generate && provider != none
effective_skill_matching = targeted_skill_match
```

Setup also writes the matching booleans for transparency, but runtime capability
gating is the authority.

## 8. Setup integration

The existing model-provider and Core/Fast setup remains unchanged. Literature
setup is appended after model setup.

### 8.1 Wizard sequence

1. Configure the model provider and Core/Fast models exactly as today.
2. Ask `Choose a literature provider`:
   - Semantic Scholar
   - PubMed/PMC
   - Shanghai AI Lab Paper RAG
   - None
3. Collect and validate provider connection details.
4. Ask whether to enable Deep Research, default `false`, only when a provider is
   configured.
5. Compute and display the resulting capability matrix.
6. Atomically persist configuration and credentials.

### 8.2 Provider prompts

Shanghai AI Lab Paper RAG:

- base URL, required;
- API key optional/reserved for gateways; no key for the current deployment.

Semantic Scholar:

- base URL, default `https://api.semanticscholar.org/graph/v1`;
- API key, required for the supported production profile.

PubMed:

- base URL, default
  `https://eutils.ncbi.nlm.nih.gov/entrez/eutils`;
- NCBI API key, required for the supported production profile;
- optional tool/email identity fields when needed by NCBI policy.

`None` collects no connection information and applies the no-provider matrix.

### 8.3 Credential storage

Literature credentials are not model credentials and must not be inserted into
Pi model auth records. Setup stores them atomically in a dedicated user-owned
credential file such as:

```text
~/.config/seekbrain/literature-credentials.json
```

The file mode is `0600`. User YAML stores only a credential reference. Environment
variable and credential-file references remain available for non-interactive
deployments. Precedence is:

```text
explicit environment variable
  -> configured credential reference
  -> setup credential store
```

### 8.4 Validation semantics

- authentication failure rejects the provider choice and returns to the prompt;
- connection timeout permits retry or selection of `None`;
- Semantic Scholar `429` proves endpoint reachability but is recorded as a
  warning, followed by a bounded delayed validation retry;
- no provider is considered configured from a URL alone when its supported
  profile requires a key;
- secret values are redacted from all setup output.

### 8.5 Setup-written defaults

With any provider:

```yaml
research_survey: true
deep_research: false
targeted_skill_match: true
targeted_skill_generate: true
```

With `none`:

```yaml
research_survey: false
deep_research: false
targeted_skill_match: true
targeted_skill_generate: false
```

## 9. Configuration shape

```yaml
literature:
  paper_source: semantic_scholar  # ailab_rag | semantic_scholar | pubmed | none

  providers:
    ailab_rag:
      base_url: "http://127.0.0.1:21800"
      credential_ref: null

    semantic_scholar:
      base_url: "https://api.semanticscholar.org/graph/v1"
      credential_ref: "semantic_scholar_default"
      timeout_seconds: 60

    pubmed:
      base_url: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
      credential_ref: "pubmed_default"
      timeout_seconds: 60

modules:
  targeted_skill:
    compatibility:
      candidate_pool_size: 10
      skill_top_k: 2
      prefer_repository: true
      paper_only_fallback: true

workflow:
  seekbrain:
    research_survey: true
    deep_research: false
    targeted_skill_match: true
    targeted_skill_generate: true
```

The existing Shanghai AI Lab agent-level `rag` configuration remains readable during the
migration. The router resolves legacy configuration before declaring that no
provider exists.

## 10. Shared compatibility contracts

External providers normalize into:

```ts
interface PaperRecord {
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
}

interface RepositoryCandidate {
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
```

Deep Research and Survey adapters expose the existing compatibility shape:

```ts
{
  ok: boolean;
  sources: Array<{
    source_id: string;
    title: string;
    pub_time: unknown;
    magazine: unknown;
    github_links: string[];
    text: string;
  }>;
  source_count: number;
  warnings: string[];
}
```

## 11. Caching, rate limits and recovery

PubMed and Semantic Scholar share infrastructure, not queries:

- one request queue per provider credential;
- bounded concurrency;
- `Retry-After` support;
- exponential backoff with jitter for 429/5xx;
- query-response cache;
- normalized-paper cache;
- PMC XML cache by PMCID;
- repository classification cache by paper identity and URL;
- reachability cache with a bounded TTL;
- no secret values in cache keys.

An interrupted run resumes from the last completed enrichment stage. Provider
failure does not silently switch providers unless an explicit future fallback
order is configured.

## 12. Observability

Every compatibility retrieval records:

```json
{
  "paper_source": "semantic_scholar",
  "query_variant_count": 3,
  "retrieved_count": 20,
  "enriched_full_text_count": 11,
  "repository_candidate_count": 21,
  "live_paper_repository_count": 7,
  "repository_skill_count": 2,
  "paper_only_skill_count": 0,
  "warnings": []
}
```

No key, authorization header or complete protected full text is written to the
trace.

## 13. Implementation phases

### Phase 1: capability and setup foundation (complete)

- add literature provider configuration and credential store;
- extend setup with the provider/none choice;
- implement the no-provider runtime gates;
- change provider-neutral Deep Research default to off;
- add frozen Shanghai AI Lab contract tests.

### Phase 2: router with unchanged Shanghai AI Lab delegation (complete)

- add `LiteratureProviderRouter`;
- route absent/legacy Shanghai AI Lab configuration to the existing client;
- prove identical Shanghai AI Lab request payloads and results for Skill, Deep Research
  and Survey.

### Phase 3: Semantic Scholar compatibility (complete)

- add client, natural-language query planner and per-key limiter;
- add multi-query merge and local reranking;
- retain external IDs and connect PMC enrichment;
- normalize Deep Research and Survey output.

### Phase 4: PubMed compatibility (complete)

- add ESearch/ESummary/EFetch client;
- add Boolean query planner and broadening policy;
- connect PMC enrichment;
- normalize Deep Research and Survey output.

### Phase 5: external-provider Skill generation (complete)

- add repository extraction, classification and validation;
- add repository-backed selection for PubMed/Semantic Scholar;
- extend `RagSkillGenerator` with an explicit no-repository mode that emits no
  scripts;
- implement the two-slot mixed fallback policy;
- ensure no-provider mode never enters this phase.

### Phase 6: end-to-end verification and documentation (complete)

- Wilson Semantic Scholar and PubMed fixtures;
- Shanghai AI Lab regression suite;
- setup migration tests;
- resume/cache tests;
- credential redaction tests;
- update configuration README and setup help.

## 14. Acceptance criteria

1. Existing Shanghai AI Lab configurations produce the same HTTP request bodies and the
   same downstream outcomes as before the compatibility work.
2. Setup requires an explicit literature choice and supports `None`.
3. No-provider mode disables Deep Research, Survey and RAG Skill generation at
   runtime while preserving trajectory Skill matching.
4. Provider-neutral Deep Research default is off.
5. Survey defaults on only when a literature provider is configured.
6. PubMed uses Boolean provider-native queries and PMC enrichment.
7. Semantic Scholar uses bounded multi-query discovery and PMC enrichment.
8. Skill candidate-pool size is independent from final Skill count.
9. Dependencies and cited GitHub resources are not mislabeled as paper code.
10. Live associated repositories produce repository-backed Skills.
11. Missing repositories produce up to two real paper-only Skills without a
    `scripts/` directory.
12. Paper-only Skills use an absent repository value, never a fabricated URL or
    sentinel GitHub repository.
13. Fewer than two real papers never cause duplicated or invented Skills.
14. A total retrieval failure produces no generated Skill but does not abort the
    scientific workflow.
15. Provider keys are redacted and stored outside YAML with mode `0600`.
16. Semantic Scholar requests from Skill, Deep Research and Survey share one
    credential-aware limiter and cache.

## 15. Deferred work

- automatic cross-provider fallback;
- simultaneous ensemble retrieval from all three providers;
- Zenodo/GitHub release archives as repository-equivalent code packages;
- per-consumer provider selection in setup;
- migration of Shanghai AI Lab into the compatibility abstraction.

These may be added later without changing the initial provider contract. They
must not delay or broaden this implementation.

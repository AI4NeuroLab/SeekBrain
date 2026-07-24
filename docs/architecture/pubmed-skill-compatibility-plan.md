# Repository-gated paper retrieval for Skill

> **Superseded on 2026-07-22.** This exploratory design rejects paper-only
> Skills and does not preserve the final AILab compatibility boundary. Do not
> implement it. The authoritative plan is
> `docs/architecture/literature-provider-compatibility-final-plan.md`.

Status: revised design recorded; implementation not started
Recorded: 2026-07-22

## 1. Decision

SeekBrain Skill generation has one provider-independent admission rule:

> A paper may enter Paper2Skill + Repo2Skill only when it is explicitly
> associated with a real Git repository and that repository passes a read-only
> reachability check.

This rule applies equally to AILab RAG, PubMed/PMC and Semantic Scholar.
Providers differ only in how they discover paper-associated repository links.

Papers without an admissible repository are discarded from the Skill candidate
set. Skill does not retain them for later Deep Research or Survey use. Those two
consumers execute their own retrieval with independent policies and may accept
papers without repositories.

Literature-backed or paper-only Skill generation is out of scope. It must not be
introduced as an implicit fallback.

## 2. Design invariants

1. `retrieved paper` does not imply `Skill candidate`.
2. A repository URL must be associated with the paper, not guessed from title
   similarity alone.
3. Repository association and repository reachability are separate checks.
4. PDFs, DOI pages, paper pages, organization pages and archive pages are not
   repository roots.
5. AILab keeps its current server-side `require_github=true` optimization, but
   all returned links still pass the same local normalization and verification.
6. PubMed papers are not discarded until the PMCID/PMC enrichment step has had
   an opportunity to find links omitted from the abstract.
7. A candidate without a verified repository is a normal Skill miss, not a
   workflow failure.
8. Skill, Deep Research and Survey share provider connections and credentials,
   not acceptance policies or retrieved results.

## 3. Feasibility gate: verified PubMed/PMC case

The central prerequisite has been demonstrated with a real neuroscience paper:

- Title: *MINT: A toolbox for the analysis of multivariate neural information
  coding and transmission*
- PMID: `40233091`
- PMCID: `PMC12043240`
- DOI: `10.1371/journal.pcbi.1012934`
- Repository explicitly stated in PMC XML:
  `https://github.com/panzerilab/MINT`
- Repository reachability: `git ls-remote ... HEAD` succeeded on 2026-07-22.
- Observed repository contents: MATLAB source, tests, tutorials, Dockerfile and
  GPLv3 licensing information.

Evidence links:

- https://pubmed.ncbi.nlm.nih.gov/40233091/
- https://pmc.ncbi.nlm.nih.gov/articles/PMC12043240/
- https://github.com/panzerilab/MINT

The paper itself states that MINT is available at this repository. The
association is therefore explicit rather than inferred from a GitHub search.
This case becomes a permanent PubMed/PMC repository-discovery fixture.

### 3.1 Semantic Scholar validation of the same case

The MINT case was also tested against the official Semantic Scholar Graph API:

- unauthenticated relevance search returned HTTP `429` on the shared deployment
  egress;
- direct lookup by DOI returned HTTP `200`;
- Semantic Scholar paper ID:
  `8c690b4d1fa3ee9e6749b0c12355efd95792e138`;
- returned external IDs included DOI `10.1371/journal.pcbi.1012934`, PubMed
  `40233091` and PubMed Central `12043240`;
- the returned abstract explicitly contained
  `https://github.com/panzerilab/MINT`.

This proves that Semantic Scholar can produce a repository-backed Skill
candidate when its paper record contains an explicit repository URL. It also
provides identifiers that allow PubMed/PMC enrichment and independent
association confirmation. However, unauthenticated Semantic Scholar search is
not reliable on a shared IP. Production search must use a configured API key or
treat `429` as a provider miss and continue to the next source.

Authenticated relevance search was then tested with two query styles:

1. A natural-language analysis question about quantifying multivariate
   information coding and transmission returned HTTP `200`, but MINT was absent
   from the top 10 results and none of those abstracts exposed a Git repository.
2. A method/software-oriented rewrite (`multivariate information toolbox neural
   population coding transmission software`) returned HTTP `200`, ranked MINT
   first and preserved its explicit GitHub link. It also returned another
   neuroscience methods paper with explicit repository URLs, while one of the
   lower-ranked results was scientifically irrelevant.

Therefore a valid Semantic Scholar key solves availability and rate-limit
problems, but it does not remove the need for Skill-specific query formulation
and local scientific reranking. The raw user question must not be the only
search query, and a repository URL alone must not override scientific relevance.

## 4. Architecture

```text
                         Shared connection registry
                    URL, driver, auth, timeout, proxy
                                  |
          +-----------------------+-----------------------+
          |                       |                       |
   AILab adapter            PubMed adapter       Semantic Scholar adapter
          |                       |                       |
          +---------- normalized PaperRecord ------------+
                                  |
                   SkillRepositoryCandidateResolver
                    |             |              |
              link discovery  association    reachability
                    |           validation     verification
                    +-------------+--------------+
                                  |
                     verified candidates only
                                  |
                    existing Paper2Skill + Repo2Skill
```

The shared paper service normalizes provider responses. The Skill-specific
resolver owns enrichment, repository association, verification and rejection.
Deep Research and Survey stop after normalized paper retrieval and never invoke
the Skill repository gate.

### 4.1 Provider adapters

Each adapter implements:

```ts
interface PaperProvider {
  readonly name: string;
  readonly capabilities: {
    repositoryFilterHint: boolean;
    abstracts: boolean;
    fullText: boolean;
  };

  search(request: PaperSearchRequest, signal?: AbortSignal): Promise<PaperSearchResult>;
}
```

Adapters may apply provider-specific hints, but hints never replace local
verification.

### 4.2 Skill repository resolver

```ts
interface SkillRepositoryCandidateResolver {
  resolve(
    papers: PaperRecord[],
    policy: SkillRepositoryPolicy,
    signal?: AbortSignal,
  ): Promise<SkillRepositoryResolution>;
}
```

It performs, in order:

1. Skill-oriented query formulation;
2. provider-specific paper retrieval and enrichment;
3. scientific relevance reranking against the question and dataset metadata;
4. repository URL extraction;
5. URL normalization and host filtering;
6. paper-to-repository association validation;
7. read-only Git reachability verification;
8. deduplication by normalized repository root;
9. rejection of every paper with no verified repository.

### 4.3 Skill query formulation

For each scientific task, construct a small bounded query set rather than one
verbatim user query:

```text
domain query: biological system + modality + analytical target
method query: analytical target + method/statistics terms
software query: method terms + toolbox/software/open-source/implementation
```

Provider adapters translate these semantic query intents into their supported
syntax. Semantic Scholar relevance search accepts plain text, so it receives
compact keyword phrases rather than PubMed field tags or Boolean syntax. Results
from all variants are merged by paper identity before local reranking.

The reranker must score both scientific relevance and implementation relevance.
A paper is rejected even with a verified repository when it does not address the
task's biological modality, analytical target or required data type.

## 5. Provider-specific discovery

### 5.1 AILab RAG

For the Skill profile, the adapter sends:

```json
{
  "require_github": true
}
```

This preserves the current server-side filtering and avoids transferring papers
that are unlikely to be useful. SeekBrain nevertheless treats returned
`github_links` as unverified candidates:

```text
AILab result
  -> normalize github_links into repository candidates
  -> reject non-repository URLs
  -> verify git reachability
  -> pass or discard
```

If AILab ignores the hint or returns an empty/invalid link, the paper is
discarded from Skill exactly as it is today. The difference is that rejection is
counted and explained rather than silently lost.

### 5.2 PubMed/PMC

PubMed has no repository-only search filter. Its Skill path is therefore an
enrichment pipeline:

```text
method-oriented query
  -> ESearch(db=pubmed): PMID list
  -> EFetch(db=pubmed, retmode=xml): metadata + abstract + DOI + PMCID
  -> extract explicit repository URLs from metadata/abstract
  -> when PMCID exists, fetch PMC XML
  -> extract explicit repository URLs from full text
  -> normalize, validate association and verify reachability
  -> pass or discard
```

The paper must not be rejected immediately because its PubMed abstract lacks a
GitHub URL. The MINT case demonstrates that PMC XML can provide the required
explicit association.

### 5.3 Semantic Scholar

Semantic Scholar results enter the same normalized contract. Repository links
may be extracted only when returned explicitly in provider metadata, abstract or
paper content. The MINT Graph API record is a verified fixture for repository
extraction from an abstract. An open-access PDF is stored as `open_access_pdf`,
never as a repository.

If Semantic Scholar does not produce an explicitly associated, reachable
repository, the paper is discarded from Skill. A GitHub search based only on the
paper title is not sufficient evidence. DOI, PubMed and PubMed Central external
IDs should be retained so the resolver can request PMC XML before final
rejection.

Semantic Scholar `429` responses must honor `Retry-After` when present, use a
bounded retry policy and then fall through to the next configured provider.
Anonymous search is supported only as a best-effort mode; a configured API key
is required for a dependable production profile.

## 6. Normalized contracts

```ts
interface PaperRecord {
  source: "ailab" | "pubmed" | "semantic_scholar";
  provider_id: string;
  title: string;
  abstract: string;
  full_text?: string;
  authors: string[];
  year?: number;
  venue?: string;
  doi?: string;
  pmid?: string;
  pmcid?: string;
  paper_url?: string;
  open_access_pdf?: string;
  external_links: string[];
  repository_candidates: RepositoryCandidate[];
  content_level: "metadata" | "abstract" | "full_text";
}

interface RepositoryCandidate {
  raw_url: string;
  normalized_url?: string;
  host?: string;
  discovery_source:
    | "provider_asserted"
    | "paper_metadata"
    | "abstract"
    | "pmc_full_text";
  evidence_locator?: string;
  association:
    | "provider_asserted"
    | "explicit_in_paper"
    | "unverified";
}

interface VerifiedSkillPaper {
  paper: PaperRecord;
  repository: {
    url: string;
    host: string;
    discovery_source: RepositoryCandidate["discovery_source"];
    association: "provider_asserted" | "explicit_in_paper";
    reachable: true;
    head?: string;
    verified_at: string;
  };
}
```

The legacy `github_links` field may temporarily be emitted only as a projection
of verified repository URLs. New logic must use `repository_candidates` and
`VerifiedSkillPaper`.

## 7. Repository admission policy

Initially allowed repository hosts:

- `github.com`
- `gitlab.com`
- `bitbucket.org`
- `codeberg.org`

A candidate is admitted only if all checks pass:

1. URL uses HTTP(S).
2. Host is allow-listed.
3. URL normalizes to a repository root rather than `/tree/`, `/blob/`, release,
   issue or organization pages.
4. Association is `provider_asserted` or `explicit_in_paper`.
5. `git ls-remote <normalized-url> HEAD` succeeds within a bounded timeout.

`git ls-remote` proves reachability, not scientific association. Both checks are
required. Failed checks produce rejection reasons such as:

- `missing_repository`
- `unsupported_repository_host`
- `not_repository_root`
- `association_unverified`
- `repository_unreachable`
- `repository_verification_timeout`

## 8. Multi-provider strategy

The Skill profile uses an ordered `first_sufficient` strategy:

```text
for provider in configured source order:
  retrieve provider candidates
  enrich and verify repositories
  merge verified candidates
  stop when minimum_verified_repositories is satisfied
```

Recommended default order:

```text
AILab -> PubMed -> Semantic Scholar
```

This is efficient because AILab supports a repository hint. If only PubMed is
configured, PubMed remains fully functional. Papers and repositories are
deduplicated before Skill generation:

```text
paper identity: DOI -> PMID/PMCID -> provider ID -> normalized title
repository identity: normalized repository root
```

When two providers describe the same paper, metadata may be merged, but the
strongest repository provenance must be preserved.

## 9. Skill resolver behavior

```text
match existing local Skill
  -> match: load existing Skill
  -> miss: retrieve and verify repository-backed papers
      -> verified candidates: run existing RagSkillGenerator
      -> zero verified candidates: return normal no-Skill result
```

There is no `literatureOnly` generation branch:

```ts
const verified = await repositoryResolver.resolve(papers, policy, signal);

if (verified.candidates.length === 0) {
  return noGeneratedSkill(verified.rejectionSummary);
}

return generateRepositoryBackedSkills(verified.candidates);
```

The no-Skill result should contain aggregate diagnostics, not complete discarded
paper content:

```json
{
  "retrieved": 10,
  "repository_candidates": 3,
  "repository_verified": 1,
  "discarded_without_repository": 7,
  "discarded_invalid_repository": 1,
  "discarded_unreachable_repository": 1
}
```

## 10. Generated Skill provenance

Every generated Skill records the paper/repository relationship:

```yaml
evidence_level: repository_backed
paper_source: pubmed
pmid: "40233091"
pmcid: "PMC12043240"
doi: "10.1371/journal.pcbi.1012934"
repository_url: "https://github.com/panzerilab/MINT"
repository_discovery_source: pmc_full_text
repository_association: explicit_in_paper
repository_verified: true
repository_verified_at: "..."
```

The existing cloned files, paper-to-code mapping, reproduction plan and generated
Skill artifacts remain unchanged after admission.

## 11. Configuration boundary

Connection details are centralized; consumer policy remains local:

```yaml
paper_retrieval:
  sources:
    ailab:
      driver: ailab_queryfull
      base_url: "${SEEKBRAIN_AILAB_RAG_BASE_URL}"
      auth:
        type: none

    pubmed:
      driver: ncbi_eutils
      base_url: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
      auth:
        type: query
        parameter: api_key
        api_key_env: NCBI_API_KEY
      tool: seekbrain
      email_env: NCBI_EMAIL
      timeout_seconds: 60

    semantic_scholar:
      driver: semantic_scholar
      base_url: "https://api.semanticscholar.org/graph/v1"
      auth:
        type: header
        name: x-api-key
        api_key_env: SEMANTIC_SCHOLAR_API_KEY
      timeout_seconds: 60

modules:
  targeted_skill:
    paper_retrieval:
      source_order: [ailab, pubmed, semantic_scholar]
      strategy: first_sufficient
      top_k_per_source: 5
      minimum_verified_repositories: 1
      require_repository: true
      verify_repository: true
      repository_verification_timeout_seconds: 20

agents:
  seekbrain_deep_research:
    paper_retrieval:
      sources: [ailab, pubmed, semantic_scholar]
      top_k: 4
      require_repository: false

  seekbrain_survey:
    paper_retrieval:
      sources: [ailab, pubmed, semantic_scholar]
      top_k: 4
      require_repository: false
```

Real keys must not be stored in project YAML or committed files. Configuration
references environment variables or protected credential files.

## 12. Cache and recovery boundaries

Cache stages independently so interrupted work resumes without weakening
verification:

1. provider response cache: query + provider configuration fingerprint;
2. normalized paper cache: parser/schema version fingerprint;
3. PMC enrichment cache: PMCID + parser version;
4. repository association cache: paper identity + extraction version;
5. repository reachability cache: normalized URL + bounded TTL;
6. generated Skill cache: question + paper identity + repository HEAD.

An expired reachability entry must be verified again. A cached paper/repository
association must not be promoted to verified if reachability never succeeded.

## 13. Failure semantics

- Provider unavailable: warn and try the next configured provider.
- Provider rate limited after bounded retry: warn and try the next provider.
- Provider returns no papers: try the next provider.
- Papers have no repositories: normal Skill miss; try the next provider.
- Repository verification fails: reject candidate and continue.
- No provider yields a verified repository: return `ok: true`, `matched: false`.
- Existing local Skill match: do not call paper providers.
- Authentication/configuration error: expose a bounded diagnostic without keys.

## 14. Connectivity requirement

The deployment environment requires an HTTPS proxy for NCBI. SeekBrain's Node
process must enable environment-proxy handling, such as
`NODE_USE_ENV_PROXY=1` on supported Node versions, or use an equivalent
proxy-aware HTTP transport. Connectivity is tested separately from repository
admission semantics.

## 15. Implementation phases

### Phase A: shared contracts without behavior change

- Add provider registry and normalized `PaperRecord`.
- Wrap current AILab client in `AilabPaperProvider`.
- Preserve `require_github=true` and existing Skill outcomes.
- Add repository URL normalization and local verification.

### Phase B: PubMed repository-backed compatibility

- Add ESearch and EFetch adapter.
- Parse PMID, PMCID, DOI, metadata and abstract.
- Fetch PMC XML when PMCID exists.
- Extract explicit repository URLs.
- Add the MINT fixture and end-to-end resolver test.
- Pass only verified candidates to existing RagSkillGenerator.

### Phase C: Semantic Scholar compatibility

- Add Semantic Scholar adapter and authentication.
- Add bounded domain/method/software query variants.
- Merge and locally rerank results before repository verification.
- Keep PDF and repository fields separate.
- Apply the same association and reachability gate.

### Phase D: multi-provider orchestration

- Add ordered `first_sufficient` fallback.
- Deduplicate papers and repositories.
- Add cache/recovery artifacts and aggregate diagnostics.

## 16. Acceptance criteria

1. AILab still sends `require_github=true` for Skill retrieval.
2. AILab papers without a verified repository do not generate a Skill.
3. PubMed ESearch/EFetch normalize results without exposing credentials.
4. PubMed candidates are enriched through PMC before repository rejection.
5. The MINT fixture resolves `https://github.com/panzerilab/MINT` with
   `explicit_in_paper` provenance.
6. PDF, DOI, paper, archive and organization URLs never pass as repositories.
7. An explicit but unreachable repository does not generate a Skill.
8. A reachable repository without verified paper association does not generate a
   Skill.
9. A verified PubMed/PMC repository uses the existing clone, repository-analysis
   and Skill-authoring stages.
10. Zero verified repositories returns a normal no-Skill result.
11. Deep Research and Survey accept papers independently and do not consume
    Skill rejection results.
12. Provider credentials are shared without coupling consumer policies.
13. The Semantic Scholar MINT fixture retains DOI, PMID and PMCID and extracts
    the explicit `panzerilab/MINT` repository from the abstract.
14. Semantic Scholar `429` is bounded and falls through without failing the
    overall Skill resolver.
15. A verbatim natural-language query and a method/software query are tested
    separately; the MINT fixture is recovered by the method/software query.
16. A repository-bearing but scientifically irrelevant paper is rejected by the
    local reranker before Skill generation.

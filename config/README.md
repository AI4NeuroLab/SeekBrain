# SeekBrain configuration

`default.yaml` contains public, provider-neutral package defaults. Configuration
layers are applied in this order:

1. package `default.yaml`
2. `~/.config/seekbrain/config.yaml`
3. `<project>/seekbrain.config.yaml` (or `--config`)
4. environment variables
5. CLI/runtime overrides

Secrets do not belong in YAML files. Use Pi auth storage or provider environment
variables.

For initial model and literature configuration, use `seekbrain setup`. The
Pi-native Settings Card keeps only Providers, Primary/Fast models, and Research
Source. Multiple simple providers can coexist; each provider has one Official
or Custom connection. Research Source can be Semantic Scholar, PubMed/PMC,
Shanghai AI Lab Paper RAG, or None. Advanced routing remains a config-file task.

Model credentials remain in Pi auth storage. Semantic Scholar and PubMed keys
are written atomically to
`~/.config/seekbrain/literature-credentials.json` with mode `0600`; SeekBrain
YAML stores only a credential reference. Selecting None disables Research
Survey and Recipe Crystallization while preserving trajectory recipe matching.
Deep Research mode remains available with supplied materials and data; its round
limit is controlled independently by workflow.seekbrain.deep_research.max_rounds.

Setup validates the chosen research source before selecting it. It retries a
Semantic Scholar `429` once according to `Retry-After`; a continued `429` is a
reachable-but-rate-limited warning. PubMed authentication failures and all other
validation errors are reported without echoing keys.

On later `seekbrain setup` runs, the same card reads Primary only from
`agents.seekbrain` and Fast only from `agents.seekbrain_default`. It does not
interpret other per-Agent routing. Changes save immediately. The standalone
command closes its owned Pi session when the card closes; `/seekbrain-setup`
returns to the current session.

Environment credentials take precedence over the protected store:

```bash
SEMANTIC_SCHOLAR_API_KEY=...
NCBI_API_KEY=...
NCBI_EMAIL=researcher@example.org  # recommended by NCBI
NCBI_TOOL=seekbrain                # optional NCBI client identity
```

A representative manual configuration is:

```yaml
literature:
  paper_source: semantic_scholar # ailab_rag | semantic_scholar | pubmed | none
  credential_store: ~/.config/seekbrain/literature-credentials.json
  providers:
    ailab_rag:
      base_url: http://localhost:21800
    semantic_scholar:
      base_url: https://api.semanticscholar.org/graph/v1
      credential_ref: semantic_scholar_default
      timeout_seconds: 60
    pubmed:
      base_url: https://eutils.ncbi.nlm.nih.gov/entrez/eutils
      credential_ref: pubmed_default
      timeout_seconds: 60
      tool: seekbrain
      email: researcher@example.org

modules:
  targeted_skill:
    resolution_mode: recipe_scout_v2
    relevance_threshold: 0.6
    top_k: 3
    compatibility:
      candidate_pool_size: 10
      recipe_candidate_pool_size: 8
      skill_top_k: 2
      prefer_repository: true
      paper_only_fallback: true
      scout:
        rag_rounds: 2
        initial_rag_top_k: 8
        retry_rag_top_k: 4
        local_top_k: 8
        repository_inspections: 4
        initial_inspection_limit: 3
        inspection_concurrency: 2
        selected_methods: 2
    revision:
      enabled: true
      budget: 1
      generated_only: true

workflow:
  seekbrain:
    research_survey: true
    # Deep Research mode only; includes the first round.
    deep_research:
      max_rounds: 3
    targeted_skill_match: true
    targeted_skill_generate: true
    rag_recipe_crystallization: false
```

`recipe_scout_v2` is the default resolver. It recalls up to eight local candidates
and runs two parallel Top-8 Paper queries (domain-oriented and method-oriented),
deduplicates Papers before repository expansion, then inspects at most four
repositories with concurrency two. One Paper's multiple links cannot crowd out
other Papers. It returns at most one backbone plus one supporting method. If no
backbone passes, it may issue one failure-directed Top-4 RAG retry. The legacy
`recipe_2_2` value is accepted as a compatibility
alias for V2; use `legacy_resolver` only when explicitly testing the old set-cover
implementation. Legacy `rag_top_k` does not reduce V2's initial Top-8 recall.

`recipe_candidate_pool_size`, `top_k`, and `candidate_pool_size` remain available
to `legacy_resolver` and external literature providers.
For Semantic Scholar and PubMed, valid associated repositories
are preferred; remaining slots may use real paper-only analysis recipes without a
`scripts/` directory. Dependencies and cited repositories are not treated as
paper code. Shanghai AI Lab continues to use its existing `/queryfull` contract.
With `paper_source: none`, runtime capability gates override literature features
off even if stale workflow booleans remain true.

Provider responses are cached across process restarts in
`~/.cache/seekbrain/literature-cache.json`. Override the cache file with
`SEEKBRAIN_LITERATURE_CACHE`; credentials and authorization headers are excluded
from cache contents.

Initialize and inspect these layers with:

```bash
seekbrain config init --user
seekbrain config init --project
seekbrain config show
seekbrain config show --effective
seekbrain config list modules.targeted_skill
seekbrain config get modules.targeted_skill.relevance_threshold
seekbrain config set modules.targeted_skill.relevance_threshold 0.6
seekbrain config unset modules.targeted_skill.relevance_threshold
```

`config list`, `get`, and `show --effective` report the winning layer for each
value. `config set` and `unset` use the user configuration by default; add
`--project` for a project-only override. They execute only as CLI maintenance
commands and do not add runtime work to research workflows.

`--user` creates the fuller user template at
`~/.config/seekbrain/config.yaml`. `--project` creates a deliberately minimal
override at `<project>/seekbrain.config.yaml`; the latter wins only for fields
it defines. The legacy unscoped `seekbrain config init` remains an alias for
project scope.

Dataset profiles generated from raw dataset directories are cached separately at
`~/.seekbrain/datasets/`. Override it with `paths.dataset_cache` (or
`SEEKBRAIN_DATASET_CACHE_ROOT`) when the home filesystem is unsuitable.

The main Pi model can be selected in either layer under `agents.seekbrain`:

```yaml
agents:
  seekbrain:
    provider: your-provider
    model: your-model
    thinking: medium
```

SeekBrain reserves `high` for stages that make consequential scientific
judgments: Research Planning and review, Formulation, Interpretation, and Report
generation. Code, Validation, the main Orchestrator, literature Survey and Recipe
generation use `medium`. Deep Research decisions use the main Orchestrator. Dataset classification and
figure repair use `low`; pure routing, lightweight TaskBrief extraction,
and unused fallback roles remain `off`.

Explicit Pi arguments passed after `--` have the highest priority. Provider
credentials remain in Pi auth storage or environment variables.

## Analysis Recipe storage

SeekBrain uses one user-owned analysis recipe root by default:

```text
~/.seekbrain/skills/
├── builtin/trajectory/<package-version>/
├── from_rag/
└── from_expert/
```

The npm package stores the curated repertoire under `recipes/`, organized as
`Multimodal-joint-analysis` and `Single-modality`. On first recipe retrieval,
the 68 Recipe directories are copied atomically into the flat versioned
`builtin/trajectory/<package-version>/` layout together with the packaged
`INDEX.md`; help and version commands do not write it. Set `SEEKBRAIN_SKILLS_ROOT` to move
the unified user recipe root. A project may additionally keep expert recipes in
`<project>/.seekbrain/skills/from_expert`.

The default resolution flow builds one concise method-class query from the
objective, biological scope, data abstraction, and dataset-grounded scientific
background. Local RecipeCards and RAG
repositories are recalled in parallel. When RAG returns a repository already
represented by a local RecipeCard, exact positive or boundary memory is applied
before repository materialization. The bounded inspector reads the repository
tree, README, and a few selected source files. A candidate enters the temporary
MethodPack only after executable-capability acceptance; full R1…Rn coverage is
not required. Existing Recipes without a `recipe-card.json` remain compatible
through deterministic metadata inference. See the
[RecipeScoutV2 implementation plan](../docs/recipe-scout-v2-implementation-plan.md).

Under RecipeScoutV2, retrieval-time Recipe Crystallization is deliberately
deferred even if an older user configuration still enables
`workflow.seekbrain.rag_recipe_crystallization`. The retrieval artifact is a
temporary MethodPack. Positive reusable Recipes are promoted only after successful
execution and validation or an explicit save; scoped negative repository boundary
memory may be retained immediately. When Validation explicitly attributes
a retryable failure to a generated Recipe, `modules.targeted_skill.revision`
allows one run-local repair by default; packaged/expert Recipes are never modified
in place. Existing Plan, Code, Interpretation, and post-validation distillation
contracts remain unchanged. `modules.targeted_skill.resource_filter` controls which trajectory
resources are loaded; the public default matches the historical loader by
including `.md` and `.py` files with a maximum of five resources.

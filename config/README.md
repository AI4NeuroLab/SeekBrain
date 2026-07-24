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
Pi-native wizard first configures the model provider and Core/Fast routing, then
asks for exactly one literature provider: Semantic Scholar, PubMed/PMC,
Shanghai AI Lab Paper RAG, or None. Advanced users may override individual agent
routes here; users should not create Pi JSON files manually.

Model credentials remain in Pi auth storage. Semantic Scholar and PubMed keys
are written atomically to
`~/.config/seekbrain/literature-credentials.json` with mode `0600`; SeekBrain
YAML stores only a credential reference. Selecting None disables Research
Survey, Deep Research, and Recipe Crystallization while preserving trajectory
recipe matching.

Setup validates the chosen provider before writing credentials. It retries a
Semantic Scholar `429` once according to `Retry-After`; a continued `429` is a
reachable-but-rate-limited warning. PubMed authentication failures and all other
validation errors are reported without echoing keys.

On later `seekbrain setup` runs, the existing model/Core/Fast routing and
literature provider are offered for reuse. Reusing the literature selection
loads its key from the protected store or environment, so the key is not entered
again. The explicit setup command exits when configuration is saved.

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
    relevance_threshold: 0.3
    top_k: 1
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

`candidate_pool_size` controls retrieval breadth independently from
`skill_top_k`. For Semantic Scholar and PubMed, valid associated repositories
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
seekbrain config set modules.targeted_skill.relevance_threshold 0.5
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
    thinking: high
```

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

The bundled trajectory library is copied atomically on first recipe retrieval;
help and version commands do not write it. Set `SEEKBRAIN_SKILLS_ROOT` to move
the unified user recipe root. A project may additionally keep expert recipes in
`<project>/.seekbrain/skills/from_expert`.

The resolution flow remains trajectory matching first, followed by Paper RAG
and persistent repository-backed Recipe Crystallization only when no trajectory recipe
matches. `modules.targeted_skill.resource_filter` controls which trajectory
resources are loaded; the public default matches the historical loader by
including `.md` and `.py` files with a maximum of five resources.

# SeekBrain

SeekBrain is a Pi-based scientific research workflow for planning analyses,
running isolated code agents, validating generated figures, reviewing changes,
and producing evidence-grounded conclusions.

## Requirements

- Linux, macOS, or Windows
- Python 3 for generated scientific analysis code (optional until a Code stage executes)
- Node.js 24 recommended; Node.js 22.19 or newer is supported
- At least one supported model provider API key

## Install

Clone the repository and install the package with Node 24:

```bash
npm install
npm run doctor
npm link
```

`npm link` exposes the development checkout as the `seekbrain` command. A
published tarball can instead be installed with `npm install --global`.

Create the local provider configuration when environment-based credentials are
preferred:

```bash
cp .env.example .env
```

Keep `.env` private. Official API endpoints are used when the corresponding
`*_BASE_URL` value is empty. Compatible relay endpoints can be supplied
explicitly when required.

## Start

Launch the interactive Pi TUI from any project directory:

```bash
seekbrain
```

The CLI starts the package dependency's Pi executable with `process.execPath`
and explicitly loads the SeekBrain extensions. It does not require a global
`pi`, `.tools/node`, or a repository shell launcher.

For a non-interactive run:

```bash
seekbrain run \
  --query "Your research question" \
  --dataset /path/to/dataset-or-metadata.json \
  --work-dir results/example
```

Run `seekbrain -h` for SeekBrain options. Pass advanced Pi options after `--`,
for example `seekbrain -- --model provider/model`.

Resume a saved SeekBrain conversation with either form:

```bash
seekbrain resume <session-id-or-path>
seekbrain --session <session-id-or-path>
```

The exit hint uses the same SeekBrain command, so resuming preserves the
SeekBrain extensions, prompts, tool allowlist, and project configuration.

## Workflow

The main workflow follows these evidence dependencies:

```text
dataset profiling (when given a directory) → Deep Research → recipe
                                            → analytical formulation
                                            → code generation and execution
                                            → validation → optional figure refinement
                                            → result interpretation
```

## First-time setup

Run the guided setup once after installation:

```bash
seekbrain setup
```

The wizard runs inside Pi's interface and uses arrow-key selectors. It configures
one mainstream provider (Anthropic, OpenAI, or Google Gemini), its API key, and
either the official endpoint or an optional relay URL. API keys are entered with
masked input and persisted by Pi; SeekBrain YAML never contains credentials.

After model routing, setup asks for one literature provider:

- Semantic Scholar - `https://api.semanticscholar.org/graph/v1`
- PubMed/PMC - `https://eutils.ncbi.nlm.nih.gov/entrez/eutils`
- Shanghai AI Lab Paper RAG
- None

Setup validates the selected endpoint before saving it. Semantic Scholar and
PubMed keys are stored separately in
`~/.config/seekbrain/literature-credentials.json` with mode `0600`; YAML contains
only the provider selection and credential reference. A Semantic Scholar `429`
after the bounded retry is reported as a reachable rate-limited endpoint rather
than exposing or discarding the credential.

Semantic Scholar and PubMed use their displayed official URLs directly, so
setup proceeds from the provider choice to API-key entry. Shanghai AI Lab keeps
an editable Base URL because it is commonly self-hosted. Advanced endpoint
overrides remain available in SeekBrain YAML.

Running `seekbrain setup` again detects the saved model routing, literature
provider, and protected credential. Accepting the recommended reuse choices
keeps them without asking for either API key again. An explicit setup command
exits after saving; it does not open a new SeekBrain session.

Setup requires one vision-capable Core model and optionally asks for a separate
vision-capable Fast model. The routing preserves the research workflow split:

```text
Core: main, analysis recipe, Deep Research, analytical formulation, Code Agent, Validation Agent, Interpretation Agent
Fast: figure refinement, default helpers
```

Choosing no Fast model routes every stage through Core. A first interactive
`seekbrain` launch starts this wizard automatically when no authenticated Core
model exists. Non-interactive `seekbrain run` exits with an instruction to run
`seekbrain setup` instead of waiting for terminal input.

The guided path deliberately keeps Core and Fast on the same provider. Advanced
users can add providers through Pi and override individual `agents.*.provider`
and `agents.*.model` entries in the user or project SeekBrain configuration.

The order is intentional: conclusions must consume validated numerical and
visual artifacts rather than unverified model output. Run state and artifacts
are written under the selected `work_dir`; do not edit `state.json` manually.

Useful interactive commands include:

```text
/seekbrain                 activate/reset the workflow widget
/seekbrain-show research  inspect the full Deep Research background
/seekbrain-show recipe    inspect the selected analysis recipe
/seekbrain-save-recipe    save a validated run as an analysis recipe
```

## Configuration

Provider-neutral package defaults live in `config/default.yaml`. User overrides
live in `~/.config/seekbrain/config.yaml`; project overrides live in
`seekbrain.config.yaml` or a path passed with `--config`. Credentials belong in
environment variables or Pi auth storage, never in YAML configuration.

Use the following commands when you need to inspect or override the generated
configuration. `config init --user` is not required after `seekbrain setup`:

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

The package default remains in `config/default.yaml`; `config set` writes only
the selected override to the user configuration by default. Add `--project` to
write the sparse override to `<project>/seekbrain.config.yaml`. These commands
perform local YAML reads/writes only and add no work to normal research runs.

Layers merge by field in this order: package defaults, user configuration,
project configuration, then explicit command-line arguments. `agents.seekbrain`
selects the main Pi provider/model/thinking level; `agents.seekbrain_default`
supplies defaults inherited by workflow subagents. For example:

```yaml
agents:
  seekbrain:
    provider: your-provider
    model: your-model
    thinking: high
```

An explicit launch such as `seekbrain -- --model provider/model` overrides the
configured main model for that invocation.

Users may provide either existing metadata JSON or just a dataset directory.
For a directory, the Data Analysis Agent profiles only that explicit root,
creates factual metadata, and stores the dataset profile under
`~/.seekbrain/datasets/<dataset-id>/metadata.json`. Later runs using the same
canonical directory reuse that metadata instead of invoking the agent again.
Each research round also records `dataset_meta_snapshot.json` for provenance.
Set `paths.dataset_cache` in SeekBrain YAML or
`SEEKBRAIN_DATASET_CACHE_ROOT` to relocate the cache. Regeneration is available
through the `seekbrain_data_resolve` tool's explicit `refresh` option.

SeekBrain does not ship a literature service. Select Semantic Scholar,
PubMed/PMC, Shanghai AI Lab Paper RAG, or None during setup. With None, trajectory
and expert recipe matching remains available, while Research Survey, Deep
Research, and Recipe Crystallization are disabled; the scientific
workflow continues without global literature context.

Semantic Scholar and PubMed/PMC results are enriched from PMC when possible.
Associated paper repositories can produce repository-backed analysis recipes. When no
valid paper repository exists, SeekBrain may crystallize a paper-only recipe with no
`scripts/` directory; dependencies and merely cited repositories are excluded.
Shanghai AI Lab keeps its existing `/queryfull` behavior. Project-local and user
analysis recipes are discovered under `.seekbrain/skills`.

The package bundles the trajectory recipe library and materializes it lazily on
the first recipe-retrieval call. Analysis Recipe storage is unified under:

```text
~/.seekbrain/skills/
├── builtin/trajectory/<seekbrain-version>/
├── from_rag/
└── from_expert/
```

The resolver first performs model-assisted matching against trajectory recipes
and loads the selected recipe document (`SKILL.md`) plus filtered script resources. Only a miss
queries the selected literature provider. Crystallized literature recipes are
persisted in `from_rag`, so the same question/evidence folder is reused on later
runs. Set
`SEEKBRAIN_SKILLS_ROOT` to relocate this user-owned recipe root.

External literature responses use a restart-safe cache at
`~/.cache/seekbrain/literature-cache.json`. Set
`SEEKBRAIN_LITERATURE_CACHE` to choose another cache file. Cache files contain
normalized responses, never API keys or authorization headers.

## Development

Use Node 24 for the same checks as CI:

```bash
npm run doctor
npm run typecheck
npm run test
npm run audit:opensource
npm run pack:check
```

Architecture and migration records are in `docs/architecture/`. See
`CONTRIBUTING.md` for change and validation expectations.

## Security and licensing

Do not commit `.env`, Pi authentication state, datasets, generated results, or
service credentials. See `SECURITY.md` for private vulnerability reporting and
`THIRD_PARTY_NOTICES.md` for direct dependency license metadata.

SeekBrain is licensed under the MIT License. See `LICENSE`.

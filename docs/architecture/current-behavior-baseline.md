# Phase 0/1 behavior baseline

Captured on 2026-07-20 from the local SeekBrain tree before the OSS refactor,
then updated only for the intentional SeekBrain namespace and entrypoint changes
made in Phase 0/1.

The standalone-package refactor began on 2026-07-21. Its Phase 0 adds a root
`seekbrain` bin while deliberately delegating real launches to the existing
launcher until direct package-owned Pi startup is implemented. During this
transition, `seekbrain -h` and `seekbrain --help` are frozen as equivalent,
side-effect-free commands, and `seekbrain --version` reports the package version.

Phase 1 moved the active, tested source boundary to `src/core`, `src/workflows`,
`src/extension`, and `src/cli`. The root manifest no longer declares npm
workspaces, declares the Pi extension at `src/extension/index.ts`, and excludes
the legacy `packages/` tree from the release tarball. Shell startup and external
prompt/config paths remain transitional until Phases 2 and 3.

Phase 2 replaced the transitional shell delegation with a package-owned Node
CLI. `seekbrain` now launches the dependency's Pi CLI through
`process.execPath`, explicitly loads `src/extension/index.ts`, preserves the
caller's cwd as the project root, and
forwards advanced Pi arguments only after `--`. The npm tarball no longer ships
`pi_run_seekbrain.sh`, `internagent/workflow/seekbrain.sh`, or the legacy config
CLI. Prompt and default-config relocation remains Phase 3 work.

Phase 3 moved all runtime prompts to `prompts/`, deterministic edit/validation
policies to `src/workflows/seekbrain`, and provider-neutral defaults to
`config/default.yaml`. Runtime configuration now layers package defaults, user
config, project `seekbrain.config.yaml`, environment values, and runtime
overrides. `PACKAGE_ROOT`, `PROJECT_ROOT`, and optional `SEEKBRAIN_RUN_ROOT` are
kept distinct. The release tarball no longer contains root `config.yaml` or
`extensions/seekbrain`.

Phase 4 replaced the InternAgent Python control plane with package-owned
TypeScript modules under `src/targeted-skill`. Targeted-skill matching and the
repository-backed generation fallback are enabled again; a missing Paper RAG
URL returns a structured no-match instead of stopping the workflow. Saving a
skill now writes to `<PROJECT_ROOT>/.seekbrain/skills` by default and rebuilds
that directory's index. Usage aggregation remains in the TypeScript
observability service. The root `internagent/` directory has been removed.
Python is retained only for generated scientific analysis code and is resolved
through `SEEKBRAIN_PYTHON`, then `python3`, then `python`.

## Runtime and tests

- Primary validation runtime: Node.js 24.18.0.
- The system `node` executable is Node.js 16.14.0 and is not a valid test
  runtime for the current Pi dependencies.
- Unit and contract checks pass under Node.js 24.18.0.
- `tests/seekbrain-contract-baseline.mjs` adds the characterization boundary used
  during the refactor.

## Active entry surface

`src/extension/index.ts` is the single package-owned Pi entry. `/seekbrain`
activates the Level 1 workflow; the former `/neuro` level selector and Level 2
implementation were intentionally removed from the standalone product.

## SeekBrain contract

The current SeekBrain implementation registers 21 tools:

1. `neuro_ping`
2. `neuro_capabilities`
3. `neuro_start_research`
4. `neuro_continue_research`
5. `neuro_start_run`
6. `neuro_resume_run`
7. `neuro_approve_stage`
8. `neuro_record_feedback`
9. `neuro_review_plan`
10. `neuro_update_plan`
11. `neuro_review_code_edit`
12. `neuro_propose_code_update`
13. `neuro_review_code_update`
14. `resolve_targeted_skill`
15. `neuro_deep_research`
16. `neuro_plan`
17. `neuro_code`
18. `neuro_validate`
19. `neuro_refine_image`
20. `neuro_analyze_image`
21. `neuro_conclude`

The characterization test stores a SHA-256 fingerprint of every tool parameter
schema. A deliberate schema change must update the corresponding fingerprint
and be reviewed as a compatibility change.

## Initial run state and layout

Calling `neuro_start_run` creates:

```text
<work_dir>/
├── state.json
└── subagents/

<cwd>/.pi/seekbrain/run_index.json
```

The initial state fields are `schema_version`, `run_id`, `run_dir`, `created_at`,
`artifacts`, `deliverables`, and optional persisted `question`. Phase 2 assigns
`schema_version: 2`; older state files are migrated on load. The default
deliverables are:

- `generated_code.py` (`code`)
- `figure.png` (`figure`, role `main`)
- `figure.pdf` (`figure`, role `main_pdf`, optional)
- `statistics.json` (`statistics`)

Later stages additionally use stable artifact names including `plan.md`,
`exec.log`, `validation.json`, `conclusions.json`, `deep_research_context.md`,
`deep_research_sources.json`, and per-figure Markdown files below
`image_analyses/`.

## Validation command

Run every current characterization check with Node.js 24:

```bash
nvm exec 24 npm run test:contract
```

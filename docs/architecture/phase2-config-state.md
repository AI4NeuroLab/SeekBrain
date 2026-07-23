# Phase 2: configuration and run state

Phase 2 establishes one validated configuration path and one persistence boundary
for `state.json`. It intentionally preserves the existing `neuro_*` tools, run
layout, deliverable names, and workflow behavior.

## Configuration

`src/core/config/config-loader.ts` is the only YAML merge and validation
entry. Precedence is:

```text
built-in defaults
  < ~/.config/seekbrain/config.yaml (or SEEKBRAIN_USER_CONFIG)
  < project seekbrain.config.yaml
  < SEEKBRAIN_* path environment variables
  < constructor overrides
  < runtime overrides
```

The result is validated against the TypeBox schema and deeply frozen. The Pi
extension and package-owned CLI use this implementation; the former Python
YAML/config helper, shell launcher, deploy script, and baked extension
`config.json` have been removed. `seekbrain config show` and
`seekbrain setup`, `seekbrain config show`, and
`seekbrain config init --user|--project` are the public configuration surface.
The Pi-native setup flow delegates credential persistence to Pi, configures one
provider with same-provider Core/Fast routing, and writes only that routing into
SeekBrain YAML. Cross-provider overrides remain available through normal user or
project configuration; setup does not implement another merge policy.

## Run state

`FileRunRepository` owns creation, loading, mutation, and event append operations.
For each run it:

- serializes concurrent updates in process;
- writes snapshots through a sibling temporary file, `fsync`, and atomic rename;
- persists `schema_version: 2`, `run_id`, and `run_dir`;
- migrates camelCase identifiers and legacy artifact maps on load;
- appends optional diagnostic events to `events.jsonl`.

The active extension routes run creation, resume, load, and state mutation through
this repository. Non-state artifacts and project/run indexes remain separate and
will move behind the Phase 3 artifact boundary.

## Verification

Use Node.js 24:

```bash
npm run typecheck
npm test
npm run test:e2e
```

Unit coverage includes config precedence and validation, deep immutability, agent
inheritance, v1-to-v2 migration, atomic writes, and concurrent state mutations.
Contract coverage verifies that tool schemas, initial state/layout, launchers, and
the Node configuration adapter remain compatible.

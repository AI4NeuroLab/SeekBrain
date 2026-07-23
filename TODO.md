# SeekBrain TODO

## Deferred phases

- [ ] Phase 6: open-source release readiness — planned but intentionally
  deferred until the maintainer explicitly asks to start it.
  - Resolve the trajectory `references/matched_files` publication boundary.
  - Reassess the Pi shrinkwrap security findings.
  - Finalize license/notices, inspect the release tarball, and repeat global
    install/CLI acceptance checks.
  - Do not publish to npm, create tags, or push release changes without
    explicit maintainer authorization.

## Release blockers

- [ ] Define and implement the npm publication boundary for bundled trajectory
  `references/matched_files` snapshots.
  - The snapshots currently contain third-party authors' absolute machine paths,
    so `npm run audit:opensource` fails even though runtime behavior is unaffected.
  - Decide whether to exclude `references/matched_files` from the npm tarball or
    sanitize those paths while retaining the snapshots and their provenance.
  - Re-run `npm run audit:opensource`, `npm run pack:check`, and package E2E after
    the decision is implemented. Do not silently delete the source trajectory
    references before their runtime and provenance value is reviewed.
  - The audit also sees local `.pi/seekbrain` run indexes and an absolute path in
    `docs/architecture/parallel-research-execution-reporting-plan.md`; exclude
    runtime indexes from source audits and sanitize that legacy planning note
    during the deferred Phase 6 release cleanup.

- [ ] Clear the two remaining production `npm audit` findings shipped inside
  the Pi `0.80.10` npm shrinkwrap (last checked 2026-07-21).
  - Resolved locally: `diff` is pinned to `8.0.4`; `yaml` is pinned to `2.9.0`.
  - Upstream-blocked: Pi still installs `brace-expansion 5.0.6` (high) and
    `protobufjs 7.6.4` (moderate) inside its private dependency tree.
  - Pi's declared ranges accept fixed versions `5.0.7` and `7.6.5`, but its
    published `npm-shrinkwrap` prevents root `overrides` and `npm dedupe` from
    replacing them. Upgrade once Pi publishes a refreshed package; do not use a
    postinstall mutation or repacked third-party tarball for a public release.

## Startup performance

- [ ] Validate and optimize `seekbrain` startup time before release.
  - Baseline measured on 2026-07-21: the current linked development install
    starts in about 7.86 seconds; `seekbrain -h` takes about 0.20 seconds.
  - Primary cause: the global `seekbrain` link resolves back to this repository
    on the `virtiofs` shared volume, where the repository-local Pi takes about
    6.8 seconds even for `--version`. The same Pi `0.80.10` installation on the
    machine-local filesystem takes about 0.88 seconds.
  - SeekBrain's TypeScript extensions add about 0.4-0.5 seconds; Pi TUI
    initialization adds about 0.14-0.16 seconds. Offline and online startup
    measurements were effectively identical, so model API, Deep Research, RAG,
    and model-catalog networking are not the current bottleneck.
  - First validate a real packed/global npm installation on a local filesystem;
    the current comparison predicts roughly 1.5-2 seconds with the existing
    extension behavior.
  - Then consider compiling the extension entrypoint to `dist/*.js`, removing
    startup-only `export *` imports, and lazy-loading setup/review/runtime modules
    that are not needed for the first render.
  - Consider adding a supported startup profiler command that reports CLI, Pi,
    extension, and TUI timing separately.
  - If development must continue from shared storage, evaluate using an already
    installed local Pi only with an explicit, strict version-compatibility check.

## External release actions

- [ ] Review the generated pack manifest.
- [ ] Decide whether the release target is a source release or an npm package.
- [ ] Create `v0.1.5-rc.1` for prerelease validation if needed.
- [ ] Create `v0.1.5` only after all release blockers are closed.
- [ ] Push tags or publish packages only with explicit maintainer approval.

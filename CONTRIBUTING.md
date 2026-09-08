# Contributing to SeekBrain

## Development setup

Use Node.js 24 when possible. Install dependencies with `npm install`, copy
`.env.example` to `.env` only when live-provider testing is required, and run
`npm run doctor` to verify the local runtime.

## Change boundaries

- Scientific state transitions belong in `src/workflows`.
- Filesystem, configuration, and artifact primitives belong in `src/core`.
- Pi commands, UI, event hooks, and tool registration belong in
  `src/extension`.
- `src/extension/index.ts` is the only published Pi extension entry and should
  remain a thin composition boundary.
- `BrainArena/` contains benchmark queries, rubrics, paper references, and
  data-link metadata only. Do not add evaluation code, source-paper figures,
  paper PDFs, or research data files there.
- Historical launchers, experimental extensions, raw evaluation datasets, and
  archived implementations do not belong in this repository.

Preserve existing user changes in a dirty worktree. Never commit credentials,
runtime state, datasets, generated results, or machine-specific absolute paths.

## Validation

Before proposing a change, run:

```bash
npm run typecheck
npm run test
npm run audit:opensource
npm run pack:check
```

Behavior changes should include a unit or contract test. Architecture boundary
changes should also update the relevant document under `docs/architecture/`.

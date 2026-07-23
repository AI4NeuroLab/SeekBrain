# Phase 3: artifact and integration boundaries

Phase 3 isolates filesystem artifacts, observability files, and Pi SDK sessions
without changing the `neuro_*` tool contract or replacing third-party runtimes.

## Artifact boundary

`ArtifactService` is the canonical normalizer for current artifact arrays and
legacy artifact maps. It owns kind inference, absolute run-local paths, merge by
path, and artifact construction.

`PathPolicy` rejects lexical traversal, absolute paths outside the run, and paths
that escape through an existing symlink. Tool-provided artifact, figure, code,
and statistics paths therefore cannot write outside their run directory.

## Pi SDK boundary

`ExistingPiAgentAdapter` is the only active location that creates an isolated Pi
agent session. It preserves the existing behavior for:

- custom finalize tools and output schemas;
- tool allowlists;
- custom and built-in model lookup;
- thinking level, images, timeout, and abort signals;
- session events, stats, disposal, and failure text.

The adapter deliberately wraps the installed Pi SDK. It does not copy or replace
Pi internals. The former `@pi-archimedes/diff` dependency was
removed; the review renderer uses public `diff` output and Pi TUI APIs.

## Observability sinks

`FileUsageSink` serializes concurrent usage updates and writes the existing
per-component JSON and aggregate `summary.json` formats. `FileDiagnosticSink`
owns best-effort JSON, text, JSONL, directory, and snapshot-copy writes. Unsafe or
failed diagnostic writes become structured `diagnostic_write_failed` warnings
instead of failing the workflow.

These files remain controlled by `workflow.debug_disk_writes`. Runtime artifacts
and `state.json` are not treated as optional diagnostics.

## Frozen compatibility

- Pi coding agent resolved by the current lockfile: `0.80.10`

The doctor command verifies the frozen direct integrations are installed. A
contract test prevents `createAgentSession` from moving back into the workflow
extension and prevents imports of third-party internal source modules.

## Verification

Run with Node.js 24:

```bash
npm run typecheck
npm test
npm run doctor
npm run test:e2e
```

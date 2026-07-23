# Phase 5: UI, commands, and deduplication

Phase 5 reduces the active extension to dependency assembly, tool registration,
and explicitly Pi-owned adapters. Scientific behavior remains frozen in the
workflow package.

Completed on 2026-07-21 for the standalone Level 1 package boundary.

## Migration status

| Slice | Status | Boundary |
| --- | --- | --- |
| runtime event hooks | complete | `src/extension/runtime-hooks.ts` |
| slash commands | complete | system/show/save-skill modules with injected services |
| TUI overlays and diff renderers | complete | show/review selectors and lazy diff adapters |
| InternAgent duplicate source | complete | duplicate Python/Pi control planes removed after migration |
| extension composition entry | complete | one package-owned public entry plus thin composition entry |

Runtime hooks now own session lifecycle, active-run tracking, usage/readable-log
events, transparency cards, compaction context, and the dummy-data tool-result
warning. The main extension injects config, state, and observability functions
without registering events inline.

Research and targeted-skill transparency cards use durable custom entries with
package-owned Markdown renderers. They are appended synchronously from
`tool_execution_end`, so Pi renders each card beside its completed tool instead
of queuing a streaming `sendMessage` until the next tool boundary. Custom card
entries are display-only and are not steered back into the model context.

The former `internagent/`, `deprecated/`, and duplicate extension trees are no
longer present. `tests/deprecated-boundary.mjs` and package allowlist checks
prevent those directories from re-entering the active or published product.
The intentionally removed Level 2 workflow is outside the standalone Level 1
SeekBrain contract.

`src/extension/index.ts` is the sole Pi extension entry. It owns the compact
Level 1 workflow widget and delegates tool composition to
`src/extension/seekbrain-extension.ts`; that module delegates runtime assembly
to `seekbrain-runtime.ts`. Commands, event hooks, and TUI review adapters remain
separate modules rather than duplicate inline registrations.

## Verification

- TypeScript typecheck passed on Node.js 24.18.0.
- 49 unit tests passed.
- All package and workflow contract tests passed.
- The npm allowlist check passed with 920 files.
- The tarball installed globally in a temporary prefix and launched
  package-owned Pi resources outside the source tree.
- `npm run audit:opensource` remains blocked only by third-party trajectory
  `references/matched_files` snapshots containing upstream absolute paths; the
  publication decision is tracked in `TODO.md` and does not affect runtime.

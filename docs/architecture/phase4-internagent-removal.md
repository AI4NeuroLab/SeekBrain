# Phase 4: InternAgent removal

Completed on 2026-07-21.

## Result

The npm package control plane no longer starts Python subprocesses. The former
InternAgent responsibilities now map to:

| Responsibility | Package module |
| --- | --- |
| skill matching and fallback | `src/targeted-skill/resolver.ts` |
| Paper RAG HTTP client | `src/targeted-skill/rag-client.ts` |
| SMMT normalization | `src/targeted-skill/taxonomy.ts` |
| skill authoring | `src/targeted-skill/skill-writer.ts` |
| skill index generation | `src/targeted-skill/indexer.ts` |
| usage aggregation | `src/core/observability/file-usage-sink.ts` |

`internagent/` was deleted after the new unit and compatibility contracts
passed. It is also forbidden by the npm pack allowlist.

## Compatibility boundary

The targeted-skill result keeps the established fields: `ok`, `matched`,
`source`, `targeted_skill`, `skill_paths`, `reference_paths`, `generated`,
`warnings`, `trace_id`, and optional trace artifacts. Paper RAG continues to
POST to `/queryfull`; no URL or no repository-backed source degrades to a
structured no-match.

The historical skill flow is preserved: model-assisted matching loads the
bundled trajectory `SKILL.md` and filtered script resources first; only a miss
queries Paper RAG. Repository-backed generated skills retain `SKILL.md`,
scripts, provenance references, matched repository files, `metadata.json`, and
the parent `INDEX.md`. Repeated question/repository folders are reused.
Generation scans supported scientific sources (including Jupyter notebooks),
then runs a separate paper/repository context pass that selects exact files,
records paper-to-code mapping and gaps, and produces a reproduction plan before
the final Skill and scripts are authored. These intermediate products persist
below `references/`.

As of `0.1.4`, all 66 bundled trajectory skills use the canonical `scripts/`
resource directory. Thirty historical `code/main.py` resources were moved to
`scripts/main.py`, so the original loader convention and the packaged seed no
longer disagree. The versioned user path ensures existing `0.1.3` material is
not mistaken for the normalized seed.

To support launches from any cwd, the package's read-only trajectory seed is
materialized under `~/.seekbrain/skills/builtin/trajectory/<package-version>`.
RAG skills persist under `~/.seekbrain/skills/from_rag`; expert skills use
project or user `from_expert` overlays. `SEEKBRAIN_SKILLS_ROOT` can relocate the
unified user root.

## Python boundary

Generated scientific `.py` files still execute as Python. Runtime resolution is:

1. `SEEKBRAIN_PYTHON`
2. `python3`
3. `python`

If none is available, the Code-stage rerun returns an actionable structured
error. Skill lookup, HTTP, configuration, state, and authoring do not require
Python.

## Verification

```bash
npm run typecheck
npm test
npm run pack:check
npm run test:e2e
```

After the trajectory and structured RAG compatibility follow-up: 49 unit tests
passed, all contract tests passed, the tarball contained 920 allowlisted files
(including the 66 bundled trajectory skills) and no `internagent/`, and a
temporary global install launched package-owned Pi resources successfully.

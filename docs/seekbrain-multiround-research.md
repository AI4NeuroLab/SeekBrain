# SeekBrain multi-round research

New interactive SeekBrain work uses one stable research-project directory:

```text
results/default/research-20260713-163000-a1b2c3d4/
├── project.json
├── round1/
│   ├── state.json
│   ├── conclusions.json
│   └── ...artifacts
├── round2/
│   ├── state.json
│   └── ...artifacts
└── round3/
    └── ...
```

Use `neuro_start_research` for round 1. It locks `data_info`,
`extra_path_info`, and `metadata_json_path` in `project.json`.

At conclusion time, `conclusions.json` includes 1–3
`next_research_directions`. The main agent summarizes them but does not start
more work until the user chooses one or supplies a different direction.

Use `neuro_continue_research` with either the project directory or any round
directory. It creates the next numbered round, inherits canonical metadata,
and records the chosen source round. Prior conclusions and artifact paths are
available through `state.json.inherited_context` as read-only inputs. New
analysis outputs must remain in the new round.

The continuation tool does not depend on the in-memory run index, so a project
or round path can be resumed in a later shell session or on another day.

For a presentation-only edit to an earlier figure, identify the exact round
directory and use its `state.json` artifact paths in the normal reviewed code
edit flow. Scientific changes to filtering, statistics, or interpretation are
not presentation revisions; they should create a new research round.

`neuro_start_run` and `neuro_resume_run` remain available for existing
single-run/headless workflows. Existing legacy directories are not moved or
rewritten automatically.

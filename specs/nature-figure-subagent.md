# Nature Figure Subagent

Date: 2026-07-13

## Invocation

```text
/run nature.figure <request>
```

The agent loads the unchanged project copy of the upstream `nature-figure`
skill from `.pi/skills/nature-figure/`.

## Modes

The agent has two modes:

- `revision`: an existing figure has identifiable generating code. Level 1,
  user-provided code, and previous Nature Figure outputs are context sources,
  not separate modes.
- `creation`: no editable figure/code pair exists and the user requests a new
  plot, multi-panel figure, schematic, or graphical abstract.

## Revision authorization

Explicit invocation authorizes the child agent to modify and execute the
target figure's generating code. This delegated path does not use the
main-agent `neuro_propose_code_update` / `neuro_review_code_update` approval
gate. The main-agent gate remains mandatory when the main agent itself prepares
a post-run code edit.

Before the first mutation, the child must call:

```text
python3 .pi/agents/nature/scripts/figure_revision.py begin \
  --work-dir <dir> --figure <figure> --code <code> --request <summary>
```

The helper creates a code-path lock and stores the currently active code plus
related generated artifacts directly under
`<work-dir>/figure_revisions/<revision-id>/`. The child then overwrites the
active code and figure paths in place without changing their filenames.

Before mutation, the child classifies the revision as `fast` or `standard`.
`fast` is limited to one explicit, local, deterministic presentation parameter
on one resolved figure/code pair—for example an exact title/label string, color,
font size, line width, or marker size—with no data, statistics, filtering,
normalization, panel structure, layout geometry, export, or scientific-meaning
change. Ambiguity, warnings, missing dependencies, or prior failures force the
`standard` path.

A `fast` revision performs exactly one edit and one execution, skips image
reading and visual review, verifies only successful execution plus regenerated,
non-empty expected exports, then calls `finish --iterations 1`. A failed
deterministic check rolls back without retry. A `standard` revision reads the
new image after every execution and may iterate edit, execute, and visual
inspection at most three times before finishing or rolling back. Reports must
identify the complexity class and must not imply visual inspection for the fast
path. Fast revisions use only a minimal semantic/output-path precheck; the full
Figure Contract and reviewer-risk analysis remain on the standard path.
Creation mode continues to require visual inspection.

The agent must stop before silently changing scientific analysis semantics such
as filtering, normalization, statistics, sample definitions, or analysis
windows. Revision mode creates no QA file, code diff, hash report, or execution
log.

## Level 1 discovery

Interactive Level 1 start/resume writes:

```text
.pi/neuroscientist-level1/current_run.json
```

The pointer contains only `run_id` and `run_dir`. Nature Figure then reads that
run's live `state.json`, resolves figures through `state.artifacts`, and follows
`produced_by` to the generating code. Headless Level 2 calls do not overwrite
the interactive current-run pointer.

The historical `run_index.json` must not be used to guess the current figure.
If several figures are plausible, the agent asks the user to choose.

## Revision artifacts

```text
figure_revisions/<revision-id>/
├── generated_code.py       # previous active code
├── figure.png              # previous active exports
├── figure.pdf
├── figure.svg              # when it existed
├── revision.json
└── failed_candidate/       # only after rollback
```

The run root always contains the latest active code and outputs, so the Level 1
artifact index stays valid. A later revision first archives that latest version
under a new revision id, producing a linear history. `finish` records active
status and iteration count without making another artifact copy. Rollback
restores every archived path.

## Creation mode

Creation mode follows the upstream skill without Level 1 overrides, with one
async-safety adaptation:

- explicit Python/R choices and saved preferences retain precedence;
- when neither exists, the asynchronously launched agent selects Python as the
  project default, persists it with `nature_figure_backend.py set python`, and
  continues instead of pausing for a question that the detached child cannot
  reliably ask;
- separate explicit OpenRouter AI-schematic route;
- Figure Contract before drawing;
- selected-backend-only plotting, preview, export, and QA;
- publication code, editable vector output, raster preview, source-data
  mapping, and QA notes when applicable.

An explicit request to create, generate, draw, or render is execution approval.
Exploratory requests or scientifically important missing choices stop at a
contract/question before generation.

## Model and runtime

The wrapper uses `llm-proxy/gemini-3.1-pro-preview` with low thinking because
revision mode requires image inspection. It has `read`, `write`, `edit`, and
`bash` tools. Its tool-call budget nudges finalization at 45 calls and blocks
further discovery-oriented calls after 80. Project-level pi-subagents
configuration runs top-level invocations in the background by default.

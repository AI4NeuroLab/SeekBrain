# Research Planning Runtime and UX Hardening Plan

Status: accepted for implementation
Scope: current SeekBrain package repository only

## Objective

Make Research Planning observable and reviewable without adding Scheduler or
multi-task overhead to the ordinary SeekBrain workflow. Correct the project
layout so planning is not represented as an analysis round, and make Reporter
generation reliable and traceable.

## Confirmed problems

1. `seekbrain_research_start` eagerly creates `round1` before the route is known.
   A Research Planning parent therefore owns an analysis round that never runs
   the ordinary Skill-to-Interpret spine.
2. The final research-tree selector reports only counts and Reviewer status.
   It does not show the scientific subquestions or terminal tasks being
   approved.
3. `seekbrain_execution_run` waits for its full `Promise.all` batch. Skill,
   Deep Research, and Plan work is hidden, and the first completed Plan cannot
   be reviewed while other Plans continue preparing.
4. A queued task-Plan selector shows the task question but no useful summary
   of its hypothesis, analysis strategy, outputs, or validation target.
5. `seekbrain_execution_tasks_run` exposes only the final batch result. Users
   cannot see which task is in Code, Validate, Refine, or Interpret.
6. Reporter treats PNG and PDF variants as separate scientific figures and
   attempts to attach PDF bytes as `image/png`. The observed report attempts
   did not reach `finalize_seekbrain_report` and left no durable failure record.

## Target project layout

```text
research-<id>/
├── project.json
├── planning/
│   ├── state.json
│   ├── dataset_meta_snapshot.json
│   ├── events.jsonl
│   ├── research_planning_assessment.json
│   ├── research_plan/
│   └── usage/
├── execution/
├── research_tasks/
│   ├── SQ1-T1/round1/
│   └── SQ2-T1/round1/
├── reports/
└── round1/                 # created only for the ordinary workflow
```

Legacy projects with `round1/research_plan/` remain readable. No existing
result directory is rewritten.

## Work packages

### WP1 — Reporter correctness and diagnostics

- Treat same-stem PNG/PDF artifacts as one semantic figure.
- Prefer a supported raster file as the canonical visual attachment.
- Retain PDF as a supplemental asset without attaching it to the model.
- Reject unsupported visual MIME types instead of defaulting to `image/png`.
- Build attachment indexes from images actually attached to the request.
- Send compact selected evidence: question/context, Plan summary, Validation,
  Interpretation, statistics, data/table references, and canonical figures.
- Persist `report_error.json` with failure phase, error, attachment details,
  and finalize status.

Acceptance:

- The Koninck example compiles two task results as two scientific figures, not
  four file variants.
- No PDF is passed to the model as an image.
- A failed Reporter run leaves an actionable diagnostic artifact.
- Reporter unit and contract tests pass.

### WP2 — Research-tree review summary

- Derive a compact summary directly from the finalized tree.
- Show overall goal, each SQ question, each terminal Task title/action, the
  synthesis relation, Reviewer verdict, and unresolved issue count before the
  Approve/Revise/Cancel selector.
- Do not depend on a main-agent prose summary.

Acceptance:

- A user can understand the complete tree from the selector without opening
  JSON or Markdown.

### WP3 — Streaming task-Plan preparation and serialized review

- Replace batch-return review timing with a producer-consumer controller.
- Start bounded Plan workers concurrently.
- Publish Skill, Deep Research, and Plan lifecycle events per Task.
- Present the first ready Plan immediately while other workers continue.
- Queue later ready Plans in stable order.
- Preserve Approve, Revise, and Approve Remaining semantics. Approve Remaining
  also applies to Plans that become ready later.
- Revised Plans re-enter the planning queue without blocking unrelated Plans.

Acceptance:

- The first Plan can be reviewed before the last Plan completes.
- Plans prepared during a review wait in the serialized queue.
- Skill match and Deep Research summaries are visible per Task.

### WP4 — Task-Plan review content

- Include Task title/question, biological hypothesis, compact analysis
  strategy, expected outputs/evidence, warnings, and queue position.
- Reuse existing Task and Plan outputs; do not add another model call.

Acceptance:

- The selector provides enough information for a scientific approval decision
  without opening `plan.md`.

### WP5 — Live Research Task execution board

- Publish `code_started/completed`, `validation_started/completed`,
  `refinement_started/completed`, `interpretation_started`, `task_completed`,
  `task_blocked`, and `task_failed` events.
- Update an in-place per-Task board through the tool progress callback.
- Show retry attempt and concise reason when a Task returns to Code.
- Keep detailed payloads behind expanded output and in `events.jsonl`.

Acceptance:

- During concurrent execution, each Task visibly advances through
  Skill → Plan → Code → Validate → optional Refine → Interpret.
- Ordinary SeekBrain runs retain their current single-workflow UI.

### WP6 — Lazy round materialization

- Split project intake/planning state from analysis-round state.
- `seekbrain_research_start` creates the project and planning context first.
- Standard route or Research Planning No materializes ordinary `round1`.
- Research Planning Yes keeps the parent under `planning/` and creates only
  child Task rounds.
- Add legacy path resolution for existing projects.

Acceptance:

- A new Research Planning project has no parent `round1`.
- A new ordinary project still starts at `round1`.
- Resume, task materialization, report selection, and legacy projects work.

## Implementation order

1. WP1 Reporter correctness and diagnostics.
2. WP2 research-tree summary.
3. WP3 and WP4 task-Plan streaming/review content.
4. WP5 live execution board.
5. WP6 lazy round materialization and compatibility.
6. Full unit, contract, package, and open-source checks; update `TODO.md` for
   any deliberately deferred compatibility cleanup.

## Non-goals

- Do not add `pi-subagents`.
- Do not change the ordinary Skill → Plan → Code → Validate → Interpret spine.
- Do not automatically generate reports or include unselected evidence.
- Do not migrate or rewrite existing result directories.

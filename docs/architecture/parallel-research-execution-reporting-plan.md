# Parallel Research Execution and Reporting Plan

Status: implemented and verified

## 1. Objectives

This plan adds two capabilities:

1. Parallel execution of terminal tasks created by the Research Planning
   Engine, with one serialized human Plan-review queue.
2. User-triggered scientific reports generated from an explicit selection of
   completed normal rounds or Research Planning task rounds.

The design must not add orchestration cost to the normal SeekBrain workflow.
Parallel scheduling, task review queues, and task-project state exist only when
Research Planning is active. Report generation is lazy and runs only after an
explicit user request.

`pi-subagents` is out of scope for this implementation. SeekBrain owns the task
scheduler, task state, review queue, and report evidence contract.

## 2. Scope Boundaries

### 2.1 Normal SeekBrain workflow

The normal workflow remains:

```text
Skill -> Plan -> Code -> Validate -> Interpret
```

It does not initialize:

- a Research Task Scheduler;
- task child processes;
- a Plan-review queue;
- task manifests;
- Reporter model context.

The only reporting-related normal-path work is a small deterministic count of
completed rounds from the existing project manifest.

### 2.2 Research Planning workflow

Only an approved Research Planning tree activates:

- terminal task projects;
- parallel task execution;
- the centralized Plan-review queue;
- the parent execution board;
- task completion aggregation.

### 2.3 Reporter

The Reporter is never called automatically. A report may be suggested, but the
user must explicitly request one through chat, a slash command, or the CLI.

The Reporter uses exactly the results selected by the user. It must not infer
that an unselected round or research-tree branch should have been included, and
must not add coverage warnings for evidence the user did not select.

## 3. Project Layout

### 3.1 Normal multi-round project

```text
project/
  project.json
  round1/
  round2/
  round3/
  reports/
```

### 3.2 Research Planning project

```text
project/
  project.json
  round1/
    research_plan/
      draft_plan.json
      reviewer_critique.json
      orchestrator_response.json
      research_plan.json
      review_decision.json
      task_manifest.json

  research_tasks/
    SQ1-T1/
      project.json
      round1/
        state.json
        events.jsonl
        plan.md
        generated_code.py
        validation.json
        figure.png
        figure.pdf
        statistics.json
        interpretation.json
        conclusions.json
      round2/
        ...

    SQ1-T2/
      project.json
      round1/
        ...

    SQ2-T1/
      project.json
      round1/
        ...

  execution/
    scheduler.json
    review_queue.json
    events.jsonl

  reports/
    report-YYYYMMDD-HHMMSS/
      selection.json
      evidence_bundle.json
      report.json
      report.md
      report.pdf
      assets/
```

Each terminal task is a real multi-round child project. This allows one task to
continue to round2 or later without changing the identity of the task or mixing
its artifacts with another task.

Existing task directories under `round1/research_plan/tasks/<task-id>` require a
compatibility reader or one-time migration to the task-project layout.

## 4. Research Task Scheduler

### 4.1 Ownership

`ResearchTaskScheduler` is created only for an approved Research Planning run.
It is the sole writer of parent-level scheduling state.

Task workers write only within their own task-project round directory. They
publish events to the Scheduler instead of directly modifying the parent
`state.json` or task manifest. This prevents concurrent child completions from
overwriting one another.

### 4.2 Task state machine

```text
queued
  -> planning
  -> awaiting_plan_review
  -> approved
  -> executing
  -> validating
  -> interpreting
  -> complete
```

Additional terminal states:

```text
plan_revision_required
blocked
failed
cancelled
```

State transitions are persisted atomically. Restarting SeekBrain reconstructs
the execution board from task-project states and scheduler events.

### 4.3 Concurrency

Suggested defaults:

```yaml
workflow:
  seekbrain:
    research_planning: true
    research_execution:
      planning_concurrency: 3
      execution_concurrency: 2
```

These settings are read only when Research Planning is executing. They do not
affect normal SeekBrain runs.

Each task may optionally declare:

```json
{
  "resource_class": "cpu | memory | gpu",
  "exclusive_resource": ""
}
```

The effective concurrency is the minimum of the configured pool limit and the
available resource slots. GPU or other exclusive tasks may run with a slot
limit of one.

### 4.4 Failure isolation

One failed task does not cancel unrelated tasks. The Scheduler records the
failure and allows the user to retry, revise, or exclude that task from the
current execution. A task retry reuses its task-project identity and creates a
new round when scientific direction changes; a mechanical retry of the same
round preserves the existing round identity and event history.

## 5. Centralized Plan Review Queue

### 5.1 Planning behavior

Task Plan generation may run in parallel. A task worker stops after persisting
`plan.md` and emits `plan_ready`. It must not open its own TUI selector.

The parent review coordinator is the only component allowed to present task
Plan approval UI.

### 5.2 Queue state

`execution/review_queue.json` contains:

```json
{
  "policy": "manual",
  "items": [
    {
      "task_id": "SQ1-T1",
      "run_id": "...",
      "plan_path": ".../plan.md",
      "status": "ready",
      "ready_at": "...",
      "revision": 0
    }
  ]
}
```

Ready plans are ordered by `ready_at`. Revised plans re-enter at the end of the
ready queue so one difficult plan does not block review of unrelated tasks.

### 5.3 Review UI

Only one Plan is shown at a time:

```text
Review task plan SQ1-T1?

Task: <task title>
Queue: 1 of 4

Approve this plan
Request changes
Approve this and all remaining task plans
```

Semantics:

- `Approve this plan`: approve only the current Plan. The task becomes runnable,
  and the next ready Plan is shown.
- `Request changes`: collect feedback, start an isolated Plan revision, and move
  the revised Plan to the end of the queue when it is ready.
- `Approve this and all remaining task plans`: approve the current Plan and set
  the current Research Planning execution policy to `approve_remaining`.

`approve_remaining` applies only to the current Research Planning execution. It
does not modify user or project defaults. Later Plans still must satisfy schema,
data-grounding, and generation-success checks. Failed, malformed, or
data-infeasible Plans remain blocked rather than being auto-approved.

### 5.4 Queue and execution overlap

After an individual Plan is approved, its task may enter the background
execution pool while the user reviews the next Plan. The UI remains serialized;
only computation is parallel.

If no other Plan is ready, review exits to the execution board rather than
holding an empty selector open. A later `plan_ready` event produces a concise
notification and resumes the queue on user interaction.

## 6. Report Availability and User Trigger

### 6.1 Normal projects

- Completing round1 produces no Report suggestion.
- After round2 or a later round completes, SeekBrain may show a passive hint:

```text
2 completed rounds are available for synthesis.
Type "generate a report" or run /seekbrain-report when needed.
```

The hint performs no model call and does not create report files. A user may
still explicitly request a report containing only round1.

### 6.2 Research Planning projects

After the initial selected task set completes, SeekBrain may show a passive
hint that multiple task results are available. It must not prompt once per task.
Later task rounds may update the available-result count, but never start a
report automatically.

### 6.3 Explicit entry points

Supported entry points:

```text
generate a report
/seekbrain-report
seekbrain report <project-path> --rounds 3,4,6
```

Research Planning task-round selectors use stable references such as:

```text
SQ1-T1:R1
SQ1-T1:R2
SQ2-T1:R1
```

## 7. Evidence Selection

The user can select any completed results within one SeekBrain project.

Normal project example:

```text
[x] Round 1
[ ] Round 2
[x] Round 3
[x] Round 4
Generate report from selected results
```

Research Planning example:

```text
SQ1-T1
  [x] Round 1
  [ ] Round 2
SQ1-T2
  [x] Round 1
SQ2-T1
  [x] Round 1
```

Selection is authoritative. The evidence compiler and Reporter receive only the
selected results. Unselected rounds and task branches are not loaded, evaluated,
mentioned, or treated as missing evidence.

## 8. Reporter Input Contract

The Reporter must not crawl project directories itself. A deterministic
`ReportEvidenceCompiler` resolves the user's selection and creates a bounded,
immutable input package.

### 8.1 Selection manifest

`selection.json` records:

```json
{
  "project_id": "...",
  "report_goal": "Synthesize the selected findings",
  "selected_evidence": [
    {
      "evidence_id": "SQ1-T1:R2",
      "source_type": "research_task_round",
      "task_id": "SQ1-T1",
      "round_number": 2,
      "run_id": "...",
      "run_dir": "..."
    }
  ],
  "created_at": "..."
}
```

For normal rounds, `source_type` is `project_round` and `evidence_id` is
`ROUND:<n>`.

### 8.2 Evidence item

Every selected result is normalized to:

```json
{
  "evidence_id": "SQ1-T1:R2",
  "source_type": "research_task_round",
  "question": "...",
  "scientific_context": {
    "research_goal": "...",
    "subquestion": "...",
    "task_title": "...",
    "biological_hypothesis": "..."
  },
  "plan": {
    "path": ".../plan.md",
    "summary": "..."
  },
  "validation": {
    "path": ".../validation.json",
    "pass": true,
    "methodological_caveats": []
  },
  "interpretation": {
    "path": ".../interpretation.json",
    "summary": "...",
    "conclusions": [],
    "limitations": [],
    "confidence": 0.0
  },
  "statistics": {},
  "data_artifacts": [],
  "table_paths": [],
  "figures": []
}
```

Normal rounds use the same shape; Research Planning fields that do not apply are
empty. This keeps one Reporter implementation for both modes without placing
Research Planning machinery on the normal execution path.

### 8.3 Input discipline

The compiler must:

- load only selected, completed runs;
- reject stale paths or runs without durable state;
- use `state.json` artifact records rather than directory-wide globbing;
- deduplicate shared metadata and repeated artifacts;
- include concise metadata context rather than repeatedly embedding the full
  dataset JSON for every evidence item;
- preserve validation caveats and artifact warnings;
- assign stable machine figure IDs and deterministic human figure numbers;
- copy referenced assets into the report snapshot;
- attach only bounded, selected figures to the vision-capable Reporter;
- record any deterministic truncation in `evidence_bundle.json`.

The Reporter's scientific scope is the selected evidence set, not the entire
project history or entire Research Planning tree.

## 9. Reporter Agent

### 9.1 Reference implementation

The Reporter prompt should reasonably adapt the useful rules from:

```text
prompts/report.md
```

It must not copy the old Level 2 workflow assumptions wholesale.

### 9.2 Retained behavior

Retain these capabilities:

- semantic faithfulness and full traceability;
- the evidence catalog as the source of truth;
- deterministic figure numbering;
- actual inspection of attached figure images;
- correct single-panel and multi-panel legends;
- consistent Figure N and panel notation;
- 1-based scientific entity labels in prose;
- key claims tied to figure/panel, statistic or artifact, and an explicit
  reasoning relationship;
- conservative behavior when image analysis, validation, statistics, or figure
  evidence is unavailable;
- no fabricated references, statistics, tables, figures, or panels.

### 9.3 Removed assumptions

Do not require:

- a Level 2 run;
- a pre-generated question conclusion;
- all subquestions from a research tree;
- all rounds from a normal project;
- a separate subquestion-conclusion agent;
- evidence outside the user's selection.

The Reporter synthesizes a question-level conclusion directly from the selected
evidence items and produces the report in one model call.

### 9.4 Reporter prompt inputs

The model receives, in this order:

1. User report goal and optional title preference.
2. Project-level question and background applicable to the selected evidence.
3. Selection manifest.
4. Normalized selected evidence items.
5. Figure catalog and authoritative figure index.
6. Evidence notes, validation caveats, and artifact warnings belonging to the
   selected items.
7. Attached selected figures with an explicit attachment-order map.

The model does not receive unselected rounds, unselected tasks, or a list of
unselected branches.

### 9.5 Output contract

```json
{
  "title": "...",
  "abstract": "...",
  "question_level_conclusion": "...",
  "sections": [
    { "heading": "...", "body": "..." }
  ],
  "figure_legends": [
    {
      "figure_id": "...",
      "figure_number": 1,
      "title": "...",
      "caption": "...",
      "panels": [
        { "label": "A", "description": "..." }
      ]
    }
  ],
  "key_claims": [
    {
      "claim": "...",
      "evidence_ids": ["SQ1-T1:R2"],
      "figure_id": "...",
      "panel": "A",
      "data_source": "...",
      "reasoning": "..."
    }
  ],
  "limitations": [],
  "paper_report_markdown": "..."
}
```

Claims that do not depend on a figure may omit `figure_id` and `panel`, but must
still cite selected `evidence_ids` and a concrete statistic, table, or artifact.

## 10. Report Snapshot

Each report is an immutable snapshot:

```text
reports/report-YYYYMMDD-HHMMSS/
  selection.json
  evidence_bundle.json
  report.json
  report.md
  report.pdf
  assets/
```

- `selection.json` proves what the user selected.
- `evidence_bundle.json` proves what the Reporter received.
- `report.json` stores structured claims and provenance.
- `report.md` is the canonical human-readable output.
- `report.pdf` is an optional deterministic rendering of `report.md`.
- `assets/` contains copies of referenced figures and other report assets, so
  the report remains readable if source run directories later move.

## 11. Implementation Phases

### Phase A — Task-project layout

Status: complete.

- Move Research Planning task runs to
  `project/research_tasks/<task-id>/round<n>`.
- Add task `project.json` manifests and stable task/round references.
- Add compatibility handling for the current task directory layout.

### Phase B — Research-only scheduler

Status: complete.

- Implement the ResearchTaskScheduler and single-writer parent state model.
- Add bounded planning and execution pools.
- Add recovery, retry, cancellation, and failure isolation.
- Prove that normal workflows do not initialize scheduler resources.

### Phase C — Plan-review queue

Status: complete.

- Persist the queue and review policy.
- Add the three-option task Plan review selector.
- Resume approved tasks independently.
- Requeue revised Plans without blocking unrelated Plans.

### Phase D — Evidence selection and compilation

Status: complete.

- Add `/seekbrain-report`, conversational tooling, and CLI selection.
- Implement normal-round and task-round selectors.
- Build the normalized evidence bundle from selected results only.
- Snapshot selected assets with stable figure numbering.

### Phase E — Reporter Agent

Status: complete. Markdown and structured JSON are canonical; PDF remains an optional backend-dependent artifact.

- Adapt the useful traceability and figure rules from the referenced Level 2
  Reporter prompt.
- Generate structured report JSON and canonical Markdown in one model call.
- Add deterministic Markdown-to-PDF rendering as an optional step.

### Phase F — Verification

Status: complete.

- Test that normal round1 has no Report hint.
- Test that normal round2+ only shows a passive hint.
- Test that no Reporter model call occurs without explicit user input.
- Test that Research Planning task Plans generate concurrently while review UI
  remains serialized.
- Test ordinary approval, revision requeue, and approve-remaining behavior.
- Test concurrent task completion without lost parent-state updates.
- Test arbitrary normal-round and task-round selections.
- Test that unselected evidence is absent from the evidence bundle and prompt.
- Test figure numbering, panel legends, key-claim provenance, restart recovery,
  and report snapshot portability.

## 12. Acceptance Criteria

- Normal SeekBrain execution has no scheduler, review-queue, or Reporter-agent
  overhead.
- Research Planning task computation can run concurrently with configurable
  resource limits.
- Human Plan reviews are always presented one at a time.
- Ordinary approval advances the queue; revision does not block other ready
  Plans; approve-remaining is scoped to one Research Planning execution.
- Every terminal task is a durable multi-round child project.
- Reports are generated only after an explicit user request.
- Users can select any completed normal rounds or Research Planning task rounds
  within a project.
- The Reporter receives and discusses only the selected evidence.
- Every report claim is traceable to selected evidence, and no figures,
  statistics, tables, panels, or references are fabricated.
- Report snapshots remain reproducible through `selection.json`,
  `evidence_bundle.json`, structured claims, and copied assets.

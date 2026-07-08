# NeuroScientist Level-2 Design

This document defines the intended Level-2 workflow before implementation.
Level-2 is the question-decomposition layer above Level-1. It should feel like
Level-1 in Pi: the user can describe the scientific task in conversation, and
the agent uses tools to create and execute a structured run.

## Goal

Level-2 answers a broad scientific question by:

1. reading the user question and dataset metadata,
2. decomposing the question into N focused subquestions,
3. generating executable analysis plans for each subquestion,
4. running Level-1 for each selected analysis plan,
5. synthesizing evidence per subquestion,
6. synthesizing the overall answer,
7. producing a final report.

YAML remains supported as a reproducible batch input format, but it is not the
primary interactive interface.

## Current Legacy Flow

There are two legacy/reference sources:

1. Original Python/batch Level-2 reference:

```text
/mnt/shared-storage-gpfs2/ai4neuro-share/luoling/Intern-NeuroScientist
```

This project contains the canonical script workflow:

```text
command_subq_testq3.sh
  -> launch_subq_test.py
  -> SubquestionPlanningWorkflow.run()
  -> NeuroScientistWorkflow.run() per analysis plan
  -> subquestion conclusion
  -> question conclusion
  -> paper report
```

Key files:

```text
launch_subq_test.py
internagent/mas/workflow/subquestion_planning_workflow.py
internagent/mas/workflow/neuroscientist_workflow.py
internagent/mas/agents/subquestion_agent.py
internagent/mas/agents/subquestion_review_agent.py
doc/level2_workflow_command_subq_testq3.md
SUBQ_TEST_USAGE.md
command_subq_testq*.sh
```

2. Earlier Pi-native Level-2 prototype:

```text
/mnt/shared-storage-user/zhuyuqing-p/agent-loop/.pi/extensions/neuroscientist-level2
```

This project contains the reusable Pi tool layer and subprocess bridge to
Level-1.

The previous script-based entry point is:

```text
pi_run_level2.sh
  -> internagent/workflow/level2.sh
  -> .pi/extensions/neuroscientist-level2/index.ts
  -> neuro_l2_* tools
  -> spawned Level-1 workflow per analysis plan
  -> subquestion conclusion
  -> question conclusion
  -> paper report
```

The redesign should use the luoling project as the canonical source for the
scientific/agent workflow semantics, and use the agent-loop Pi prototype as the
starting point for the Pi extension implementation.

The legacy YAML shape is:

```yaml
question: "..."
background: "..."
scientific_goal: "..."
meta_json_path: /path/to/meta.json
```

This is useful for batch runs, but too restrictive as the only input contract.

## Reusable Legacy Components

The earlier Level-2 Pi implementation is not disposable. It already contains
most of the execution primitives we need. The redesign should keep these pieces
and replace the interaction/activation layer around them.

Reusable from `.pi/extensions/neuroscientist-level2/index.ts`:

- `neuro_l2_start_run`: creates run directories and stores question input.
- `neuro_l2_subquestion`: runs the subquestion-generation subagent.
- `neuro_l2_subquestion_review`: reviews generated subquestions.
- `neuro_l2_method_development`: generates per-subquestion analysis plans.
- `neuro_l2_method_review`: reviews per-subquestion plans.
- `neuro_l2_run_level1`: executes one plan by spawning the Level-1 workflow.
- `neuro_l2_subagent_conclusion`: synthesizes evidence per subquestion.
- `neuro_l2_subagent_conclusion_review`: reviews subquestion conclusions.
- `neuro_l2_question_conclusion`: synthesizes the overall question answer.
- `neuro_l2_paper_report`: writes the final report markdown.

Also reusable:

- subagent runner and finalize-tool pattern,
- run state and `.pi/neuroscientist-level2/run_index.json`,
- readable event logging,
- usage ingestion from spawned Level-1 runs,
- Level-1 artifact ingestion,
- existing Level-2 prompts.

## Level-1 Reuse Policy

Level-2 should reuse Level-1 execution, but only in headless/non-interactive
mode.

The interactive Level-1 user experience includes a human review gate after plan
generation. That is correct when the user directly runs Level-1, but it is not
appropriate inside Level-2. Once a Level-2 subquestion workstream enters its
Level-1 execution phase, it should not stop for human plan approval.

Current reusable mechanism:

```text
neuro_l2_run_level1
  -> spawnLevel1(...)
  -> internagent/workflow/level1.sh --non-interactive
```

`level1.sh --non-interactive` exports:

```bash
NEURO_LEVEL1_NON_INTERACTIVE=1
```

The Level-1 extension checks this flag when computing workflow config:

```ts
humanReviewEnabled =
  humanReview.enabled === true &&
  process.env.NEURO_LEVEL1_NON_INTERACTIVE !== "1"
```

Therefore Level-1 human review gates are disabled in Level-2-spawned runs even
if `config.workflow.level1.human_review.enabled` is true for normal interactive
Level-1 sessions.

Required Level-2 behavior:

- Reuse Level-1 through `level1.sh --non-interactive`, not by calling
  interactive Level-1 tools in the parent session.
- Do not expose Level-1 `neuro_approve_stage` or `neuro_record_feedback` inside
  the Level-2 subprocess path.
- Treat Level-1 as an execution engine for an already-approved Level-2 analysis
  plan.
- If Level-1 fails because the plan is infeasible or data are missing, record
  the failure as plan-level evidence and continue according to Level-2 policy.
- Human review, if enabled in Level-2, happens before Level-1 execution:
  subquestions and methods/plans can be reviewed by the user in the parent
  Level-2 conversation.

This preserves the distinction:

```text
Direct Level-1 run:
  plan -> optional human review -> code/validate/conclude

Level-2 spawned Level-1 run:
  already selected plan -> headless code/validate/conclude
```

Primary problems to fix:

- The old entry path is script/prompt-template driven rather than a selected
  `/neuro -> level2` workflow.
- The old interaction model asks the main agent to follow a long prompt; review
  and feedback are not represented as clean Pi UI states.
- YAML/file input is treated as the default path, while conversation input
  should be first-class.
- The dashboard/state model is not integrated with the new unified `neuro.ts`
  selector.

Therefore the first implementation should copy/adapt the old Level-2 extension
into `extensions/neuro/level2/`, patch package imports and root-path handling,
then improve the user-facing prompt and workflow activation.

## Input Philosophy

Level-2 should accept task information from conversation first.

Example interactive user input:

```text
Run Level-2.

Question:
Assessment of motor and postural confounds on the neural prior signal

Background:
Neural signals interpreted as cognitive priors might instead reflect body
posture, movements, or preparatory motor adjustments that correlate with trial
history.

Scientific goal:
Decide whether the neural signals representing the prior can be explained by
embodied features like body posture or eye position.

Metadata:
/path/to/Findling_2025_Nature_data_meta.json

Use 3 subquestions and at most 3 analysis plans per subquestion.
Save under results/level2/findling_q3.
```

The agent should convert this into a structured run spec and call tools. The
user should not need to manually create a YAML file.

## Unified Run Spec

All input modes should normalize into one Level-2 run spec.

```ts
type Level2RunSpec = {
  question: string;
  background?: string;
  scientific_goal?: string;
  metadata: {
    meta_json_path?: string;
    meta_json?: Record<string, unknown>;
    notes?: string;
  };
  output?: {
    work_dir?: string;
    tag?: string;
  };
  planning?: {
    subquestion_count?: number;
    max_analysis_plan_count?: number;
    review_max_rounds?: number;
    method_review_max_rounds?: number;
  };
  execution?: {
    run_level1?: boolean;
    level1_interactive?: boolean;
    max_parallel_level1_runs?: number;
  };
  review?: {
    subquestion_human_review?: boolean;
    method_human_review?: boolean;
  };
};
```

Required minimum:

```text
question
metadata.meta_json_path or metadata.meta_json
```

`scientific_goal` is strongly preferred. If missing, the agent should infer a
draft goal from the question and ask for confirmation only when the ambiguity
would materially change the decomposition.

## Supported Input Modes

### Conversation Input

Primary mode. The user describes the task in Pi. The agent extracts fields and
starts a run.

### YAML Import

Secondary mode for reproducibility:

```text
Use /path/to/question.yaml for Level-2.
```

The tool loads YAML and normalizes it into the same `Level2RunSpec`.

### Direct Metadata Object

For future use, the tool may accept the parsed metadata JSON directly. This is
useful when another tool has already loaded or generated metadata.

## Proposed Tool Surface

Tool names should use a `neuro_l2_*` prefix to avoid collisions with Level-1.

Minimal first implementation:

```text
neuro_l2_capabilities
neuro_l2_start_run
neuro_l2_load_question_yaml
neuro_l2_generate_subquestions
neuro_l2_generate_methods
neuro_l2_run_level1_plans
neuro_l2_synthesize
neuro_l2_generate_report
```

Expanded review-aware implementation:

```text
neuro_l2_subquestion
neuro_l2_subquestion_review
neuro_l2_method_development
neuro_l2_method_review
neuro_l2_run_level1
neuro_l2_subagent_conclusion
neuro_l2_subagent_conclusion_review
neuro_l2_question_conclusion
neuro_l2_paper_report
neuro_l2_review_subquestions
neuro_l2_record_subquestion_feedback
neuro_l2_review_methods
neuro_l2_record_method_feedback
neuro_l2_conclude_subquestions
neuro_l2_conclude_question
```

Human review should be tool-driven rather than blocking on raw CLI input. The
agent should show proposed subquestions/plans in the conversation and call a
record-feedback or approve tool based on the user's response.

## Workflow Stages

Suggested dashboard stages:

```text
Input -> SubQ -> Methods -> Level1 -> Evidence -> Report
```

Stage meanings:

- `Input`: run spec created, metadata loaded, output directory initialized.
- `SubQ`: subquestions generated and optionally reviewed.
- `Methods`: analysis plans generated for each subquestion and optionally reviewed.
- `Level1`: Level-1 runs executed for selected analysis plans.
- `Evidence`: per-subquestion and overall conclusions synthesized.
- `Report`: final markdown/PDF/report artifacts generated.

## Dashboard / Board Design

Here `dashboard` means the Pi UI board shown below the conversation. The
Level-2 board should follow the visual pattern of `extensions/pi-pi.ts`.

`pi-pi.ts` shows a grid of expert cards:

- each expert has one card,
- cards have colored borders/backgrounds,
- each card shows name, status, elapsed time, current work, and last line,
- the widget is rendered with `ctx.ui.setWidget(...)`,
- the grid column count is configurable,
- long text is truncated to fit the card width,
- statuses are visually distinct: idle / running / done / error.

Level-2 should use the same idea, but the cards represent subquestion agents.
If the run is configured for 3 subquestions, the board should show 3 cards:

```text
┌────────────────────────┐ ┌────────────────────────┐ ┌────────────────────────┐
│ SubQ 1                 │ │ SubQ 2                 │ │ SubQ 3                 │
│ ◉ level1 184s          │ │ ✓ evidence 392s        │ │ ○ pending              │
│ motor/posture signals… │ │ eye-position control…  │ │ history-confound test… │
│ running plan 2/3       │ │ conclusion ready       │ │ waiting for methods    │
└────────────────────────┘ └────────────────────────┘ └────────────────────────┘
```

Each card tracks one subquestion through the full local lifecycle:

```text
pending
-> subquestion_generated
-> methods_running
-> methods_ready
-> level1_running
-> level1_done
-> evidence_running
-> evidence_done
-> error
```

Card fields:

- `title`: `SubQ 1`, `SubQ 2`, etc.
- `status`: current lifecycle state.
- `elapsed`: time since this subquestion became active.
- `subquestion`: truncated subquestion text.
- `last_event`: last tool event or plan progress, e.g. `running plan 2/3`.
- `plan_progress`: completed / total analysis plans.
- `error`: short error if failed.

The board should also keep a compact top-level pipeline line, separate from the
cards:

```text
Level-2: Input ✓  SubQ ✓  Methods ◉  Level1 ○  Evidence ○  Report ○
```

This gives both views:

- global stage progress,
- per-subquestion/subagent progress.

Implementation notes:

- Reuse the raw-line card renderer style from `pi-pi.ts` rather than relying on
  nested TUI components; this avoids ANSI-width issues.
- Use `setWidget("neuro-level2-board", ...)`.
- Update the board on `tool_execution_start`, `tool_execution_end`, and any
  tool `onUpdate` events emitted during Level-1 subprocess execution.
- Provide a command similar to `/experts-grid N`, e.g. `/neuro-grid N`, if grid
  columns need adjustment.
- The initial version can assume 3 columns when `subquestion_count=3`, then
  fall back to `min(3, subquestion_count)` for other counts.

Important distinction:

- The card is not necessarily a separate OS process.
- It represents one subquestion workstream. Internally, that workstream may use
  multiple tools: method development, method review, one or more Level-1 runs,
  and subquestion conclusion.

## Pi Extension Shape

```text
extensions/
  neuro.ts
  neuro/
    level1/
      index.ts
      config.json
      prompts/
    level2/
      index.ts
      config.json
      prompts/
        entry.md
```

`extensions/neuro.ts` should register Level-2 at extension load time:

```ts
import registerLevel2 from "./neuro/level2/index.ts";

export default function (pi) {
  registerLevel1(pi);
  registerLevel2(pi);
  pi.registerCommand("neuro", ...);
}
```

The `/neuro` command only activates a workflow level. It must not dynamically
register tools.

## First Implementation Boundary

The first implementation should prioritize end-to-end functionality:

1. Add `level2` to the `/neuro` selector.
2. Add `extensions/neuro/level2/index.ts`.
3. Copy/adapt the existing `.pi/extensions/neuroscientist-level2/index.ts`.
4. Patch imports from the old Pi package names to this repository's
   `@mariozechner/*` package names.
5. Patch root-path handling so Level-2 runs from the unified project root.
6. Register Level-2 tools at extension load through `extensions/neuro.ts`.
7. Avoid CLI `input()` loops in the Pi path.
8. Store all run state and artifacts under the selected `work_dir`.

The old tools are already close to the desired implementation. The main redesign
work is to make the user-facing input a conversation-derived run spec rather
than a mandatory YAML path, and to make review/approval visible in the unified
Pi workflow.

## Open Design Questions

1. Should Level-2 generate all analysis plans before any Level-1 run, or run
   Level-1 after each subquestion is approved?
2. Should Level-1 runs be serial by default for stability, with parallelism as
   an explicit option?
3. Should method review be mandatory, optional, or replaced by human approval in
   interactive mode?
4. Should the final report be paper-style by default, or should there be a
   shorter answer-focused mode?
5. How should failed Level-1 runs affect synthesis: exclude, retry, or include
   as negative evidence?

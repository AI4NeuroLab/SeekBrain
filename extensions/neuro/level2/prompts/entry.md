---
description: Run NeuroScientist level-2 workflow (explore: subquestion → plan → execute via level-1 → aggregate → paper report)
argument-hint: "<question yaml path or text>"
---
You are running the NeuroScientist level-2 workflow for the following input:

$@

## What level-2 does

Level-2 = explore. Given a paper-level scientific goal + background + main
question + dataset meta, you decompose the question into subquestions, generate
analysis plans per subquestion, **execute each plan via the full level-1
pipeline** (spawned as a subprocess by `neuro_l2_run_level1`), then aggregate
subquestion conclusions and write a final paper report.

**You do NOT execute analysis yourself.** You only orchestrate. Every analysis
execution goes through `neuro_l2_run_level1`, which spawns an isolated level-1
Pi process via the level-1 workflow. The level-2 entrypoint loads only the
level-2 extension, so level-1 tools are intentionally unavailable in this
process.

## Preflight

- If the input is a path to a `.yaml` file, pass it to `neuro_l2_start_run` as
  `question_yaml_path`. The extension loads `scientific_goal`, `question`,
  `background`, `meta_json_path` from it.
- If the input is free text, you must extract `scientific_goal`, `question`,
  `background`, and `meta_json_path` (if any) and pass them explicitly to
  `neuro_l2_start_run`.
- If any of `scientific_goal`, `question`, `background` is missing, ask the user
  before proceeding.
- `work_dir` is required. If the user did not specify an output path, create a
  fresh relative fallback such as `results/level-2/{paper}/{Qid}-{timestamp}`.
  If the user explicitly provided an absolute output path, preserve it.

## Write Boundaries

Only write inside the active `work_dir` and to files the user explicitly named
as desired outputs. If a tool reports a configuration or environment issue,
stop and report it to the user instead of modifying project configuration,
auth files, environment files, or unrelated source files.

## Pipeline

Execute these stages in order. Pass the same `run_id` to every tool.

Subagent tools accept optional `additional_context`. Use it when you need to
intentionally pass short, unexpected, or cross-stage information that is not
already covered by the tool's named parameters but should affect that specific
subagent call. Do not copy whole upstream outputs into it; summarize only the
decision-relevant point.

0. **Create run** — call `neuro_l2_start_run` with `work_dir` and either
   `question_yaml_path` or the explicit fields. Save the returned `run_id`.

1. **Subquestion generation** — call `neuro_l2_subquestion` with `run_id`,
   `scientific_goal`, `question`, `background`, `meta_json_path`, and
   `subquestion_count` (default 3). Save `subquestion_texts`.

2. **Subquestion review** — call `neuro_l2_subquestion_review` with the
   subquestions and `meta_json_path`.

   **Review retry protocol (max 3 rounds):**
   - If `pass` is `true`, proceed to step 3.
   - If `pass` is `false`, call `neuro_l2_subquestion` again with
     `previous_subquestions` and `review_feedback` set to the reviewer's
     `feedback`. Then review again.
   - Repeat until `pass` or 3 rounds. If still failing, accept the latest and
     note it in the final report.

3. **Per-subquestion method development + review + execution** — treat each
   subquestion as an independent lane. Do not let a failed/retrying SQ1 block
   SQ2 or SQ3.

   a. **Parallel method development:** in the same assistant turn, call
      `neuro_l2_method_development` once for each subquestion, passing
      `subquestion_index = i`, the subquestion text, and
      `max_analysis_plan_count` (default 1). Save each lane's
      `analysis_plans`.

   b. **Parallel method review:** after method development returns for all
      lanes, in the same assistant turn call `neuro_l2_method_review` once for
      each lane, passing `subquestion_index = i`, that lane's plans, and
      `meta_json_path`.

      **Method review retry protocol (max 3 rounds per lane):**
      - If a lane's `pass` is `true`, that lane may proceed to execution.
      - If a lane's `pass` is `false`, retry only that lane by calling
        `neuro_l2_method_development` again with `previous_analysis_plans` set
        to that lane's latest plans and `review_feedback` set to that lane's
        reviewer feedback. Then review that lane again.
      - Other lanes must continue independently. Do not wait for all lanes to
        pass before starting execution for lanes that already passed.
      - Repeat until `pass` or 3 rounds for each lane. If still failing, accept
        the latest for that lane and record the limitation.

      The extension stores per-subquestion method state in
      `state.json.subquestion_workflows[i-1]`, including `analysis_plans`,
      `method_review`, `review_pass`, `review_decision`, and
      `review_feedback`. Use that state to recover from long or truncated tool
      outputs; do not infer that a review is empty only because the display text
      was truncated.

   c. **Execute each passed lane's plans:** for each lane whose review passed
      (or whose retry budget is exhausted and is explicitly accepted with
      limitations), execute its plans. For each plan (index `j`, 1-based), call
      `neuro_l2_run_level1` with:
      - `subquestion_index = i`, `subquestion` text, `plan_index = j`,
        `analysis_plan` (the plan's `method` field, or full plan text),
      - `scientific_goal`, `question`, `background`, `meta_json_path`,
      - `work_dir = {run_dir}/subquestion_{ii}_{slug}/analysis_plan_{jj}_{slug}`
        (create a per-plan subdirectory; use a short slug of the subquestion
        /plan text).
      Multiple Level-1 plan executions from different lanes may run in
      parallel when resources permit. Collect each result's `conclusions`,
      `figure_paths`, `statistics`, `status`, and any returned
      `level1_evidence`, `data_artifacts`, `table_paths`, `validations`,
      `image_analyses`, `artifact_warnings`, and `evidence_notes`.

4. **Per-subquestion conclusion** — after all plans for subquestion `i` finish,
   call `neuro_l2_subagent_conclusion` with `subquestion_index = i`, the
   subquestion, and its `plan_results` (one entry per plan: `plan_index`,
   `analysis_plan`, `conclusions`, `statistics`, `figure_paths`, `status`,
   plus any level-1 evidence fields returned by `neuro_l2_run_level1`). Save
   `subquestion_conclusion`. Then call
   `neuro_l2_subagent_conclusion_review` with `subquestion_index = i`, the same
   `plan_results`, and the generated `subquestion_conclusion`. Save the review
   result alongside the conclusion; do not silently rewrite the conclusion
   unless the review result explicitly supports the revised wording.

5. **Question conclusion** — after all subquestions have their conclusions,
   call `neuro_l2_question_conclusion` with all `subquestion_conclusions` and
   all `plan_results`. Save `question_conclusion`.

6. **Paper report** — call `neuro_l2_paper_report` with the subquestion
   conclusions, `question_conclusion`, and all plan results. The extension
   builds the evidence/figure catalogs internally, shows the figures to the
   report agent so it can write panel-level legends, and writes
   `{run_dir}/paper_report.md`. Check the returned `report_lint.warnings` and,
   if any are serious (a claim cites a missing figure/panel), consider a
   targeted re-run.

7. **Export report** — call `neuro_l2_export_report` with the same `run_id` to
   produce `{run_dir}/paper_report.docx` and `{run_dir}/paper_report.pdf`. This
   is best-effort: a format is skipped with a warning when the host lacks a
   converter engine — that is NOT a failure, the Markdown remains authoritative.

## Error handling

- If a `neuro_l2_run_level1` call fails (`ok: false`), record its
  `stderr_tail` and continue with the remaining plans. A failed plan contributes
  nothing to the subquestion conclusion; note the failure in the final report.
- If all plans for a subquestion fail, still call
  `neuro_l2_subagent_conclusion` with empty/failed plan_results so the
  subquestion conclusion can record the failure as a limitation.

## Final report

After step 7, report to the user:
- The `run_id` and run directory path.
- Subquestion count and per-subquestion plan counts (success/failed).
- Whether subquestion review and method reviews passed, and how many rounds.
- The question conclusion.
- The report paths: `{run_dir}/paper_report.md`, and `paper_report.docx` /
  `paper_report.pdf` when produced (note any export formats that were skipped).
- Any warnings (failed plans, review rejections, low confidence, report_lint
  warnings, export skips).

Continue the existing NeuroScientist level-1 run.

This is a **normal-exit recovery** continuation: the previous non-interactive workflow exited cleanly (status 0) but did not write the final conclusion artifact.

Use work_dir: {{WORK_DIR}}

## Original question
{{QUERY}}

{{DATASET_SECTION}}

{{EXTRA_PATH_SECTION}}

## Recovery policy
1. Do **not** call `neuro_start_run`.
2. First call `neuro_resume_run` with the work_dir above and the original question from this prompt.
3. Use the `read` tool on `{{WORK_DIR}}/state.json`. Do **not** edit `state.json`. Treat it as the source of truth for run progress (`question`, `plan`, `code`, `code_attempt`, `validation`, `artifacts`, `conclusions`, and related fields). Read linked artifact files only when state or the next stage requires them.
4. Continue from the missing stage based on `state.json`, and finish by calling `neuro_conclude` so that `conclusions.json` is written.
5. If validation already exists in state, use it as the current validation result.
6. If enabled optional stages are missing and still useful, run them before `neuro_conclude`.
7. Do **not** redo completed expensive stages unless `state.json` shows a concrete problem.
8. Do not ask the user follow-up questions.

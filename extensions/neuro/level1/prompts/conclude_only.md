Conclude the existing NeuroScientist level-1 run from **partial artifacts only**.

This is a **conclude_only** pass after the main run (or continue) ended without `neuro_conclude` finishing — including timeout / abnormal exit, or continue exiting 0 without a conclusion artifact. Do **not** resume the full pipeline.

Use work_dir: {{WORK_DIR}}

## Original question
{{QUERY}}

{{DATASET_SECTION}}

{{EXTRA_PATH_SECTION}}

## Conclude-only policy
1. Do **not** call `neuro_start_run`.
2. Do **not** call `neuro_plan`, `neuro_code`, `neuro_validate`, `neuro_refine_image`, `neuro_analyze_image`, `neuro_deep_research`, or `resolve_targeted_skill`.
3. Call `neuro_resume_run` once with the work_dir above and the original question from this prompt to load state.
4. Use the `read` tool on `{{WORK_DIR}}/state.json`. Do **not** edit `state.json`. Treat it as the source of truth for available evidence (`question`, `plan`, `code`, `validation`, `artifacts`, `image_analyses`, `checks`, and related fields). Read linked artifact files only when needed for `neuro_conclude`.
5. Call **`neuro_conclude` only**, using whatever artifacts already exist in state/files (code output, partial validation, statistics, image analyses, etc.).
6. If validation never finished, say so explicitly in `limitations` and lower `confidence` accordingly.
7. If only code exists without validation, treat conclusions as **unvalidated exploratory findings**.
8. The goal is a honest degraded conclusion artifact, not a perfect rerun.
9. Do not ask the user follow-up questions.

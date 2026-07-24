# Paper–UI Terminology Alignment

Status: terminology and public tool-ID migration completed. User-facing labels, prompts, help text, result cards, commands, events, telemetry, and public documentation now use the Paper-aligned terminology and the `seekbrain_` namespace. Workflow behavior and persisted state-field contracts remain unchanged.

## Confirmed decisions

1. Keep the user-facing name **Deep Research** unchanged.
   - It is task-level background context in the current product.
   - The Paper's **Survey Agent** belongs specifically to the **Research Planning Engine** and should continue to be presented there as Research Survey / Survey Agent.

2. Use **Code Agent** consistently.
   - Do not use **Coding Agent** in SeekBrain UI text or prompts.

3. Replace the product concept **Skill** with **Recipe** in user-facing text and agent prompts.
   - `Skill` → `Recipe` for compact stage labels.
   - `Targeted Skill` → `Analysis Recipe`.
   - `Resolve Targeted Skill` → `Retrieve Analysis Recipe`.
   - `Skill Relevance` → `Recipe Relevance`.
   - Paper/repository-backed generation → `Recipe Crystallization`.
   - Saving a validated execution trajectory → `Save as Analysis Recipe` / `Recipe Distillation`.
   - `Skills Index` → `Analysis Recipe Index`.

4. Keep compatibility-sensitive internal identifiers unchanged during the terminology-only pass.
   - Examples: `targeted_skill`, `resolve_targeted_skill`, `SKILL.md`, current state fields, existing artifact paths, and existing slash-command IDs.
   - Only labels, help text, result cards, prompts, and other user-visible strings should change in the first implementation pass.

5. Use Paper terminology for the execution stages where the mapping is direct.
   - Per-task `Plan` → `Analytical Formulation`.
   - Its output → `Methodological Schema`.
   - `Code` → `Code Generation & Execution`.
   - `Validate` → `Validation`.
   - `Interpret` → `Result Interpretation`.
   - Do not replace `Research Planning`; it corresponds to the Paper's Research Planning Engine.

6. Replace `Research tree` with `Hierarchical research plan` in user-facing text.

7. Prefer `Researcher review` / `Researcher feedback` over `Human review` in user-facing text, matching the Paper's researcher-in-the-loop terminology.

## Tool and command naming: design direction

The extension exposes 34 public tool IDs. All now use the `seekbrain_` namespace and the `seekbrain_<domain>_<action>` grammar. Legacy `neuro_*` IDs and `resolve_targeted_skill` are accepted only when translating references from persisted state; they are not registered as public aliases.

### Recommended separation

- **Tool ID:** machine-facing API name used by the agent, prompts, tests, logs, and returned `next_tool` fields.
- **Tool label:** concise user-facing function name rendered by the interface.
- **Paper role:** conceptual name used to explain the architecture, such as Research Planning Engine, Analysis Execution Engine, Formulation Agent, and Validation Agent.

These layers should not be forced to use the same string.

### Prefix recommendation

- User-facing labels should not include `Neuro` or `SeekBrain` repeatedly. The surrounding interface already establishes product ownership.
- Machine-facing tool IDs should retain a namespace to avoid collisions with generic tools such as `plan`, `code`, `validate`, and `report`.
- Public tool IDs use the explicit product namespace `seekbrain_` rather than `neuro_`.
- Do not introduce unprefixed generic tool IDs.
- Do not expose both old and new aliases simultaneously for a long period: duplicate visible tools increase model-selection ambiguity and prompt/tool-schema size.

### Completed migration order

1. Rename only labels, descriptions, cards, prompts, and help text.
2. Group the tool catalog conceptually by Paper subsystem and identify redundant or diagnostic-only tools.
3. Decide which tools truly need to remain exposed to the main agent.
4. Introduce a tool-ID migration from `neuro_*` to `seekbrain_*`, with an internal compatibility map for persisted `next_tool` values and older run state.
5. Update prompts, tests, documentation, commands, event names, and telemetry together.
6. Remove legacy aliases after a defined compatibility window.

### Proposed conceptual groups

- System and diagnostics
- Data access and metadata
- Research Planning Engine
- Analysis Execution Engine
- Neuroscience Analysis Repertoire
- Researcher-in-the-loop review
- Report generation
- Post-run code revision

### Implemented tool naming grammar

Use the following three layers deliberately:

1. **Tool ID:** stable machine-facing API name with a product namespace.
2. **Tool label:** concise user-facing function name without repeated `Neuro` or `SeekBrain` prefixes.
3. **Paper role:** architectural explanation of the responsible Engine or Agent; it does not need to be identical to the tool ID or label.

Public tool IDs use:

`seekbrain_<domain>_<action>`

Complete public tool mapping:

| Legacy tool ID | Current tool ID | User-facing label |
| --- | --- | --- |
| `neuro_resolve_data` | `seekbrain_data_resolve` | Profile Dataset |
| `neuro_ping` | `seekbrain_system_check` | Check Extension |
| `neuro_capabilities` | `seekbrain_system_capabilities` | Show Capabilities |
| `neuro_start_research` | `seekbrain_research_start` | Start Research |
| `neuro_assess_research` | `seekbrain_planning_assess` | Assess Research Planning |
| `neuro_review_research_planning` | `seekbrain_planning_decision_review` | Review Research Planning |
| — | `seekbrain_planning_decision_record` | Record Research Planning Response |
| `neuro_prepare_subquestions` | `seekbrain_planning_generate` | Generate Hierarchical Research Plan |
| `neuro_review_research_plan` | `seekbrain_planning_peer_review` | Run Reviewer Agent |
| `neuro_review_research_tree` | `seekbrain_planning_researcher_review` | Review Research Plan |
| — | `seekbrain_planning_researcher_decision_record` | Record Research Plan Review Response |
| `neuro_materialize_research_tasks` | `seekbrain_analysis_tasks_prepare` | Prepare Analysis Tasks |
| `neuro_initialize_research_execution` | `seekbrain_execution_initialize` | Initialize Analysis Execution |
| `neuro_prepare_task_plans` | `seekbrain_execution_run` | Run Analysis Execution Engine |
| `neuro_review_task_plan` | `seekbrain_execution_schema_review` | Review Methodological Schema |
| `neuro_execute_research_tasks` | `seekbrain_execution_tasks_run` | Execute Analysis Tasks |
| `neuro_control_research_task` | `seekbrain_analysis_task_control` | Control Analysis Task |
| `neuro_continue_research` | `seekbrain_research_continue` | Continue Research |
| `neuro_start_run` | `seekbrain_run_start` | Start Analysis Run |
| `neuro_resume_run` | `seekbrain_run_resume` | Resume Analysis Run |
| `resolve_targeted_skill` | `seekbrain_recipe_retrieve` | Retrieve Analysis Recipe |
| `neuro_deep_research` | `seekbrain_deep_research` | Deep Research |
| `neuro_plan` | `seekbrain_formulation_generate` | Generate Methodological Schema |
| `neuro_review_plan` | `seekbrain_formulation_researcher_review` | Review Methodological Schema |
| `neuro_update_plan` | `seekbrain_formulation_update` | Update Methodological Schema |
| `neuro_code` | `seekbrain_code_execute` | Run Code Agent |
| `neuro_validate` | `seekbrain_validation_run` | Run Validation Agent |
| `neuro_refine_image` | `seekbrain_figure_refine` | Refine Figure |
| `neuro_interpret` | `seekbrain_interpretation_run` | Run Interpretation Agent |
| `neuro_approve_stage` | `seekbrain_review_approve` | Approve Stage |
| `neuro_record_feedback` | `seekbrain_review_feedback` | Record Researcher Feedback |
| `neuro_review_code_edit` | `seekbrain_code_edit_review` | Review Code Edit |
| `neuro_propose_code_update` | `seekbrain_code_update_propose` | Propose Code Update |
| `neuro_review_code_update` | `seekbrain_code_update_review` | Review Code Update |
| `neuro_compile_report_evidence` | `seekbrain_report_evidence_compile` | Compile Report Evidence |
| `neuro_generate_report` | `seekbrain_report_generate` | Generate Report |

The two planning-review concepts must remain distinguishable:

- Automated critique by the Paper's **Reviewer Agent** → `peer_review` / `Run Reviewer Agent`.
- User approval or revision in the researcher-in-the-loop interface → `researcher_review` / `Review Research Plan`.

Avoid generic unprefixed tool IDs such as `plan`, `code`, `validate`, or `report`. They are collision-prone and make tool ownership unclear when SeekBrain is loaded alongside other extensions.

### Tool-surface reduction target

The current extension exposes 34 tool IDs. The repeated `neuro_` prefix is visible naming debt, but the larger design issue is the number of exposed tools and the overlap between lifecycle, scheduler, compatibility, diagnostic, and scientific-stage operations.

Target approximately **12–16 primary tools** for the main workflow. Consider making the following internal, diagnostic-only, or reachable through a higher-level tool:

- health checks such as ping and capability inspection;
- legacy single-run compatibility entry points;
- explicit scheduler initialization;
- low-level report-evidence compilation;
- low-level task execution already orchestrated by the Research Task Pipeline;
- compatibility-only rerun or assessment entries that are not part of an ordinary workflow.

Reducing the exposed tool surface is not a terminology-only change. It must be reviewed during the workflow-conflict phase because it may change orchestration boundaries, recovery behavior, and test contracts.

### Slash-command direction

Commands now use one consistent product prefix and hyphen style:

- `/seekbrain`
- `/seekbrain-setup`
- `/seekbrain-show`
- `/seekbrain-report`
- `/seekbrain-save-recipe`
- `/seekbrain-reload-config`
- `/seekbrain-tools`

Legacy `neuro-*` command aliases are not publicly registered, preventing duplicate completion entries. The `seekbrain-show` handler still accepts the legacy `skill` argument as an input compatibility detail while documenting and completing `recipe`.

## Implemented terminology mappings

The following mappings were applied across tool labels and descriptions, review selectors, result cards, setup text, public documentation, and agent prompts.

### High-confidence Paper-aligned renames

| Current user-facing wording | Proposed wording | Reason |
| --- | --- | --- |
| Research Task / Research Tasks | Analysis Task / Analysis Tasks | The Paper consistently describes terminal nodes as actionable or executable analysis tasks. |
| Prepare Research Tasks | Prepare Analysis Tasks | These are child executions of approved analysis tasks, not separate research projects. |
| Execute Research Tasks | Execute Analysis Tasks | Matches the Analysis Execution Engine. |
| Control Research Task | Control Analysis Task | Same task concept as above. |
| Research Task Pipeline | Analysis Execution Engine | Direct Paper architecture match. |
| Resolve Data / Resolve Dataset Metadata | Profile Dataset | The operation inspects a dataset and extracts structure, variable types, sample sizes, and available dimensions. |
| Dataset metadata generated/reused | Dataset profile generated/reused | User-facing result of dataset profiling; internal metadata filenames may remain unchanged. |
| planning subagent | Formulation Agent | Applies only to the per-analysis execution stage that generates the methodological schema. Research Planning continues to use the Orchestrator Agent. |
| code subagent | Code Agent | Paper-approved Agent name. |
| semantics validator | Validation Agent | Paper-approved Agent name. |
| scientific Reporter / Reporter model | Report Agent | Paper-approved Agent name. |
| vision-agent for final interpretation | Interpretation Agent | Paper-approved Agent name. |
| Refine Image / Image refinement | Refine Figure / Figure Refinement | SeekBrain produces and evaluates scientific figures; the Paper consistently describes figures rather than generic images. |
| deep-research report | Deep Research background | Keep the feature name Deep Research, but do not describe its background context as a report. |

The dataset-profiling mapping is grounded in the Paper's **Data Analysis Agent**, which is invoked when metadata is absent to profile the dataset. The user-facing operation should preferably be `Profile Dataset`; the internal tool ID and metadata cache contract do not need to change in the terminology-only pass.

### Recipe source and status wording

Do not expose internal source values such as `existing_skill` or `generated_from_rag` directly in cards. Map them to Paper-facing wording:

| Internal value or current wording | Proposed display wording |
| --- | --- |
| `existing_skill` / matched | Retrieved from the Neuroscience Analysis Repertoire |
| `generated_from_rag` / generated | Crystallized from literature and code |
| no match / not found | No matching analysis recipe found |
| `validate_skills` | Recipe validation |
| full `SKILL.md` | Full recipe document (`SKILL.md`) |

The physical `SKILL.md` filename and Pi `/skill:*` invocation remain framework-level compatibility details and should not be renamed during this pass.

### Engineering wording that should not leak into the interface

The following status wording describes internal routing rather than a scientific function:

| Current wording | Proposed wording |
| --- | --- |
| Research route | Planning assessment |
| review suggested | Research Planning recommended |
| standard workflow | Direct analysis workflow |

These are text-only candidates, but the underlying distinction between direct analysis and the Research Planning Engine must be reviewed later as an architectural/workflow difference from the Paper.

### Public documentation and setup text

The terminology-only pass updated README, configuration help, setup output, and the TUI together:

- `Skill storage` → `Analysis Recipe storage`.
- `targeted skill` → `analysis recipe`.
- `RAG Skill generation` → `Recipe Crystallization`.
- `save a completed run as a reusable skill` → `save a validated run as an analysis recipe`.
- Workflow diagrams should use `Deep Research → Recipe → Analytical Formulation → Code Generation & Execution → Validation → optional Figure Refinement → Result Interpretation`.
- Internal directory names, environment variables, YAML keys, prompt filenames, and persisted state fields remain unchanged. Public command IDs have migrated to the `seekbrain-*` form.

### Terms that are already acceptable

No rename is currently needed for:

- Deep Research;
- Research Planning Engine / Research Planning;
- Research Survey / Survey Agent within Research Planning;
- Orchestrator Agent;
- Reviewer Agent;
- Code Agent;
- Validation Agent;
- Interpretation Agent;
- Report generation;
- hierarchical evidence synthesis, when the implementation is actually performing synthesis rather than only compiling an evidence bundle.

## Deferred to workflow-conflict review

- Whether 34 exposed tools should be reduced to a smaller high-level public tool surface.
- Whether `Image Refinement` should remain a distinct visible stage.
- How the current five-stage task display maps onto the Paper's three-phase computational workflow.
- Whether multi-round projects and round terminology need a Paper-facing explanation.
- Whether recipe distillation fully implements the Paper's Distillation Agent behavior.

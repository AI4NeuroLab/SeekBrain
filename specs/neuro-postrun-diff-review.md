# NeuroScientist Post-Run Diff Review Notes

Date: 2026-07-10
Project: `/mnt/shared-storage-gpfs2/ai4neuro-share/zhuyuqing/neuro-pi-agent`

## Current Focus

The latest work focused on improving the post-run code modification workflow for NeuroScientist Level 1.

Normal Level-1 usage is now understood as:

1. User reviews the analysis plan.
2. NeuroScientist generates and executes code automatically.
3. Code is not normally reviewed before execution.
4. After the full workflow finishes, the user may inspect the figure/result and ask NeuroScientist to modify the generated code.
5. In that post-run case, the main agent may prepare a code change, but it must show a diff and get explicit approval before applying/running it.

This separates method approval from post-run code-edit approval.

### Nature Figure delegation exception

An explicit `/run nature.figure ...` invocation is a separate delegated edit
path. The child snapshots the generating code and related figure artifacts,
then directly edits, executes, visually checks, and either retains or rolls
back its revision. It does not require the main-agent diff selector. An audit
diff is still stored in the revision directory. The approval flow documented
below continues to apply when the main agent itself prepares the code update.

Delegation is scoped to the edit request that explicitly invoked or named
`nature.figure`; it does not become sticky ownership of that artifact. Later
ordinary requests to change the same figure—including title, label, color,
legend, font, and layout tweaks—return to the main-agent proposal/review gate
unless the user explicitly delegates that new request to `nature.figure`.
Clarifying a missing value such as title text does not change the route selected
for the originating edit request.

## Implemented Code-Edit Gate

### Preferred one-call fast path: `neuro_review_code_edit`

Localized post-run changes now use one tool call with bounded exact
`find`/`replace` operations. The tool starts loading `@pi-archimedes/diff` as
soon as execution begins, in parallel with run resolution, code reads, proposal
writes, and diff construction. It joins the import before opening the review UI.

The same tool then:

- requires the configured exact match count (normally one),
- stores the original code, proposed code, compact patch, and summary,
- displays the existing `DiffComponent` review,
- applies only after the user approves,
- optionally reruns an approved Python artifact,
- stores stdout, stderr, and structured execution metadata,
- verifies that linked output artifacts were regenerated.

Presentation-only edits invalidate visual review without invalidating scientific
validation. The two-tool flow below remains available as a compatibility
fallback for complex revisions that cannot be expressed as exact replacements.

New Level-1 tools were added in:

- `extensions/neuro/level1/index.ts`
- `internagent/pi/extensions/neuroscientist-level1/index.ts`

### `neuro_propose_code_update`

Purpose: create a pending code edit without modifying the active code artifact.

Inputs:

- `run_id`
- optional `code_path`
- `updated_code`: complete updated code content
- optional `summary`

Behavior:

- Resolves the target code artifact, usually `generated_code.py`.
- Writes proposed code under:
  `pending_code_edits/<edit_id>/`
- Writes:
  - proposed code file
  - `diff.patch`
  - `summary.md`
- Records the pending edit in `state.json` under `pending_code_edits`.
- Does not overwrite the actual code artifact.
- Does not execute anything.

### `neuro_review_code_update`

Purpose: show the pending diff and ask for approval.

Behavior:

- Reads the latest pending code edit or a provided `edit_id`.
- Shows a review block in the TUI:
  - code path
  - diff path
  - summary
  - formatted diff
- Presents two options:
  - `Yes, apply and run`
  - `No, and tell NeuroScientist what to do differently`

If the user chooses `Yes, apply and run`:

- The proposed code is copied over the active code artifact.
- The edit is marked `applied`.
- The tool returns `approved_for_execution: true`.
- The main agent may then run the updated script and rerun validation/conclusion.

If the user chooses `No...`:

- The tool collects feedback.
- The edit is marked `changes_requested`.
- The main agent should revise the proposal and call the same gated flow again.

## Diff Formatting Work

The first implementation produced a correct but noisy unified diff: even a one-line deletion could display the whole script as one large hunk.

This was fixed by changing `unifiedDiff` to produce compact hunks with local context.

Current diff behavior:

- Uses an LCS-based line diff for moderately sized files.
- Falls back to simple line comparison for very large files.
- Shows only changed regions with 3 lines of context.
- Writes standard compact unified diff to `diff.patch`.

The review UI now formats the diff with:

- old/new line numbers
- red ANSI color for removed lines
- green ANSI color for added lines
- dim ANSI style for file headers and hunk headers

Relevant helper functions:

- `unifiedDiff(...)`
- `formatDiffForReview(...)`
- `truncateForDisplay(...)`

Example target output style:

```text
  914 -  return [
  915 -    `--- ${fromPath}`,
  914 +  const changed = ops
  915 +    .map((op, index) => op.type === "context" ? -1 : index)
```

## Example Test Case

A real test was performed on:

`results/Koninck_2025_Fig_1E/20260626-run1/generated_code.py`

User request:

Remove the top title from:

`results/Koninck_2025_Fig_1E/20260626-run1/figure.png`

The generated diff now correctly collapses to the local change:

```diff
@@ -105,7 +105,6 @@
                    interpolation="nearest", aspect="equal")
     cbar = fig.colorbar(im, ax=ax, shrink=0.85)
     cbar.set_label("Pearson correlation")
-    ax.set_title(f"Average FC (spontaneous, first 600 tp) — n = {n_fish} larvae")
     ax.set_xlabel("Region index (kept)")
     ax.set_ylabel("Region index (kept)")
     fig.tight_layout()
```

The existing pending edit's `diff.patch` was also manually refreshed to this compact format.

## Main-Agent Prompt Update

The Level-1 entry prompt was updated in:

- `extensions/neuro/level1/prompts/entry.md`
- `internagent/pi/extensions/neuroscientist-level1/prompts/entry.md`

New section:

`Post-Run Code Feedback`

Key rule:

After a workflow has produced code/artifacts/conclusions, the main agent may inspect and revise generated code, but it must not directly overwrite or execute revisions. It must use:

1. `neuro_propose_code_update`
2. `neuro_review_code_update`
3. Apply/run only after `approved_for_execution=true`

## Plan Review Changes Nearby

The plan approval flow was also adjusted before the diff work.

Current plan-review options:

- `Yes, code`
- `No, and tell NeuroScientist what to do differently`

The planner no longer owns the user-facing summary. Instead:

1. `neuro_plan` returns `plan_markdown`.
2. The main agent summarizes the plan in chat.
3. The main agent calls `neuro_review_plan` to show the two-option selector.
4. If feedback is given, the main agent can use `neuro_update_plan` for local plan edits instead of rerunning planner every time.

## Pi Diff Resource Package

Installed during this session:

```bash
pi install npm:@pi-archimedes/diff
```

Install result:

- npm package installed successfully
- no vulnerabilities reported
- Pi should load resources declared by the package manifest

Important correction: `@pi-archimedes/diff@1.7.1` does not export a default Pi extension factory. Registering it with `pi install` makes Pi fail during extension discovery. It was therefore removed from the global Pi package list and is now used only as a project-local npm library imported by the Neuro Level-1 extension.

Follow-up development idea:

Investigate whether `@pi-archimedes/diff` exposes a resource/component that can replace or improve the current custom `formatDiffForReview(...)` implementation. The current implementation is intentionally lightweight and local; it does not yet use the installed package.

### Integration completed

The follow-up was completed on 2026-07-10:

- Added `@pi-archimedes/diff@1.7.1` and `diff@8.0.0` as project dependencies.
- Do not run `pi install @pi-archimedes/diff`; use the dependency declared in this repository's `package.json`.
- Replaced the custom LCS diff generator with `diff.createTwoFilesPatch(...)` using 3 context lines.
- Removed the custom ANSI `formatDiffForReview(...)` renderer.
- `neuro_review_code_update` now streams structured diff details to a custom tool renderer backed by `DiffComponent`.
- The review supports Shiki language highlighting, word-level emphasis, line numbers, and automatic unified/split layout based on terminal width.
- The active and deploy-copy Level-1 extensions use the same implementation.

Verification used the existing title-removal pending edit. It produced one 7-line hunk, and the component render contained both the changed line and its correct old/new line numbers.

## Environment Notes

### Pi / Node

There was a recurring Node compatibility issue earlier in development:

- Some Pi builds depend on newer Node features.
- Old Node versions can fail with errors such as unsupported regex flags or undici APIs.
- The project contains Node 22 at:

```bash
/mnt/shared-storage-gpfs2/ai4neuro-share/zhuyuqing/neuro-pi-agent/.tools/node-v22.19.0/bin/node
```

Known working diagnostic command:

```bash
PATH=/mnt/shared-storage-gpfs2/ai4neuro-share/zhuyuqing/neuro-pi-agent/.tools/node-v22.19.0/bin:$PATH pi --version
```

Current user note: the user's shell has bashrc setup and can run `pi` normally. Do not treat Node as an active blocker unless the error reappears.

### Codex

Codex was updated during this session:

```bash
codex update
```

Result:

- Updated from `codex-cli 0.142.5` to `codex-cli 0.144.1`
- Installer requested restarting Codex

Before restart, local model cache still showed:

- `gpt-5.4`
- `gpt-5.4-mini`
- `gpt-5.5`

No `gpt-5.6` was visible in the local cache at that time. After restart, if `gpt-5.6` still does not appear, likely causes are account rollout/permission rather than local CLI version.

## Files Most Relevant for Next Session

Active extension:

- `extensions/neuro/level1/index.ts`
- `extensions/neuro/level1/prompts/entry.md`
- `extensions/neuro/level1/prompts/plan.md`
- `extensions/neuro/level1/prompts/code.md`

Legacy/deploy copy:

- `internagent/pi/extensions/neuroscientist-level1/index.ts`
- `internagent/pi/extensions/neuroscientist-level1/prompts/entry.md`
- `internagent/pi/extensions/neuroscientist-level1/prompts/plan.md`
- `internagent/pi/extensions/neuroscientist-level1/prompts/code.md`

Test run:

- `results/Koninck_2025_Fig_1E/20260626-run1/`

Pending edit example:

- `results/Koninck_2025_Fig_1E/20260626-run1/pending_code_edits/edit_20260710-162956_0bcbb929/`

## Recommended Next Steps Under GPT-5.6

1. Check whether `@pi-archimedes/diff` provides a better native resource for diff display.
2. Decide whether to keep the custom ANSI formatter or replace it with the package resource.
3. Test `neuro_review_code_update` in a fresh Pi session after restarting Pi/Codex.
4. Verify color rendering in the actual TUI, not only shell output.
5. After `Yes, apply and run`, decide whether to automate script execution inside the tool or keep execution as a separate main-agent step.
6. Consider adding a small regression test for compact diff generation:
   - one-line deletion
   - one-line insertion
   - multiple separate hunks
   - large file fallback

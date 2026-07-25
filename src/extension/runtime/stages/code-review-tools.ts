import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { ReviewWorkflow, WorkflowRunContext } from "../../../workflows/index.ts";
import { applyExactCodeEdits, validationInvalidationForScope } from "../../../workflows/seekbrain/code-edit-policy.js";
import {
  createCodeReviewDetails,
  preloadDiffComponent,
  renderCodeEditCall,
  renderCodeEditResult,
  renderCodeUpdateCall,
  renderCodeUpdateResult,
} from "../../tui/code-review-tui.ts";
import { renderSeekBrainResult } from "../../tui/compact-tool-results.ts";
import { selectBinaryReview } from "../../tui/review-selectors.ts";
import { codeArtifactsFromRun, generatedArtifactsForCodeEdit, resolveEditableCodePath } from "../shared/artifact-service.ts";
import type { CodeEditService } from "../shared/code-edit-service.ts";
import { artifactStamps, unifiedDiff, writeJson, writeText } from "../shared/file-service.ts";
import type { Json, SeekBrainToolDefinition } from "../runtime-types.ts";

export interface CodeReviewToolDependencies {
  workflow: ReviewWorkflow;
  codeEditService: CodeEditService;
  resolveRun(cwd: string, runId?: string): Promise<WorkflowRunContext>;
  snapshotRunArtifacts(run: WorkflowRunContext, label: string): Promise<Json | undefined>;
  content(details: Json): any;
}

export function createCodeReviewTools(deps: CodeReviewToolDependencies): SeekBrainToolDefinition[] {
  return [
    defineTool({
      name: "seekbrain_code_edit_review",
      label: "Review Code Edit",
      description: "Prepare exact localized code edits, show a diff for approval, then apply and optionally regenerate in one tool call.",
      renderShell: "self",
      parameters: Type.Object({
        run_id: Type.String(),
        code_path: Type.Optional(Type.String({ description: "Code artifact to edit. Defaults to the single known code artifact or generated_code.py." })),
        edits: Type.Array(Type.Object({
          find: Type.String({ description: "Exact source text to replace." }),
          replace: Type.String({ description: "Replacement source text." }),
          expected_matches: Type.Optional(Type.Integer({ minimum: 1, description: "Required exact match count. Defaults to 1." })),
        }), { minItems: 1, maxItems: 20 }),
        summary: Type.Optional(Type.String({ description: "Short user-facing explanation of the change." })),
        change_scope: Type.Optional(Type.Union([
          Type.Literal("presentation"),
          Type.Literal("scientific"),
        ], { description: "Presentation-only edits invalidate visual review only; scientific edits invalidate full validation." })),
        rerun: Type.Optional(Type.Boolean({ description: "After approval, rerun a Python code artifact and verify regenerated outputs. Defaults to true." })),
      }),
      async execute(_toolCallId, params, signal, onUpdate, ctx) {
        const diffWarmup = preloadDiffComponent()
          .then(() => ({ ok: true }))
          .catch((error) => ({ ok: false, error: String(error) }));
        const run = await deps.resolveRun(ctx.cwd, params.run_id);
        const targetPath = resolveEditableCodePath(run, params.code_path);
        if (!targetPath) {
          return deps.content({
            ok: false,
            run_id: run.runId,
            error: "No editable code artifact found. Pass code_path for a code file inside the run directory.",
            code_artifacts: codeArtifactsFromRun(run),
          });
        }

        const oldCode = await readFile(targetPath, "utf8").catch(() => "");
        let editResult: { updatedCode: string; appliedEdits: Json[] };
        try {
          editResult = applyExactCodeEdits(oldCode, params.edits);
        } catch (error) {
          return deps.content({ ok: false, run_id: run.runId, code_path: targetPath, error: String(error) });
        }

        const scope = params.change_scope === "presentation" ? "presentation" : "scientific";
        const rerun = params.rerun !== false;
        const editId = deps.codeEditService.createEditId();
        const pendingDir = join(run.runDir, "pending_code_edits", editId);
        const beforePath = join(pendingDir, `before_${basename(targetPath)}`);
        const proposedPath = join(pendingDir, basename(targetPath));
        const diffPath = join(pendingDir, "diff.patch");
        const summaryPath = join(pendingDir, "summary.md");
        const executionPath = join(pendingDir, "execution.json");
        const stdoutPath = join(pendingDir, "stdout.log");
        const stderrPath = join(pendingDir, "stderr.log");
        const summary = String(params.summary || "Localized code edit proposed by SeekBrain.").trim();
        const diffText = unifiedDiff(oldCode, editResult.updatedCode, targetPath, proposedPath);
        await Promise.all([
          writeText(beforePath, oldCode),
          writeText(proposedPath, editResult.updatedCode),
          writeText(diffPath, diffText),
          writeText(summaryPath, summary),
        ]);

        const pendingEntry = {
          edit_id: editId,
          status: "proposed",
          mode: "exact_replacements",
          code_path: targetPath,
          before_path: beforePath,
          proposed_path: proposedPath,
          diff_path: diffPath,
          summary_path: summaryPath,
          summary,
          change_scope: scope,
          rerun_requested: rerun,
          edits: editResult.appliedEdits,
          created_at: new Date().toISOString(),
        };
        await deps.workflow.proposeCodeEdit(run, pendingEntry, "seekbrain_code_edit_proposed");

        const diffRenderer = await diffWarmup;
        const reviewDetails = createCodeReviewDetails({
          codePath: targetPath,
          diffPath,
          summary,
          oldCode,
          proposedCode: editResult.updatedCode,
          extra: { diffRenderer },
        });
        onUpdate?.({
          content: [{ type: "text", text: `Review pending code edit for ${targetPath}. Full patch: ${diffPath}` }],
          details: reviewDetails,
        });

        const selection = await selectBinaryReview(ctx as any, {
          title: "Apply this code edit?",
          approveLabel: rerun ? "Yes, apply and regenerate" : "Yes, apply",
          feedbackTitle: "Feedback for code edit",
          feedbackPlaceholder: "Describe what should change before applying and regenerating",
        });
        if (selection.decision === "unavailable") {
          const result = {
            ok: false,
            run_id: run.runId,
            edit_id: editId,
            diff_path: diffPath,
            needs_text_review: true,
            message: "Interactive selector is unavailable. Ask the user to approve or provide feedback in chat.",
          };
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], details: { ...reviewDetails, ...result } };
        }

        if (selection.decision === "approve") {
          const trackedArtifacts = generatedArtifactsForCodeEdit(run, targetPath, scope);
          const trackedPaths = trackedArtifacts.map((artifact) => artifact.path);
          const beforeStamps = await artifactStamps(trackedPaths);
          const snapshot = await deps.snapshotRunArtifacts(run, `before_code_edit_${editId}`);
          await writeText(targetPath, editResult.updatedCode);
          const appliedAt = new Date().toISOString();
          const appliedEntry = { ...pendingEntry, status: "applied", applied_at: appliedAt, snapshot };
          await deps.workflow.applyCodeEdit(run, editId, appliedEntry, validationInvalidationForScope(scope), "seekbrain_code_edit_apply");

          if (!rerun) {
            return deps.content({
              ok: true,
              run_id: run.runId,
              edit_id: editId,
              decision: "approve",
              status: "applied",
              code_path: targetPath,
              diff_path: diffPath,
              approved_for_execution: true,
            });
          }

          onUpdate?.({
            content: [{ type: "text", text: `Approved. Regenerating artifacts with ${basename(targetPath)}...` }],
            details: reviewDetails,
          });
          const execution = await deps.codeEditService.rerunApprovedPythonCode(targetPath, run.runDir, signal);
          await Promise.all([
            writeText(stdoutPath, String(execution.stdout || "")),
            writeText(stderrPath, String(execution.stderr || "")),
          ]);
          const afterStamps = await artifactStamps(trackedPaths);
          const artifactChecks = trackedPaths.map((path) => {
            const before = beforeStamps[path];
            const after = afterStamps[path];
            return {
              path,
              exists: Boolean(after?.exists),
              updated: Boolean(after?.exists && (!before?.exists || after.mtime_ms > before.mtime_ms)),
              before,
              after,
            };
          });
          const hasRequiredArtifacts = scope !== "presentation" || trackedPaths.length > 0;
          const verified = execution.ok === true
            && hasRequiredArtifacts
            && artifactChecks.every((check) => check.exists && check.updated);
          const status = execution.ok !== true ? "execution_failed" : verified ? "verified" : "verification_failed";
          const executionRecord = {
            command: [execution.command || process.env.SEEKBRAIN_PYTHON || "python3", targetPath],
            cwd: run.runDir,
            ok: execution.ok === true,
            exit_code: execution.exit_code ?? null,
            signal: execution.signal,
            error: execution.error,
            duration_ms: execution.duration_ms,
            stdout_path: stdoutPath,
            stderr_path: stderrPath,
            artifact_checks: artifactChecks,
            has_required_artifacts: hasRequiredArtifacts,
            verified,
            finished_at: new Date().toISOString(),
          };
          await writeJson(executionPath, executionRecord);
          const finalEntry = { ...appliedEntry, status, execution_path: executionPath, executed_at: executionRecord.finished_at };
          await deps.workflow.finalizeCodeEdit(run, editId, finalEntry, {
            event: "seekbrain_code_edit_execute",
            ok: verified,
            status,
            exit_code: executionRecord.exit_code,
            artifact_checks: artifactChecks,
          });
          return deps.content({
            ok: verified,
            run_id: run.runId,
            edit_id: editId,
            decision: "approve",
            status,
            code_path: targetPath,
            diff_path: diffPath,
            execution: executionRecord,
            artifacts: trackedArtifacts,
            guidance: verified
              ? "The approved edit was applied and regenerated artifacts were verified. Summarize the result; do not run the script again."
              : "The edit remains applied, but regeneration or artifact verification failed. Inspect execution.json and logs before retrying.",
          });
        }

        if (selection.decision === "feedback_empty") {
          return deps.content({ ok: false, run_id: run.runId, edit_id: editId, decision: "cancel", message: "No feedback was entered." });
        }
        if (selection.decision === "feedback") {
          await deps.workflow.requestCodeChanges(run, editId, selection.feedback, "code_edit_selector", "seekbrain_code_edit_feedback");
          return deps.content({
            ok: true,
            run_id: run.runId,
            edit_id: editId,
            decision: "feedback",
            feedback: selection.feedback,
            guidance: "Prepare corrected exact replacements and call seekbrain_code_edit_review again.",
          });
        }

        return deps.content({ ok: false, run_id: run.runId, edit_id: editId, decision: "cancel", message: "Code edit review was cancelled." });
      },
      renderCall: renderCodeEditCall,
      renderResult: renderCodeEditResult,
    }),
    defineTool({
      name: "seekbrain_code_update_propose",
      label: "Propose Code Update",
      description: "Create a pending code edit and diff for post-run user feedback. Does not modify the active code artifact.",
      parameters: Type.Object({
        run_id: Type.String(),
        code_path: Type.Optional(Type.String({ description: "Code artifact to update. Defaults to the single known code artifact or generated_code.py." })),
        updated_code: Type.String({ description: "Complete updated code content proposed by the main agent." }),
        summary: Type.Optional(Type.String({ description: "Short explanation of the intended code change." })),
      }),
      async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
        const run = await deps.resolveRun(ctx.cwd, params.run_id);
        const targetPath = resolveEditableCodePath(run, params.code_path);
        if (!targetPath) {
          return deps.content({
            ok: false,
            run_id: run.runId,
            error: "No editable code artifact found. Pass code_path for a code file inside the run directory.",
            code_artifacts: codeArtifactsFromRun(run),
          });
        }
        const updatedCode = String(params.updated_code || "");
        if (!updatedCode.trim()) {
          return deps.content({ ok: false, run_id: run.runId, code_path: targetPath, error: "updated_code is required" });
        }
        const oldCode = await readFile(targetPath, "utf8").catch(() => "");
        const editId = deps.codeEditService.createEditId();
        const pendingDir = join(run.runDir, "pending_code_edits", editId);
        const proposedPath = join(pendingDir, basename(targetPath));
        const diffPath = join(pendingDir, "diff.patch");
        const summaryPath = join(pendingDir, "summary.md");
        const diffText = unifiedDiff(oldCode, updatedCode, targetPath, proposedPath);
        const summary = String(params.summary || "Pending code update proposed by the main agent.").trim();
        await writeText(proposedPath, updatedCode);
        await writeText(diffPath, diffText);
        await writeText(summaryPath, summary);
        const pendingEntry = {
          edit_id: editId,
          status: "proposed",
          code_path: targetPath,
          proposed_path: proposedPath,
          diff_path: diffPath,
          summary_path: summaryPath,
          summary,
          created_at: new Date().toISOString(),
        };
        await deps.workflow.proposeCodeEdit(run, pendingEntry, "seekbrain_code_update_propose");
        return deps.content({
          ok: true,
          run_id: run.runId,
          edit_id: editId,
          code_path: targetPath,
          proposed_path: proposedPath,
          diff_path: diffPath,
          summary_path: summaryPath,
          summary,
          guidance: "Show the user the summary, then call seekbrain_code_update_review. Do not apply or execute the proposed code before approval.",
        });
      },
      renderResult: renderSeekBrainResult("seekbrain_code_update_propose"),
    }),
    defineTool({
      name: "seekbrain_code_update_review",
      label: "Review Code Update",
      description: "Display a pending code diff and ask for approval before applying post-run code changes.",
      renderShell: "self",
      parameters: Type.Object({
        run_id: Type.String(),
        edit_id: Type.Optional(Type.String({ description: "Pending code edit id. Defaults to the latest proposed edit." })),
      }),
      async execute(_toolCallId, params, _signal, onUpdate, ctx) {
        const diffWarmup = preloadDiffComponent().catch(() => undefined);
        const run = await deps.resolveRun(ctx.cwd, params.run_id);
        const entry = deps.workflow.findPending(run, params.edit_id);
        if (!entry) {
          return deps.content({ ok: false, run_id: run.runId, error: "No pending code edit found." });
        }
        const oldCode = await readFile(entry.code_path, "utf8").catch(() => "");
        const proposedCode = await readFile(entry.proposed_path, "utf8").catch(() => "");
        const summaryText = await readFile(entry.summary_path, "utf8").catch(() => entry.summary || "");
        await diffWarmup;
        const reviewDetails = createCodeReviewDetails({
          codePath: entry.code_path,
          diffPath: entry.diff_path,
          summary: summaryText,
          oldCode,
          proposedCode,
        });
        onUpdate?.({
          content: [{
            type: "text",
            text: `Review pending code update for ${entry.code_path}. Full patch: ${entry.diff_path}`,
          }],
          details: reviewDetails,
        });
        const selection = await selectBinaryReview(ctx as any, {
          title: "Apply this code update?",
          approveLabel: "Yes, apply and run",
          feedbackTitle: "Feedback for code update",
          feedbackPlaceholder: "Describe what should change before applying and running",
        });
        if (selection.decision === "unavailable") {
          const result = {
            ok: false,
            run_id: run.runId,
            edit_id: entry.edit_id,
            diff_path: entry.diff_path,
            needs_text_review: true,
            message: "Interactive selector is unavailable. Ask the user to approve or provide feedback in chat.",
          };
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
            details: { ...reviewDetails, ...result },
          };
        }
        if (selection.decision === "approve") {
          const updatedCode = await readFile(entry.proposed_path, "utf8");
          await writeText(entry.code_path, updatedCode);
          const appliedEntry = {
            ...entry,
            status: "applied",
            applied_at: new Date().toISOString(),
          };
          await deps.workflow.applyCodeEdit(run, entry.edit_id, appliedEntry, { validation_invalidated_by_code_edit: true }, "seekbrain_code_update_apply");
          return deps.content({
            ok: true,
            run_id: run.runId,
            edit_id: entry.edit_id,
            decision: "approve",
            code_path: entry.code_path,
            diff_path: entry.diff_path,
            approved_for_execution: true,
            guidance: "The code update has been applied. Run the updated script in the run directory, then rerun validation/conclusion as needed.",
          });
        }
        if (selection.decision === "feedback_empty") {
          return deps.content({
            ok: false,
            run_id: run.runId,
            edit_id: entry.edit_id,
            decision: "cancel",
            message: "No feedback was entered. Revise the proposal or call seekbrain_code_update_review again.",
          });
        }
        if (selection.decision === "feedback") {
          await deps.workflow.requestCodeChanges(run, entry.edit_id, selection.feedback, "code_update_selector", "seekbrain_code_update_feedback");
          return deps.content({
            ok: true,
            run_id: run.runId,
            edit_id: entry.edit_id,
            decision: "feedback",
            feedback: selection.feedback,
            guidance: "Revise the proposed code, call seekbrain_code_update_propose again, then call seekbrain_code_update_review again. Do not apply or execute code until approved.",
          });
        }
        return deps.content({
          ok: false,
          run_id: run.runId,
          edit_id: entry.edit_id,
          decision: "cancel",
          message: "Code update review was cancelled. Call seekbrain_code_update_review again when ready.",
        });
      },
      renderCall: renderCodeUpdateCall,
      renderResult: renderCodeUpdateResult,
    }),
  ];
}

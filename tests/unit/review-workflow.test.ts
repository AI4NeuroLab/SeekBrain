import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FileRunRepository } from "../../src/core/index.ts";
import { ReviewWorkflow, RunLifecycleWorkflow } from "../../src/workflows/index.ts";

async function fixture() {
  const cwd = await mkdtemp(join(tmpdir(), "seekbrain-review-stage-"));
  const lifecycle = new RunLifecycleWorkflow(new FileRunRepository());
  const run = await lifecycle.startRun(cwd, "run", undefined, "review task");
  const events: any[] = [];
  const workflow = new ReviewWorkflow({
    lifecycle,
    writeText: (path, value) => writeFile(path, value),
    appendEvent: async (event) => { events.push(event); },
  });
  return { cwd, lifecycle, run, events, workflow };
}

describe("review workflow", () => {
  it("records approval, feedback and a local plan revision", async () => {
    const item = await fixture();
    try {
      const approved = await item.workflow.approveStage(item.cwd, item.run.runId, " Plan ", "looks good");
      expect(approved).toMatchObject({ ok: true, stage: "plan", review: { status: "approved", notes: "looks good" } });
      const feedback = await item.workflow.recordStageFeedback(item.cwd, item.run.runId, "plan", "add controls");
      expect(feedback).toMatchObject({ ok: true, review: { status: "changes_requested" } });
      expect(feedback.review.approved_at).toBeUndefined();

      await item.lifecycle.updateState(item.run, { plan: { summary: "old", confidence: 0.5, warnings: ["old warning"], revision: 2 } });
      const updated = await item.workflow.updatePlan({ cwd: item.cwd, runId: item.run.runId, planMarkdown: "# Revised", revisionNote: "human edit" });
      expect(updated).toMatchObject({ ok: true, revision: 3, human_review: { approved: false, feedback: "1. add controls", needs_user_review: true } });
      expect(await readFile(join(item.run.runDir, "plan.md"), "utf8")).toBe("# Revised");
      const state = JSON.parse(await readFile(join(item.run.runDir, "state.json"), "utf8"));
      expect(state.plan).toMatchObject({ summary: "old", revision: 3, revision_note: "human edit", updated_by: "main_agent" });
      expect(item.events.map((event) => event.event)).toEqual(["neuro_approve_stage", "neuro_record_feedback", "neuro_update_plan"]);
    } finally {
      await rm(item.cwd, { recursive: true, force: true });
    }
  });

  it("owns pending, applied, execution and feedback code-edit transitions", async () => {
    const item = await fixture();
    try {
      const first = { edit_id: "edit-1", status: "proposed", code_path: "code.py", change_scope: "presentation" };
      await item.workflow.proposeCodeEdit(item.run, first, "proposed");
      expect(item.workflow.findPending(item.run)?.edit_id).toBe("edit-1");
      const applied = { ...first, status: "applied" };
      await item.workflow.applyCodeEdit(item.run, "edit-1", applied, { refinement_pending_validation: true }, "applied");
      const final = { ...applied, status: "verified" };
      await item.workflow.finalizeCodeEdit(item.run, "edit-1", final, { event: "executed", ok: true });

      const second = { edit_id: "edit-2", status: "proposed", code_path: "code.py" };
      await item.workflow.proposeCodeEdit(item.run, second, "proposed");
      await item.workflow.requestCodeChanges(item.run, "edit-2", "keep labels", "selector", "feedback");
      const state = JSON.parse(await readFile(join(item.run.runDir, "state.json"), "utf8"));
      expect(state.pending_code_edits.find((entry: any) => entry.edit_id === "edit-1").status).toBe("verified");
      expect(state.applied_code_edits[0].status).toBe("verified");
      expect(state.refinement_pending_validation).toBe(true);
      expect(state.pending_code_edits.find((entry: any) => entry.edit_id === "edit-2")).toMatchObject({ status: "changes_requested", feedback: [{ text: "keep labels", source: "selector" }] });
      expect(item.events.map((event) => event.event)).toEqual(["proposed", "applied", "executed", "proposed", "feedback"]);
    } finally {
      await rm(item.cwd, { recursive: true, force: true });
    }
  });
});

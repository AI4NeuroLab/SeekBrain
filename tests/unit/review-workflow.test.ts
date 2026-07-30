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
  it("persists an explicit terminal stop without interpreting feedback text", async () => {
    const item = await fixture();
    try {
      const review = await item.workflow.stop(item.run, "plan", "Researcher stopped at Plan review");
      expect(review).toMatchObject({ status: "cancelled_by_user", notes: "Researcher stopped at Plan review" });
      const state = JSON.parse(await readFile(join(item.run.runDir, "state.json"), "utf8"));
      expect(state).toMatchObject({
        workflow_status: "cancelled_by_user",
        human_reviews: { plan: { status: "cancelled_by_user" } },
        cancellation: { stage: "plan", source: "review_selector" },
      });
      expect(item.events.map((event) => event.event)).toEqual(["seekbrain_workflow_cancelled"]);
    } finally {
      await rm(item.cwd, { recursive: true, force: true });
    }
  });

  it("records approval, feedback and a local plan revision", async () => {
    const item = await fixture();
    try {
      const approved = await item.workflow.approveStage(item.cwd, item.run.runId, " Plan ", "looks good");
      expect(approved).toMatchObject({ ok: true, stage: "plan", review: { status: "approved", notes: "looks good" } });
      const feedback = await item.workflow.recordStageFeedback(item.cwd, item.run.runId, "plan", "add controls");
      expect(feedback).toMatchObject({ ok: true, review: { status: "changes_requested" } });
      expect(feedback.review.approved_at).toBeUndefined();

      await writeFile(join(item.run.runDir, "plan.md"), "# Original");
      await item.lifecycle.updateState(item.run, { plan: { review_summary: "old", warnings: ["old warning"], revision: 2 } });
      const updated = await item.workflow.updatePlan({ cwd: item.cwd, runId: item.run.runId, planMarkdown: "# Revised", revisionNote: "human edit" });
      expect(updated).toMatchObject({ ok: true, revision: 3, human_review: { approved: false, feedback: "1. add controls", needs_user_review: true } });
      expect(await readFile(join(item.run.runDir, "plan.md"), "utf8")).toBe("# Revised");
      expect(JSON.parse(await readFile(join(item.run.runDir, "plan.previous.json"), "utf8"))).toMatchObject({ plan_markdown: "# Original", revision: 2 });
      const state = JSON.parse(await readFile(join(item.run.runDir, "state.json"), "utf8"));
      expect(state.plan).toMatchObject({ review_summary: "old", path: join(item.run.runDir, "plan.md"), revision: 3, revision_note: "human edit", updated_by: "main_agent" });
      expect(state.plan.plan_markdown).toBeUndefined();
      expect(item.events.map((event) => event.event)).toEqual(["seekbrain_review_approve", "seekbrain_review_feedback", "seekbrain_formulation_update"]);
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

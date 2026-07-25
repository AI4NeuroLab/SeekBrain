import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { atomicWriteJson, FileRunRepository } from "../../src/core/index.ts";
import { CodeWorkflow, RunLifecycleWorkflow } from "../../src/workflows/index.ts";

async function fixture() {
  const cwd = await mkdtemp(join(tmpdir(), "seekbrain-code-stage-"));
  const lifecycle = new RunLifecycleWorkflow(new FileRunRepository());
  const run = await lifecycle.startRun(cwd, "run", undefined, "compare 120 neurons");
  return { cwd, lifecycle, run };
}

describe("code workflow", () => {
  it("blocks before invoking the coder when plan approval is required", async () => {
    const item = await fixture();
    try {
      let invoked = false;
      const workflow = new CodeWorkflow({
        lifecycle: item.lifecycle,
        retryPolicy: () => ({ allowed: true, reason: "initial_attempt", previousAttempt: 0, feedback: "" }),
        runAgent: async () => { invoked = true; return { ok: false }; },
        writeText: (path, value) => writeFile(path, value),
        writeJson: atomicWriteJson,
        snapshot: async () => undefined,
        appendEvent: async () => undefined,
      });
      const result = await workflow.execute({
        cwd: item.cwd,
        runId: item.run.runId,
        rolePrompt: "coder role",
        agentConfig: {},
        finalizeSchema: {},
        planReviewRequired: true,
        maxAttempts: 3,
      });
      expect(invoked).toBe(false);
      expect(result).toMatchObject({ ok: false, blocked_by_human_review: true, required_stage: "plan", status: "pending_review" });
    } finally {
      await rm(item.cwd, { recursive: true, force: true });
    }
  });

  it("persists coder artifacts and deterministic checks through injected ports", async () => {
    const item = await fixture();
    try {
      const events: any[] = [];
      const snapshots: string[] = [];
      let capturedPrompt = "";
      let capturedAfterToolCall: unknown;
      const afterToolCall = async () => undefined;
      const workflow = new CodeWorkflow({
        lifecycle: item.lifecycle,
        retryPolicy: () => ({ allowed: true, reason: "initial_attempt", previousAttempt: 0, feedback: "" }),
        runAgent: async ({ runDir, prompt, afterToolCall: handler }) => {
          capturedPrompt = prompt;
          capturedAfterToolCall = handler;
          await writeFile(join(runDir, "generated_code.py"), "print('real data')\n");
          await writeFile(join(runDir, "figure.png"), "png");
          await writeFile(join(runDir, "statistics.json"), JSON.stringify({ n_neurons: 120, detailed_metric: 3.5 }));
          return {
            ok: true,
            result: {
              code_files: [{ path: "generated_code.py" }],
              exec_log: "completed",
              statistics: { n_neurons: 120 },
              artifacts: [{ path: "figure.png", kind: "figure", role: "main", produced_by: "generated_code.py" }],
              summary: "generated",
              warnings: [],
            },
            output_path: "output.json",
          };
        },
        writeText: (path, value) => writeFile(path, value),
        writeJson: atomicWriteJson,
        snapshot: async (_run, label) => { snapshots.push(label); },
        appendEvent: async (event) => { events.push(event); },
      });
      const result = await workflow.execute({
        cwd: item.cwd,
        runId: item.run.runId,
        rolePrompt: "coder role",
        agentConfig: {},
        finalizeSchema: {},
        planReviewRequired: false,
        maxAttempts: 3,
        afterToolCall,
      });

      expect(capturedPrompt).toContain("Question:\ncompare 120 neurons");
      expect(capturedPrompt).toContain("Required final tool: finalize_code_result");
      expect(capturedAfterToolCall).toBe(afterToolCall);
      expect(await readFile(join(item.run.runDir, "exec.log"), "utf8")).toBe("completed");
      const statistics = JSON.parse(await readFile(join(item.run.runDir, "statistics.json"), "utf8"));
      expect(statistics.n_neurons).toBe(120);
      expect(statistics.detailed_metric).toBe(3.5);
      const state = JSON.parse(await readFile(join(item.run.runDir, "state.json"), "utf8"));
      expect(state.code_attempt).toBe(1);
      expect(state.code.code_files).toEqual([{ path: "generated_code.py" }]);
      expect(state.code.statistics.detailed_metric).toBe(3.5);
      expect(state.artifacts.some((artifact: any) => artifact.kind === "code")).toBe(true);
      expect(result).toMatchObject({ ok: true, code_attempt: 1, blocked_by_dummy_data: false, next_step: { tool: "seekbrain_validation_run" } });
      expect(events[0]).toMatchObject({ event: "seekbrain_code_execute", code_attempt: 1 });
      expect(snapshots).toEqual(["after_code_attempt_1"]);
    } finally {
      await rm(item.cwd, { recursive: true, force: true });
    }
  });
});
